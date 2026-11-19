// Where a landed ramp crosses a block at road height (interchange.js landCuts: the loops' marked crossings and the
// slips' cuts), on the frozen v3 fixtures (ADR-0011, amendment of 2026-11-19):
// - no kerb, block paving or verge triangle lies over the cut (and so over the crossing or the road inside it),
//   with 1 cm tolerance at its edges;
// - where its parapets step down over the fill and end at the landing point, no parapet vertex is more than 1 cm below
//   the ground or deck directly under it (the highest surface there, other than parapets, not over half a metre above it);
// - nothing beside them stands above their foot: no verge within 1 m of the cut's edge is more than 0.2 m above the
//   ramp's surface next to it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { barriers, buildInterchange, landCuts, plan } from '../../web/src/interchange.js';
import { parapetGeometry } from '../../web/src/parapets.js';
import { buildStreets } from '../../web/src/streets.js';
import { verge } from '../../web/src/terrain.js';
import { palette } from '../../web/src/palette.js';
import { insideRing } from '../../web/src/geometry.js';
import { city, fixture } from './harness.mjs';

const mats = new Map();
const tag = (name) => mats.get(name) ?? mats.set(name, Object.assign(new THREE.MeshStandardMaterial(), { name, emissiveMap: new THREE.Texture() })).get(name);
const model = () => { const g = new THREE.Group(), d = new THREE.Group(); d.name = 'detail'; g.add(d); return g; };
const kit = new Proxy({}, { get: (_, k) => (k === 'model' ? model : k === 'foldDetail' ? (g) => g : (...a) => tag(`${String(k)}:${a[0]}`)) });
const GROUND = [`concrete:${palette.slate}`, `concrete:${palette.roseGrey}`, `concrete:${palette.oliveGrey}`]; // block paving, kerbs, verge
// The distance from [x, z] to polygon P's outline.
const edge = (P, x, z) => Math.min(...P.map((a, i) => {
  const b = P[(i + 1) % P.length], dx = b[0] - a[0], dz = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz);
}));

for (const name of ['sim-v3-seed7-t288.json.gz', 'sim-v3-seed3-t288.json.gz']) {
  const snap = fixture(name), { layout } = city(snap), P = plan(layout), cuts = landCuts(layout), root = new THREE.Group();
  buildStreets(kit, layout, root); // the blocks' paving and kerbs (not the interchange's own piers, also slate)
  snap.tiles.forEach((t, i) => { // the verge, placed as city.js places terrain tiles
    if (t.k !== 'road') return;
    const [cx, cz] = [layout.pos(i % layout.n), layout.pos(Math.floor(i / layout.n))], g = verge(kit, cuts.map((c) => c.verge.map(([x, z]) => [x - cx, z - cz])));
    g.position.set(cx, 0.18, cz);
    root.add(g);
  });
  root.updateMatrixWorld(true);
  // Every ground triangle near a cut, in world space.
  const near = (b) => cuts.some(({ notch }) => notch.some(([x, z]) => x > b.min.x - 3 && x < b.max.x + 3 && z > b.min.z - 3 && z < b.max.z + 3));
  const tris = [], v = new THREE.Vector3();
  root.traverse((m) => {
    if (!m.isMesh || !GROUND.includes(m.material.name)) return;
    m.geometry.computeBoundingBox();
    if (!near(new THREE.Box3().copy(m.geometry.boundingBox).applyMatrix4(m.matrixWorld))) return;
    const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry, A = g.attributes.position;
    for (let i = 0; i < A.count; i += 3) tris.push({ t: [0, 1, 2].map((j) => v.fromBufferAttribute(A, i + j).applyMatrix4(m.matrixWorld).toArray()), what: m.material.name });
  });
  const ends = P.decks.filter((d) => d.landing).map((d) => (P.ramps.includes(d) ? `ramp ${P.ramps.indexOf(d)}` : `slip of ramp ${P.ramps.indexOf(d.ramp)}`));

  test(`${name}: every landed end has its cut`, () => assert.equal(cuts.length, ends.length));

  cuts.forEach(({ notch }, k) => {
    test(`${name}: ${ends[k]}: no kerb, paving or verge over its cut`, () => {
      const wrong = [];
      for (const { t, what } of tris) { // its corners, edge midpoints and centre
        const pts = [...t, ...t.map((p, i) => p.map((c, j) => (c + t[(i + 1) % 3][j]) / 2)), t[0].map((c, j) => (c + t[1][j] + t[2][j]) / 3)];
        const bad = pts.find(([x, , z]) => insideRing(notch, x, z) && edge(notch, x, z) > 0.01);
        if (bad) wrong.push(`${what} at ${bad.map((c) => c.toFixed(2))}`);
      }
      assert.deepEqual(wrong.slice(0, 8), []);
    });
  });
}

