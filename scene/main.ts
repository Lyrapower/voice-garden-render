// Offline render scene. The CLI drives it one frame at a time: no clocks, no requestAnimationFrame, so the same
// inputs give the same pixels. Look and camera follow Lyrapower/voice-garden src/main.ts.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { AfterimagePass } from 'three/addons/postprocessing/AfterimagePass.js';
import { Backdrop } from './backdrop';
import { createParticleInstancedField, seeded, uniform } from './field';

export type SceneOptions = {
  width: number;
  height: number;
  particles: number;
  seed: number;
  bloom: number;
  dispersion: number;
  particleSize: number;
  flowSpeed: number;
  audioReactivity: number;
  /** four rim-to-core colours as [r, g, b] in 0..1 */
  palette: [number, number, number][];
  sky: boolean;
  trails: number;
};

export type FrameInput = {
  t: number;
  dt: number;
  u_density: number;
  u_colorShift: number;
  u_coherence: number;
  u_audioRMS: number;
};

const BG = 0x0a0a0f;
const CAMERA_ORBIT = 120;
const LOOK_AT = new THREE.Vector3(0, -8, 0);
const FIELD_RADIUS = 55;
const FOV = 52;

function orbitFor(aspect: number): number {
  return Math.max(CAMERA_ORBIT, FIELD_RADIUS / (Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * aspect));
}

const chromaShader = {
  uniforms: { tDiffuse: { value: null as THREE.Texture | null }, amount: { value: 0.003 } },
  vertexShader: `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float amount;
    varying vec2 vUv;
    void main() {
      vec2 c = vUv - 0.5;
      vec2 dir = length(c) > 0.0001 ? normalize(c) : vec2(0.0);
      vec2 off = dir * amount * length(c);
      vec4 base = texture2D(tDiffuse, vUv);
      gl_FragColor = vec4(texture2D(tDiffuse, vUv + off).r, base.g, texture2D(tDiffuse, vUv - off).b, base.a);
    }
  `,
};

function init(o: SceneOptions) {
  const canvas = document.querySelector<HTMLCanvasElement>('#c');
  if (!canvas) throw new Error('missing canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(o.width, o.height, true);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  // the look is tuned for 100k additive particles; keep fewer particles about as bright
  renderer.toneMappingExposure = 1.05 * Math.min(4, Math.max(1, 100_000 / o.particles));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);
  const camera = new THREE.PerspectiveCamera(FOV, o.width / o.height, 0.5, 600);
  const backdrop = o.sky ? new Backdrop() : null;
  if (backdrop) {
    backdrop.bake(renderer, o.width, o.height);
    scene.add(backdrop.mesh);
  }

  const field = createParticleInstancedField(o.particles, seeded(o.seed));
  scene.add(field.mesh);

  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(1);
  composer.setSize(o.width, o.height);
  composer.addPass(new RenderPass(scene, camera));
  // light trails: each frame keeps a fading copy of the previous ones (frames are rendered in order, so this is
  // still deterministic)
  if (o.trails > 0) composer.addPass(new AfterimagePass(o.trails));
  const bloom = new UnrealBloomPass(new THREE.Vector2(o.width, o.height), o.bloom, 0.32, 0.35);
  composer.addPass(bloom);
  const chroma = new ShaderPass(chromaShader);
  uniform(chroma, 'amount').value = 0.001 + 0.004 * Math.min(1, o.audioReactivity);
  composer.addPass(chroma);
  composer.addPass(new OutputPass());

  const gl = renderer.getContext();
  const pixels = new Uint8Array(o.width * o.height * 4);
  const target = new THREE.Vector3();
  const camWorld = new THREE.Vector3();
  const m = field.material;
  ['uPal0', 'uPal1', 'uPal2', 'uPal3'].forEach((k, i) => uniform(m, k).value.setRGB(...o.palette[i]!));

  function frame(f: FrameInput): string {
    // as voice-garden: about 40 degrees above the turning disk, circling slowly; solved from t, so any frame stands alone
    const orbit = f.t * 0.11;
    const r = orbitFor(camera.aspect) + Math.sin(f.t * 0.35) * 1.8;
    const lift = 0.62 + Math.sin(orbit * 0.7) * 0.06;
    camera.position.copy(target.set(Math.cos(orbit), lift, Math.sin(orbit)).normalize().multiplyScalar(r));
    camera.lookAt(LOOK_AT);
    backdrop?.setOrbit(orbit);
    camera.getWorldPosition(camWorld);

    uniform(m, 'uCameraPos').value.copy(camWorld);
    uniform(m, 'uTime').value = f.t;
    uniform(m, 'u_density').value = f.u_density;
    uniform(m, 'u_colorShift').value = f.u_colorShift;
    uniform(m, 'u_coherence').value = f.u_coherence;
    uniform(m, 'u_audioRMS').value = f.u_audioRMS;
    uniform(m, 'u_flowSpeed').value = o.flowSpeed;
    uniform(m, 'u_particleScale').value = o.particleSize;
    uniform(m, 'u_dispersion').value = o.dispersion;

    composer.render();
    gl.readPixels(0, 0, o.width, o.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels); // bottom row first
    let s = '';
    for (let i = 0; i < pixels.length; i += 0x8000) s += String.fromCharCode.apply(null, pixels.subarray(i, i + 0x8000) as unknown as number[]);
    return btoa(s);
  }

  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  return {
    frame,
    gpu: dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER)),
  };
}

declare global {
  interface Window {
    vgr: { init: (o: SceneOptions) => { gpu: string }; frame: (f: FrameInput) => string };
  }
}

let current: ReturnType<typeof init> | null = null;
window.vgr = {
  init(o) {
    current = init(o);
    return { gpu: current.gpu };
  },
  frame(f) {
    if (!current) throw new Error('vgr.init must be called first');
    return current.frame(f);
  },
};
document.title = 'voice-garden-render scene (ready)';
