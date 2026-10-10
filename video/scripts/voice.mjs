// Speaks the narration with macOS `say` (one file per sentence), then joins each scene's sentences into
// assets/voice/<scene>.wav with a short lead-in and a pause after every sentence. Writes
// assets/voice/manifest.json: each sentence's start and end in the scene, so cues can follow the words.
// Run from video/:  node scripts/voice.mjs   (VOICE=Karen RATE=100 by default; sentences are cached by text)
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scenes } from '../scenes.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'assets', 'voice');
const CACHE = path.join(OUT, 'cache');
mkdirSync(CACHE, { recursive: true });

const VOICE = process.env.VOICE ?? 'Karen'; // en_AU
const RATE = process.env.RATE ?? '100';
const FFMPEG = process.env.FFMPEG ?? '/opt/homebrew/bin/ffmpeg';
const SR = 48000;
const LEAD = 0.5; // silence before the first sentence
const GAP = 0.45; // pause after each sentence

// Words the voice gets wrong, spelt the way it should say them. Captions keep the real spelling.
const SAY_AS = [
  [/\bGantt\b/g, 'Gant'],
  [/\bETA\b/g, 'E.T.A.'],
];

/** Raw mono 16-bit PCM at SR for one sentence. */
function sentencePcm(text) {
  let spoken = text;
  for (const [re, to] of SAY_AS) spoken = spoken.replace(re, to);
  const key = createHash('sha1').update(`${VOICE}|${RATE}|${spoken}`).digest('hex').slice(0, 16);
  const raw = path.join(CACHE, `${key}.pcm`);
  if (!existsSync(raw)) {
    const aiff = path.join(CACHE, `${key}.aiff`);
    execFileSync('say', ['-v', VOICE, '-r', RATE, '-o', aiff, spoken]);
    // Trim the voice's own leading and trailing silence so the pauses are ours.
    execFileSync(FFMPEG, [
      '-v', 'error', '-y', '-i', aiff,
      '-af', 'silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse',
      '-ar', String(SR), '-ac', '1', '-f', 's16le', raw,
    ]);
  }
  return readFileSync(raw);
}

function wav(pcm) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0);
  h.writeUInt32LE(36 + pcm.length, 4);
  h.write('WAVE', 8);
  h.write('fmt ', 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(SR, 24);
  h.writeUInt32LE(SR * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write('data', 36);
  h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

const silence = (s) => Buffer.alloc(Math.round(s * SR) * 2);
const manifest = { voice: VOICE, rate: RATE, sampleRate: SR, scenes: {} };
let words = 0;
let total = 0;
for (const sc of scenes) {
  const parts = [silence(LEAD)];
  let t = LEAD;
  const sentences = [];
  for (const text of sc.say) {
    const pcm = sentencePcm(text);
    const d = pcm.length / 2 / SR;
    sentences.push({ start: +t.toFixed(3), end: +(t + d).toFixed(3) });
    parts.push(pcm, silence(GAP));
    t += d + GAP;
    words += text.split(/\s+/).length;
  }
  const file = `${sc.id}.wav`;
  writeFileSync(path.join(OUT, file), wav(Buffer.concat(parts)));
  manifest.scenes[sc.id] = { file, sentences, voiceEnd: sentences.at(-1).end, length: +t.toFixed(3) };
  total += t;
  console.log(sc.id, `${t.toFixed(1)}s`, sentences.map((s) => (s.end - s.start).toFixed(1)).join(' '));
}
writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`${words} words, ${total.toFixed(1)}s of narration with pauses (${((words / total) * 60).toFixed(0)} words a minute)`);