// Every landed end's parapets over its fill (barriers runs with per-point depths, below FILL), against the ground.
for (const name of ['sim-v3-seed7-t288.json.gz', 'sim-v3-seed3-t288.json.gz']) {
  const snap = fixture(name), { layout } = city(snap), P = plan(layout), cuts = landCuts(layout), root = new THREE.Group();
  buildStreets(kit, layout, root);
  buildInterchange(kit, root, layout, snap);
  snap.tiles.forEach((t, i) => {
    if (t.k !== 'road') return;
    const [cx, cz] = [layout.pos(i % layout.n), layout.pos(Math.floor(i / layout.n))], g = verge(kit, cuts.map((c) => c.verge.map(([x, z]) => [x - cx, z - cz])));
    g.position.set(cx, 0.18, cz);
    root.add(g);
  });
  root.updateMatrixWorld(true);
  const landed = P.decks.filter((d) => d.land !== undefined), label = (d) => (P.median.includes(d) ? `median ${P.median.indexOf(d)}` : P.ramps.includes(d) ? `ramp ${P.ramps.indexOf(d)}` : `slip of ramp ${P.ramps.indexOf(d.ramp)}`);
  const surfaces = [];
  root.traverse((m) => { if (m.isMesh && !m.material.transparent && !m.material.name.endsWith(':parapet') && !m.material.name.startsWith('steel') && !m.material.name.startsWith('glow')) surfaces.push(m); }); // solid surfaces: not the lamps' light pools
  const ray = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0), up = new THREE.Vector3();
  const ground = (x, y, z) => { // the highest surface at (x, z) not over half a metre above y
    ray.set(new THREE.Vector3(x, y + 0.5, z), down);
    ray.far = 10;
    return ray.intersectObjects(surfaces, false).find((h) => up.copy(h.face.normal).transformDirection(h.object.matrixWorld).y > 0.3)?.point.y ?? -Infinity;
  };
  const runs = barriers(layout).filter((r) => Array.isArray(r.depth));
  for (const d of landed) {
    const mine = runs.filter((r) => r.pts.every((q) => d.pts.some((p) => Math.hypot(p[0] - q[0], p[2] - q[2]) < 4.5)));
    test(`${name}: ${label(d)}: its parapets over the fill end on the surface, never below the ground under them`, () => {
      assert.ok(mine.length >= 2, `${mine.length} parapet runs`);
      const wrong = [];
      let n = 0;
      for (const run of mine) {
        const A = parapetGeometry([run]).concrete.attributes.position;
        for (let i = 0; i < A.count; i++) {
          const [x, y, z] = [A.getX(i), A.getY(i), A.getZ(i)], q = run.pts.reduce((b, p) => (Math.hypot(p[0] - x, p[2] - z) < Math.hypot(b[0] - x, b[2] - z) ? p : b));
          if (q[1] > 2.5) continue; // over the slab: the foot is cast into the deck
          n++;
          const g = ground(x, y, z);
          if (y < g - 0.01) wrong.push(`${[x, y, z].map((c) => c.toFixed(2))}: ${(g - y).toFixed(3)} m below`);
        }
      }
      assert.ok(n > 50, `${n} vertices over the fill`);
      assert.deepEqual(wrong.slice(0, 40), []);
    });
  }
  cuts.forEach(({ notch }, k) => {
    const d = P.decks.filter((x) => x.landing)[k];
    test(`${name}: ${label(d)}: no verge within 1 m of its cut more than 0.2 m above the ramp beside it`, () => {
      const wrong = [], v = new THREE.Vector3();
      root.traverse((m) => {
        if (!m.isMesh || m.material.name !== `concrete:${palette.oliveGrey}`) return;
        const A = m.geometry.attributes.position;
        for (let i = 0; i < A.count; i++) {
          const [x, y, z] = v.fromBufferAttribute(A, i).applyMatrix4(m.matrixWorld).toArray();
          if (insideRing(notch, x, z) || edge(notch, x, z) > 1) continue;
          const q = d.pts.reduce((b, p) => (Math.hypot(p[0] - x, p[2] - z) < Math.hypot(b[0] - x, b[2] - z) ? p : b));
          if (y > q[1] + 0.2 + 1e-6) wrong.push(`${[x, y, z].map((c) => c.toFixed(2))} beside the ramp at ${q[1].toFixed(2)}`);
        }
      });
      assert.deepEqual(wrong.slice(0, 8), []);
    });
  });
}
