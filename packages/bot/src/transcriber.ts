/**
 * Voice notes to text. One interface, three implementations:
 *  - WhisperCppTranscriber: local, offline. ffmpeg turns Telegram's OGG/Opus
 *    into 16 kHz mono WAV, then whisper.cpp's CLI writes plain text. Both run
 *    through child_process.spawn with an args array (no shell), so the same
 *    code runs on macOS, Windows and Linux.
 *  - CloudTranscriber: OpenAI's audio transcriptions endpoint over fetch.
 *  - FakeTranscriber: scripted, for tests.
 * Chosen by TRANSCRIBER=local|cloud (see transcriberFromEnv).
 */
import { spawn as nodeSpawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, extname, join } from 'node:path';

export interface TranscribeOptions {
  /** Priming text: job names, trade names, site terms (see transcriptionPrompt). */
  prompt: string;
  language?: 'en';
}

export interface Transcriber {
  /** A short name for logs ("whisper.cpp", "openai gpt-4o-mini-transcribe", "fake"). */
  readonly name?: string;
  transcribe(audioFile: string, opts: TranscribeOptions): Promise<{ text: string }>;
}

/** Thrown when a transcriber can't produce text. The message is for the log, not for Dominic. */
export class TranscriptionError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'TranscriptionError';
  }
}

// ---------------------------------------------------------------------------
// Priming prompt
// ---------------------------------------------------------------------------

/** Site words Whisper tends to mishear without a hint. */
export const SITE_TERMS = [
  'lock-up',
  'hold point',
  'before-cover',
  'OC',
  'PC',
  'practical completion',
  'slab',
  'frame',
  'fit-off',
  'rough-in',
];

/** Whisper reads at most ~224 prompt tokens; stay well under. */
const MAX_PROMPT_CHARS = 700;

/**
 * "Construction site update. Jobs: Park Rd, Seaview St, ... Trades: ... Terms: lock-up, hold point, ..."
 * Terms come first after the jobs so a long trade list can't push them out.
 */
export function transcriptionPrompt(input: { jobs: string[]; trades: string[]; terms?: string[] }): string {
  const uniq = (xs: string[]) => [...new Set(xs.map((x) => x.trim()).filter(Boolean))];
  const jobs = `Jobs: ${uniq(input.jobs).join(', ')}.`;
  const terms = `Terms: ${uniq(input.terms ?? SITE_TERMS).join(', ')}.`;
  let text = `Construction site update. ${jobs} ${terms}`;
  const trades = uniq(input.trades);
  if (trades.length) {
    const room = MAX_PROMPT_CHARS - text.length - ' Trades: .'.length;
    const kept: string[] = [];
    let used = 0;
    for (const t of trades) {
      if (used + t.length + 2 > room) break;
      kept.push(t);
      used += t.length + 2;
    }
    if (kept.length) text += ` Trades: ${kept.join(', ')}.`;
  }
  return text.length > MAX_PROMPT_CHARS ? text.slice(0, MAX_PROMPT_CHARS) : text;
}

// ---------------------------------------------------------------------------
// Running a program (spawn, args array, no shell)
// ---------------------------------------------------------------------------

/** The slice of child_process.spawn the transcriber uses, so tests can mock it. */
export type SpawnLike = (
  command: string,
  args: readonly string[],
  options: { stdio: ['ignore', 'pipe', 'pipe']; windowsHide: boolean; shell: false },
) => ChildLike;

export interface ChildLike {
  stdout: { on(event: 'data', cb: (chunk: Buffer | string) => void): unknown } | null;
  stderr: { on(event: 'data', cb: (chunk: Buffer | string) => void): unknown } | null;
  on(event: 'error', cb: (err: Error) => void): unknown;
  on(event: 'close', cb: (code: number | null, signal: NodeJS.Signals | null) => void): unknown;
  kill(signal?: NodeJS.Signals): unknown;
}

export interface RunResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

export async function runProgram(spawn: SpawnLike, command: string, args: string[], timeoutMs: number): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    let child: ChildLike;
    try {
      child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true, shell: false });
    } catch (e) {
      reject(e);
      return;
    }
    let stdout = '';
    let stderr = '';
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGKILL');
      reject(new TranscriptionError(`${basename(command)} took longer than ${Math.round(timeoutMs / 1000)} s`));
    }, timeoutMs);
    child.stdout?.on('data', (c) => (stdout += String(c)));
    child.stderr?.on('data', (c) => (stderr += String(c)));
    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const code = (err as NodeJS.ErrnoException).code;
      reject(new TranscriptionError(code === 'ENOENT' ? `${command} was not found (is it installed and on PATH?)` : `${command} failed to start: ${err.message}`, err));
    });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });
}

const tail = (s: string, n = 400) => (s.length > n ? `…${s.slice(-n)}` : s).trim();

