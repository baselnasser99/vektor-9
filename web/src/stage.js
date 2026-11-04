// Shared night stage for the city and the sample page: renderer, sky, fog, lights, bloom, orbit camera, frame loop.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { css, palette, ui } from './palette.js';
import { MOON, skyDome } from './atmosphere.js';

// The look, in one place: exposure, key (moon) and fill (sky) light, bloom [strength, radius, threshold], and the
// haze's thinning with height (density at `aloft` times the street's, from `low` to `high` metres).
export const LOOK = { exposure: 1.35, key: 1.7, fill: 1.3, bloom: [0.5, 0.45, 0.82] };
const HAZE = { aloft: 0.3, low: 25, high: 220 };

// Haze in every material's fog: thickest among the streets and thinning with height, so distant streets fade into
// the night while tall landmarks stay crisp. The fragment's height comes from the view-space position (the view
// matrix is rigid, so its inverse is a transpose), so sprites and points get it too.
THREE.ShaderChunk.fog_pars_vertex = `#ifdef USE_FOG
  varying float vFogDepth;
  varying float vFogHeight;
#endif`;
THREE.ShaderChunk.fog_vertex = `#ifdef USE_FOG
  vFogDepth = - mvPosition.z;
  vFogHeight = (transpose(mat3(viewMatrix)) * (mvPosition.xyz - viewMatrix[3].xyz)).y;
#endif`;
THREE.ShaderChunk.fog_pars_fragment = THREE.ShaderChunk.fog_pars_fragment
  .replace('varying float vFogDepth;', 'varying float vFogDepth;\n  varying float vFogHeight;');
THREE.ShaderChunk.fog_fragment = `#ifdef USE_FOG
  #ifdef FOG_EXP2
    float fogThin = fogDensity * mix(1.0, ${HAZE.aloft.toFixed(2)}, smoothstep(${HAZE.low.toFixed(1)}, ${HAZE.high.toFixed(1)}, vFogHeight));
    float fogFactor = 1.0 - exp(- fogThin * fogThin * vFogDepth * vFogDepth);
  #else
    float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
  #endif
  gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, fogFactor);
#endif`;

// span: half-width in metres of the area that needs shadows and fits in the view.
export function createStage({ span, fog, camera: [cx, cy, cz], target: [tx, ty, tz] }) {
  const far = span * 12, renderer = createRenderer(), scene = nightScene(span, fog, far);
  const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.5, far);
  camera.position.set(cx, cy, cz);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(tx, ty, tz);
  controls.maxPolarAngle = Math.PI / 2.1;
  controls.maxDistance = span * 2.5;
  const move = navigate(controls, camera, span * 2.5);
  controls.update();

  const composer = createComposer(renderer, scene, camera);
  const render = () => composer.render();
  // Ambient motion (rain, traffic, mist) runs in a frame loop unless the visitor asked for reduced motion;
  // then the city is drawn once and again only when the camera moves.
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const updates = [];
  if (still) {
    controls.addEventListener('change', render);
    addEventListener('keydown', () => move(0.05)); // no frame loop: step once per key repeat
  } else updates.push(move);
  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    composer.setSize(innerWidth, innerHeight);
    render();
  });

  return {
    renderer, scene, camera, controls, render, still, far,
    // fn(dt, t) runs every frame before drawing; never called with reduced motion.
    onFrame: (fn) => updates.push(fn),
    start() {
      renderer.shadowMap.needsUpdate = true;
      if (still) return render();
      const clock = new THREE.Clock();
      renderer.setAnimationLoop(() => {
        const dt = Math.min(clock.getDelta(), 0.1), t = clock.elapsedTime;
        for (const fn of updates) fn(dt, t);
        render();
      });
    },
    // Reflections are captured from the finished scene once, so glass and the wet street pick up the lights.
    captureReflections(at) {
      const pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromScene(scene, 0.02, 0.5, far, { position: new THREE.Vector3(...at) }).texture;
      scene.environmentIntensity = 0.6;
    },
    bench: () => bench(renderer, scene, render),
  };
}

// Navigation: left-drag turns, right-drag or shift-drag slides over the ground, scroll zooms; WASD or arrows move,
// Q and E turn. The focus point stays within `reach` of the centre. Returns a per-frame step for held keys.
function navigate(controls, camera, reach) {
  Object.assign(controls, { screenSpacePanning: false, minDistance: 15,
    mouseButtons: { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN },
    touches: { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN } });
  const keys = { KeyW: [0, 1], ArrowUp: [0, 1], KeyS: [0, -1], ArrowDown: [0, -1], KeyA: [-1, 0], ArrowLeft: [-1, 0],
    KeyD: [1, 0], ArrowRight: [1, 0], KeyQ: [0, 0, 1], KeyE: [0, 0, -1] };
  const held = new Set();
  addEventListener('keydown', (e) => {
    if (!(e.code in keys)) return;
    held.add(e.code);
    e.preventDefault();
  });
  addEventListener('keyup', (e) => held.delete(e.code));
  addEventListener('blur', () => held.clear());
  const up = new THREE.Vector3(0, 1, 0), fwd = new THREE.Vector3(), side = new THREE.Vector3(), shift = new THREE.Vector3();
  // Slide camera and focus together, keeping the focus inside the city's surroundings.
  const slide = (v) => {
    const t = controls.target, clamp = (a) => Math.min(Math.max(a, -reach), reach);
    v.x = clamp(t.x + v.x) - t.x;
    v.z = clamp(t.z + v.z) - t.z;
    t.add(v);
    camera.position.add(v);
  };
  controls.addEventListener('change', () => slide(shift.set(0, 0, 0))); // mouse panning obeys the same bounds
  hint();
  return (dt) => {
    if (!held.size) return;
    camera.getWorldDirection(fwd).setY(0).normalize();
    side.crossVectors(fwd, up);
    const speed = camera.position.distanceTo(controls.target) * 0.8 * dt;
    let turn = 0;
    shift.set(0, 0, 0);
    for (const code of held) {
      const [x, z, q = 0] = keys[code];
      shift.addScaledVector(side, x * speed).addScaledVector(fwd, z * speed);
      turn += q;
    }
    slide(shift);
    if (turn) camera.position.sub(controls.target).applyAxisAngle(up, turn * 1.2 * dt).add(controls.target);
    controls.update();
  };
}

