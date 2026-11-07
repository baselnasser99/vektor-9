// IKARO's eye (headquarters.js): a synthetic crimson surveillance eye, over 30 m across, floating over the gap
// between the two towers (just ahead of their fronts), high above the skybridge. Light, not an object: layered
// additive geometry, every part drawn in one shader with fine scanlines, a slow refresh band, a thin data line and,
// now and then, a gentle interference; fog takes it with distance like anything else.
//
// Its form is an eye, not a reticle: a long horizontal outline with pointed corners and a heavy upper lid (the
// lower lid flatter, the top's apex set a little off centre), a curved lens front and back, a bright rim with a
// thin inner rim ahead and behind, broken arcs of larger outlines round it, a brow stroke over the upper lid and a
// short tail off one corner. Inside, the iris is a faint disc of broken rings turning slowly in opposite directions
// and irregular fibres, round a vertical slit pupil, the brightest thing in it; the iris is clipped by the lids, so
// when the eye narrows it is covered top and bottom like a real one. Horizontal glitch streaks trail off its corners,
// with a fine shell of particles; a soft elliptical halo sits behind it all.
//
// It watches: the iris moves inside the outline, the whole eye turns a little with it, and a slow state machine,
// driven by time alone, decides where it looks: scanning the skyline slowly, holding a gaze and re-aiming it a
// little, pausing near the middle as if thinking, and rarely locking on the camera, when the eye narrows and the
// slit tightens. Nothing flashes or blinks; with reduced motion there is no frame loop and it holds still.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { palette } from './palette.js';
import { rng } from './geometry.js';
import { HQ, siteFrame } from './headquarters.js';
import { radialTexture } from './textures.js';

const W = 15, H = 6.4; // the outline, across and high, in the eye's own units (scaled by HQ.eye.scale)
const LOW = 0.72; // the lower lid, flatter than the upper

// The holographic material: additive light in `color`, faded at `alpha`, with scanlines, the glitch slice and the
// interference. flicker: each little piece (the debris) brightens and fades slowly, out of step with the others.
// clip: drawn only inside the lids as they are now (the iris), worked out in the eye's own frame (u.eye, u.open).
function holo(color, alpha, u, { flicker = false, clip = false } = {}) {
  const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: alpha, blending: THREE.AdditiveBlending,
    depthWrite: false, side: THREE.DoubleSide });
  m.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, { uTime: u.time, uGlitch: u.glitch, uNoise: u.noise, uEye: u.eye, uOpen: u.open });
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLocal, vEye;\nvarying float vFlick;\nuniform float uTime, uGlitch;\nuniform mat4 uEye;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vLocal = position;
        float hp = fract(sin(dot(floor(position.xy * 1.5), vec2(12.9898, 78.233))) * 43758.5453);
        vFlick = ${flicker ? '0.35 + 0.65 * (0.5 + 0.5 * sin(uTime * 1.3 + hp * 6.28))' : '1.0'};
        // The glitch: one thin horizontal slice slips a little sideways for a moment.
        float slice = step(abs(position.y - (fract(uGlitch * 7.13) - 0.5) * ${H.toFixed(1)}), 0.3);
        transformed.x += slice * step(0.5, uGlitch) * 0.25;
        vEye = (uEye * modelMatrix * vec4(transformed, 1.0)).xyz;`);
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLocal, vEye;\nvarying float vFlick;\nuniform float uTime, uNoise, uOpen;')
      .replace('#include <opaque_fragment>', `
        ${clip ? `float across = max(0.0, 1.0 - pow(abs(vEye.x) / ${(W / 2 * 0.95).toFixed(2)}, 2.0)), lid = ${(H / 2 * 0.92).toFixed(2)} * uOpen;
        if (vEye.y > lid * pow(across, 0.62) || vEye.y < -lid * ${LOW.toFixed(2)} * pow(across, 0.75)) discard;` : ''}
        // Fine scanlines drifting up; during interference they waver sideways a little and the light dips slightly.
        float waver = sin(vLocal.x * 3.0 + uTime * 9.0) * uNoise * 0.8;
        float scan = 0.72 + 0.28 * sin(vEye.y * 22.0 - uTime * 2.2 + waver);
        float band = exp(-pow((vEye.y - (fract(uTime * 0.11) * 1.6 - 0.8) * ${H.toFixed(1)}) * 1.6, 2.0)); // a slow refresh band
        float sweep = exp(-pow((vEye.y - (0.5 - fract(uTime * 0.17)) * ${(H * 1.4).toFixed(1)}) * 7.0, 2.0)) * 0.35; // a thin data line sweeping down
        float breathe = 0.9 + 0.1 * sin(uTime * 0.7);
        outgoingLight *= (scan * breathe + band * 0.6 + sweep) * vFlick * (1.0 - 0.15 * uNoise);
        #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => `holo:${flicker}:${clip}`;
  return m;
}

