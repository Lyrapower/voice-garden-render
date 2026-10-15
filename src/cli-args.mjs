import { readFileSync } from 'node:fs';
import { basename, extname } from 'node:path';
import { parseArgs } from 'node:util';
import { DEFAULTS, PRESETS, paletteOf } from './defaults.mjs';

export const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
export const HELP = `voice-garden-render ${pkg.version}
Render an audio file into an audio-reactive particle video.

Usage: voice-garden-render <audio> [options]

  -o, --output <file>      MP4 to write (default: <audio name>.mp4)
      --fps <n>            frames per second, 1-120 (default ${DEFAULTS.fps})
      --size <WxH>         even width x height, 16-4096 (default ${DEFAULTS.width}x${DEFAULTS.height}; 1080x1920 for vertical)
      --particles <n>      1000-200000 (default ${DEFAULTS.particles})
      --seed <n>           particle layout seed, integer (default ${DEFAULTS.seed}); same seed + same audio = same video
      --bloom <x>          glow strength 0-3 (default ${DEFAULTS.bloom})
      --palette <p>        ${Object.keys(PRESETS).join(' | ')}, or four colours rim to core:
                           "#1a2985,#1fc7f2,#eb1fb8,#ff991f" (default ${DEFAULTS.preset})
      --trails <x>         light-trail persistence 0-0.95, 0 = off (default ${DEFAULTS.trails})
      --no-sky             plain dark background instead of the night sky
      --start <sec>        start offset in the audio (default 0)
      --duration <sec>     length to render (default: to the end)
      --browser-path <p>   Chromium executable (default: Playwright's; env VGR_BROWSER)
      --software           force software WebGL (SwiftShader), e.g. on machines without a GPU
      --hash-frames <json> write the sha256 of every frame to a JSON file
  -h, --help               this help
  -v, --version            version
`;

export class UsageError extends Error {}

function num(name, v, { min, max, integer = false }) {
  const n = Number(v);
  if (v === undefined || v === '' || !Number.isFinite(n) || (integer && !Number.isInteger(n)) || n < min || n > max) {
    throw new UsageError(`--${name} must be ${integer ? 'an integer' : 'a number'} from ${min} to ${max} (got "${v}")`);
  }
  return n;
}

/** Parse and validate argv into render options. Throws UsageError on bad input. */
export function parseCli(argv) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      output: { type: 'string', short: 'o' }, fps: { type: 'string' }, size: { type: 'string' }, particles: { type: 'string' },
      seed: { type: 'string' }, bloom: { type: 'string' }, start: { type: 'string' }, duration: { type: 'string' },
      'browser-path': { type: 'string' }, software: { type: 'boolean' }, 'hash-frames': { type: 'string' },
      palette: { type: 'string' }, trails: { type: 'string' }, 'no-sky': { type: 'boolean' },
      help: { type: 'boolean', short: 'h' }, version: { type: 'boolean', short: 'v' },
    },
  });
  if (values.help) return { help: true };
  if (values.version) return { version: true };
  if (positionals.length !== 1) throw new UsageError(positionals.length ? 'give exactly one audio file' : 'missing the audio file to render');
  const input = positionals[0];
  const o = { input, output: values.output ?? `${basename(input, extname(input))}.mp4` };
  if (!/\.mp4$/i.test(o.output)) throw new UsageError('--output must end in .mp4');
  if (values.fps !== undefined) o.fps = num('fps', values.fps, { min: 1, max: 120, integer: true });
  if (values.size !== undefined) {
    const m = /^(\d+)x(\d+)$/.exec(values.size);
    if (!m) throw new UsageError(`--size must look like 1280x720 (got "${values.size}")`);
    o.width = num('size width', m[1], { min: 16, max: 4096, integer: true });
    o.height = num('size height', m[2], { min: 16, max: 4096, integer: true });
    if (o.width % 2 || o.height % 2) throw new UsageError('--size width and height must be even (H.264 needs it)');
  }
  if (values.particles !== undefined) o.particles = num('particles', values.particles, { min: 1000, max: 200_000, integer: true });
  if (values.seed !== undefined) o.seed = num('seed', values.seed, { min: 0, max: 2 ** 32 - 1, integer: true });
  if (values.bloom !== undefined) o.bloom = num('bloom', values.bloom, { min: 0, max: 3 });
  if (values.start !== undefined) o.start = num('start', values.start, { min: 0, max: 86_400 });
  if (values.duration !== undefined) o.duration = num('duration', values.duration, { min: 0.05, max: 86_400 });
  if (values.palette !== undefined) {
    try {
      paletteOf(values.palette);
    } catch (e) {
      throw new UsageError(`--${e.message}`);
    }
    o.preset = values.palette;
  }
  if (values.trails !== undefined) o.trails = num('trails', values.trails, { min: 0, max: 0.95 });
  if (values['no-sky']) o.sky = false;
  if (values['browser-path']) o.browserPath = values['browser-path'];
  if (values.software) o.software = true;
  if (values['hash-frames']) o.hashFrames = values['hash-frames'];
  return o;
}

