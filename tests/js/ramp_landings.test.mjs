// The landed ramps (interchange.js landing: the two median ramps) on the frozen v3 fixtures (ADR-0011, amendment of
// 2026-11-19). For each: along every car path through it (its lane and every move through the nodes at its two
// ends), sampled every 0.5 m, the wheels (the path runs 0.65 m over the road) are within 5 cm of the surface drawn
// under them, found by casting down onto the streets and the interchange as built; no grade along those paths is
// over 14.3 %; the deck as drawn ends at its landing point exactly at road height, so it has no open slab end.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildInterchange, decksDrawn, landing, plan } from '../../web/src/interchange.js';
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

  test(`${name}: both median ramps land`, () => assert.deepEqual(landed, P.median));

  for (const d of landed) {
    const label = `median ${P.median.indexOf(d)}`, D = decksDrawn(layout).find((x) => x.deck === d);
    const lane = roads.links.find((L) => L.pts && L.edge && L.pts.length === d.pts.length && L.pts.every((q, i) => flat(q, d.pts[i]) < 1e-6 && Math.abs(q[1] - LIFT - d.pts[i][1]) < 1e-6));
    const paths = [[`${label} lane`, lane.edge.pts]];
    for (const N of [lane.start, lane.end]) for (const I of N.ins) for (const mv of I.moves ?? []) if (mv.edge && (I === lane || mv.out === lane)) paths.push([`${label} ${mv.move} at ${N.key}`, mv.edge.pts]);
    const near = meshes.filter((m) => { // only what lies within 20 m of the deck in plan
      m.geometry.computeBoundingBox();
      const b = new THREE.Box3().copy(m.geometry.boundingBox).applyMatrix4(m.matrixWorld);
      return d.pts.some((p) => p[0] > b.min.x - 20 && p[0] < b.max.x + 20 && p[2] > b.min.z - 20 && p[2] < b.max.z + 20);
    });

    test(`${name}: ${label}: the wheels stay within ${GAP * 100} cm of the drawn surface along every car path through it`, () => {
      const ray = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0), up = new THREE.Vector3(), wrong = [];
      let n = 0;
      for (const [path, pts] of paths) for (let i = 1; i < pts.length; i++) {
        const [a, b] = [pts[i - 1], pts[i]], k = Math.max(1, Math.ceil(flat(a, b) / 0.5));
        for (let j = 0; j < k; j++) {
          const q = a.map((v, c) => v + ((b[c] - v) * j) / k), w = q[1] - LIFT;
          if (flat(q, D.pts[0]) > 150 && flat(q, D.pts.at(-1)) > 150) continue; // far out on a move: another street's
          ray.set(new THREE.Vector3(q[0], w + 1, q[2]), down);
          ray.far = 4;
          const hit = ray.intersectObjects(near, false).find((h) => up.copy(h.face.normal).transformDirection(h.object.matrixWorld).y > 0.5);
          if (!hit) continue;
          n++;
          if (Math.abs(w - hit.point.y) > GAP) wrong.push(`${path} at ${q.map((v) => v.toFixed(2))}: ${(w - hit.point.y).toFixed(3)} m`);
        }
      }
      assert.ok(n > 300, `sampled ${n} points`);
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
      const first = d.pts[0][1] < d.pts.at(-1)[1], end = first ? D.pts[0] : D.pts.at(-1), street = first ? d.pts[0] : d.pts.at(-1);
      assert.equal(landing(0), 0);
      assert.equal(end[1], 0, 'the drawn end is at road height');
      assert.ok(Math.abs(flat(end, street) - d.land) < 1e-6, 'the drawn end is the landing point');
      assert.ok(d.pts.every((p) => (flat(p, street) <= d.land + 1e-6 ? p[1] === 0 : p[1] > 0)), 'level from the street end to the landing point, above it after');
    });
  }
}
