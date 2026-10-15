import { describe, expect, it } from 'vitest';
import { parseCli, UsageError } from '../src/cli-args.mjs';
import { paletteOf, PRESETS } from '../src/defaults.mjs';

describe('parseCli', () => {
  it('names the output after the input by default', () => {
    expect(parseCli(['music/track.mp3'])).toEqual({ input: 'music/track.mp3', output: 'track.mp4' });
  });
  it('parses every option', () => {
    const o = parseCli(['a.wav', '-o', 'v.mp4', '--fps', '24', '--size', '1080x1920', '--particles', '50000', '--seed', '7',
      '--bloom', '1.4', '--start', '30', '--duration', '15', '--software', '--hash-frames', 'h.json']);
    expect(o).toMatchObject({ output: 'v.mp4', fps: 24, width: 1080, height: 1920, particles: 50000, seed: 7, bloom: 1.4,
      start: 30, duration: 15, software: true, hashFrames: 'h.json' });
  });
  it.each([
    [[], /missing the audio file/],
    [['a.wav', 'b.wav'], /exactly one/],
    [['a.wav', '--fps', '0'], /--fps/],
    [['a.wav', '--fps', '121'], /--fps/],
    [['a.wav', '--fps', '29.97'], /--fps must be an integer/],
    [['a.wav', '--size', '1280'], /--size must look like/],
    [['a.wav', '--size', '641x360'], /even/],
    [['a.wav', '--size', '8x8'], /--size width/],
    [['a.wav', '--particles', '200001'], /--particles/],
    [['a.wav', '--bloom', 'lots'], /--bloom/],
    [['a.wav', '--duration', '0'], /--duration/],
    [['a.wav', '-o', 'out.gif'], /\.mp4/],
    [['a.wav', '--palette', 'neon'], /--palette must be one of/],
    [['a.wav', '--palette', '#ff0000,#00ff00,#0000ff'], /four #rrggbb/],
    [['a.wav', '--palette', '#ff0000,#00ff00,#0000ff,red'], /four #rrggbb/],
    [['a.wav', '--trails', '1'], /--trails/],
  ])('rejects %j', (argv, msg) => {
    expect(() => parseCli(argv)).toThrow(UsageError);
    expect(() => parseCli(argv)).toThrow(msg);
  });
  it('rejects unknown flags', () => {
    expect(() => parseCli(['a.wav', '--colour', 'red'])).toThrow();
  });

  it('takes a preset name, four colours, trails and --no-sky', () => {
    expect(parseCli(['a.wav', '--palette', 'aurora', '--trails', '0', '--no-sky'])).toMatchObject({ preset: 'aurora', trails: 0, sky: false });
    expect(parseCli(['a.wav', '--palette', '#000000,#ffffff,#ff0000,#00ff00']).preset).toBe('#000000,#ffffff,#ff0000,#00ff00');
  });
});

describe('paletteOf', () => {
  it('turns every preset into four rgb triples in 0..1', () => {
    for (const name of Object.keys(PRESETS)) {
      const p = paletteOf(name);
      expect(p).toHaveLength(4);
      for (const c of p) for (const v of c) expect(v >= 0 && v <= 1).toBe(true);
    }
  });
  it('reads custom colours', () => {
    expect(paletteOf('#ff0000,#00ff00,#0000ff,#ffffff')).toEqual([[1, 0, 0], [0, 1, 0], [0, 0, 1], [1, 1, 1]]);
  });
});
