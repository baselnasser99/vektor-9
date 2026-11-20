// No holes in the ground round the interchange, on the frozen v3 fixtures: over the whole interchange area (its road
// tiles, the streets between them and the avenue under the median ramps, out 10 m), every 0.5 m, a ray cast straight
// down from above hits an opaque surface at or above y = -0.05 (streets.js ground, blocks and kerbs, the verge, every
// deck and wall). Where nothing is hit, the view goes through to empty space and shows black. Every hole is listed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { blockCuts, buildInterchange, plan } from '../../web/src/interchange.js';
import { buildStreets } from '../../web/src/streets.js';
import { verge } from '../../web/src/terrain.js';
import { city, fixture } from './harness.mjs';

const mats = new Map();
const tag = (name) => mats.get(name) ?? mats.set(name, Object.assign(new THREE.MeshStandardMaterial(), { name, emissiveMap: new THREE.Texture() })).get(name);
const model = () => { const g = new THREE.Group(), d = new THREE.Group(); d.name = 'detail'; g.add(d); return g; };
const kit = new Proxy({}, { get: (_, k) => (k === 'model' ? model : k === 'foldDetail' ? (g) => g : (...a) => tag(`${String(k)}:${a[0]}`)) });
const CELL = 8;

for (const name of ['sim-v3-seed7-t288.json.gz', 'sim-v3-seed3-t288.json.gz']) {
  test(`${name}: no hole in the ground anywhere round the interchange`, () => {
    const snap = fixture(name), { layout } = city(snap), P = plan(layout), root = new THREE.Group();
    buildStreets(kit, layout, root);
    buildInterchange(kit, root, layout, snap);
    const road = [];
    snap.tiles.forEach((t, i) => { // the verge, as city.js places it
      if (t.k !== 'road') return;
      const [cx, cz] = [layout.pos(i % layout.n), layout.pos(Math.floor(i / layout.n))];
      road.push([cx, cz]);
      const g = verge(kit, blockCuts(layout).verge.map((V) => V.map(([x, z]) => [x - cx, z - cz])));
      g.position.set(cx, 0.18, cz);
      root.add(g);
    });
    root.updateMatrixWorld(true);
    // Every opaque triangle in world space, by 2 m plan cell (a ray straight down hits a triangle where the point lies inside it in plan).
    const grid = new Map(), v = new THREE.Vector3(), C = 2;
    root.traverse((m) => {
      if (!m.isMesh || m.material.transparent) return;
      const g = m.geometry, pos = g.attributes.position, idx = g.index ? g.index.array : null, n = idx ? idx.length : pos.count;
      const w = Array.from({ length: pos.count }, (_, i) => v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld).toArray());
      for (let t = 0; t < n; t += 3) {
        const T = [0, 1, 2].map((k) => w[idx ? idx[t + k] : t + k]);
        if (Math.abs((T[1][0] - T[0][0]) * (T[2][2] - T[0][2]) - (T[2][0] - T[0][0]) * (T[1][2] - T[0][2])) < 1e-9) continue; // edge-on from above
        const [lx, hx, lz, hz] = [Math.min(...T.map((p) => p[0])), Math.max(...T.map((p) => p[0])), Math.min(...T.map((p) => p[2])), Math.max(...T.map((p) => p[2]))];
        for (let i = Math.floor(lx / C); i <= Math.floor(hx / C); i++) for (let j = Math.floor(lz / C); j <= Math.floor(hz / C); j++) {
          const k = `${i}|${j}`;
          (grid.get(k) ?? grid.set(k, []).get(k)).push(T);
        }
      }
    });
    const heightIn = (T, x, z) => { // the triangle's height at (x, z) if (x, z) lies inside it in plan, else null
      const [a, b, c] = T, d = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
      const u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / d, w2 = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / d;
      return u >= -1e-9 && w2 >= -1e-9 && u + w2 <= 1 + 1e-9 ? u * a[1] + w2 * b[1] + (1 - u - w2) * c[1] : null;
    };
    // The area: the road tiles' extent and the median ramps' stretch of the avenue, out 10 m.
    const xs = [...road.map(([x]) => x), P.west.c], zs = road.map(([, z]) => z);
    const [x0, x1, z0, z1] = [Math.min(...xs) - 10, Math.max(...xs) + 10, Math.min(...zs) - 10, Math.max(...zs) + 10];
    const holes = [];
    for (let x = x0; x <= x1; x += 0.5) for (let z = z0; z <= z1; z += 0.5) {
      const [px, pz] = [x + 0.013, z + 0.017]; // off the grid's lines, so a point never sits on a seam
      if (!(grid.get(`${Math.floor(px / C)}|${Math.floor(pz / C)}`) ?? []).some((T) => (heightIn(T, px, pz) ?? -Infinity) >= -0.05)) holes.push(`${x.toFixed(1)},${z.toFixed(1)}`);
    }
    assert.deepEqual(holes, []);
  });
}
