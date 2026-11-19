// No walker or car path at the interchange runs through a wall, parapet or deck slab, except the crossings that
// were there before (tests/fixtures/ramp-crossings-allowlist.json, measured on origin/main at 1d9d988, less the six
// on each fixture the landed loops removed (ADR-0011, amendment of 2026-11-19); the list may only shrink). On the frozen v3 fixtures:
// - every car lane and every move through a node (life.js edges) is swept as a box 1.8 m wide, from 0.6 m under to
//   0.9 m over its path (the path runs 0.65 m over the road);
// - every walking network edge (people.js network), node to node, at three distances in from the kerb and two wait
//   depths, is swept 0.5 m wide from the ground (network.ground) to 1.8 m over it;
// - against every face of the interchange's deck slabs (top, underside, sides), its parapets and any wall.
// A crossing is keyed by path, face owner and face type. Known gap: walkers' walks to doors and benches are not
// network edges and are not checked.
// Also: the open slab ends (a deck end whose top stands over 0.3 m and under 2 m) are exactly the known ones.
// RAMP_CROSSINGS_WRITE=1 rewrites the allowlist from the code as it is (then update ALLOWED below by hand).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';
import { barriers, buildInterchange, decksDrawn, plan } from '../../web/src/interchange.js';
import { parapetGeometry } from '../../web/src/parapets.js';
import { palette } from '../../web/src/palette.js';
import { city, fixture } from './harness.mjs';

const LIST = join('tests', 'fixtures', 'ramp-crossings-allowlist.json');
const ALLOWED = { 'sim-v3-seed7-t288.json.gz': 54, 'sim-v3-seed3-t288.json.gz': 24 }; // the allowlist's length per fixture
const OPEN = { // deck end -> [x, y, z] of its end, as drawn (decksDrawn)
  'sim-v3-seed7-t288.json.gz': {
    'ramp 0 low': [299.85, 0.73, -49.38], 'ramp 3 low': [299.85, 0.73, 49.38], 'slip of ramp 1 low': [243.64, 1.02, -75.71],
    'slip of ramp 2 low': [259.6, 0.68, 77.69], // the median ramps land (ramp_landings.test.mjs)
  },
  'sim-v3-seed3-t288.json.gz': {
    'ramp 0 low': [299.85, 0.73, -49.38], 'ramp 3 low': [299.85, 0.73, 49.38],
  },
};

// A kit whose materials carry their maker's name, so the faces can be told apart.
const mats = new Map();
const tag = (name) => mats.get(name) ?? mats.set(name, Object.assign(new THREE.MeshStandardMaterial(), { name })).get(name);
const model = () => { const g = new THREE.Group(), d = new THREE.Group(); d.name = 'detail'; g.add(d); return g; };
const kit = new Proxy({}, { get: (_, k) => (k === 'model' ? model : k === 'foldDetail' ? (g) => g : (...a) => tag(`${String(k)}:${a[0]}`)) });
const laneId = (L) => `${L.axis}|${L.dir}|${L.c}|${L.off}|${L.k}|${L.kind}|${L.pts ? 'ramp' : L.out ?? 'block'}|${L.start?.key ?? '-'}|${L.end?.key ?? '-'}`; // as lane_moves.test.mjs
const deckName = (P, d) => (P.ramps.includes(d) ? `ramp ${P.ramps.indexOf(d)}` : P.median.includes(d) ? `median ${P.median.indexOf(d)}` : `slip of ramp ${P.ramps.indexOf(d.ramp)}`);

