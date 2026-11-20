// Every ramp deck's surface (ADR-0011, amendment of 2026-11-20, later), on the frozen v3 fixtures: across its full
// width inside the parapets' feet (0.6 m in from each drawn edge), on a 0.5 m grid along and across it, the topmost
// surface is asphalt within 1 cm of the deck's height there (interchange.js topAt: its centre line's, level across, or
// a slip's while it lies across its ramp), and no other surface lies within 3 cm of it (above or below: that shows as a
// seam or flicker). Paint, the steel expansion joints and the parapets stand on it by design and are left out; so is
// wherever another deck lies on it (the expressway, a ramp over its own slip) and a landed deck's landing line, where
// it meets the road flush. Failures within 30 m of a landed end fail the test; the rest are known and listed (KNOWN, a todo).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { blockCuts, buildInterchange, decksDrawn, plan, topAt } from '../../web/src/interchange.js';
import { buildStreets } from '../../web/src/streets.js';
import { verge } from '../../web/src/terrain.js';
import { city, fixture } from './harness.mjs';

const mats = new Map();
const tag = (name) => mats.get(name) ?? mats.set(name, Object.assign(new THREE.MeshStandardMaterial(), { name, emissiveMap: new THREE.Texture() })).get(name);
const model = () => { const g = new THREE.Group(), d = new THREE.Group(); d.name = 'detail'; g.add(d); return g; };
const kit = new Proxy({}, { get: (_, k) => (k === 'model' ? model : k === 'foldDetail' ? (g) => g : (...a) => tag(`${String(k)}:${a[0]}`)) });
const ASPHALT = 'mat:aerial_asphalt_01', SKIP = (n) => n.startsWith('glow') || n.startsWith('steel') || n.endsWith(':parapet');
const CELL = 8;