// The eye's outline (n points round), w across and h high: pointed corners, a heavy arched upper lid whose apex sits
// a little toward +x, a flatter lower lid.
function outline(w, h, n = 72) {
  return Array.from({ length: n }, (_, i) => {
    const t = (i / n) * Math.PI * 2, c = Math.cos(t), s = Math.sin(t);
    const x = (w / 2) * c + (s > 0 ? w * 0.05 * s * s : 0);
    const y = s > 0 ? (h / 2) * s ** 1.25 : -(h / 2) * LOW * Math.abs(s) ** 1.5; // powers over 1: pointed corners
    return new THREE.Vector3(x, y, 0);
  });
}
// A tube along part of an outline: points i0..i1 of it (wrapping), at depth z.
function stroke(pts, i0, i1, r, z = 0) {
  const n = pts.length, run = [];
  for (let i = i0; i <= i1; i++) run.push(pts[((i % n) + n) % n].clone().setZ(z));
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(run), Math.max(8, run.length * 2), r, 5, false);
}

export function hqEye(site, camera, onFrame) {
  const u = { time: { value: 0 }, glitch: { value: 0 }, noise: { value: 0 }, eye: { value: new THREE.Matrix4() }, open: { value: 1 } };
  const crimson = new THREE.Color(palette.coreCrimson), scarlet = new THREE.Color(palette.coreScarlet), coral = new THREE.Color(palette.coreCoral);
  const g = new THREE.Group(), body = new THREE.Group(), shell = new THREE.Group(), look = new THREE.Group();
  g.add(body);
  body.add(shell, look);
  const r = rng(4049);

  // The shell (it narrows): the lens front and back, the rims, the broken outer arcs, the brow, the tail. Parts
  // that look alike share one mesh.
  const lens = [1, -1].map((side) => {
    const geo = new THREE.ShapeGeometry(new THREE.Shape(outline(W * 0.96, H * 0.94).map((p) => new THREE.Vector2(p.x, p.y))), 24);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) / (W / 2), y = p.getY(i) / (H / 2);
      p.setZ(i, side * 1.5 * Math.max(0, 1 - x * x - y * y * 0.6));
    }
    return geo;
  });
  shell.add(new THREE.Mesh(mergeGeometries(lens), holo(crimson, 0.2, u)));
  const main = outline(W, H), thin = outline(W * 0.86, H * 0.84);
  shell.add(new THREE.Mesh(stroke(main, 0, main.length, 0.15), holo(scarlet, 0.9, u)));
  shell.add(new THREE.Mesh(mergeGeometries([0.9, -0.9].map((z) => stroke(thin, 0, 72, 0.05, z))), holo(crimson, 0.28, u)));
  // Broken arcs of two larger outlines, a little offset and askew: fragments, never a closed ring.
  const arcs = [];
  for (const [k, z, runs] of [[1.12, -0.6, [[2, 15], [20, 31], [40, 52], [58, 67]]], [1.25, 0.5, [[5, 11], [27, 34], [44, 49], [61, 70]]]]) {
    const pts = outline(W * k, H * k * 1.08).map((p) => p.add(new THREE.Vector3(0.3, -0.1, 0)));
    for (const [a, b] of runs) arcs.push(stroke(pts, a, b, k > 1.2 ? 0.05 : 0.08, z));
  }
  const arcMesh = new THREE.Mesh(mergeGeometries(arcs), holo(crimson, 0.38, u));
  arcMesh.rotation.z = 0.02;
  shell.add(arcMesh);
  const brow = stroke(outline(W * 1.06, H * 1.2), 8, 28, 0.13, 0.2); // over the upper lid
  const tail = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(W / 2 + 0.2, -0.05, 0), new THREE.Vector3(W / 2 + 1.2, -0.35, 0),
    new THREE.Vector3(W / 2 + 2.1, -0.4, 0)]), 12, 0.06, 5, false);
  shell.add(new THREE.Mesh(mergeGeometries([brow, tail]), holo(scarlet, 0.65, u)));

  // The iris (it moves; clipped by the lids): a faint disc, broken rings turning slowly in opposite directions,
  // irregular fibres, a vertical slit pupil and its glow. Each part carries a front and a back copy in one geometry,
  // close together (further apart they read as two pupils from the side); the rings turn about the shared axis.
  const twin = (geo) => mergeGeometries([0.5, -0.5].map((z) => geo.clone().translate(0, 0, z)));
  const part = (geo, color, alpha) => new THREE.Mesh(twin(geo), holo(color, alpha, u, { clip: true }));
  const arcsOf = (r0, r1, n, runs) => mergeGeometries(runs.map(([a, l]) => new THREE.RingGeometry(r0, r1, n, 1, a, l)));
  const fibres = Array.from({ length: 46 }, () => {
    const a = r() * Math.PI * 2, r0 = 0.95 + r() * 0.35, r1 = r0 + 0.35 + r() * 0.8;
    return new THREE.PlaneGeometry(0.04 + r() * 0.04, r1 - r0).translate(0, (r0 + r1) / 2, 0).rotateZ(a);
  });
  const outer = part(arcsOf(1.95, 2.28, 24, [[0.2, 1.7], [2.15, 1.25], [3.7, 2.1]]), crimson, 0.85);
  const inner = part(arcsOf(1.38, 1.5, 20, [[0.9, 2.2], [3.6, 1.6], [5.5, 0.6]]), scarlet, 0.7);
  const pupil = new THREE.Group();
  pupil.add(part(new THREE.CircleGeometry(0.9, 32).scale(0.85, 1.75, 1), scarlet, 0.4), part(new THREE.CircleGeometry(0.9, 32).scale(0.42, 1.45, 1), coral, 1));
  look.add(part(new THREE.CircleGeometry(2.3, 40), scarlet, 0.16), outer, inner, part(mergeGeometries(fibres), scarlet, 0.45), pupil);

  // A soft elliptical halo behind it all, for a restrained bloom of its own.
  body.add(new THREE.Mesh(new THREE.PlaneGeometry(W * 1.4, H * 1.5), new THREE.MeshBasicMaterial({ color: crimson,
    transparent: true, opacity: 0.09, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, map: radialTexture(128) })));
  // Glitch debris: horizontal streaks trailing off the corners and along the eye's axis, and a fine shell of
  // particles, each flickering slowly out of step; one mesh, turning very slowly.
  const streaks = Array.from({ length: 36 }, () => {
    const side = r() < 0.5 ? -1 : 1, x = side * (W / 2) * (0.55 + r() * 0.75), y = (r() - 0.5) * H * (0.25 + r() * 0.5);
    return new THREE.PlaneGeometry(0.4 + r() * 2.0, 0.04 + r() * 0.11).translate(x, y, (r() - 0.5) * 2.4);
  });
  const motes = Array.from({ length: 140 }, () => {
    const a = r() * Math.PI * 2, d = 1.08 + r() * 0.45, s = 0.05 + r() * 0.1;
    return new THREE.PlaneGeometry(s, s).translate(Math.cos(a) * (W / 2) * d, Math.sin(a) * (H / 2) * d * 1.5, (r() - 0.5) * 2.4);
  });
  const debris = new THREE.Mesh(mergeGeometries([...streaks, ...motes]), holo(crimson, 0.55, u, { flicker: true }));
  g.add(debris);

  // Placement: centred on the gap, high above the bridge and just ahead of the towers' fronts, facing the street;
  // built at its own size and scaled (the shader works in the eye's own frame).
  const [x, z] = siteFrame(site).at(0, HQ.eye.w);
  g.position.set(x, HQ.eye.y + 0.18, z);
  g.rotation.y = site.heading;
  g.scale.setScalar(HQ.eye.scale);

  // The gaze. Time is cut into spans of 5 to 11 s, each picked from its index (the same for everyone): a slow scan
  // across the skyline (30%), a hold on one point with a small vertical adjustment part way through (45%), a pause
  // back near the middle, a little down, as if thinking (15%), or, rarely, a lock on the camera (10%), when the eye
  // narrows and the slit tightens. Holds carry tiny shifts every second or so. Each target is (across, up, how open
  // the eye is, how wide the slit is); everything eases slowly toward it.
  const hash = (k) => { const v = Math.sin(k * 127.1 + 31.7) * 43758.5453; return v - Math.floor(v); };
  const span = (k) => 5 + hash(k) * 6;
  let k = 0, start = 0, gx = 0, gy = 0, open = 1, slit = 1, gaze = [0, 0];
  const local = new THREE.Vector3();
  function target(t) {
    while (t - start > span(k)) { start += span(k); k++; }
    const kind = hash(k * 3.1), f = (t - start) / span(k), tick = Math.floor(t * 0.8);
    const jitter = [(hash(tick * 1.7 + k) - 0.5) * 0.04, (hash(tick * 2.3 + k) - 0.5) * 0.03]; // tiny, slow
    if (kind < 0.3) return [Math.sin((t - start) * 0.25 + k) * 0.95, -0.15 + 0.1 * Math.sin(k), 0.92, 1]; // scanning
    if (kind < 0.75) { // a deliberate hold, re-aimed a little up or down part way through
      const lift = f > 0.55 ? (hash(k * 4.4) - 0.5) * 0.5 : 0;
      return [(hash(k * 5.7) - 0.5) * 1.7 + jitter[0], (hash(k * 9.2) - 0.5) * 0.5 + lift + jitter[1], 1, 1.1];
    }
    if (kind < 0.9) return [jitter[0] * 2, -0.2 + jitter[1], 0.84, 0.9]; // thinking: the middle, a little down
    local.copy(camera.position); // locked on the camera, in the eye's own frame
    g.worldToLocal(local);
    const n = local.normalize();
    return [THREE.MathUtils.clamp(n.x * 2.2, -1, 1), THREE.MathUtils.clamp(n.y * 1.6, -0.6, 0.6), 0.7, 0.55];
  }
  // Interference: now and then (every 11 to 24 s, irregularly) a moment, under half a second, when the scanlines waver,
  // the light dips slightly and one thin slice slips a little sideways. Never a flash.
  let nextGlitch = 11, glitchAt = -10;
  function place(dt) {
    const t = u.time.value, tgt = target(t);
    const ease = 1 - Math.exp(-dt * 1.0), slow = 1 - Math.exp(-dt * 0.8); // slow, deliberate
    gx += (tgt[0] - gx) * ease;
    gy += (tgt[1] - gy) * ease;
    open += (tgt[2] - open) * slow;
    slit += (tgt[3] - slit) * slow;
    // The iris stays inside the outline (it may slip partly under the lids, which clip it).
    let ix = gx * (W / 2 - 2.8), iy = gy * (H / 2 - 1.4);
    const e = (ix / (W / 2 - 2.8)) ** 2 + (iy / (H / 2 - 1.4)) ** 2;
    if (e > 1) { ix /= Math.sqrt(e); iy /= Math.sqrt(e); }
    gaze = [ix, iy];
    look.position.set(ix, iy, 0);
    shell.scale.y = open;
    u.open.value = open;
    pupil.scale.set(slit * (1 + 0.04 * Math.sin(t * 0.9)), 1, 1); // the slit breathes a little
    outer.rotation.z = t * 0.05;
    inner.rotation.z = -t * 0.08;
    body.rotation.y = gx * 0.22; // the whole eye turns a little with its gaze
    body.rotation.x = -gy * 0.12;
    body.position.y = Math.sin(t * 0.4) * 0.25;
    debris.rotation.z = t * 0.01;
    g.updateMatrixWorld(true);
    u.eye.value.copy(body.matrixWorld).invert(); // the clip's frame: the body, before the shell narrows
    if (t >= nextGlitch) {
      glitchAt = t;
      nextGlitch = t + 11 + hash(Math.floor(t)) * 13;
    }
    const since = t - glitchAt;
    u.noise.value = since < 0.45 ? Math.sin((since / 0.45) * Math.PI) : 0; // eases in and out
    u.glitch.value = since < 0.18 ? 1 + Math.floor(glitchAt) : 0;
  }
  onFrame((dt) => {
    u.time.value += dt;
    place(dt);
  });
  place(0);
  g.userData.gaze = () => gaze;
  return g;
}
