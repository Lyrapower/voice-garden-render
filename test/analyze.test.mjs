import { describe, expect, it } from 'vitest';
import { analyze, BUFFER_SIZE } from '../src/analyze.mjs';

const SR = 44100;
const tone = (hz, sec, amp = 0.5) => Float32Array.from({ length: Math.round(SR * sec) }, (_, i) => amp * Math.sin((2 * Math.PI * hz * i) / SR));
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

describe('analyze', () => {
  it('returns nothing for no samples and rejects the wrong input type', () => {
    expect(analyze(new Float32Array(0), SR)).toEqual([]);
    expect(() => analyze([0, 0, 0], SR)).toThrow(TypeError);
    expect(() => analyze(new Float32Array(10), 0)).toThrow(RangeError);
  });

  it('reports silence as zero loudness and no beats', () => {
    const f = analyze(new Float32Array(SR), SR);
    expect(f.length).toBe(Math.ceil(SR / BUFFER_SIZE));
    for (const x of f) {
      expect(x.rms).toBe(0);
      expect(x.beat).toBe(0);
    }
  });

  it('finds the pitch of a sine within one FFT bin', () => {
    const f = analyze(tone(440, 1), SR);
    expect(Math.abs(median(f.map((x) => x.dominantFreq)) - 440)).toBeLessThan(SR / BUFFER_SIZE);
  });

  it('marks an onset after silence, and not again while the tone just holds', () => {
    const s = new Float32Array(SR * 2);
    s.set(tone(220, 1), SR); // silence for 1 s, then a tone
    const f = analyze(s, SR);
    const beats = f.flatMap((x, i) => (x.beat === 1 ? [i] : []));
    expect(beats.length).toBe(1);
    expect(f[beats[0]].time).toBeGreaterThan(1);
    expect(f[beats[0]].time).toBeLessThan(1 + (2 * BUFFER_SIZE) / SR);
  });

  it('keeps every value finite even for NaN-free clipped input', () => {
    const s = Float32Array.from({ length: SR }, (_, i) => (i % 2 ? 1 : -1));
    for (const x of analyze(s, SR)) for (const v of Object.values(x)) expect(Number.isFinite(v)).toBe(true);
  });
});
