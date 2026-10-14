import { describe, expect, it } from 'vitest';
import { coherence, drive } from '../src/drive.mjs';

const features = Array.from({ length: 50 }, (_, k) => ({
  time: (k + 1) * 0.0464,
  rms: k % 10 === 0 ? 0.9 : 0.1,
  spectralCentroid: 30,
  dominantFreq: k % 2 ? 220 : 880,
  beat: k % 10 === 0 ? 1 : 0,
}));

describe('drive', () => {
  it('is deterministic: the same features give identical frames', () => {
    expect(drive(features, { fps: 30, frameCount: 60 })).toEqual(drive(features, { fps: 30, frameCount: 60 }));
  });
  it('steps time at exactly 1 / fps and keeps uniforms finite and in range', () => {
    const f = drive(features, { fps: 24, frameCount: 48 });
    expect(f).toHaveLength(48);
    f.forEach((x, i) => {
      expect(x.t).toBeCloseTo(i / 24, 12);
      for (const v of Object.values(x)) expect(Number.isFinite(v)).toBe(true);
      expect(x.u_coherence).toBeGreaterThanOrEqual(0);
      expect(x.u_coherence).toBeLessThanOrEqual(1);
    });
  });
  it('reacts to the audio: louder input raises u_audioRMS', () => {
    const quiet = drive(features.map((x) => ({ ...x, rms: 0 })), { fps: 30, frameCount: 60 });
    const loud = drive(features.map((x) => ({ ...x, rms: 1 })), { fps: 30, frameCount: 60 });
    expect(loud.at(-1).u_audioRMS).toBeGreaterThan(quiet.at(-1).u_audioRMS + 0.3);
  });
  it('works with no features (silence) and with zero frames, and rejects a bad fps', () => {
    expect(drive([], { fps: 30, frameCount: 3 })).toHaveLength(3);
    expect(drive(features, { fps: 30, frameCount: 0 })).toEqual([]);
    expect(() => drive(features, { fps: 0, frameCount: 3 })).toThrow(RangeError);
    expect(() => drive(features, { fps: 29.97, frameCount: 3 })).toThrow(RangeError);
  });
  it('coherence matches voice-garden: 1 when equal, clamped to 0 at 8 kHz apart', () => {
    expect(coherence(440, 440)).toBe(1);
    expect(coherence(0, 4000)).toBeCloseTo(0.5);
    expect(coherence(0, 9000)).toBe(0);
  });
});
