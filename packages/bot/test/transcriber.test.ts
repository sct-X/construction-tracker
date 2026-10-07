/**
 * Transcribers: the argv WhisperCppTranscriber builds for ffmpeg and whisper.cpp (mock spawn, no shell),
 * the OpenAI request CloudTranscriber sends (fake fetch), env selection, and the priming prompt.
 * One test converts the real OGG fixture with ffmpeg when ffmpeg is installed.
 */
import { spawnSync } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CloudTranscriber,
  ffmpegArgs,
  runProgram,
  transcriberFromEnv,
  transcriptionPrompt,
  TranscriptionError,
  WhisperCppTranscriber,
  type SpawnLike,
} from '../src/index.js';

const FIXTURE_OGG = new URL('./fixtures/voice.ogg', import.meta.url);

interface SpawnCall {
  command: string;
  args: string[];
  options: unknown;
}

/** A mock spawn: records each call, then `behave` decides the exit code (and may write files). */
function mockSpawn(behave: (c: SpawnCall) => { code?: number; stdout?: string; stderr?: string; error?: NodeJS.ErrnoException }) {
  const calls: SpawnCall[] = [];
  const spawn: SpawnLike = (command, args, options) => {
    const call = { command, args: [...args], options };
    calls.push(call);
    const child = new EventEmitter() as EventEmitter & { stdout: EventEmitter; stderr: EventEmitter; kill(): void };
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.kill = () => undefined;
    setImmediate(() => {
      const r = behave(call);
      if (r.error) {
        child.emit('error', r.error);
        return;
      }
      if (r.stdout) child.stdout.emit('data', Buffer.from(r.stdout));
      if (r.stderr) child.stderr.emit('data', Buffer.from(r.stderr));
      child.emit('close', r.code ?? 0, null);
    });
    return child as never;
  };
  return { spawn, calls };
}

let work: string;
beforeEach(() => {
  work = mkdtempSync(join(tmpdir(), 'ct-tr-'));
});
afterEach(() => rmSync(work, { recursive: true, force: true }));

