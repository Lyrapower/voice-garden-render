// End to end: real FFmpeg, a real headless Chromium, real WebGL. Needs `npx playwright-core install chromium`
// (or VGR_BROWSER pointing at a Chromium) and ffmpeg on PATH.
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isBlank, render } from '../src/render.mjs';

const dir = mkdtempSync(join(tmpdir(), 'vgr-'));
const input = join(dir, 'tone.wav');
execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=330:duration=1.2', '-ar', '44100', input]);
const base = { input, fps: 10, width: 128, height: 72, particles: 5000, duration: 1, hashFrames: true, browserPath: process.env.VGR_BROWSER };
const probe = (f) =>
  JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,codec_name,width,height,duration', '-of', 'json', f]).toString()).streams;

describe('render (end to end)', { timeout: 300_000 }, () => {
  it('writes an H.264 + AAC MP4 of the right length, and the same seed gives the same frames', async () => {
    const a = await render({ ...base, output: join(dir, 'a.mp4'), seed: 1 });
    const b = await render({ ...base, output: join(dir, 'b.mp4'), seed: 1 });
    const c = await render({ ...base, output: join(dir, 'c.mp4'), seed: 2 });
    expect(a.frames).toBe(10);
    expect(a.hashes).toHaveLength(10);
    expect(new Set(a.hashes).size).toBeGreaterThan(1); // the field moves
    expect(b.hashes).toEqual(a.hashes); // deterministic
    expect(c.hashes).not.toEqual(a.hashes); // and the seed matters, so the hash is not trivially constant
    const s = probe(join(dir, 'a.mp4'));
    const v = s.find((x) => x.codec_type === 'video');
    const au = s.find((x) => x.codec_type === 'audio');
    expect(v).toMatchObject({ codec_name: 'h264', width: 128, height: 72 });
    expect(au.codec_name).toBe('aac');
    expect(Math.abs(Number(v.duration) - 1)).toBeLessThan(0.15);
  });

  it('fails with a clear message for a missing input instead of writing an empty video', async () => {
    await expect(render({ ...base, input: join(dir, 'nope.wav'), output: join(dir, 'x.mp4') })).rejects.toThrow(/input not found/);
  });

  it('fails for a file with no audio', async () => {
    const txt = join(dir, 'not-audio.wav');
    execFileSync('sh', ['-c', `printf 'hello' > '${txt}'`]);
    await expect(render({ ...base, input: txt, output: join(dir, 'y.mp4') })).rejects.toThrow();
  });
});

describe('isBlank', () => {
  it('is true for one flat colour and false once something is drawn', () => {
    const px = new Uint8Array(128 * 72 * 4).fill(10);
    expect(isBlank(px)).toBe(true);
    px[4 * 97 * 5] = 200;
    expect(isBlank(px)).toBe(false);
  });
});
