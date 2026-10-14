import { describe, expect, it } from 'vitest';
import { parseCli, UsageError } from '../src/cli-args.mjs';

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
  ])('rejects %j', (argv, msg) => {
    expect(() => parseCli(argv)).toThrow(UsageError);
    expect(() => parseCli(argv)).toThrow(msg);
  });
  it('rejects unknown flags', () => {
    expect(() => parseCli(['a.wav', '--colour', 'red'])).toThrow();
  });
});