// Pre-existing failures away from the landed ends (todo): the loops' slip forks, the sweeps' forks near the expressway,
// the median ramps' top ends where they join the expressway's deck, and the outbound loop's slip end at its street.
export const KNOWN = {
  'sim-v3-seed7-t288.json.gz': [
    'ramp 0 at 329.9,5.55,-18.6: top is mat:aerial_asphalt_01 at 5.539',
    'ramp 1 at 236.3,4.89,-50.9: mat:aerial_asphalt_01 -2.4 cm from it',
    'ramp 1 at 235.2,4.79,-52.8: mat:aerial_asphalt_01 -1.6 cm from it',
    'ramp 1 at 234.9,4.84,-52.4: mat:aerial_asphalt_01 -2.9 cm from it',
    'ramp 1 at 234.8,4.79,-53.1: mat:aerial_asphalt_01 -2.5 cm from it',
    'ramp 1 at 235.4,4.69,-54.1: mat:aerial_asphalt_01 -0.1 cm from it',
    'ramp 2 at 245.3,3.51,62.7: mat:aerial_asphalt_01 -2.3 cm from it',
    'ramp 2 at 245.1,3.51,63.1: mat:aerial_asphalt_01 -2.9 cm from it',
    'ramp 3 at 327.0,5.56,12.4: top is mat:aerial_asphalt_01 at 5.572',
    'median 0 at 258.4,8.40,-3.4: mat:aerial_asphalt_01 0.0 cm from it',
    'median 0 at 258.4,8.40,-2.2: mat:aerial_asphalt_01 0.0 cm from it',
    'median 1 at 258.4,8.40,3.4: mat:aerial_asphalt_01 0.0 cm from it',
    'median 1 at 258.4,8.40,2.2: mat:aerial_asphalt_01 0.0 cm from it',
    'slip of ramp 1 at 235.9,4.77,-52.6: mat:aerial_asphalt_01 -0.4 cm from it',
    'slip of ramp 1 at 235.1,4.67,-54.6: mat:aerial_asphalt_01 -1.2 cm from it',
    'slip of ramp 1 at 236.2,4.38,-59.0: top is mat:aerial_asphalt_01 at 4.394',
    'slip of ramp 1 at 232.6,4.38,-59.3: top is mat:aerial_asphalt_01 at 4.371',
    'slip of ramp 1 at 236.2,3.82,-62.5: top is mat:aerial_asphalt_01 at 3.830',
    'slip of ramp 1 at 233.1,3.89,-62.7: top is mat:aerial_asphalt_01 at 3.875',
    'slip of ramp 1 at 234.1,3.54,-64.9: top is mat:aerial_asphalt_01 at 3.548',
    'slip of ramp 1 at 236.6,3.54,-64.2: top is mat:aerial_asphalt_01 at 3.527',
    'slip of ramp 1 at 237.1,3.54,-64.0: top is mat:aerial_asphalt_01 at 3.524',
    'slip of ramp 1 at 233.6,3.54,-65.1: top is mat:aerial_asphalt_01 at 3.550',
    'slip of ramp 1 at 238.1,2.97,-66.8: top is mat:aerial_asphalt_01 at 2.960',
    'slip of ramp 1 at 234.3,3.20,-67.1: top is mat:aerial_asphalt_01 at 3.188',
    'slip of ramp 1 at 238.0,2.88,-67.4: top is mat:aerial_asphalt_01 at 2.868',
    'slip of ramp 1 at 235.2,2.88,-68.9: top is mat:aerial_asphalt_01 at 2.893',
    'slip of ramp 1 at 239.3,2.51,-68.8: top is mat:aerial_asphalt_01 at 2.526',
    'slip of ramp 1 at 238.9,2.51,-69.1: top is mat:aerial_asphalt_01 at 2.522',
    'slip of ramp 1 at 236.3,2.51,-70.8: top is mat:aerial_asphalt_01 at 2.499',
    'slip of ramp 1 at 239.9,2.18,-70.4: top is mat:aerial_asphalt_01 at 2.169',
    'slip of ramp 1 at 237.4,2.18,-72.4: top is mat:aerial_asphalt_01 at 2.194',
    'slip of ramp 1 at 242.3,1.50,-73.0: top is mat:aerial_asphalt_01 at 1.479',
    'slip of ramp 1 at 240.5,1.50,-75.0: top is mat:aerial_asphalt_01 at 1.510',
    'slip of ramp 1 at 238.8,1.81,-74.0: top is mat:aerial_asphalt_01 at 1.800',
    'slip of ramp 1 at 242.7,1.41,-73.3: top is mat:aerial_asphalt_01 at 1.397',
    'slip of ramp 1 at 240.6,1.41,-75.6: top is mat:aerial_asphalt_01 at 1.428',
    'slip of ramp 1 at 243.0,1.41,-72.9: top is mat:aerial_asphalt_01 at 1.393',
    'slip of ramp 1 at 243.1,1.33,-73.6: top is mat:aerial_asphalt_01 at 1.315',
    'slip of ramp 1 at 241.1,1.33,-76.0: top is mat:aerial_asphalt_01 at 1.339',
    'slip of ramp 2 at 259.3,0.68,78.5: top is mat:aerial_asphalt_01 at 0.000',
    'slip of ramp 2 at 257.4,1.20,75.3: top is mat:aerial_asphalt_01 at 1.184',
    'slip of ramp 2 at 257.0,1.02,78.6: top is mat:aerial_asphalt_01 at 1.036',
    'slip of ramp 2 at 256.0,1.20,78.2: top is mat:aerial_asphalt_01 at 1.211',
    'slip of ramp 2 at 257.6,1.20,74.9: top is mat:aerial_asphalt_01 at 1.178',
    'slip of ramp 2 at 256.0,1.53,74.2: top is mat:aerial_asphalt_01 at 1.546',
    'slip of ramp 2 at 254.3,1.53,77.3: top is mat:aerial_asphalt_01 at 1.522',
    'slip of ramp 2 at 254.4,1.91,73.2: top is mat:aerial_asphalt_01 at 1.898',
    'slip of ramp 2 at 252.5,1.91,76.2: top is mat:aerial_asphalt_01 at 1.921',
    'slip of ramp 2 at 253.1,2.25,72.2: top is mat:aerial_asphalt_01 at 2.257',
    'slip of ramp 2 at 250.9,2.25,75.0: top is mat:aerial_asphalt_01 at 2.234',
    'slip of ramp 2 at 251.6,2.59,71.0: top is mat:aerial_asphalt_01 at 2.579',
    'slip of ramp 2 at 245.8,3.46,63.0: mat:aerial_asphalt_01 -0.8 cm from it',
    'slip of ramp 2 at 245.7,3.47,62.9: top is mat:aerial_asphalt_01 at 3.479',
  ],
  'sim-v3-seed3-t288.json.gz': [
    'ramp 0 at 329.9,5.55,-18.6: top is mat:aerial_asphalt_01 at 5.539',
    'ramp 3 at 327.0,5.56,12.4: top is mat:aerial_asphalt_01 at 5.572',
    'median 0 at 258.4,8.40,-3.4: mat:aerial_asphalt_01 0.0 cm from it',
    'median 0 at 258.4,8.40,-2.2: mat:aerial_asphalt_01 0.0 cm from it',
    'median 1 at 258.4,8.40,3.4: mat:aerial_asphalt_01 0.0 cm from it',
    'median 1 at 258.4,8.40,2.2: mat:aerial_asphalt_01 0.0 cm from it',
  ],
};

