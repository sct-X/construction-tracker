// Renders both compositions locally with HyperFrames, then normalises the sound to about -16 LUFS
// (ffmpeg loudnorm, two passes; the picture is copied, not re-encoded).
//   node scripts/render.mjs            both versions
//   node scripts/render.mjs landscape  just the 1920x1080 one
// Raw renders go to renders/, finished files to out/. Telemetry is switched off.
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const FFMPEG = process.env.FFMPEG ?? '/opt/homebrew/bin/ffmpeg';
const env = { ...process.env, HYPERFRAMES_NO_TELEMETRY: '1', DO_NOT_TRACK: '1' };
const hf = path.join(ROOT, 'node_modules/.bin/hyperframes');
mkdirSync(path.join(ROOT, 'renders'), { recursive: true });
mkdirSync(path.join(ROOT, 'out'), { recursive: true });

const JOBS = {
  landscape: { dir: ROOT, raw: 'renders/landscape-raw.mp4', out: 'out/dom-tracker-guide.mp4' },
  portrait: { dir: path.join(ROOT, 'portrait'), raw: 'renders/portrait-raw.mp4', out: 'out/dom-tracker-guide-phone.mp4' },
};
const which = process.argv.slice(2);
for (const [name, job] of Object.entries(JOBS)) {
  if (which.length && !which.includes(name)) continue;
  const raw = path.join(ROOT, job.raw);
  console.log(`rendering ${name}…`);
  execFileSync(hf, ['render', job.dir, '--output', raw, '--quality', 'high'], { cwd: job.dir, env, stdio: 'inherit' });
  // loudnorm pass 1: measure
  const LN = 'loudnorm=I=-16:TP=-1.5:LRA=11';
  const err = execFileSync('sh', ['-c', `"${FFMPEG}" -hide_banner -i "${raw}" -vn -af "${LN}:print_format=json" -f null - 2>&1`], { encoding: 'utf8' });
  const j = JSON.parse(err.slice(err.lastIndexOf('{'), err.lastIndexOf('}') + 1));
  const af = `${LN}:measured_I=${j.input_i}:measured_TP=${j.input_tp}:measured_LRA=${j.input_lra}:measured_thresh=${j.input_thresh}:offset=${j.target_offset}:linear=true`;
  execFileSync(FFMPEG, ['-v', 'error', '-y', '-i', raw, '-c:v', 'copy', '-af', af, '-ar', '48000', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', path.join(ROOT, job.out)], { stdio: 'inherit' });
  console.log(`${name}: ${job.out} (input ${j.input_i} LUFS)`);
}
