// Shared night stage for the city and the sample page: renderer, sky, fog, lights, bloom, orbit camera, frame loop.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { CopyShader } from 'three/addons/shaders/CopyShader.js';
import { css, palette, ui } from './palette.js';
import { MOON, glslColor, skyDome, skyGlsl } from './atmosphere.js';

// The look, in one place: exposure, key (moon), fill (sky) and bounce (city glow) light, bloom [strength, radius,
// threshold], and the haze's thinning with height (density at `aloft` times the street's, from `low` to `high` metres).
export const LOOK = { exposure: 1.35, key: 1.7, fill: 1.3, bounce: 1.5, bloom: [0.5, 0.45, 0.82] };
const HAZE = { aloft: 0.3, low: 25, high: 220 };
// Ground mist: extra haze per metre of sight line at street level, halving every `half` metres of height. It is
// summed along the line from the eye to each point, so it has no edge where a building rises out of it (the flat
// mist layers it replaces left a hard line across every tower they cut).
const MIST = { street: 0.005, half: 25 };
const MIST_RGB = glslColor(palette.nightHorizon); // lit from below, paler than the haze

// The sky (atmosphere.js skyGlsl), shared by the dome and the fog. Polluted twilight: haze at the ground, muted smog
// orange just over the horizon, blue-grey haze, a desaturated dusk blue and a deep zenith; light pollution from the
// city warms the lowest sky.
const SKY = skyGlsl([[0, palette.nightFog], [0.015, palette.smogOrange], [0.07, palette.smogHaze], [0.25, palette.duskBlue],
  [1, palette.duskZenith]], [palette.cityGlow, 0.35]);

// Haze in every material's fog: thickest among the streets and thinning with height, so distant streets fade into
// the night while tall landmarks stay crisp. vFogDir is the fragment's offset from the eye in world space, from the
// view-space position (the view matrix is rigid, so its inverse is a transpose), so sprites and points get it too;
// the fragment's height is its y plus the eye's. The fog's colour is the sky's toward the fragment, so what the haze
// swallows melts into the sky behind it; looking down at the streets that is the plain night haze.
THREE.ShaderChunk.fog_pars_vertex = `#ifdef USE_FOG
  varying float vFogDepth;
  varying vec3 vFogDir;
#endif`;
THREE.ShaderChunk.fog_vertex = `#ifdef USE_FOG
  vFogDepth = - mvPosition.z;
  vFogDir = transpose(mat3(viewMatrix)) * mvPosition.xyz;
#endif`;
THREE.ShaderChunk.fog_pars_fragment = THREE.ShaderChunk.fog_pars_fragment
  .replace('varying float vFogDepth;', `varying float vFogDepth;\n  varying vec3 vFogDir;\n  ${SKY}`);
