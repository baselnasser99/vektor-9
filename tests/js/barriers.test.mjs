// Deck parapets (interchange.js barriers): on the frozen v3 fixtures, every metre of every deck edge (both sides of
// the expressway and across its inner end, both sides of every ramp, median ramp and slip road as drawn) has a
// parapet along it, or is a join: on another deck at its level, on the expressway's deck, or at a street at its
// level. The edges here are rebuilt from the decks themselves, not from the parapet runs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { barriers, decksDrawn, HIGH, onDeckOf, plan } from '../../web/src/interchange.js';
import { city, fixture } from './harness.mjs';

const TOP = HIGH + 0.6, WIDE = 30;
const dense = (line) => line.flatMap((p, i) => {
  if (!i) return [p];
  const q = line[i - 1], n = Math.max(1, Math.ceil(Math.hypot(p[0] - q[0], p[2] - q[2])));
  return Array.from({ length: n }, (_, k) => q.map((v, j) => v + ((p[j] - v) * (k + 1)) / n));
});
const normal = (pts, i) => {
  const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dx = b[0] - a[0], dz = b[2] - a[2], l = Math.hypot(dx, dz);
  return [dz / l, -dx / l];
};
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
  const { x0, z0, edge } = plan(layout), drawn = decksDrawn(layout), runs = barriers(layout);
  const covered = (p) => runs.some((r) => {
    const [d, y] = near(r, p);
    return d < 0.4 && Math.abs(y - p[1]) < 0.5;
  });
  const onExpressway = ([x, , z]) => x > x0 && x < edge && Math.abs(z - z0) < WIDE / 2 + 0.01;
  // At a street at its level: within its corridor, give or take the 0.25 m the parapet stands in from the edge.
  const atStreet = ([x, y, z], pad = 0) => y < 1.5 && layout.cross.some((l) => Math.abs(x - l.c) < l.w / 2 + pad || Math.abs(z - l.c) < l.w / 2 + pad);
  const onOther = (p, self) => drawn.some((D) => D !== self && onDeckOf(D, p, 0.75));
  // Every edge: its name, its points a metre apart, and what counts as a join along it.
  const edges = [
    ...[-1, 1].map((s) => ({ name: `expressway side ${s}`, pts: dense([[x0, TOP, z0 + s * WIDE / 2], [edge, TOP, z0 + s * WIDE / 2]]), join: (p) => onOther(p) })),
    { name: 'expressway inner end', pts: dense([[x0, TOP, z0 - WIDE / 2], [x0, TOP, z0 + WIDE / 2]]), join: (p) => onOther(p) },
    ...drawn.flatMap((D, k) => [-1, 1].map((side) => ({
      name: `deck ${k} side ${side}`,
      pts: dense(D.pts.map((p, i) => { const [nx, nz] = normal(D.pts, i), o = side * D.half(i); return [p[0] + nx * o, p[1], p[2] + nz * o]; })),
      join: (p) => onExpressway(p) || atStreet(p, 0.3) || onOther(p, D),
    }))),
  ];

  test(`${name}: every deck edge has a parapet except at joins`, () => {
    const bare = [];
    for (const e of edges) {
      // A join's ends are found to the metre (barriers samples every metre), so the metre beside one counts with it.
      const join = e.pts.map(e.join), open = e.pts.filter((p, i) => !covered(p) && !join[i] && !join[i - 1] && !join[i + 1]);
      if (open.length) bare.push(`${e.name}: ${open.length} m bare, first at ${open[0].map((v) => v.toFixed(1))}`);
    }
    assert.deepEqual(bare, []);
  });

  test(`${name}: both sides of every deck have a parapet, and the expressway's sides are nearly all walled`, () => {
    for (const e of edges.filter((e) => e.name.startsWith('deck'))) assert.ok(e.pts.some(covered), `${e.name} has no parapet`);
    for (const s of [-1, 1]) {
      const e = edges.find((e) => e.name === `expressway side ${s}`), share = e.pts.filter(covered).length / e.pts.length;
      assert.ok(share > 0.85, `expressway side ${s}: ${share.toFixed(2)} walled`);
    }
  });

  test(`${name}: no parapet stands on a street at its level or on the expressway's deck away from its edges`, () => {
    const wrong = runs.flatMap((r) => r).filter((p) => atStreet(p) || (onExpressway(p) && Math.abs(Math.abs(p[2] - z0) - WIDE / 2) > 0.3 && Math.abs(p[0] - x0) > 0.3));
    assert.deepEqual(wrong, []);
  });
}
