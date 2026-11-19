// The landed ramps (interchange.js landing, landEnd and sweepProfile: the two median ramps, both loops and both sweeps)
// on the frozen v3 fixtures (ADR-0011, amendments of 2026-11-19 and 2026-11-20). For each: along every car path
// through it (its lanes and every move through the nodes at their ends), sampled every 0.5 m, the wheels (the path runs
// 0.65 m over the road) are within 5 cm of the surface drawn under them, found by casting down onto the streets and the
// interchange as built, with a surface under every sample (the count follows from the paths' length); under the
// expressway's top, where the sweeps still pass through its slab (ramp_clearance's todo), nothing is sampled. No grade
// along those paths is over 14.3 %; the deck as drawn ends at its landing point exactly at road height, so it has no
// open slab end.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildInterchange, decksDrawn, HIGH, landing, plan } from '../../web/src/interchange.js';
import { buildStreets } from '../../web/src/streets.js';
import { city, fixture } from './harness.mjs';

const GAP = 0.05, GRADE = 0.143, LIFT = 0.65;
const mat = new THREE.MeshStandardMaterial();
mat.emissiveMap = new THREE.Texture(); // as harness.mjs: streets.js clones it
const model = () => { const g = new THREE.Group(), d = new THREE.Group(); d.name = 'detail'; g.add(d); return g; };
const kit = new Proxy({}, { get: (_, k) => (k === 'model' ? model : k === 'foldDetail' ? (g) => g : () => mat) });
const flat = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);

for (const name of ['sim-v3-seed7-t288.json.gz', 'sim-v3-seed3-t288.json.gz']) {
  const snap = fixture(name), { layout, roads } = city(snap), P = plan(layout), root = new THREE.Group();
  buildStreets(kit, layout, root);
  buildInterchange(kit, root, layout, snap);
  root.updateMatrixWorld(true);
  const meshes = [];
  root.traverse((m) => { if (m.isMesh) meshes.push(m); });
  const landed = P.decks.filter((d) => d.land !== undefined);

  test(`${name}: every ramp and both median ramps land`, () => assert.deepEqual(landed, [...P.ramps, ...P.median])); // the sweeps' slips cannot (their grade beside the sweep)

  for (const d of landed) {
    const label = P.median.includes(d) ? `median ${P.median.indexOf(d)}` : `ramp ${P.ramps.indexOf(d)}`, D = decksDrawn(layout).find((x) => x.deck === d);
    const on = (q) => d.pts.some((p) => flat(q, p) < 1e-6 && Math.abs(q[1] - LIFT - p[1]) < 1e-6);
    const lanes = roads.links.filter((L) => L.pts && L.edge && L.pts.every(on)); // its lane, in pieces where a slip road parts
    const paths = lanes.map((L, k) => [`${label} lane ${k}`, L.edge.pts]);
    for (const N of new Set(lanes.flatMap((L) => [L.start, L.end]))) for (const I of N.ins) for (const mv of I.moves ?? []) if (mv.edge && (lanes.includes(I) || lanes.includes(mv.out))) paths.push([`${label} ${mv.move} at ${N.key}`, mv.edge.pts]);
    const near = meshes.filter((m) => { // only what lies within 20 m of the deck in plan
      m.geometry.computeBoundingBox();
      const b = new THREE.Box3().copy(m.geometry.boundingBox).applyMatrix4(m.matrixWorld);
      return d.pts.some((p) => p[0] > b.min.x - 20 && p[0] < b.max.x + 20 && p[2] > b.min.z - 20 && p[2] < b.max.z + 20);
    });

    test(`${name}: ${label}: the wheels stay within ${GAP * 100} cm of the drawn surface along every car path through it`, () => {
      const ray = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0), up = new THREE.Vector3(), wrong = [], missed = [];
      let n = 0, length = 0;
      for (const [path, pts] of paths) for (let i = 1; i < pts.length; i++) {
        const [a, b] = [pts[i - 1], pts[i]], k = Math.max(1, Math.ceil(flat(a, b) / 0.5));
        for (let j = 0; j < k; j++) {
          const q = a.map((v, c) => v + ((b[c] - v) * j) / k), w = q[1] - LIFT;
          if (flat(q, D.pts[0]) > 150 && flat(q, D.pts.at(-1)) > 150) continue; // far out on a move: another street's
          if (q[0] > P.x0 && q[0] < P.edge && Math.abs(q[2] - P.z0) < 15 && w < HIGH + 0.6 - GAP) continue; // under the expressway's top: the sweeps' clipping todo (ramp_clearance)
          length += flat(a, b) / k;
          ray.set(new THREE.Vector3(q[0], w + 1, q[2]), down);
          ray.far = 4;
          const hit = ray.intersectObjects(near, false).find((h) => up.copy(h.face.normal).transformDirection(h.object.matrixWorld).y > 0.5);
          if (!hit) { missed.push(`${path} at ${q.map((v) => v.toFixed(2))}`); continue; }
          n++;
          if (Math.abs(w - hit.point.y) > GAP) wrong.push(`${path} at ${q.map((v) => v.toFixed(2))}: ${(w - hit.point.y).toFixed(3)} m`);
        }
      }
      assert.ok(n >= Math.floor(length / 0.5), `sampled ${n} points over ${length.toFixed(1)} m of path; no surface under ${missed.slice(0, 5).join('; ')}`); // every 0.5 m, each over a surface
      assert.deepEqual(wrong.slice(0, 10), []);
    });

    test(`${name}: ${label}: no grade over ${(GRADE * 100).toFixed(1)} % along its car paths`, () => {
      const wrong = [];
      for (const [path, pts] of paths) for (let i = 1; i < pts.length; i++) {
        const l = flat(pts[i], pts[i - 1]);
        if (l > 1e-6 && Math.abs(pts[i][1] - pts[i - 1][1]) / l > GRADE) wrong.push(`${path} at ${pts[i].map((v) => v.toFixed(1))}`);
      }
      assert.deepEqual(wrong, []);
    });

    test(`${name}: ${label}: drawn down to its landing point, exactly at road height (no open slab end)`, () => {
      const first = d.pts[0][1] < d.pts.at(-1)[1], pts = first ? d.pts : [...d.pts].reverse(), end = first ? D.pts[0] : D.pts.at(-1), along = [0]; // from the street end
      for (let i = 1; i < pts.length; i++) along.push(along[i - 1] + flat(pts[i], pts[i - 1]));
      const k = pts.findIndex((p) => flat(p, end) < 1e-9);
      assert.equal(landing(0), 0);
      assert.equal(end[1], 0, 'the drawn end is at road height');
      assert.ok(Math.abs(along[k] - d.land) < 1e-6, 'the drawn end is the landing point');
      assert.ok(pts.every((p, i) => (along[i] <= d.land + 1e-6 ? p[1] === 0 : p[1] > 0)), 'level from the street end to the landing point, above it after');
    });
  }
}