// One line of help in the corner, so visitors know the city can be explored.
function hint() {
  const el = Object.assign(document.createElement('div'), {
    textContent: 'Drag to turn · right-drag or shift-drag to move · scroll to zoom · WASD / arrows, Q E' });
  Object.assign(el.style, { position: 'fixed', left: '12px', bottom: '12px', padding: '6px 10px', borderRadius: '6px',
    font: '12px system-ui, sans-serif', color: css(ui.muted), background: `${css(ui.panel)}cc`,
    border: `1px solid ${css(ui.border)}`, pointerEvents: 'none' });
  document.body.appendChild(el);
}

function createRenderer() {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // The city does not move, so its shadows are drawn once (on start), not every frame.
  renderer.shadowMap.autoUpdate = false;
  // AgX keeps saturated neon from clipping to flat hues the way ACES did, and rolls highlights off gently.
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = LOOK.exposure;
  document.body.appendChild(renderer.domElement);
  return renderer;
}

// Night: deep blue zenith, blue haze lit from below by the city. A cool moon is the key light, strong enough to
// model every building's form and cast its shadows; the sky fill (cool above, a mauve bounce from the lit streets
// below) is kept low so lit and unlit sides separate. Warm windows, lamps and neon do the rest.
function nightScene(span, fog, far) {
  const scene = new THREE.Scene();
  scene.add(skyDome([[0, palette.nightFog], [0.05, palette.nightHorizon], [0.25, palette.nightSky], [1, palette.nightZenith]], far * 0.8));
  scene.fog = new THREE.FogExp2(palette.nightFog, fog);
  scene.add(new THREE.HemisphereLight(palette.nightHorizon, palette.nightSand, LOOK.fill));
  const moon = new THREE.DirectionalLight(palette.moon, LOOK.key);
  moon.position.copy(MOON).multiplyScalar(span * 2.5);
  moon.castShadow = true;
  moon.shadow.mapSize.setScalar(span > 100 ? 4096 : 2048);
  moon.shadow.normalBias = 0.03;
  moon.shadow.radius = 6;
  Object.assign(moon.shadow.camera, { left: -span, right: span, top: span, bottom: -span, far: span * 6 });
  scene.add(moon);
  return scene;
}

// Bloom gives lamps and neon soft halos; only the brightest light blooms (threshold), so facades keep their detail.
// The grade runs at the end of the output pass (tone mapping and colour space), so it costs no extra full-screen pass.
// shortcut: GTAOPass washed the frame out, so contact shading comes from shadows, texture AO and the facades'
// street-canyon darkening (facade.js); revisit with a tuned half-resolution AO pass if it is still missing.
function createComposer(renderer, scene, camera) {
  // Multisampled target: the composer otherwise drops the canvas antialiasing and edges go jagged.
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 }));
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), ...LOOK.bloom));
  const output = new OutputPass(), shader = output.material.fragmentShader, end = shader.lastIndexOf('}');
  output.material.fragmentShader = `${shader.slice(0, end).replace('void main() {', `${GRADE}\nvoid main() {`)}
  gl_FragColor.rgb = grade(gl_FragColor.rgb, vUv);
}`;
  composer.addPass(output);
  return composer;
}

// The grade, on the final image: darks and mid-tones lose a little saturation (so concrete, steel and glass read as
// themselves) while bright light keeps its colour (signs, neon, windows); shadows lean cool and highlights warm;
// a soft vignette.
const GRADE = `vec3 grade(vec3 c, vec2 uv) {
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  vec3 g = mix(vec3(l), c, mix(0.8, 1.05, smoothstep(0.3, 0.75, l)));
  g *= mix(vec3(0.97, 0.99, 1.04), vec3(1.03, 1.0, 0.97), smoothstep(0.15, 0.7, l));
  return g * (1.0 - 0.2 * pow(length(uv - 0.5) * 1.25, 2.0));
}`;

// ?bench in the URL: time 30 frames, log draw calls and triangles for one whole frame (scene, shadows and post
// passes), and which materials hold the most triangles.
function bench(renderer, scene, render) {
  if (!new URLSearchParams(location.search).has('bench')) return;
  const gl = renderer.getContext();
  renderer.info.autoReset = false;
  renderer.info.reset();
  renderer.shadowMap.needsUpdate = true;
  render();
  const { calls, triangles } = renderer.info.render;
  renderer.info.autoReset = true;
  gl.finish();
  const t0 = performance.now();
  for (let i = 0; i < 30; i++) render();
  gl.finish();
  console.info(`bench: ${((performance.now() - t0) / 30).toFixed(1)} ms/frame, ${calls} draw calls, ${triangles} triangles per frame`);
  const byMat = new Map();
  scene.traverse((o) => {
    if (!o.isMesh) return;
    const tris = (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3 * (o.count ?? 1);
    const key = (o.material.name || o.material.type).split(':')[0];
    byMat.set(key, (byMat.get(key) ?? 0) + tris);
  });
  console.info('bench triangles by material:', [...byMat].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k} ${(v / 1e6).toFixed(2)}M`).join(', '));
}