// Triangle t clipped to the convex plan polygon R ([x, z] corners in order): the y range of what is left, or null.
function clipY(t, R) {
  let poly = t;
  const o = Math.sign(R.reduce((s, p, i) => { const q = R[(i + 1) % R.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0)) || 1;
  for (let i = 0; i < R.length && poly.length; i++) {
    const a = R[i], b = R[(i + 1) % R.length], side = (p) => o * ((b[0] - a[0]) * (p[2] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])), out = [];
    poly.forEach((p, j) => {
      const q = poly[(j + 1) % poly.length], sp = side(p), sq = side(q);
      if (sp >= 0) out.push(p);
      if (sp >= 0 !== sq >= 0) out.push(p.map((v, k) => v + ((q[k] - v) * sp) / (sp - sq)));
    });
    poly = out;
  }
  return poly.length ? [Math.min(...poly.map((p) => p[1])), Math.max(...poly.map((p) => p[1]))] : null;
}

// Every crossing on this fixture: { key: 'path | owner | type', at: [x, z] } (the first place met).
function crossings(name) {
  const snap = fixture(name), { layout, roads, net } = city(snap), P = plan(layout), drawn = decksDrawn(layout).filter((D) => D.pts.length >= 2);
  const root = new THREE.Group();
  buildInterchange(kit, root, layout, snap);
  root.updateMatrixWorld(true);
  const faces = [], v = new THREE.Vector3();
  const add = (geo, matrix, owner, type) => {
    const g = geo.index ? geo.toNonIndexed() : geo, A = g.attributes.position;
    for (let i = 0; i < A.count; i += 3) faces.push({ t: [0, 1, 2].map((j) => v.fromBufferAttribute(A, i + j).applyMatrix4(matrix).toArray()), owner, type });
  };
  // Slabs: the expressway's deck and its end, then each drawn deck in turn, as buildInterchange lays them.
  const wall = `concrete:${palette.weatheredConcrete}`, slabs = [];
  root.traverse((m) => {
    if (!m.isMesh) return;
    if (m.material.name.startsWith('mat:aerial_asphalt_01')) slabs.push(m);
    else if (m.material.name === wall) { // a wall: owned by the deck nearest its first corner
      const p = new THREE.Vector3().fromBufferAttribute(m.geometry.attributes.position, 0).applyMatrix4(m.matrixWorld);
      const D = drawn.reduce((b, x) => { const d = Math.min(...x.pts.map((q) => Math.hypot(q[0] - p.x, q[2] - p.z))); return d < b[0] ? [d, x] : b; }, [Infinity])[1];
      add(m.geometry, m.matrixWorld, `wall of ${deckName(P, D.deck)}`, 'wall');
    }
  });
  assert.equal(slabs.length, drawn.length + 2, 'a slab for the expressway, its end and every drawn deck');
  slabs.forEach((m, i) => {
    const owner = i === 0 ? 'expressway' : i === 1 ? 'expressway end' : deckName(P, drawn[i - 2].deck);
    if (i > 1) { // check the order: the slab starts at its deck's first point
      const p = new THREE.Vector3().fromBufferAttribute(m.geometry.attributes.position, 0).applyMatrix4(m.matrixWorld), q = drawn[i - 2].pts[0];
      assert.ok(Math.hypot(p.x - q[0], p.z - q[2]) < 5, `slab ${i} is ${owner}'s`);
    }
    add(m.geometry, m.matrixWorld, owner, 'slab');
  });
  barriers(layout).forEach((run, r) => add(parapetGeometry([run]).concrete, new THREE.Matrix4(), `parapet run ${r}`, 'parapet'));
  // A 2 m grid over the faces' plan boxes.
  const C = 2, grid = new Map(), cell = (i, j) => i * 100000 + j;
  for (const f of faces) {
    const xs = f.t.map((p) => Math.floor(p[0] / C)), zs = f.t.map((p) => Math.floor(p[2] / C));
    for (let a = Math.min(...xs); a <= Math.max(...xs); a++) for (let b = Math.min(...zs); b <= Math.max(...zs); b++) {
      if (!grid.has(cell(a, b))) grid.set(cell(a, b), []);
      grid.get(cell(a, b)).push(f);
    }
  }
  const found = new Map();
  const sweep = (path, pts, width, [b0, b1]) => { // pts [x, y, z], y the band's base; half a metre at a time
    for (let i = 1; i < pts.length; i++) {
      const [a, b] = [pts[i - 1], pts[i]], L = Math.hypot(b[0] - a[0], b[2] - a[2]);
      if (L < 1e-6) continue;
      const n = Math.ceil(L / 0.5), w = [((a[2] - b[2]) / L) * width / 2, ((b[0] - a[0]) / L) * width / 2];
      for (let k = 0; k < n; k++) {
        const p = a.map((c, j) => c + ((b[j] - c) * k) / n), q = a.map((c, j) => c + ((b[j] - c) * (k + 1)) / n);
        const R = [[p[0] - w[0], p[2] - w[1]], [q[0] - w[0], q[2] - w[1]], [q[0] + w[0], q[2] + w[1]], [p[0] + w[0], p[2] + w[1]]];
        const lo = Math.min(p[1], q[1]) + b0, hi = Math.max(p[1], q[1]) + b1, cx = (p[0] + q[0]) / 2, cz = (p[2] + q[2]) / 2, seen = new Set();
        for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) for (const f of grid.get(cell(Math.floor(cx / C) + di, Math.floor(cz / C) + dj)) ?? []) {
          if (seen.has(f)) continue;
          seen.add(f);
          const key = `${path} | ${f.owner} | ${f.type}`;
          if (found.has(key)) continue;
          const y = clipY(f.t, R);
          if (y && y[1] > lo && y[0] < hi) found.set(key, [Math.round(cx * 10) / 10, Math.round(cz * 10) / 10]);
        }
      }
    }
  };
  for (const L of roads.links) if (L.edge) sweep(`car ${laneId(L)}`, L.edge.pts, 1.8, [-0.6, 0.9]);
  for (const N of roads.nodes) for (const I of N.ins) for (const mv of I.moves ?? []) if (mv.edge) sweep(`car ${laneId(I)} ${mv.move} ${laneId(mv.out)}`, mv.edge.pts, 1.8, [-0.6, 0.9]);
  for (let a = 0; a < net.N; a++) for (const e of net.adj[a]) for (const lane of [1.9, 2.45, 3]) for (const back of [0, 1.8]) {
    const pts = [net.node(a, lane), ...e.path({ lane, jit: 0, back, speed: 1.3 }).map((q) => [q[0], q[1]]), net.node(e.to, lane)], fine = [];
    pts.forEach((q, i) => {
      if (i) {
        const p = pts[i - 1], n = Math.max(1, Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / 0.5));
        for (let k = 1; k < n; k++) { const x = p[0] + ((q[0] - p[0]) * k) / n, z = p[1] + ((q[1] - p[1]) * k) / n; fine.push([x, net.ground(x, z), z]); }
      }
      fine.push([q[0], net.ground(q[0], q[1]), q[1]]);
    });
    sweep(`walker ${a}>${e.to} ${e.kind}`, fine, 0.5, [0, 1.8]);
  }
  // Open slab ends.
  const open = {};
  for (const D of drawn) for (const [end, p] of [['first', D.pts[0]], ['last', D.pts.at(-1)]]) {
    if (p[1] <= 0.3 || p[1] >= 2) continue;
    const other = end === 'first' ? D.pts.at(-1) : D.pts[0];
    open[`${deckName(P, D.deck)} ${p[1] < other[1] ? 'low' : 'high'}`] = p.map((x) => Math.round(x * 100) / 100);
  }
  return { list: [...found].map(([key, at]) => ({ key, at })).sort((a, b) => (a.key < b.key ? -1 : 1)), open };
}