describe('WhisperCppTranscriber', () => {
  it('runs ffmpeg (OGG -> 16 kHz mono WAV) then whisper-cli with --prompt and plain-text output, args arrays, no shell', async () => {
    const input = join(work, 'voice note.oga');
    writeFileSync(input, 'ogg');
    const { spawn, calls } = mockSpawn((c) => {
      if (c.command.endsWith('whisper-cli')) {
        const outBase = c.args[c.args.indexOf('-of') + 1]!;
        writeFileSync(`${outBase}.txt`, '  Slab inspection at Seaview\n is done. [BLANK_AUDIO]\n');
      }
      return { code: 0 };
    });
    const t = new WhisperCppTranscriber({ modelPath: '/models/ggml-base.en.bin', ffmpegBin: '/opt/bin/ffmpeg', whisperBin: 'whisper-cli', spawn, tmpDir: work, threads: 4 });
    const prompt = 'Jobs: Seaview St. Terms: hold point, lock-up.';
    const r = await t.transcribe(input, { prompt, language: 'en' });
    expect(r.text).toBe('Slab inspection at Seaview is done.');

    expect(calls).toHaveLength(2);
    const [ff, wh] = calls;
    expect(ff!.command).toBe('/opt/bin/ffmpeg');
    const wav = ff!.args.at(-1)!;
    expect(wav).toMatch(/voice note\.wav$/);
    expect(ff!.args).toEqual(['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', '-i', input, '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', wav]);
    expect(ff!.options).toMatchObject({ shell: false, windowsHide: true });

    expect(wh!.command).toBe('whisper-cli');
    const outBase = wh!.args[wh!.args.indexOf('-of') + 1]!;
    expect(wh!.args).toEqual(['-m', '/models/ggml-base.en.bin', '-f', wav, '-l', 'en', '--prompt', prompt, '-nt', '-np', '-otxt', '-of', outBase, '-t', '4']);
    expect(wh!.options).toMatchObject({ shell: false });
    // The prompt is one argv entry (spaces, commas and all): nothing for a shell to split.
    expect(wh!.args.filter((a) => a === prompt)).toHaveLength(1);
    // The temporary folder (WAV, text) is cleaned up; the input is left alone.
    expect(existsSync(join(outBase, '..'))).toBe(false);
    expect(existsSync(input)).toBe(true);
  });

  it('defaults to "ffmpeg" and "whisper-cli" on PATH', async () => {
    const { spawn, calls } = mockSpawn(() => ({ code: 0, stdout: 'hello' }));
    const t = new WhisperCppTranscriber({ modelPath: 'm.bin', spawn, tmpDir: work });
    expect((await t.transcribe(join(work, 'a.ogg'), { prompt: 'p' })).text).toBe('hello'); // no .txt: stdout
    expect(calls.map((c) => c.command)).toEqual(['ffmpeg', 'whisper-cli']);
  });

  it('a failing ffmpeg stops before whisper with a TranscriptionError naming it', async () => {
    const { spawn, calls } = mockSpawn(() => ({ code: 1, stderr: 'Invalid data found when processing input' }));
    const t = new WhisperCppTranscriber({ modelPath: 'm.bin', spawn, tmpDir: work });
    await expect(t.transcribe(join(work, 'a.ogg'), { prompt: 'p' })).rejects.toThrow(/ffmpeg exited with 1: Invalid data/);
    expect(calls).toHaveLength(1);
  });

  it('a missing program is reported plainly (ENOENT)', async () => {
    const err = Object.assign(new Error('spawn whisper-cli ENOENT'), { code: 'ENOENT' });
    const { spawn } = mockSpawn((c) => (c.command === 'whisper-cli' ? { error: err } : { code: 0 }));
    const t = new WhisperCppTranscriber({ modelPath: 'm.bin', spawn, tmpDir: work });
    const p = t.transcribe(join(work, 'a.ogg'), { prompt: 'p' });
    await expect(p).rejects.toBeInstanceOf(TranscriptionError);
    await expect(p).rejects.toThrow('whisper-cli was not found (is it installed and on PATH?)');
  });

  it.skipIf(spawnSync('ffmpeg', ['-version']).status !== 0)('real ffmpeg turns the OGG fixture into a 16 kHz mono WAV with these args', async () => {
    const { spawn } = await import('node:child_process');
    const wav = join(work, 'out.wav');
    const r = await runProgram(spawn as unknown as SpawnLike, 'ffmpeg', ffmpegArgs(fileURLToPath(FIXTURE_OGG), wav), 30_000);
    expect(r.code, r.stderr).toBe(0);
    const head = readFileSync(wav).subarray(0, 44);
    expect(head.toString('ascii', 0, 4)).toBe('RIFF');
    expect(head.readUInt16LE(22)).toBe(1); // mono
    expect(head.readUInt32LE(24)).toBe(16000); // 16 kHz
    expect(head.readUInt16LE(34)).toBe(16); // 16-bit
    expect(statSync(wav).size).toBeGreaterThan(44);
  });
});

