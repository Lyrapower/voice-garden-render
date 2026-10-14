import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';

export const SAMPLE_RATE = 44100;

/** Run a binary and collect stdout; rejects with stderr on a non-zero exit, with an install hint if it is missing. */
export function run(bin, args, { input } = {}) {
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(bin, args, { stdio: [input ? 'pipe' : 'ignore', 'pipe', 'pipe'] });
    } catch (e) {
      reject(e);
      return;
    }
    const out = [];
    let err = '';
    child.stdout.on('data', (d) => out.push(d));
    child.stderr.on('data', (d) => (err += d));
    child.on('error', (e) => {
      if (e.code === 'ENOENT') reject(new Error(`${bin} not found on PATH. Install FFmpeg (https://ffmpeg.org/download.html), e.g. "brew install ffmpeg" or "sudo apt install ffmpeg".`));
      else reject(e);
    });
    child.on('close', (code) => {
      if (code === 0) resolve(Buffer.concat(out));
      else reject(new Error(`${bin} exited with ${code}: ${err.trim().split('\n').slice(-3).join(' | ')}`));
    });
    if (input) child.stdin.end(input);
  });
}

/** Decode any audio FFmpeg can read into mono float32 PCM at 44.1 kHz. */
export async function decodeAudio(path, { start = 0, duration } = {}) {
  await access(path).catch(() => {
    throw new Error(`input not found: ${path}`);
  });
  const args = ['-v', 'error', '-ss', String(start), '-i', path];
  if (duration !== undefined) args.push('-t', String(duration));
  args.push('-vn', '-ac', '1', '-ar', String(SAMPLE_RATE), '-f', 'f32le', 'pipe:1');
  const buf = await run('ffmpeg', args);
  const samples = new Float32Array(buf.buffer, buf.byteOffset, Math.floor(buf.byteLength / 4));
  if (samples.length === 0) throw new Error(`no audio decoded from ${path} (empty file, or start is past the end)`);
  for (let i = 0; i < samples.length; i++) if (!Number.isFinite(samples[i])) samples[i] = 0;
  return { samples: Float32Array.from(samples), sampleRate: SAMPLE_RATE };
}
