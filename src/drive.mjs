const MAX_FREQ = 8000;

/** voice-garden's coherence: 1 when the two pitches match, 0 when they are 8 kHz or more apart. */
export function coherence(voiceHz, otherHz, maxFreq = MAX_FREQ) {
  return Math.max(0, Math.min(1, 1 - Math.abs(voiceHz - otherHz) / maxFreq));
}

/** The built-in companion stream voice-garden uses when no live server is connected, as a function of time. */
export function companion(t) {
  return { aiFreq: 180 + 90 * Math.sin(t * 0.7) + 40 * Math.sin(t * 2.1), aiAmplitude: 0.12 + 0.08 * Math.sin(t * 1.3) ** 2 };
}

/**
 * Turn analysis buffers into per-video-frame uniforms with voice-garden's Controller.update, stepped at exactly
 * 1 / fps. Each video frame sees the latest buffer available at its time, as the live app does.
 */
export function drive(features, { fps, frameCount, colorShiftSpeed = 1, audioReactivity = 0.7 }) {
  if (!Number.isInteger(fps) || fps <= 0) throw new RangeError('fps must be a positive integer');
  if (!Number.isInteger(frameCount) || frameCount < 0) throw new RangeError('frameCount must be a non-negative integer');
  const dt = 1 / fps;
  const s = { rms: 0, coherence: 1, colorShift: 0 };
  let voiceFreq = 400;
  let last = { rms: 0, beat: 0 };
  let k = 0;
  const out = [];
  for (let i = 0; i < frameCount; i++) {
    const t = i / fps;
    while (k < features.length && features[k].time <= t + 1e-9) {
      last = features[k];
      const vf = last.dominantFreq > 40 ? last.dominantFreq : last.spectralCentroid;
      voiceFreq = Number.isFinite(vf) ? vf : 400;
      k++;
    }
    const ai = companion(t);
    const coh = coherence(voiceFreq, ai.aiFreq);
    const targetRms = last.rms * audioReactivity + ai.aiAmplitude * (1 - audioReactivity * 0.35);
    const a = 1 - Math.exp(-dt / 0.12);
    s.rms += (targetRms - s.rms) * a;
    s.coherence += (coh - s.coherence) * a;
    s.colorShift += colorShiftSpeed * dt * 0.08;
    const beatPulse = last.beat > 0.5 ? 0.08 : 0;
    out.push({
      t,
      dt,
      u_density: 1 + s.rms * 0.35 + beatPulse + ai.aiAmplitude * 0.2,
      u_colorShift: s.colorShift % 1000,
      u_coherence: s.coherence,
      u_audioRMS: s.rms,
    });
  }
  return out;
}
