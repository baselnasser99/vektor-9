// IKARO's eye (headquarters.js): a giant crimson hologram floating in the gap between the two towers, above the
// skybridge, watching the city. Light, not an object: layered additive geometry, every part drawn in one shader with
// fine scanlines, a slow refresh band and, now and then, a slice slipping sideways; fog takes it with distance like
// anything else. Its depth: a curved lens front and back, two almond rims, an iris ring with radial ticks, a pupil,
// a soft halo, and thin fragments drifting round it.
//
// It watches: the iris and pupil move inside the almond, the whole eye turns a little with them, and a slow state
// machine, the same for every visitor at the same moment (driven by time alone), decides where it looks: scanning
// the skyline from side to side, holding a gaze, moving to a new one, and now and then turning to the camera. Its
// gaze toward the camera is worked out in the eye's own frame and clamped inside the almond. Nothing flashes or
// blinks; with reduced motion there is no frame loop and it holds still, looking ahead.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { palette } from './palette.js';
import { rng } from './geometry.js';
import { HQ, siteAt } from './headquarters.js';
import { radialTexture } from './textures.js';

const W = 15, H = 6.8; // the almond, across and high (m)
const glsl = (c) => new THREE.Color(c);

// The holographic material: additive light in `color`, faded at `alpha`, with scanlines and the glitch slice;
// flicker: each little piece of the geometry (the fragments) brightens and fades slowly, out of step with the others.
function holo(color, alpha, time, glitch, flicker = false) {
  const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: alpha, blending: THREE.AdditiveBlending,
    depthWrite: false, side: THREE.DoubleSide });
  m.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, { uTime: time, uGlitch: glitch });
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLocal;\nvarying float vFlick;\nuniform float uTime, uGlitch;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vLocal = position;
        float hp = fract(sin(dot(floor(position.xy * 1.5), vec2(12.9898, 78.233))) * 43758.5453);
        vFlick = ${flicker ? '0.35 + 0.65 * (0.5 + 0.5 * sin(uTime * 1.3 + hp * 6.28))' : '1.0'};
        // The glitch: one thin horizontal slice slips sideways for a moment.
        float slice = step(abs(position.y - (fract(uGlitch * 7.13) - 0.5) * ${H.toFixed(1)}), 0.35);
        transformed.x += slice * step(0.5, uGlitch) * 0.6;`);
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLocal;\nvarying float vFlick;\nuniform float uTime;')
      .replace('#include <opaque_fragment>', `
        float scan = 0.72 + 0.28 * sin(vLocal.y * 22.0 - uTime * 2.2);  // fine scanlines drifting up
        float band = exp(-pow((vLocal.y - (fract(uTime * 0.11) * 1.6 - 0.8) * ${H.toFixed(1)}) * 1.6, 2.0)); // a slow refresh band
        float breathe = 0.9 + 0.1 * sin(uTime * 0.7);
        outgoingLight *= (scan * breathe + band * 0.6) * vFlick;
        #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => `holo:${flicker}`;
  return m;
}

// An almond outline (n points round), w across and h high.
function almond(w, h, n = 64) {
  return Array.from({ length: n }, (_, i) => {
    const t = (i / n) * Math.PI * 2, s = Math.sin(t);
    return new THREE.Vector2((w / 2) * Math.cos(t), (h / 2) * Math.sign(s) * Math.abs(s) ** 0.8);
  });
}