const flat = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
export function surfaceFailures(name) {
  const snap = fixture(name), { layout } = city(snap), P = plan(layout), root = new THREE.Group();
  buildStreets(kit, layout, root);
  buildInterchange(kit, root, layout, snap);
  snap.tiles.forEach((t, i) => { // the verge, as city.js places it
    if (t.k !== 'road') return;
    const [cx, cz] = [layout.pos(i % layout.n), layout.pos(Math.floor(i / layout.n))];
    const g = verge(kit, blockCuts(layout).verge.map((V) => V.map(([x, z]) => [x - cx, z - cz])));
    g.position.set(cx, 0.18, cz);
    root.add(g);
  });
  root.updateMatrixWorld(true);
  // Meshes by plan cell, for the rays.
  const grid = new Map(), box = new THREE.Box3();
  root.traverse((m) => {
    if (!m.isMesh || SKIP(m.material.name) || m.material.transparent) return;
    box.setFromObject(m);
    if (box.max.y > 30 || box.max.y - box.min.y > 30) return;
    for (let i = Math.floor(box.min.x / CELL); i <= Math.floor(box.max.x / CELL); i++) for (let j = Math.floor(box.min.z / CELL); j <= Math.floor(box.max.z / CELL); j++) {
      const k = `${i}|${j}`;
      (grid.get(k) ?? grid.set(k, []).get(k)).push(m);
    }
  });
  const ray = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0), n = new THREE.Vector3();
  const hits = (x, y, z) => {
    ray.set(new THREE.Vector3(x, y + 1, z), down);
    ray.far = 2;
    return ray.intersectObjects(grid.get(`${Math.floor(x / CELL)}|${Math.floor(z / CELL)}`) ?? [], false)
      .filter((h) => n.copy(h.face.normal).transformDirection(h.object.matrixWorld).y > 0.2);
  };
  const drawn = decksDrawn(layout), { x0, z0, edge } = P;
  const onExpressway = (x, z) => x > x0 && x < edge && Math.abs(z - z0) < 15.3;
  const ends = P.decks.filter((d) => d.land !== undefined).map((d) => (d.pts[0][1] < d.pts.at(-1)[1] ? d.pts[0] : d.pts.at(-1)));
  const label = (d) => (P.median.includes(d) ? `median ${P.median.indexOf(d)}` : P.ramps.includes(d) ? `ramp ${P.ramps.indexOf(d)}` : `slip of ramp ${P.ramps.indexOf(d.ramp)}`);
  // The top of drawn deck D at q [x, z] if q is inside its outline, else null.
  const heightOn = (D, q) => { // its nearest segment, the projection clamped (outside a bend, past both segments' ends)
    let best = null;
    for (let i = 1; i < D.pts.length; i++) {
      const [a, b] = [D.pts[i - 1], D.pts[i]], dx = b[0] - a[0], dz = b[2] - a[2], t = Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[2]) * dz) / (dx * dx + dz * dz || 1)));
      const e = Math.hypot(q[0] - a[0] - t * dx, q[1] - a[2] - t * dz), room = D.half(i - 1) + (D.half(i) - D.half(i - 1)) * t + 0.02;
      if (e < room && (!best || e < best.e)) best = { e, y: topAt(D.deck, a.map((v, k) => v + (b[k] - v) * t), q[0], q[1]) };
    }
    return best?.y ?? null;
  };
  const out = [];
  for (const D of drawn) {
    if (D.pts.length < 2) continue;
    const others = drawn.filter((E) => E !== D && E.pts.length > 1);
    // The deck's own cross-sections (as interchange.js ribbon builds them): at point i, along its normal there.
    const N = D.pts.map((_, i) => { const a = D.pts[Math.max(0, i - 1)], b = D.pts[Math.min(D.pts.length - 1, i + 1)], l = flat(a, b); return [(b[2] - a[2]) / l, -(b[0] - a[0]) / l]; });
    for (let i = 1; i < D.pts.length; i++) {
      const [a, b] = [D.pts[i - 1], D.pts[i]], l = flat(a, b);
      for (let s = 0; s < l; s += 0.5) {
        const t = s / l, p = a.map((v, k) => v + (b[k] - v) * t), nrm = [0, 1].map((k) => N[i - 1][k] + (N[i][k] - N[i - 1][k]) * t), half = D.half(i - 1) + (D.half(i) - D.half(i - 1)) * t, w = half - 0.6;
        if (onExpressway(p[0], p[2]) || p[1] < 1e-6) continue; // under the expressway; on a landed deck's landing line, where it meets the road flush
        for (let o = -w; o <= w + 1e-6; o += Math.max(0.25, w / Math.ceil(w / 0.5))) {
          const [x, z] = [p[0] + nrm[0] * o, p[2] + nrm[1] * o], y = topAt(D.deck, p, x, z);
          if (others.some((E) => { const h = heightOn(E, [x, z]); return h !== null && h > y && h - y < 0.3; })) continue; // another deck lies on it there (a fork, drawn just under it)
          const H = hits(x, y, z);
          const top = H[0], where = `${label(D.deck)} at ${x.toFixed(1)},${y.toFixed(2)},${z.toFixed(1)}`;
          const near = ends.some((e) => Math.hypot(e[0] - x, e[2] - z) < 30);
          let why = null;
          if (!top || top.object.material.name !== ASPHALT || Math.abs(top.point.y - y) > 0.01) why = top ? `top is ${top.object.material.name} at ${top.point.y.toFixed(3)}` : 'nothing';
          else {
            const other = H.slice(1).find((h) => Math.abs(h.point.y - top.point.y) < 0.03 && !(h.object === top.object && Math.abs(h.point.y - top.point.y) < 1e-4));
            if (other) why = `${other.object.material.name} ${((other.point.y - top.point.y) * 100).toFixed(1)} cm from it`;
          }
          if (why) out.push({ where, why, near, deck: label(D.deck), x, z });
        }
      }
    }
  }
  return out;
}

// Failures, one per 2 m cell and kind, for reading.
export const cluster = (F) => [...new Map(F.map((f) => [`${f.deck}|${Math.round(f.x / 2)}|${Math.round(f.z / 2)}|${f.why.split(' ')[0]}`, f])).values()];

for (const name of ['sim-v3-seed7-t288.json.gz', 'sim-v3-seed3-t288.json.gz']) {
  const F = surfaceFailures(name);
  test(`${name}: every ramp deck's surface is its own asphalt, with nothing within 3 cm, at the landed ends`, () => {
    assert.deepEqual(cluster(F.filter((f) => f.near)).map((f) => `${f.where}: ${f.why}`), []);
  });
  test(`${name}: every ramp deck's surface elsewhere`, { todo: 'pre-existing seams away from the landed ends (listed)' }, (t) => {
    const away = cluster(F.filter((f) => !f.near)).map((f) => `${f.where}: ${f.why}`);
    for (const line of away) t.diagnostic(line);
    assert.deepEqual(away, KNOWN[name] ?? []);
  });
}
