// Shared night stage for the city and the sample page: renderer, sky, fog, lights, bloom, orbit camera, frame loop.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { palette } from './palette.js';
import { skyDome } from './atmosphere.js';

// span: half-width in metres of the area that needs shadows and fits in the view.
export function createStage({ span, fog, camera: [cx, cy, cz], target: [tx, ty, tz] }) {
  const far = span * 12, renderer = createRenderer(), scene = nightScene(span, fog, far);
  const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.5, far);
  camera.position.set(cx, cy, cz);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(tx, ty, tz);
  controls.maxPolarAngle = Math.PI / 2.1;
  controls.maxDistance = span * 2.5;
  controls.update();

  const composer = createComposer(renderer, scene, camera);
  const render = () => composer.render();
  // Ambient motion (rain, traffic, mist) runs in a frame loop unless the visitor asked for reduced motion;
  // then the city is drawn once and again only when the camera moves.
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const updates = [];
  if (still) controls.addEventListener('change', render);
  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    composer.setSize(innerWidth, innerHeight);
    render();
  });

  return {
    renderer, scene, camera, controls, render, still,
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
      scene.environmentIntensity = 0.45;
    },
    bench: () => bench(renderer, scene, render),
  };
}

function createRenderer() {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // The city does not move, so its shadows are drawn once (on start), not every frame.
  renderer.shadowMap.autoUpdate = false;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  document.body.appendChild(renderer.domElement);
  return renderer;
}

// Night: deep blue zenith, blue haze lit from below by the city; a cool sky fill so dark structure stays readable
// and a soft blue moon for shape and shadows. Warm lamps and neon do the rest.
function nightScene(span, fog, far) {
  const scene = new THREE.Scene();
  scene.add(skyDome([[0, palette.nightFog], [0.05, palette.nightHorizon], [0.25, palette.nightSky], [1, palette.nightZenith]], far * 0.8));
  scene.fog = new THREE.FogExp2(palette.nightFog, fog);
  scene.add(new THREE.HemisphereLight(palette.nightSky, palette.charcoal, 0.9));
  const moon = new THREE.DirectionalLight(palette.moon, 0.8);
  moon.position.set(-25, 45, -30).normalize().multiplyScalar(span * 2.5);
  moon.castShadow = true;
  moon.shadow.mapSize.setScalar(span > 100 ? 4096 : 2048);
  moon.shadow.normalBias = 0.03;
  moon.shadow.radius = 6;
  Object.assign(moon.shadow.camera, { left: -span, right: span, top: span, bottom: -span, far: span * 6 });
  scene.add(moon);
  return scene;
}

// Bloom gives lamps and neon soft halos; kept modest so signs stay readable.
// shortcut: GTAOPass washed the frame out, so contact shading comes only from texture AO and shadows; revisit with a tuned AO pass.
function createComposer(renderer, scene, camera) {
  // Multisampled target: the composer otherwise drops the canvas antialiasing and edges go jagged.
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 }));
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.7, 0.55, 0.65));
  composer.addPass(new OutputPass());
  return composer;
}

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
