// Stubs (ADR-0016's measured dead ends, roadmap 2): a mid street's half with cars at one end only, left where
// cityLayout's `closed` builds over the half beyond a walk. Seed 7 has one, x -80.5 from z -150 to -80.5 (view 08);
// seed 3 two, at (80.5, 150) and (219.5, 150). Each stays closed to cars and is drawn as a car-free continuation of
// the walk (streets.js closure). On the frozen v3 fixtures, each stub found by the dead-end rule (a crossing with
// exactly one car arm, as in masterplan.test.mjs), independently of city.js layout.stub:
// - no car lane runs along it;
// - no road paint inside it (lines, stop lines, zebras), and no open carriageway: paved all over, from the walk's
//   far kerb line to the car street's kerb line;
// - a kerb straight across its mouth at the car street's kerb line, the kerbs either side running unbroken from the
//   walk's kerb line to it, and on along the car street across the mouth (square corners): every kerb there ends at
//   a corner;
// - bollards just behind the mouth's kerb.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildStreets, kerbOf } from '../../web/src/streets.js';
import { palette } from '../../web/src/palette.js';
import { CARS } from '../../web/src/world.js';
import { city, fixture } from './harness.mjs';

const mats = new Map();
const tag = (name) => mats.get(name) ?? mats.set(name, Object.assign(new THREE.MeshStandardMaterial(), { name, emissiveMap: new THREE.Texture() })).get(name);
const model = () => { const g = new THREE.Group(), d = new THREE.Group(); d.name = 'detail'; g.add(d); return g; };
const kit = new Proxy({}, { get: (_, k) => (k === 'model' ? model : k === 'foldDetail' ? (g) => g : (...a) => tag(`${String(k)}:${a[0]}`)) });

const EPS = 0.05, CURB = `concrete:${palette.roseGrey}`, PAVED = new Set([CURB, `concrete:${palette.slate}`]);

// Every stub: its corridor L, the axis it runs along, the walk W it meets, the car street C at its other end, d (from
// W toward C along the axis), and its roadway as [v0, v1] along (W's far kerb line to C's kerb line) and L.c +- R.
function stubs(layout) {
  const out = [];
  for (const a of layout.cross) for (const b of layout.cross) {
    const arms = [-1, 1].flatMap((d) => [[a, 'x', b, d], [b, 'z', a, d]]).filter(([L, axis, W, d]) => CARS.has(layout.kindAt(L, axis, W.c + d * (W.w / 2 + 1))));
    if (arms.length !== 1) continue;
    const [L, axis, W, d] = arms[0], C = layout.cross[W.j + d];
    out.push({ L, axis, W, C, d, name: `${axis === 'z' ? `x ${L.c}` : `z ${L.c}`} from ${W.c} to ${C.c}`, v: [W.c - d * kerbOf(W), C.c - d * kerbOf(C)].sort((p, q) => p - q), R: kerbOf(L) });
  }
  return out;
}

