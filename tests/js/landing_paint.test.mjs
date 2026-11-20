// Paint where a landed ramp meets the street (interchange.js rampMarkings, streets.js road), on the frozen v3 fixtures,
// at all six landed ends (both median ramps, both loops, both sweeps; ADR-0011 amendment of 2026-11-20, later):
// - every ramp line end near the street joins a street line end to end (centres at most 5 cm apart, the two lines
//   not overlapping, the direction changing at most 10 degrees) or ends square at a stop line, the ramp's landing
//   point or the edge of its marked crossing;
// - no ramp line or taper crosses or overlaps a street line (stop lines and zebra bars included) or another ramp line;
// - no lane line or edge line ends inside a lane (within 0.95 m, half a car's width, of a car path, plus half the
//   line's width), unless it is a taper's free end or joins another line there;
// - where a ramp's lane meets the main street's kerb lane (both loops, both sweeps) a taper joins the street's edge
//   line end to end.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { decksDrawn, landCuts, plan, rampMarkings } from '../../web/src/interchange.js';
import { buildStreets } from '../../web/src/streets.js';
import { palette } from '../../web/src/palette.js';
import { city, fixture } from './harness.mjs';

const mats = new Map();
const tag = (name) => mats.get(name) ?? mats.set(name, Object.assign(new THREE.MeshStandardMaterial(), { name, emissiveMap: new THREE.Texture() })).get(name);
const model = () => { const g = new THREE.Group(), d = new THREE.Group(); d.name = 'detail'; g.add(d); return g; };
const kit = new Proxy({}, { get: (_, k) => (k === 'model' ? model : k === 'foldDetail' ? (g) => g : (...a) => tag(`${String(k)}:${a[0]}`)) });

const R = 30; // m round each street end
const JOIN = 0.05, TURN = (10 * Math.PI) / 180, CAR = 0.95;
const flat = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const unit = (a, b) => { const l = flat(a, b) || 1; return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; };
// A segment a-b, w wide, as an oriented rectangle; whether two overlap by more than 5 mm (separating axes).
const rect = (a, b, w) => { const u = unit(a, b); return { c: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], u, v: [-u[1], u[0]], h: [flat(a, b) / 2, w / 2] }; };
const overlaps = (A, B) => [A.u, A.v, B.u, B.v].every((ax) => {
  const ext = (S) => S.h[0] * Math.abs(S.u[0] * ax[0] + S.u[1] * ax[1]) + S.h[1] * Math.abs(S.v[0] * ax[0] + S.v[1] * ax[1]);
  return ext(A) + ext(B) - Math.abs((A.c[0] - B.c[0]) * ax[0] + (A.c[1] - B.c[1]) * ax[1]) > 0.005;
});
// The distance from p to segment a-b, and to polyline P.
const toSeg = (p, a, b) => {
  const dx = b[0] - a[0], dz = b[1] - a[1], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz);
};
const toLine = (p, P) => Math.min(...P.slice(1).map((b, i) => toSeg(p, P[i], b)));
const ring = (P) => [...P, P[0]];

