// Writes a 24 s synth track (pad, kick, hats, arpeggio) as 16-bit mono WAV. Generated from code, so it is CC0
// and safe to use in demos. Usage: node examples/make-demo-audio.mjs out.wav
import { writeFileSync } from 'node:fs';

const SR = 44100;
const SECONDS = 24;
const BEAT = 0.5; // 120 bpm
const out = new Float32Array(SR * SECONDS);
const midi = (n) => 440 * 2 ** ((n - 69) / 12);
const chords = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62], [57, 60, 64], [53, 57, 60]]; // Am F C G Am F

let noise = 12345;
const rnd = () => ((noise = (noise * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 2 - 1;

for (let i = 0; i < out.length; i++) {
  const t = i / SR;
  const bar = Math.floor(t / (BEAT * 4));
  const chord = chords[Math.floor(t / 4)] ?? chords[0];
  const fadeIn = Math.min(1, t / 2);
  const fadeOut = Math.min(1, (SECONDS - t) / 2.5);
  let s = 0;
  // pad: three voices, a few soft harmonics each, slow swell
  const swell = 0.6 + 0.4 * Math.sin((t / 4) * Math.PI) ** 2;
  for (const n of chord) for (let h = 1; h <= 4; h++) s += (0.05 / h) * Math.sin(2 * Math.PI * midi(n) * h * t) * swell;
  // kick from bar 2
  const tb = t % BEAT;
  if (bar >= 2) s += 0.55 * Math.sin(2 * Math.PI * (50 + 90 * Math.exp(-tb * 30)) * tb) * Math.exp(-tb * 9);
  // offbeat hats from bar 4
  const th = (t + BEAT / 2) % BEAT;
  if (bar >= 4 && th < 0.05) s += 0.12 * rnd() * Math.exp(-th * 90);
  // eighth-note arpeggio from bar 6, an octave up
  if (bar >= 6) {
    const step = Math.floor(t / (BEAT / 2));
    const n = chord[step % 3] + 12 + (step % 6 >= 3 ? 12 : 0);
    const ta = t % (BEAT / 2);
    s += 0.16 * Math.sin(2 * Math.PI * midi(n) * ta) * Math.exp(-ta * 7);
  }
  out[i] = Math.tanh(s * 1.3) * 0.8 * fadeIn * fadeOut;
}

const buf = Buffer.alloc(44 + out.length * 2);
buf.write('RIFF', 0); buf.writeUInt32LE(36 + out.length * 2, 4); buf.write('WAVE', 8); buf.write('fmt ', 12);
buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(SR, 24);
buf.writeUInt32LE(SR * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36);
buf.writeUInt32LE(out.length * 2, 40);
for (let i = 0; i < out.length; i++) buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, out[i])) * 32767), 44 + i * 2);
writeFileSync(process.argv[2] ?? 'demo.wav', buf);
console.log(`wrote ${process.argv[2] ?? 'demo.wav'} (${SECONDS} s)`);