describe('CloudTranscriber', () => {
  it('posts the file, model and prompt to OpenAI audio transcriptions with the key in the header', async () => {
    const file = join(work, 'v.oga');
    writeFileSync(file, Buffer.from([1, 2, 3]));
    const seen: { url: string; init: RequestInit }[] = [];
    const fetch = (async (url: string, init: RequestInit) => {
      seen.push({ url, init });
      return new Response(JSON.stringify({ text: ' Park Rd windows\nnow 16 Nov ' }), { status: 200 });
    }) as unknown as typeof globalThis.fetch;
    const t = new CloudTranscriber({ apiKey: 'sk-test', fetch });
    expect(t.name).toBe('openai gpt-4o-mini-transcribe');
    const r = await t.transcribe(file, { prompt: 'Jobs: Park Rd.' });
    expect(r.text).toBe('Park Rd windows now 16 Nov');
    expect(seen[0]!.url).toBe('https://api.openai.com/v1/audio/transcriptions');
    expect(seen[0]!.url).not.toContain('sk-test');
    expect((seen[0]!.init.headers as Record<string, string>).Authorization).toBe('Bearer sk-test');
    const form = seen[0]!.init.body as FormData;
    expect(form.get('model')).toBe('gpt-4o-mini-transcribe');
    expect(form.get('prompt')).toBe('Jobs: Park Rd.');
    expect(form.get('language')).toBe('en');
    const sent = form.get('file') as File;
    expect(sent.name).toBe('voice.ogg'); // Telegram's .oga sent as .ogg
    expect(new Uint8Array(await sent.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
  });

  it('an error status becomes a TranscriptionError', async () => {
    const file = join(work, 'v.ogg');
    writeFileSync(file, 'x');
    const fetch = (async () => new Response('{"error":{"message":"bad key"}}', { status: 401 })) as unknown as typeof globalThis.fetch;
    await expect(new CloudTranscriber({ apiKey: 'k', model: 'whisper-1', fetch }).transcribe(file, { prompt: '' })).rejects.toThrow(/answered 401/);
  });
});

describe('transcriberFromEnv', () => {
  it('local needs WHISPER_MODEL_PATH; cloud needs a key; unset is off unless a model path is set; never cloud by itself', () => {
    expect(transcriberFromEnv({})).toEqual({ ok: false, reason: 'TRANSCRIBER is not set (local or cloud)' });
    expect(transcriberFromEnv({ TRANSCRIBER: 'local' })).toMatchObject({ ok: false, reason: expect.stringContaining('WHISPER_MODEL_PATH') });
    const local = transcriberFromEnv({ TRANSCRIBER: 'local', WHISPER_MODEL_PATH: '/m.bin', FFMPEG_BIN: 'C:\\ffmpeg\\bin\\ffmpeg.exe' });
    expect(local).toMatchObject({ ok: true, description: 'whisper.cpp (whisper-cli, model /m.bin, C:\\ffmpeg\\bin\\ffmpeg.exe)' });
    expect(transcriberFromEnv({ WHISPER_MODEL_PATH: '/m.bin' })).toMatchObject({ ok: true });
    expect(transcriberFromEnv({ OPENAI_API_KEY: 'k' })).toMatchObject({ ok: false });
    expect(transcriberFromEnv({ TRANSCRIBER: 'cloud' })).toMatchObject({ ok: false, reason: expect.stringContaining('OPENAI_API_KEY') });
    expect(transcriberFromEnv({ TRANSCRIBER: 'cloud', OPENAI_API_KEY: 'k', TRANSCRIBE_MODEL: 'whisper-1' })).toMatchObject({ ok: true, description: 'OpenAI whisper-1' });
    expect(transcriberFromEnv({ TRANSCRIBER: 'Cloud', OPENAI_API_KEY: 'k' })).toMatchObject({ ok: true, description: 'OpenAI gpt-4o-mini-transcribe' });
    expect(transcriberFromEnv({ TRANSCRIBER: 'azure' })).toMatchObject({ ok: false, reason: expect.stringContaining('"local" or "cloud"') });
  });
});

describe('transcriptionPrompt', () => {
  it('names the jobs, the site terms and as many trades as fit', () => {
    const trades = Array.from({ length: 80 }, (_, i) => `Trade number ${i}`);
    const p = transcriptionPrompt({ jobs: ['Park Rd', 'Seaview St', 'Park Rd'], trades });
    expect(p).toMatch(/^Construction site update\. Jobs: Park Rd, Seaview St\. Terms: lock-up, hold point, before-cover, OC, PC, practical completion, slab, frame, fit-off, rough-in\. Trades: Trade number 0, /);
    expect(p.length).toBeLessThanOrEqual(700);
  });
});