/** Collapses whisper's line breaks and stray spaces into one line of text. */
export function cleanTranscript(raw: string): string {
  return raw
    .replace(/\[(BLANK_AUDIO|MUSIC|NOISE|SOUND|SILENCE)\]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------------------------------------------------------------------------
// whisper.cpp
// ---------------------------------------------------------------------------

export interface WhisperCppOptions {
  /** whisper.cpp's CLI. Default "whisper-cli" (WHISPER_CPP_BIN). */
  whisperBin?: string;
  /** ggml model file, e.g. ggml-base.en.bin (WHISPER_MODEL_PATH). Required. */
  modelPath: string;
  /** Default "ffmpeg" (FFMPEG_BIN). */
  ffmpegBin?: string;
  /** whisper.cpp threads. Default: whisper's own default. */
  threads?: number;
  /** Per program. Default 120 s. */
  timeoutMs?: number;
  /** Tests: a mock spawn. */
  spawn?: SpawnLike;
  /** Where the WAV and text go while working. Default the OS temp folder. */
  tmpDir?: string;
}

/** ffmpeg: any input (Telegram OGG/Opus, m4a, mp3) -> 16 kHz mono 16-bit WAV, what whisper.cpp reads. */
export function ffmpegArgs(input: string, wavOut: string): string[] {
  return ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', '-i', input, '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', wavOut];
}

/** whisper.cpp CLI: plain text (no timestamps) written to `<outBase>.txt`. */
export function whisperArgs(o: { modelPath: string; wav: string; outBase: string; prompt: string; language?: string; threads?: number }): string[] {
  const args = ['-m', o.modelPath, '-f', o.wav, '-l', o.language ?? 'en', '--prompt', o.prompt, '-nt', '-np', '-otxt', '-of', o.outBase];
  if (o.threads) args.push('-t', String(o.threads));
  return args;
}

export class WhisperCppTranscriber implements Transcriber {
  readonly name = 'whisper.cpp';
  private readonly spawn: SpawnLike;
  constructor(private readonly o: WhisperCppOptions) {
    this.spawn = o.spawn ?? (nodeSpawn as unknown as SpawnLike);
  }

  async transcribe(audioFile: string, opts: TranscribeOptions): Promise<{ text: string }> {
    const ffmpeg = this.o.ffmpegBin || 'ffmpeg';
    const whisper = this.o.whisperBin || 'whisper-cli';
    const timeout = this.o.timeoutMs ?? 120_000;
    const work = await mkdtemp(join(this.o.tmpDir ?? tmpdir(), 'ct-voice-'));
    try {
      const stem = basename(audioFile, extname(audioFile)) || 'voice';
      const wav = join(work, `${stem}.wav`);
      const conv = await runProgram(this.spawn, ffmpeg, ffmpegArgs(audioFile, wav), timeout);
      if (conv.code !== 0) throw new TranscriptionError(`ffmpeg exited with ${conv.code}: ${tail(conv.stderr)}`);
      const outBase = join(work, stem);
      const args = whisperArgs({ modelPath: this.o.modelPath, wav, outBase, prompt: opts.prompt, language: opts.language ?? 'en', ...(this.o.threads ? { threads: this.o.threads } : {}) });
      const run = await runProgram(this.spawn, whisper, args, timeout);
      if (run.code !== 0) throw new TranscriptionError(`${basename(whisper)} exited with ${run.code}: ${tail(run.stderr)}`);
      // -otxt writes <outBase>.txt; fall back to stdout for builds that only print.
      const raw = await readFile(`${outBase}.txt`, 'utf8').catch(() => run.stdout);
      return { text: cleanTranscript(raw) };
    } finally {
      await rm(work, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}

// ---------------------------------------------------------------------------
// Cloud (OpenAI audio transcriptions)
// ---------------------------------------------------------------------------

export const DEFAULT_TRANSCRIBE_MODEL = 'gpt-4o-mini-transcribe';

export interface CloudTranscriberOptions {
  apiKey: string;
  /** Default gpt-4o-mini-transcribe (TRANSCRIBE_MODEL). */
  model?: string;
  /** Default https://api.openai.com/v1 (TRANSCRIBE_BASE_URL). */
  baseUrl?: string;
  fetch?: typeof fetch;
  /** Default 60 s. */
  timeoutMs?: number;
}

const AUDIO_TYPES: Record<string, string> = {
  '.ogg': 'audio/ogg',
  '.oga': 'audio/ogg',
  '.opus': 'audio/ogg',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.mp4': 'audio/mp4',
  '.wav': 'audio/wav',
  '.webm': 'audio/webm',
};

export class CloudTranscriber implements Transcriber {
  readonly name: string;
  private readonly model: string;
  constructor(private readonly o: CloudTranscriberOptions) {
    this.model = o.model || DEFAULT_TRANSCRIBE_MODEL;
    this.name = `openai ${this.model}`;
  }

  async transcribe(audioFile: string, opts: TranscribeOptions): Promise<{ text: string }> {
    const doFetch = this.o.fetch ?? fetch;
    const base = (this.o.baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');
    const data = await readFile(audioFile);
    let ext = extname(audioFile).toLowerCase();
    // OpenAI reads the format from the file name; Telegram's ".oga" is plain Ogg.
    if (ext === '.oga' || ext === '.opus') ext = '.ogg';
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(data)], { type: AUDIO_TYPES[ext] ?? 'application/octet-stream' }), `voice${ext || '.ogg'}`);
    form.append('model', this.model);
    form.append('prompt', opts.prompt);
    form.append('language', opts.language ?? 'en');
    form.append('response_format', 'json');
    let res: Response;
    try {
      res = await doFetch(`${base}/audio/transcriptions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.o.apiKey}` },
        body: form,
        signal: AbortSignal.timeout(this.o.timeoutMs ?? 60_000),
      });
    } catch (e) {
      throw new TranscriptionError(`Transcription request failed: ${e instanceof Error ? e.message : String(e)}`, e);
    }
    const body = await res.text();
    if (!res.ok) throw new TranscriptionError(`Transcription API answered ${res.status}: ${tail(body, 300)}`);
    let text: unknown;
    try {
      text = (JSON.parse(body) as { text?: unknown }).text;
    } catch {
      text = body;
    }
    if (typeof text !== 'string') throw new TranscriptionError('Transcription API gave no text');
    return { text: cleanTranscript(text) };
  }
}

// ---------------------------------------------------------------------------
// Fake (tests)
// ---------------------------------------------------------------------------

export type FakeTranscript = string | Error | ((audioFile: string, opts: TranscribeOptions) => string);

/** Returns scripted transcripts in order (an Error entry is thrown). Records every call. */
export class FakeTranscriber implements Transcriber {
  readonly name = 'fake';
  readonly calls: { audioFile: string; opts: TranscribeOptions }[] = [];
  private readonly script: FakeTranscript[];
  constructor(script: FakeTranscript[] | string) {
    this.script = typeof script === 'string' ? [script] : [...script];
  }
  get remaining(): number {
    return this.script.length;
  }
  async transcribe(audioFile: string, opts: TranscribeOptions): Promise<{ text: string }> {
    this.calls.push({ audioFile, opts });
    const next = this.script.shift();
    if (next === undefined) throw new Error('FakeTranscriber: script exhausted');
    if (next instanceof Error) throw next;
    return { text: typeof next === 'function' ? next(audioFile, opts) : next };
  }
}

// ---------------------------------------------------------------------------
// From env
// ---------------------------------------------------------------------------

export type TranscriberChoice = { ok: true; transcriber: Transcriber; description: string } | { ok: false; reason: string };

/**
 * TRANSCRIBER=local: whisper.cpp (WHISPER_CPP_BIN default "whisper-cli", WHISPER_MODEL_PATH required, FFMPEG_BIN
 * default "ffmpeg", WHISPER_THREADS optional). TRANSCRIBER=cloud: OpenAI (TRANSCRIBE_API_KEY or OPENAI_API_KEY,
 * TRANSCRIBE_MODEL default gpt-4o-mini-transcribe, TRANSCRIBE_BASE_URL optional). Unset: local when
 * WHISPER_MODEL_PATH is set, else off. Never picks the cloud on its own: audio leaves the machine only when asked.
 */
export function transcriberFromEnv(env: Record<string, string | undefined>, o: { fetch?: typeof fetch; spawn?: SpawnLike } = {}): TranscriberChoice {
  const mode = (env.TRANSCRIBER?.trim().toLowerCase() || (env.WHISPER_MODEL_PATH?.trim() ? 'local' : '')) as string;
  if (!mode) return { ok: false, reason: 'TRANSCRIBER is not set (local or cloud)' };
  if (mode === 'local') {
    const modelPath = env.WHISPER_MODEL_PATH?.trim();
    if (!modelPath) return { ok: false, reason: 'TRANSCRIBER=local but WHISPER_MODEL_PATH is not set (the ggml model file)' };
    const threads = Number(env.WHISPER_THREADS);
    const whisperBin = env.WHISPER_CPP_BIN?.trim() || 'whisper-cli';
    const ffmpegBin = env.FFMPEG_BIN?.trim() || 'ffmpeg';
    return {
      ok: true,
      transcriber: new WhisperCppTranscriber({
        modelPath,
        whisperBin,
        ffmpegBin,
        ...(Number.isInteger(threads) && threads > 0 ? { threads } : {}),
        ...(o.spawn ? { spawn: o.spawn } : {}),
      }),
      description: `whisper.cpp (${whisperBin}, model ${modelPath}, ${ffmpegBin})`,
    };
  }
  if (mode === 'cloud') {
    const apiKey = (env.TRANSCRIBE_API_KEY || env.OPENAI_API_KEY)?.trim();
    if (!apiKey) return { ok: false, reason: 'TRANSCRIBER=cloud but neither TRANSCRIBE_API_KEY nor OPENAI_API_KEY is set' };
    const model = env.TRANSCRIBE_MODEL?.trim() || DEFAULT_TRANSCRIBE_MODEL;
    const baseUrl = env.TRANSCRIBE_BASE_URL?.trim();
    return {
      ok: true,
      transcriber: new CloudTranscriber({ apiKey, model, ...(baseUrl ? { baseUrl } : {}), ...(o.fetch ? { fetch: o.fetch } : {}) }),
      description: `OpenAI ${model}`,
    };
  }
  return { ok: false, reason: `TRANSCRIBER must be "local" or "cloud", got "${env.TRANSCRIBER}"` };
}