const results = Object.fromEntries(Object.keys(ALLOWED).map((name) => [name, crossings(name)]));
if (process.env.RAMP_CROSSINGS_WRITE) {
  writeFileSync(LIST, `${JSON.stringify({
    note: 'Walker and car paths through interchange faces that were there on origin/main at 1d9d988 (tests/js/ramp_crossings.test.mjs). Follow-up: ADR-0011, amendment of 2026-11-16 (the sweep ramps and the ramp low ends).',
    ...Object.fromEntries(Object.entries(results).map(([name, r]) => [name, r.list])),
  }, null, 1)}\n`);
}
const allow = JSON.parse(readFileSync(LIST, 'utf8'));

for (const name of Object.keys(ALLOWED)) {
  test(`${name}: no walker or car path through a wall, parapet or slab beyond the allowlist`, () => {
    assert.equal(allow[name].length, ALLOWED[name], 'the allowlist changed: update ALLOWED with it');
    const known = new Set(allow[name].map((c) => c.key));
    assert.deepEqual(results[name].list.filter((c) => !known.has(c.key)).map((c) => `${c.key} at ${c.at}`), []);
  });
  test(`${name}: the open slab ends are exactly the known ones`, () => {
    const now = results[name].open, want = OPEN[name], wrong = [];
    for (const k of new Set([...Object.keys(now), ...Object.keys(want)])) {
      if (!now[k] || !want[k] || now[k].some((v, j) => Math.abs(v - want[k][j]) > 0.05)) wrong.push(`${k}: ${now[k] ?? 'none'} (known ${want[k] ?? 'none'})`);
    }
    assert.deepEqual(wrong, []);
  });
}
