// Sound geometry in every mesh Node can build, on the frozen v3 fixtures: every position finite, every normal finite
// and of unit length, and no zero-area triangle. A zero normal is NaN in the shader once normalized, and bloom spreads
// one NaN pixel into a black frame: a parapet's landing end, where its section collapses to the road, drew a triangle
// with zero normals and blacked out the screen from (194, 22, -2) (docs/visual/VIEWS.md, view 31).
// Covered, each on its own so a failure names its builder: the interchange, the streets, the verge, the whole city
// as merged (city.js buildCity: those three again with every tile, prop, the railway and the HQ, through a kit whose
// Blender models are empty groups), the desert, the traffic with its signals and the trains (instanced, their
// geometry as built), and the power plant in each of its layouts, mirrored and not, lit and dark. Not covered,
// browser only or not meshes: the Blender models' own geometry, people and
// figures, the HQ's eye, the aircars, the sky (atmosphere.js) and steam.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildCity, cityPlan } from '../../web/src/city.js';
import { buildDesert } from '../../web/src/desert.js';
import { blockCuts, buildInterchange } from '../../web/src/interchange.js';
import { rng } from '../../web/src/geometry.js';
import { traffic, trains } from '../../web/src/life.js';
import { mergeByMaterial } from '../../web/src/merge.js';
import { powerPlant } from '../../web/src/plant.js';
import { buildStreets } from '../../web/src/streets.js';
import { verge } from '../../web/src/terrain.js';
import { fixture } from './harness.mjs';

const mats = new Map();
const tag = (name) => mats.get(name) ?? mats.set(name, Object.assign(new THREE.MeshStandardMaterial(), { name, emissiveMap: new THREE.Texture() })).get(name);
const model = () => { // an empty Blender model whose named parts appear when asked for
  const g = new THREE.Group(), find = g.getObjectByName.bind(g);
  g.getObjectByName = (n) => find(n) ?? g.add(Object.assign(new THREE.Group(), { name: n })).children.at(-1);
  return g;
};
const kit = new Proxy({}, { get: (_, k) => (k === 'model' ? model : k === 'foldDetail' ? (g) => g : (...a) => tag(`${String(k)}:${a[0]}`)) });
const AREA = 1e-8; // m²: below this a triangle has no real extent

function problems(...roots) {
  const wrong = [], seen = new Set();
  for (const r of roots) r.traverse((m) => {
    if (!m.isMesh || seen.has(m.geometry)) return;
    seen.add(m.geometry);
    const g = m.geometry, P = g.attributes.position.array, N = g.attributes.normal?.array, I = g.index?.array, what = m.material.name || m.material.type;
    const at = (v) => [P[v * 3], P[v * 3 + 1], P[v * 3 + 2]].map((c) => +c.toFixed(3)).join(', ');
    if (!N) wrong.push(`${what}: no normals`);
    for (let v = 0; v < P.length / 3; v++) {
      const l = N && Math.hypot(N[v * 3], N[v * 3 + 1], N[v * 3 + 2]);
      if (![P[v * 3], P[v * 3 + 1], P[v * 3 + 2]].every(Number.isFinite)) wrong.push(`${what}: vertex ${v} not finite`);
      else if (N && !(Math.abs(l - 1) < 1e-3)) wrong.push(`${what}: normal of length ${l.toFixed(3)} at (${at(v)})`);
    }
    const n = I ? I.length : P.length / 3;
    for (let t = 0; t < n; t += 3) {
      const [a, b, c] = [0, 1, 2].map((k) => (I ? I[t + k] : t + k) * 3);
      const u = [0, 1, 2].map((k) => P[b + k] - P[a + k]), w = [0, 1, 2].map((k) => P[c + k] - P[a + k]);
      const area = Math.hypot(u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]) / 2;
      if (!(area >= AREA)) wrong.push(`${what}: zero-area triangle at (${at(a / 3)})`);
    }
  });
  return wrong;
}

const quiet = (f) => {
  const info = console.info;
  console.info = () => {};
  try { return f(); } finally { console.info = info; }
};
const builders = {
  interchange: (snap, { layout }) => {
    const root = new THREE.Group();
    buildInterchange(kit, root, layout, snap);
    return [mergeByMaterial(root)];
  },
  streets: (snap, { layout }) => {
    const root = new THREE.Group();
    buildStreets(kit, layout, root);
    return [mergeByMaterial(root)];
  },
  verge: (snap, { layout }) => { // each road tile's, with the cuts buildCity gives it
    const root = new THREE.Group(), cuts = layout.expressway ? blockCuts(layout).verge : [];
    snap.tiles.forEach((t, i) => {
      if (t.k !== 'road') return;
      const [x, z] = [layout.pos(i % layout.n), layout.pos(Math.floor(i / layout.n))];
      root.add(verge(kit, cuts.map((c) => c.map(([u, v]) => [u - x, v - z]))).translateX(x).translateZ(z));
    });
    return [mergeByMaterial(root)];
  },
  city: (snap, { built }) => [built.city, ...built.city.userData.lods],
  desert: (snap, { built, layout }) => [buildDesert(kit, built.edge, built.lines, () => {}, layout)],
  'traffic and signals': (snap, { built }) => [traffic(kit, built.roads, () => {}, built.warp, built.hub, built.parked)],
  trains: (snap, { built }) => (built.rail ? [trains(kit, built.rail, () => {})] : []),
};

for (const name of ['sim-v3-seed7-t288.json.gz', 'sim-v3-seed3-t288.json.gz']) {
  let ctx;
  const setup = () => {
    if (ctx) return ctx;
    const snap = fixture(name);
    return (ctx = { snap, layout: cityPlan(snap).layout, built: quiet(() => buildCity(kit, snap)) });
  };
  for (const [builder, build] of Object.entries(builders)) {
    test(`${name}: ${builder}: finite positions, unit normals and no zero-area triangle`, () => {
      const c = setup(), roots = quiet(() => build(c.snap, c));
      const wrong = problems(...roots);
      assert.deepEqual(wrong.slice(0, 20), [], `${wrong.length} problems`);
    });
  }
}

test('power plants, every layout and mirror, lit and dark: finite positions, unit normals and no zero-area triangle', () => {
  const seen = new Set();
  for (let s = 0; seen.size < 6; s++) {
    const { layout, mirrored } = powerPlant(kit, rng(s), true).userData;
    if (seen.has(`${layout} ${mirrored}`)) continue;
    seen.add(`${layout} ${mirrored}`);
    for (const lit of [true, false]) {
      const wrong = problems(powerPlant(kit, rng(s), lit));
      assert.deepEqual(wrong.slice(0, 20), [], `${layout}, mirrored ${mirrored}, lit ${lit}: ${wrong.length} problems`);
    }
  }
});
