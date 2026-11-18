// Ramp paint (interchange.js rampMarkings) on the frozen v3 fixtures: every ramp, loop, median ramp and slip road
// has edge lines; every line point lies on a deck as drawn, at its height (within 8 cm: a point off a curved,
// sloping centre line), never on the expressway; and every slip road has gore hatching where it parts from or
// joins its ramp.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decksDrawn, plan, rampMarkings } from '../../web/src/interchange.js';
import { city, fixture } from './harness.mjs';

const WIDE = 30;
// The distance in plan from q to deck D's centre line, and D's height there.
const near = ({ pts }, q) => {
  let best = [Infinity, 0];
  for (let m = 1; m < pts.length; m++) {
    const [a, b] = [pts[m - 1], pts[m]], dx = b[0] - a[0], dz = b[2] - a[2];
    const t = Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[2] - a[2]) * dz) / (dx * dx + dz * dz || 1)));
    const d = Math.hypot(q[0] - a[0] - t * dx, q[2] - a[2] - t * dz);
    if (d < best[0]) best = [d, a[1] + (b[1] - a[1]) * t];
  }
  return best;
};

for (const name of ['sim-v3-seed7-t288.json.gz', 'sim-v3-seed3-t288.json.gz']) {
  test(`${name}: edge lines on every deck, on its surface; gore hatching at every slip road`, () => {
    const { layout } = city(fixture(name)), P = plan(layout), drawn = decksDrawn(layout), { lines, hatch } = rampMarkings(layout), wrong = [];
    for (const D of drawn) {
      const own = lines.filter((L) => L.every((q) => { const [d, y] = near(D, q); return d < 4.1 && Math.abs(y - q[1]) < 0.08; }));
      if (!own.length) wrong.push(`deck ${P.decks.indexOf(D.deck)}: no edge line`);
    }
    for (const q of lines.flat()) {
      if (q[0] > P.x0 && q[0] < P.edge && Math.abs(q[2] - P.z0) < WIDE / 2) wrong.push(`line on the expressway at ${q.map((v) => v.toFixed(1))}`);
      if (!drawn.some((D) => { const [d, y] = near(D, q); return d < 4 && Math.abs(y - q[1]) < 0.08; })) wrong.push(`line off every deck at ${q.map((v) => v.toFixed(1))}`);
    }
    for (const s of P.slips) {
      const D = drawn.find((x) => x.deck === s);
      if (!hatch.some(([a]) => near(D, a)[0] < 2.5)) wrong.push(`slip of ramp ${P.ramps.indexOf(s.ramp)}: no gore hatching`);
    }
    assert.deepEqual(wrong, []);
  });
}
