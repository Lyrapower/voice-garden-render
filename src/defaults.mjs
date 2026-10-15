export const DEFAULTS = {
  fps: 30,
  width: 1280,
  height: 720,
  particles: 100_000,
  seed: 1,
  bloom: 1.0,
  dispersion: 0.7,
  particleSize: 0.6,
  flowSpeed: 1.0,
  audioReactivity: 0.7,
  start: 0,
  crf: 18,
  preset: 'deep-space',
  sky: true,
  trails: 0.8,
};

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);

/** Colour sets, rim to core. deep-space is voice-garden's own; the others keep its shape and change the mood. */
export const PRESETS = {
  'deep-space': ['#1a2985', '#1fc7f2', '#eb1fb8', '#ff991f'], // navy, cyan, magenta, gold
  sunset: ['#2b1b5e', '#c2306f', '#ff7a3d', '#ffd28a'],       // indigo, rose, orange, peach
  aurora: ['#0b2a4a', '#14b8a6', '#7cf29a', '#c4a3ff'],       // deep blue, teal, green, lilac
  ember: ['#3a0c0c', '#b3261e', '#ff8a1f', '#ffe1a8'],        // dark red, red, amber, cream
  ice: ['#0d1b3d', '#4f86c6', '#a9d6ff', '#f2f8ff'],          // navy, steel, ice, white
};

/** Four rim-to-core colours as [r, g, b] in 0..1, from a preset name or "#rrggbb,#rrggbb,#rrggbb,#rrggbb". */
export function paletteOf(spec) {
  const list = PRESETS[spec] ?? (typeof spec === 'string' ? spec.split(',').map((x) => x.trim()) : null);
  if (!list || list.length !== 4 || !list.every((h) => /^#[0-9a-fA-F]{6}$/.test(h))) {
    throw new RangeError(`palette must be one of ${Object.keys(PRESETS).join(', ')} or four #rrggbb colours separated by commas`);
  }
  return list.map(hex);
}