for (const [name, count] of [['sim-v3-seed7-t288.json.gz', 1], ['sim-v3-seed3-t288.json.gz', 2]]) {
  const { layout, roads } = city(fixture(name)), S = stubs(layout);
  test(`${name}: the dead-end rule finds the measured stubs`, () => assert.equal(S.length, count, S.map((s) => s.name).join('; ')));

  const root = new THREE.Group();
  buildStreets(kit, layout, root);
  root.updateMatrixWorld(true);
  const rects = [], bb = new THREE.Box3();
  root.traverse((m) => {
    if (!m.isMesh) return;
    bb.setFromObject(m);
    rects.push({ x0: bb.min.x, x1: bb.max.x, z0: bb.min.z, z1: bb.max.z, y0: bb.min.y, y1: bb.max.y, mat: m.material.name, cyl: m.geometry.type === 'CylinderGeometry' });
  });

  for (const s of S) {
    const { L, axis, C, d, v: [v0, v1], R } = s, A = axis === 'x' ? ['x0', 'x1', 'z0', 'z1'] : ['z0', 'z1', 'x0', 'x1'];
    const along = (r) => [r[A[0]], r[A[1]]], across = (r) => [r[A[2]] - L.c, r[A[3]] - L.c];
    const inside = (r, m = 0) => along(r)[1] > v0 + m && along(r)[0] < v1 - m && across(r)[1] > -R + m && across(r)[0] < R - m;
    const mouth = C.c - d * kerbOf(C);

    test(`${name}: ${s.name}: no car lane along it`, () => {
      const lanes = roads.links.filter((E) => !E.pts && E.axis === axis && Math.abs(E.c - L.c) < 0.01 && Math.max(E.from, E.to) > v0 + 1 && Math.min(E.from, E.to) < v1 - 1);
      assert.deepEqual(lanes.map((E) => `${E.dir} ${E.from}..${E.to}`), []);
    });

    test(`${name}: ${s.name}: no road paint in it, and no open carriageway`, () => {
      assert.deepEqual(rects.filter((r) => r.mat === `glow:${palette.cream}` && r.y1 < 0.05 && inside(r, 0.01)).map((r) => `${along(r).map((u) => u.toFixed(2))}`), [], 'paint');
      const open = [];
      for (let u = v0 + 0.25; u < v1; u += 0.5) for (let w = -R + 0.25; w < R; w += 0.5) {
        const [x, z] = axis === 'x' ? [u, L.c + w] : [L.c + w, u];
        if (!rects.some((r) => PAVED.has(r.mat) && r.y1 > 0.17 && r.y0 < 0.01 && !r.cyl && x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1)) open.push(`${u.toFixed(2)},${w.toFixed(2)}`);
      }
      assert.deepEqual(open.slice(0, 5), [], `${open.length} unpaved points`);
    });

    test(`${name}: ${s.name}: a kerb across its mouth; the kerbs either side and along the car street end at square corners`, () => {
      const kerbs = rects.filter((r) => r.mat === CURB && r.y1 > 0.2 && r.y1 < 0.23 && !r.cyl);
      const band = (lo, hi) => kerbs.filter((r) => { const [a0, a1] = along(r); return a0 < Math.max(lo, hi) + EPS && a1 > Math.min(lo, hi) - EPS; });
      const covers = (iv, a, b, what) => { // intervals iv cover [a, b] unbroken
        iv.sort((p, q) => p[0] - q[0]);
        let reach = a;
        for (const [p, q] of iv) if (p <= reach + EPS) reach = Math.max(reach, q);
        assert.ok(reach >= b - EPS, `${what}: kerb breaks at ${reach.toFixed(2)} short of ${b.toFixed(2)}`);
      };
      // Along the car street, its kerb line on the stub's side, from R + 3 m either side of the stub across its mouth.
      covers(band(mouth, mouth - d * 0.35).filter((r) => r[A[1]] - r[A[0]] < 0.5).map(across), -R - 3, R + 3, 'across the mouth');
      for (const side of [-1, 1]) { // the stub's own sides, from the walk's kerb line to the mouth
        const iv = kerbs.filter((r) => { const [w0, w1] = across(r); return w0 < side * R + 0.4 && w1 > side * R - 0.4 && w1 - w0 < 0.5; }).map(along);
        covers(iv.filter(([p, q]) => q > v0 && p < v1), Math.min(s.W.c + d * kerbOf(s.W), mouth), Math.max(s.W.c + d * kerbOf(s.W), mouth), `side ${side}`);
      }
    });

    test(`${name}: ${s.name}: bollards behind the mouth's kerb`, () => {
      const posts = rects.filter((r) => r.cyl && r.mat === `steel:${palette.charcoal}` && r.y1 - r.y0 > 0.85 && inside(r) && Math.abs((along(r)[0] + along(r)[1]) / 2 - (mouth - d * 1.1)) < 0.5);
      assert.ok(posts.length >= 4, `${posts.length} bollards`);
    });
  }
}
