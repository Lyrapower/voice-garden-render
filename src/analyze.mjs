import Meyda from 'meyda';

export const BUFFER_SIZE = 2048;

/**
 * Audio features per analysis buffer, computed exactly like voice-garden's live AudioCapture: Meyda rms / spectral
 * centroid / amplitude spectrum on consecutive 2048-sample buffers, peak-bin dominant frequency, and the same onset
 * ("beat") rule with its 8-buffer hold. Buffer k becomes available at time (k + 1) * 2048 / sampleRate.
 */
export function analyze(samples, sampleRate) {
  if (!(samples instanceof Float32Array)) throw new TypeError('samples must be a Float32Array');
  if (!(sampleRate > 0)) throw new RangeError('sampleRate must be positive');
  Meyda.bufferSize = BUFFER_SIZE;
  Meyda.sampleRate = sampleRate;
  Meyda.windowingFunction = 'hanning';
  const frames = [];
  let prevRms = 0;
  let beatHold = 0;
  const buf = new Float32Array(BUFFER_SIZE);
  for (let k = 0; k * BUFFER_SIZE < samples.length; k++) {
    buf.fill(0);
    buf.set(samples.subarray(k * BUFFER_SIZE, (k + 1) * BUFFER_SIZE));
    const f = Meyda.extract(['rms', 'spectralCentroid', 'amplitudeSpectrum'], buf);
    const rms = typeof f.rms === 'number' && Number.isFinite(f.rms) ? f.rms : 0;
    const sc = typeof f.spectralCentroid === 'number' && Number.isFinite(f.spectralCentroid) ? f.spectralCentroid : 0;
    const spec = f.amplitudeSpectrum;
    let dominantFreq = sc;
    if (spec && spec.length > 4) {
      let peak = 0;
      let peakI = 0;
      for (let i = 1; i < spec.length; i++) {
        if (spec[i] > peak) {
          peak = spec[i];
          peakI = i;
        }
      }
      dominantFreq = (peakI / Math.max(1, spec.length - 1)) * (sampleRate / 2);
    }
    const thr = 0.02 + prevRms * 0.08;
    let beat = 0;
    if (beatHold > 0) beatHold--;
    if (rms > prevRms * 1.18 && rms > thr && beatHold === 0) {
      beat = 1;
      beatHold = 8;
    }
    prevRms = rms * 0.92 + prevRms * 0.08;
    frames.push({
      time: ((k + 1) * BUFFER_SIZE) / sampleRate,
      rms: Math.min(1, rms * 4),
      spectralCentroid: sc,
      dominantFreq,
      beat: Math.max(beat, beatHold > 6 ? 0.35 : 0),
    });
  }
  return frames;
}
