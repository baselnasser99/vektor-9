// Deck parapets (interchange.js barriers, parapets.js), on the frozen v3 fixtures:
// - along each continuous edge the runs meet end to end: an end that is not an opening coincides with exactly one
//   other run's end, within 2 cm in plan and in height, and the only ends that coincide in plan without matching in
//   height are on the expressway's edges where the two sweep ramps come out from under it (they drop while
//   still under it);
// - no two ends that meet nothing sit less than a metre apart (a near miss), and no run steps in height;
// - every other end is an opening, and gets a tapered end cap;
// - every half metre of every deck edge has a parapet on it, or is a join (on another deck at its level, under the
//   expressway, at a street at its level), or lies in the taper or past it at an opening. The edges here are
//   rebuilt from the decks themselves, not taken from the runs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { barriers, decksDrawn, HIGH, plan } from '../../web/src/interchange.js';
import { city, fixture } from './harness.mjs';

const TOP = HIGH + 0.6, WIDE = 30, MEET = 0.02;
const flat = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const dense = (line, step) => line.flatMap((p, i) => {
  if (!i) return [p];
  const q = line[i - 1], n = Math.max(1, Math.ceil(flat(p, q) / step));
  return Array.from({ length: n }, (_, k) => q.map((v, j) => v + ((p[j] - v) * (k + 1)) / n));
});
const normal = (pts, i) => {
  const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dx = b[0] - a[0], dz = b[2] - a[2], l = Math.hypot(dx, dz);
  return [dz / l, -dx / l];
};
// Whether p [x, y, z] lies on deck D (one of decksDrawn) within 1.2 m of its height, within its edge plus pad (the
// distance from its centre line, not its outline as interchange.js keeps it).
const onDeckOf = ({ pts, half }, p, pad) => pts.slice(1).some((b, j) => {
  const a = pts[j], dx = b[0] - a[0], dz = b[2] - a[2];
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[2] - a[2]) * dz) / (dx * dx + dz * dz || 1)));
  return Math.abs(a[1] + (b[1] - a[1]) * t - p[1]) < 1.2 && Math.hypot(p[0] - a[0] - t * dx, p[2] - a[2] - t * dz) < half(j) + (half(j + 1) - half(j)) * t + pad;
});
// The horizontal distance from p to polyline run, and the run's height there.
const near = (run, p) => {
  let best = [Infinity, 0];
  for (let m = 1; m < run.length; m++) {
    const [a, b] = [run[m - 1], run[m]], dx = b[0] - a[0], dz = b[2] - a[2];
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[2] - a[2]) * dz) / (dx * dx + dz * dz || 1)));
    const d = Math.hypot(p[0] - a[0] - t * dx, p[2] - a[2] - t * dz);
    if (d < best[0]) best = [d, a[1] + (b[1] - a[1]) * t];
  }
  return best;
};