THREE.ShaderChunk.fog_fragment = `#ifdef USE_FOG
  float vFogHeight = vFogDir.y + cameraPosition.y;
  #ifdef FOG_EXP2
    float fogThin = fogDensity * mix(1.0, ${HAZE.aloft.toFixed(2)}, smoothstep(${HAZE.low.toFixed(1)}, ${HAZE.high.toFixed(1)}, vFogHeight));
    // Mist density e^(-y/H) averaged over the heights the sight line passes (its exact integral over a straight line).
    float mistH = ${(MIST.half / Math.LN2).toFixed(2)}, mistRise = vFogHeight - cameraPosition.y;
    float mistHere = exp(-max(vFogHeight, 0.0) / mistH);
    float mistAvg = abs(mistRise) < 0.5 ? mistHere : mistH * (exp(-max(cameraPosition.y, 0.0) / mistH) - mistHere) / mistRise;
    float fogFactor = 1.0 - exp(- fogThin * fogThin * vFogDepth * vFogDepth);
    float mistFactor = 1.0 - exp(- ${MIST.street.toFixed(4)} * mistAvg * vFogDepth);
  #else
    float fogFactor = smoothstep(fogNear, fogFar, vFogDepth), mistFactor = 0.0;
  #endif
  gl_FragColor.rgb = mix(mix(gl_FragColor.rgb, vec3(${MIST_RGB}), mistFactor), skyAt(normalize(vFogDir)), fogFactor);
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
  } else updates.push((dt, t, raw) => move(Math.min(raw, 0.25))); // keys keep their pace on slow frames
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
      const clock = new THREE.Clock(), govern = governor(renderer, composer);
      renderer.setAnimationLoop(() => {
        const raw = clock.getDelta(), dt = Math.min(raw, 0.1), t = clock.elapsedTime;
        govern(raw, t);
        for (const fn of updates) fn(dt, t, raw);
        render();
      });
    },
    // Reflections are captured from the finished scene once, so glass and the wet street pick up the lights.
    captureReflections(at) {
      const pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromScene(scene, 0.02, 0.5, far, { position: new THREE.Vector3(...at) }).texture;
      scene.environmentIntensity = 0.6;
    },
    bench: () => bench(renderer, scene, render, updates),
  };
}

// Navigation: left-drag turns, right-drag or shift-drag slides over the ground, scroll zooms straight in;
// WASD or arrows move (Shift to go fast), Q and E turn, R and F zoom in and out. The focus point stays within
// `reach` of the centre. Returns a per-frame step for held keys.
function navigate(controls, camera, reach) {
  Object.assign(controls, { screenSpacePanning: false, minDistance: 15, zoomSpeed: 1.8, panSpeed: 1.6,
    mouseButtons: { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN },
    touches: { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN } });
  const keys = { KeyW: [0, 1], ArrowUp: [0, 1], KeyS: [0, -1], ArrowDown: [0, -1], KeyA: [-1, 0], ArrowLeft: [-1, 0],
    KeyD: [1, 0], ArrowRight: [1, 0], KeyQ: [0, 0, 1], KeyE: [0, 0, -1], KeyR: [0, 0, 0, -1], KeyF: [0, 0, 0, 1] };
  const held = new Set();
  let fast = false;
  addEventListener('keydown', (e) => {
    fast = e.shiftKey;
    if (!(e.code in keys)) return;
    held.add(e.code);
    e.preventDefault();
  });
  addEventListener('keyup', (e) => {
    fast = e.shiftKey;
    held.delete(e.code);
  });
  addEventListener('blur', () => {
    held.clear();
    fast = false;
  });
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
    // Faster the higher the view, but never a crawl up close; Shift triples it.
    const far = camera.position.distanceTo(controls.target), speed = Math.max(far, 80) * 1.4 * (fast ? 3 : 1) * dt;
    let turn = 0, zoom = 0;
    shift.set(0, 0, 0);
    for (const code of held) {
      const [x, z, q = 0, r = 0] = keys[code];
      shift.addScaledVector(side, x * speed).addScaledVector(fwd, z * speed);
      turn += q;
      zoom += r;
    }
    slide(shift);
    if (turn) camera.position.sub(controls.target).applyAxisAngle(up, turn * 1.6 * dt).add(controls.target);
    if (zoom) { // toward or away from the focus, within the orbit's limits
      const to = camera.position.clone().sub(controls.target), d = to.length();
      const next = Math.min(Math.max(d * Math.exp(zoom * 1.8 * dt), controls.minDistance), controls.maxDistance);
      camera.position.copy(controls.target).addScaledVector(to, next / d);
    }
    controls.update();
  };
}

// One line of help in the corner, so visitors know the city can be explored.
function hint() {
  const el = Object.assign(document.createElement('div'), {
    textContent: 'Drag to turn · right-drag to move · scroll to zoom · WASD / arrows (Shift: fast) · Q E turn · R F zoom' });
  Object.assign(el.style, { position: 'fixed', left: '12px', bottom: '12px', padding: '6px 10px', borderRadius: '6px',
    font: '12px system-ui, sans-serif', color: css(ui.muted), background: `${css(ui.panel)}cc`,
    border: `1px solid ${css(ui.border)}`, pointerEvents: 'none' });
  document.body.appendChild(el);
}

function createRenderer() {
  // No canvas antialiasing: the composer antialiases the scene (createComposer) and the canvas only ever gets one
  // full-screen picture, where four samples per pixel would all be the same colour.
  const renderer = new THREE.WebGLRenderer({ antialias: false });
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
// below) is kept low so lit and unlit sides separate. A soft mauve glow from the lit haze, low and opposite the moon
// with no shadows, keeps walls turned away from the moon from going black (only the shadow side gets it).
// Warm windows, lamps and neon do the rest.
function nightScene(span, fog, far) {
  const scene = new THREE.Scene();
  scene.add(skyDome(SKY, far * 0.8));
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
  const glow = new THREE.DirectionalLight(palette.cloudGlow, LOOK.bounce);
  glow.position.set(-MOON.x, 0.3, -MOON.z);
  scene.add(glow);
  return scene;
}

// Frame rate first on slow GPUs: when frames average over 22 ms (under about 45 fps) for two seconds, draw fewer
// pixels, a step at a time down to 0.7 per CSS pixel. It never steps back up (no see-sawing), and a GPU that keeps
// up is never touched, so the look only changes where it was stuttering. A stalled or hidden tab says nothing about
// the GPU, and the first seconds are shader compiles, so neither counts.
export function governor(renderer, composer, step = 0.15, floor = 0.7) {
  let sum = 0, n = 0;
  return (dt, t) => {
    if (t < 4 || dt >= 0.25) return;
    sum += dt;
    n++;
    if (sum < 2) return;
    const slow = sum / n > 0.022, now = renderer.getPixelRatio();
    sum = n = 0;
    if (!slow || now <= floor) return;
    const next = Math.max(floor, now - step);
    renderer.setPixelRatio(next);
    composer.setPixelRatio(next);
    renderer.setSize(innerWidth, innerHeight);
    composer.setSize(innerWidth, innerHeight);
    console.info(`resolution: ${next.toFixed(2)} pixels per CSS pixel (frames were slow)`);
  };
}

// Bloom gives lamps and neon soft halos; only the brightest light blooms (threshold), so facades keep their detail.
// The grade runs at the end of the output pass (tone mapping and colour space), so it costs no extra full-screen pass.
// shortcut: GTAOPass washed the frame out, so contact shading comes from shadows, texture AO and the facades'
// street-canyon darkening (facade.js); revisit with a tuned half-resolution AO pass if it is still missing.
function createComposer(renderer, scene, camera) {
  // The scene draws into a multisampled target (antialiased edges), then is copied once into a plain one, where
  // bloom adds its glow: adding it to every one of four samples cost several times as much for the same picture.
  // The copy swaps the two targets and so does the output pass, so the scene always lands in the multisampled one
  // (renderTarget2, the first read buffer); keep the swaps per frame even when adding passes.
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType }));
  composer.renderTarget2.samples = 4;
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new ShaderPass(CopyShader));
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
// passes), which materials hold the most triangles, and what the per-frame updates cost on the CPU.
function bench(renderer, scene, render, updates) {
  if (!new URLSearchParams(location.search).has('bench')) return;
  const gl = renderer.getContext();
  renderer.info.autoReset = false;
  renderer.info.reset();
  renderer.shadowMap.needsUpdate = true;
  render();
  const { calls, triangles } = renderer.info.render;
  renderer.info.autoReset = true;
  // Reading a pixel back waits for the GPU to finish the frame; gl.finish() returns early on ANGLE (Windows), which
  // made the bench report a fraction of the real frame time.
  const px = new Uint8Array(4), wait = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  wait();
  const t0 = performance.now();
  for (let i = 0; i < 30; i++) {
    render();
    wait();
  }
  console.info(`bench: ${((performance.now() - t0) / 30).toFixed(1)} ms/frame, ${calls} draw calls, ${triangles} triangles per frame`);
  const byMat = new Map();
  scene.traverse((o) => {
    if (!o.isMesh) return;
    const tris = (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3 * (o.count ?? 1);
    const key = (o.material.name || o.material.type).split(':')[0];
    byMat.set(key, (byMat.get(key) ?? 0) + tris);
  });
  const cost = updates.map((fn) => {
    const u0 = performance.now();
    for (let i = 0; i < 30; i++) fn(1 / 60, 10 + i / 60, 1 / 60);
    return [(performance.now() - u0) / 30, fn.toString().replace(/\s+/g, ' ').slice(0, 70)];
  }).sort((a, b) => b[0] - a[0]);
  console.info(`bench updates: ${cost.reduce((a, [ms]) => a + ms, 0).toFixed(2)} ms/frame in ${updates.length}; top:
${cost.slice(0, 6).map(([ms, src]) => `${ms.toFixed(2)} ms ${src}`).join('\n')}`);
  console.info('bench triangles by material:', [...byMat].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k} ${(v / 1e6).toFixed(2)}M`).join(', '));
}