export function hqEye(site, camera, onFrame) {
  const time = { value: 0 }, glitch = { value: 0 };
  const crimson = glsl(palette.coreCrimson), scarlet = glsl(palette.coreScarlet), coral = glsl(palette.coreCoral);
  const g = new THREE.Group(), body = new THREE.Group(), look = new THREE.Group();
  g.add(body);
  // The lens, front and back: the almond filled and bulged toward each side, faint.
  for (const side of [1, -1]) {
    const geo = new THREE.ShapeGeometry(new THREE.Shape(almond(W * 0.96, H * 0.92)), 24), p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) / (W / 2), y = p.getY(i) / (H / 2);
      p.setZ(i, side * 1.6 * Math.max(0, 1 - x * x - y * y * 0.6));
    }
    geo.computeVertexNormals();
    body.add(new THREE.Mesh(geo, holo(crimson, 0.22, time, glitch)));
  }
  // The rims: the almond as a tube, bright; a second, larger and fainter, a little behind.
  for (const [k, alpha, r, z] of [[1, 1, 0.2, 0], [1.14, 0.4, 0.08, -0.6], [1.26, 0.2, 0.05, 0.5]]) {
    const pts = almond(W * k, H * k).map((v) => new THREE.Vector3(v.x, v.y, z));
    body.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 128, r, 6, true), holo(k === 1 ? scarlet : crimson, alpha, time, glitch)));
  }
  // The iris and pupil, moved by the gaze: a ring, radial ticks, an inner ring, the pupil (brightest), front and back.
  const iris = new THREE.Group();
  iris.add(new THREE.Mesh(new THREE.RingGeometry(1.75, 2.35, 48), holo(crimson, 0.85, time, glitch)));
  iris.add(new THREE.Mesh(new THREE.RingGeometry(1.15, 1.3, 40), holo(scarlet, 0.7, time, glitch)));
  const ticks = Array.from({ length: 28 }, (_, k) => new THREE.PlaneGeometry(0.06, 0.42).translate(0, 1.55, 0).rotateZ((k / 28) * Math.PI * 2));
  iris.add(new THREE.Mesh(mergeGeometries(ticks), holo(scarlet, 0.55, time, glitch)));
  iris.add(new THREE.Mesh(new THREE.CircleGeometry(0.85, 32), holo(coral, 1, time, glitch)));
  iris.add(new THREE.Mesh(new THREE.CircleGeometry(1.15, 32), holo(scarlet, 0.45, time, glitch)));
  for (const z of [1.7, -1.7]) {
    const c = iris.clone();
    c.position.z = z;
    look.add(c);
  }
  body.add(look);
  // A soft halo behind it all, for a restrained bloom of its own.
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(W * 1.7, H * 2.4), new THREE.MeshBasicMaterial({ color: crimson,
    transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    map: radialTexture(128) }));
  body.add(halo);
  // Fragments: thin slivers in a shell round the eye, one mesh, each flickering slowly and out of step (holo's
  // flicker), the whole shell turning slowly.
  const r = rng(4049), pieces = Array.from({ length: 40 }, (_, k) => {
    const a = (k / 40) * Math.PI * 2 + r() * 0.3, d = 1.05 + r() * 0.35;
    return new THREE.PlaneGeometry(0.3 + r() * 1.5, 0.05 + r() * 0.18)
      .translate(Math.cos(a) * (W / 2) * d, Math.sin(a) * (H / 2) * d * 1.2, (r() - 0.5) * 3);
  });
  const shards = new THREE.Mesh(mergeGeometries(pieces), holo(crimson, 0.55, time, glitch, true));
  g.add(shards);

  // Placement: centred in the gap, above the bridge, facing the street (the site's front).
  const [x, z] = siteAt(site, 0, HQ.eye.w);
  g.position.set(x, HQ.eye.y + 0.18, z);
  g.rotation.y = site.heading;

  // The gaze. Time is cut into spans of 4 to 9 s, each a scan, a hold, a move or a look at the camera, picked from its
  // index (the same for everyone); the pupil eases toward that span's target. (gx, gy): across and up, -1..1.
  const hash = (k) => { const v = Math.sin(k * 127.1 + 31.7) * 43758.5453; return v - Math.floor(v); };
  const span = (k) => 4 + hash(k) * 5;
  let k = 0, start = 0, gx = 0, gy = 0, gaze = [0, 0];
  const local = new THREE.Vector3();
  function target(t) {
    while (t - start > span(k)) { start += span(k); k++; }
    const kind = hash(k * 3.1), f = (t - start) / span(k);
    if (kind < 0.35) return [Math.sin((t - start) * 0.5 + k) * 0.95, -0.15 + 0.1 * Math.sin(k)]; // scanning
    if (kind < 0.8) return [(hash(k * 5.7) - 0.5) * 1.7, (hash(k * 9.2) - 0.5) * 0.6 - (f < 0.2 ? 0 : 0)]; // hold / move
    // Looking at the camera, in the eye's own frame.
    local.copy(camera.position);
    g.worldToLocal(local);
    const n = local.normalize();
    return [THREE.MathUtils.clamp(n.x * 2.2, -1, 1), THREE.MathUtils.clamp(n.y * 1.6, -0.6, 0.6)];
  }
  function place(dt) {
    const tgt = target(time.value);
    const ease = 1 - Math.exp(-dt * 1.4); // slow, deliberate
    gx += (tgt[0] - gx) * ease;
    gy += (tgt[1] - gy) * ease;
    // The iris stays inside the almond: an ellipse a little smaller than it, less the iris itself.
    let ix = gx * (W / 2 - 2.6), iy = gy * (H / 2 - 2.0);
    const e = (ix / (W / 2 - 2.6)) ** 2 + (iy / (H / 2 - 2.0)) ** 2;
    if (e > 1) { ix /= Math.sqrt(e); iy /= Math.sqrt(e); }
    gaze = [ix, iy];
    look.position.set(ix, iy, 0);
    body.rotation.y = gx * 0.22; // the whole eye turns a little with its gaze
    body.rotation.x = -gy * 0.12;
    body.position.y = Math.sin(time.value * 0.4) * 0.25;
    shards.rotation.z = time.value * 0.015; // the fragments' shell turns slowly
    // A glitch now and then: about every 9 s, for a quarter of a second.
    const phase = time.value % 9.3;
    glitch.value = phase < 0.25 ? 1 + Math.floor(time.value / 9.3) : 0;
  }
  onFrame((dt) => {
    time.value += dt;
    place(dt);
  });
  place(0);
  g.userData.gaze = () => gaze;
  return g;
}
