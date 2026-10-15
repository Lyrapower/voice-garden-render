import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { analyze } from './analyze.mjs';
import { decodeAudio } from './audio.mjs';
import { DEFAULTS, paletteOf } from './defaults.mjs';
import { drive } from './drive.mjs';

const SCENE_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'scene-dist');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.map': 'application/json' };


/** Serve scene-dist on 127.0.0.1 only; module scripts do not load from file:// URLs. */
async function serveScene() {
  await stat(join(SCENE_DIR, 'index.html')).catch(() => {
    throw new Error(`render scene not built (${SCENE_DIR} missing). Run "npm run build" in the package directory.`);
  });
  const server = createServer((req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([/\\])+/, '');
    const file = join(SCENE_DIR, path || 'index.html');
    if (!file.startsWith(SCENE_DIR)) {
      res.writeHead(403).end();
      return;
    }
    stat(file)
      .then((s) => {
        if (!s.isFile()) throw new Error('not a file');
        res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
        createReadStream(file).pipe(res);
      })
      .catch(() => res.writeHead(404).end());
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { server, url: `http://127.0.0.1:${server.address().port}/index.html` };
}

/** True when a frame is one flat colour, i.e. nothing was drawn (WebGL missing, shader failure). */
export function isBlank(rgba) {
  const r0 = rgba[0], g0 = rgba[1], b0 = rgba[2];
  for (let i = 0; i < rgba.length; i += 4 * 97) {
    if (Math.abs(rgba[i] - r0) > 3 || Math.abs(rgba[i + 1] - g0) > 3 || Math.abs(rgba[i + 2] - b0) > 3) return false;
  }
  return true;
}

function startEncoder({ input, output, fps, width, height, start, duration, crf }) {
  const args = ['-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${width}x${height}`, '-r', String(fps), '-i', 'pipe:0',
    '-ss', String(start), '-t', String(duration), '-i', input,
    '-map', '0:v', '-map', '1:a?', '-vf', 'vflip', '-c:v', 'libx264', '-preset', 'medium', '-crf', String(crf), '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-shortest', output];
  const ff = spawn('ffmpeg', args, { stdio: ['pipe', 'ignore', 'pipe'] });
  let err = '';
  ff.stderr.on('data', (d) => (err += d));
  const done = new Promise((resolve, reject) => {
    ff.on('error', (e) => reject(e.code === 'ENOENT' ? new Error('ffmpeg not found on PATH') : e));
    ff.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited with ${code}: ${err.trim().split('\n').slice(-3).join(' | ')}`))));
  });
  done.catch(() => {}); // surfaced by the await below
  return { ff, done };
}

function write(stream, buf) {
  return stream.write(buf) ? Promise.resolve() : new Promise((r) => stream.once('drain', r));
}

/**
 * Render `input` (any audio FFmpeg reads) to an MP4 at `output`. Returns frame count, GPU string, timing and, when
 * `hashFrames` is set, the sha256 of every raw frame (used by the determinism test).
 */
export async function render(opts) {
  const o = { ...DEFAULTS, ...opts };
  const t0 = Date.now();
  const { samples, sampleRate } = await decodeAudio(o.input, { start: o.start, duration: o.duration });
  const duration = samples.length / sampleRate;
  const frameCount = Math.max(1, Math.round(duration * o.fps));
  const frames = drive(analyze(samples, sampleRate), { fps: o.fps, frameCount, audioReactivity: o.audioReactivity });

  const { server, url } = await serveScene();
  const browser = await chromium.launch({
    executablePath: o.browserPath || process.env.VGR_BROWSER || undefined,
    args: ['--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', ...(o.software ? ['--use-angle=swiftshader'] : [])],
  });
  let encoder;
  try {
    const page = await browser.newPage({ viewport: { width: Math.min(o.width, 4096), height: Math.min(o.height, 4096) } });
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && pageErrors.push(m.text()));
    await page.goto(url);
    await page.waitForFunction(() => window.vgr !== undefined, null, { timeout: 30_000 });
    const { gpu } = await page.evaluate((s) => window.vgr.init(s), {
      width: o.width, height: o.height, particles: o.particles, seed: o.seed, bloom: o.bloom,
      dispersion: o.dispersion, particleSize: o.particleSize, flowSpeed: o.flowSpeed, audioReactivity: o.audioReactivity,
      palette: paletteOf(o.preset), sky: o.sky, trails: o.trails,
    });
    encoder = startEncoder({ input: o.input, output: o.output, fps: o.fps, width: o.width, height: o.height, start: o.start, duration, crf: o.crf });
    const hashes = [];
    for (let i = 0; i < frames.length; i++) {
      const rgba = Buffer.from(await page.evaluate((f) => window.vgr.frame(f), frames[i]), 'base64');
      if (rgba.length !== o.width * o.height * 4) throw new Error(`frame ${i}: got ${rgba.length} bytes, expected ${o.width * o.height * 4}`);
      if (i === 0 && isBlank(rgba)) {
        throw new Error(`the first frame is blank, so WebGL drew nothing (GPU: ${gpu}). ${pageErrors.join(' | ') || 'Try --software.'}`);
      }
      if (o.hashFrames) hashes.push(createHash('sha256').update(rgba).digest('hex'));
      await write(encoder.ff.stdin, rgba);
      o.onProgress?.({ frame: i + 1, frames: frames.length, elapsed: (Date.now() - t0) / 1000 });
    }
    encoder.ff.stdin.end();
    await encoder.done;
    if (pageErrors.length) throw new Error(`scene errors: ${pageErrors.join(' | ')}`);
    return { frames: frames.length, duration, gpu, seconds: (Date.now() - t0) / 1000, hashes };
  } catch (e) {
    encoder?.ff.kill('SIGKILL');
    throw e;
  } finally {
    await browser.close();
    server.close();
  }
}