for (const name of ['sim-v3-seed7-t288.json.gz', 'sim-v3-seed3-t288.json.gz']) {
  const { layout } = city(fixture(name));
  const P = plan(layout), drawn = decksDrawn(layout);
  const runs = barriers(layout).map((r) => ({ pts: r.pts ?? r, caps: r.caps ?? [false, false] })); // (a bare polyline: no caps)
  const ends = runs.flatMap((r, k) => [0, 1].map((e) => ({ k, e, p: e ? r.pts.at(-1) : r.pts[0], cap: r.caps[e] })));
  const sweeps = [P.ramps[0], P.ramps[3]].map((d) => drawn.find((D) => D.deck === d));
  const label = ({ k, e, p }) => `run ${k} ${e ? 'end' : 'start'} at ${p.map((v) => v.toFixed(2))}`;

  test(`${name}: parapet runs meet end to end within 2 cm, and every other end is a capped opening`, () => {
    const wrong = [];
    for (const a of ends) {
      const at = ends.filter((b) => b.k !== a.k && flat(a.p, b.p) < MEET);
      if (a.cap) {
        for (const b of at) {
          if (Math.abs(a.p[1] - b.p[1]) <= MEET) wrong.push(`${label(a)}: capped where it meets ${label(b)}`);
          else if (!(Math.abs(Math.abs(a.p[2] - P.z0) - WIDE / 2) < MEET && sweeps.some((D) => onDeckOf(D, a.p, 1) || onDeckOf(D, b.p, 1)))) wrong.push(`${label(a)}: steps ${(a.p[1] - b.p[1]).toFixed(2)} m to ${label(b)}`);
        }
      } else if (at.length !== 1) wrong.push(`${label(a)}: no cap, meets ${at.length} ends`);
      else if (at[0].cap || Math.abs(a.p[1] - at[0].p[1]) > MEET) wrong.push(`${label(a)}: meets ${label(at[0])} ${at[0].cap ? 'capped' : `${(a.p[1] - at[0].p[1]).toFixed(3)} m apart in height`}`);
    }
    assert.deepEqual(wrong, []);
  });

  test(`${name}: no parapet ends miss each other, and no run steps in height`, () => {
    const wrong = [], joined = (a) => ends.some((b) => b.k !== a.k && flat(a.p, b.p) < MEET);
    for (const a of ends) for (const b of ends) {
      const d = flat(a.p, b.p);
      if (a.k < b.k && d >= MEET && d < 1 && !joined(a) && !joined(b)) wrong.push(`${label(a)} and ${label(b)} miss by ${d.toFixed(2)} m`);
    }
    runs.forEach(({ pts }, k) => pts.slice(1).forEach((p, i) => { // steeper than any deck (the slip roads drop at up to about 1 in 4)
      const d = flat(p, pts[i]);
      if (Math.abs(p[1] - pts[i][1]) > 0.35 * d + MEET) wrong.push(`run ${k} steps ${(p[1] - pts[i][1]).toFixed(2)} m over ${d.toFixed(2)} m at ${p.map((v) => v.toFixed(1))}`);
    }));
    assert.deepEqual(wrong, []);
  });

  test(`${name}: every opening gets a tapered end cap`, async () => {
    const { parapetGeometry } = await import('../../web/src/parapets.js');
    const capped = runs.reduce((n, r) => n + r.caps.filter(Boolean).length, 0);
    assert.ok(capped > 0);
    assert.equal(parapetGeometry(barriers(layout)).caps, capped);
  });

  test(`${name}: every deck edge has a parapet except at joins and openings`, () => {
    const caps = ends.filter((x) => x.cap).map((x) => x.p);
    const covered = (p) => runs.some((r) => {
      const [d, y] = near(r.pts, p);
      return d < 0.06 && Math.abs(y - p[1]) < 0.3; // on the edge (a run keeps a point every 3 m), its foot in the deck (35 cm deep)
    });
    const onExpressway = ([x, , z]) => x > P.x0 && x < P.edge && Math.abs(z - P.z0) < WIDE / 2 + 0.01;
    const atStreet = ([x, y, z]) => y < 1.5 && layout.cross.some((l) => Math.abs(x - l.c) < l.w / 2 + 0.05 || Math.abs(z - l.c) < l.w / 2 + 0.05);
    const onOther = (p, self) => drawn.some((D) => D !== self && onDeckOf(D, p, 0.1));
    const opening = (p) => caps.some((c) => flat(c, p) < 1); // an opening's end is found to the metre where a deck below or above drops out of reach
    const edges = [
      ...[-1, 1].map((s) => ({ name: `expressway side ${s}`, pts: dense([[P.x0, TOP, P.z0 + s * WIDE / 2], [P.edge, TOP, P.z0 + s * WIDE / 2]], 0.5), join: (p) => onOther(p) || p[0] > P.edge - 0.01 })),
      { name: 'expressway inner end', pts: dense([[P.x0, TOP, P.z0 - WIDE / 2], [P.x0, TOP, P.z0 + WIDE / 2]], 0.5), join: (p) => onOther(p) },
      ...drawn.flatMap((D, k) => [-1, 1].map((side) => ({
        name: `deck ${k} side ${side}`,
        pts: dense(D.pts.map((p, i) => { const [nx, nz] = normal(D.pts, i), o = side * D.half(i); return [p[0] + nx * o, p[1], p[2] + nz * o]; }), 0.5),
        join: (p) => onExpressway(p) || atStreet(p) || onOther(p, D),
      }))),
    ];
    const bare = [];
    for (const e of edges) {
      const open = e.pts.filter((p) => !covered(p) && !e.join(p) && !opening(p));
      if (open.length) bare.push(`${e.name}: ${open.length / 2} m bare, first at ${open[0].map((v) => v.toFixed(2))}`);
    }
    assert.deepEqual(bare, []);
  });
}