for (const name of ['sim-v3-seed7-t288.json.gz', 'sim-v3-seed3-t288.json.gz']) {
  const snap = fixture(name), { layout, roads } = city(snap), P = plan(layout), root = new THREE.Group();
  buildStreets(kit, layout, root);
  root.updateMatrixWorld(true);
  // The streets' paint at road level, as rectangles: lines (along a street, 0.2 m wide or less) and the rest (stop lines,
  // zebra bars). Arrows (turned glyphs) are left out.
  const street = [], box = new THREE.Box3();
  root.traverse((m) => {
    if (!m.isMesh || m.material.name !== `glow:${palette.cream}` || m.rotation.y !== 0) return;
    box.setFromObject(m);
    if (box.max.y > 0.05) return;
    const [dx, dz] = [box.max.x - box.min.x, box.max.z - box.min.z], along = dx > dz, [cx, cz] = [(box.min.x + box.max.x) / 2, (box.min.z + box.max.z) / 2];
    const [a, b] = along ? [[box.min.x, cz], [box.max.x, cz]] : [[cx, box.min.z], [cx, box.max.z]], w = Math.min(dx, dz);
    street.push({ pts: [a, b], w, line: w <= 0.2 && Math.max(dx, dz) >= 0.5, kind: 'street', stop: Math.abs(w - 0.45) < 0.01 });
  });
  const { lines, road, taper = [] } = rampMarkings(layout), low = (L) => L.filter((p) => p[1] < 0.3);
  const ramp = [...lines, ...road].map((L) => ({ pts: L.map((p) => [p[0], p[2]]), y: L.map((p) => p[1]), w: 0.15, line: true, kind: 'ramp' }));
  const tapers = taper.map((L) => ({ pts: L.map((p) => [p[0], p[2]]), y: L.map(() => 0), w: 0.15, line: true, kind: 'taper' }));
  // Car paths at road level: the streets' lanes and the ramps' lanes.
  const paths = roads.links.flatMap((L) => {
    if (L.pts) return [L.pts.filter((p) => p[1] < 1.2).map((p) => [p[0], p[2]])];
    if (L.y > 1) return [];
    return [L.axis === 'x' ? [[L.from, L.at], [L.to, L.at]] : [[L.at, L.from], [L.at, L.to]]];
  }).filter((Q) => Q.length > 1);
  const cuts = landCuts(layout), landed = P.decks.filter((d) => d.landing);
  const ends = [...P.median, P.ramps[0], P.ramps[1], P.ramps[2], P.ramps[3]];
  const label = (d) => (P.median.includes(d) ? `median ${P.median.indexOf(d)}` : `ramp ${P.ramps.indexOf(d)}${d.loop ? ' (loop)' : ' (sweep)'}`);

  for (const d of ends) {
    const first = d.pts[0][1] < d.pts.at(-1)[1], tip = first ? d.pts[0] : d.pts.at(-1), e = [tip[0], tip[2]];
    const D = decksDrawn(layout).find((x) => x.deck === d), i0 = first ? 0 : D.pts.length - 1, lp = [D.pts[i0][0], D.pts[i0][2]];
    const lpNext = [D.pts[first ? 1 : i0 - 1][0], D.pts[first ? 1 : i0 - 1][2]], lpDir = unit(lp, lpNext), half = D.half(i0);
    const crossing = cuts[landed.indexOf(d)]?.main ? cuts[landed.indexOf(d)].crossing : null;
    const near = (L) => L.pts.some((p) => flat(p, e) < R);
    // This deck's lines (every point within 4 m of its centre line; a road line or taper near its street end), only
    // their stretch at road level (a line on the deck high up meets no street paint); open: whether each end is the line's own.
    const centre = d.pts.map((q) => [q[0], q[2]]);
    const mine = [...ramp, ...tapers].map((L) => {
      const k = L.y.map((y, i) => (y < 0.3 ? i : -1)).filter((i) => i >= 0);
      return k.length > 1 ? { ...L, pts: L.pts.slice(k[0], k.at(-1) + 1), open: [k[0] === 0, k.at(-1) === L.pts.length - 1] } : null;
    }).filter((L) => L && near(L) && L.pts.every((p) => toLine(p, centre) < 4.1));
    const others = street.filter(near), all = [...mine, ...others];
    // Each line's ends: the point, the way out of the line there, and the line (not where it was cut at 0.3 m up).
    const tips = (L) => [[L.pts[0], unit(L.pts[1], L.pts[0])], [L.pts.at(-1), unit(L.pts.at(-2), L.pts.at(-1))]].map(([p, o], k) => ({ p, o, L, k })).filter((t) => L.open?.[t.k] ?? true);
    const joined = (t) => all.flatMap(tips).find((s) => s.L !== t.L && s.L.line && flat(s.p, t.p) <= JOIN && Math.acos(Math.max(-1, Math.min(1, -(s.o[0] * t.o[0] + s.o[1] * t.o[1])))) <= TURN);

    test(`${name}: ${label(d)}: every ramp line end joins a street line or ends square at a stop line, the landing point or a crossing`, () => {
      const wrong = [];
      for (const L of mine.filter((M) => M.kind === 'ramp')) for (const t of tips(L)) {
        if (flat(t.p, e) > R) continue;
        if (joined(t)) continue;
        const across = Math.abs((t.p[0] - lp[0]) * lpDir[0] + (t.p[1] - lp[1]) * lpDir[1]), side = Math.abs((t.p[0] - lp[0]) * -lpDir[1] + (t.p[1] - lp[1]) * lpDir[0]);
        if (across <= JOIN && side <= half) continue; // at the landing point
        const stop = others.find((S) => S.stop && (() => { // at a stop line: its end on the stop line's edge, square to it
          const [a, b] = S.pts, u = unit(a, b), off = Math.abs((t.p[0] - a[0]) * -u[1] + (t.p[1] - a[1]) * u[0]), along = (t.p[0] - a[0]) * u[0] + (t.p[1] - a[1]) * u[1];
          return Math.abs(off - S.w / 2) <= JOIN && along >= 0 && along <= flat(a, b) && Math.abs(t.o[0] * u[0] + t.o[1] * u[1]) <= Math.sin(TURN);
        })());
        if (stop) continue;
        if (crossing && toLine(t.p, ring(crossing)) <= JOIN) continue; // at its marked crossing's edge
        wrong.push(`end at ${t.p.map((v) => v.toFixed(2))}`);
      }
      assert.deepEqual(wrong, []);
    });

    test(`${name}: ${label(d)}: no ramp line or taper crosses a street line or another ramp line`, () => {
      const wrong = [];
      for (const A of mine) for (const B of all) {
        if (B === A || (B.kind !== 'street' && mine.indexOf(B) < mine.indexOf(A))) continue;
        const pair = tips(A).flatMap((t) => (joined(t)?.L === B ? [t] : [])); // a join: its two end segments touch by design
        for (let i = 1; i < A.pts.length; i++) for (let j = 1; j < B.pts.length; j++) {
          if (pair.some((t) => (t.k ? i === A.pts.length - 1 : i === 1) && flat(joined(t).p, B.pts[j - 1]) + flat(joined(t).p, B.pts[j]) < flat(B.pts[j - 1], B.pts[j]) + 1e-6)) continue;
          if (overlaps(rect(A.pts[i - 1], A.pts[i], A.w), rect(B.pts[j - 1], B.pts[j], B.w))) {
            wrong.push(`${A.kind} at ${A.pts[i].map((v) => v.toFixed(2))} over ${B.kind} at ${B.pts[j].map((v) => v.toFixed(2))}`);
            break;
          }
        }
      }
      assert.deepEqual([...new Set(wrong)].slice(0, 12), []);
    });

    test(`${name}: ${label(d)}: no line ends inside a lane, but at a taper's end`, () => {
      const wrong = [], lanes = paths.filter((Q) => Q.some((p) => flat(p, e) < R + 20));
      for (const L of all.filter((M) => M.line && M.kind !== 'taper')) for (const t of tips(L)) {
        if (flat(t.p, e) > R || joined(t)) continue;
        const inside = lanes.find((Q) => toLine(t.p, Q) < CAR + L.w / 2);
        if (inside) wrong.push(`${L.kind} line end at ${t.p.map((v) => v.toFixed(2))}`);
      }
      assert.deepEqual(wrong, []);
    });

    if (P.ramps.includes(d)) test(`${name}: ${label(d)}: a taper joins the street's edge line where its lane meets the kerb lane`, () => {
      const found = mine.filter((T) => T.kind === 'taper').some((T) => tips(T).some((t) => joined(t)?.L.kind === 'street'));
      assert.ok(found, 'no taper joined to a street line');
    });
  }
}
