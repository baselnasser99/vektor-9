// Ramp grades (interchange.js plan) on the frozen v3 fixtures, measured between consecutive points: no deck is
// steeper than on origin/main at 1d9d988, except the two loop slip roads, which come down on a straight grade and
// are held to their new, lower maxima (eased, as before, they reached about 21 and 19 percent).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plan } from '../../web/src/interchange.js';
import { city, fixture } from './harness.mjs';

// Rounded up to 0.01 %. slips[k]: the slip road off or onto ramp k (one per ramp at most; 1 and 2 are the loops').
const MAX = { sweep: 0.1455, loop: 0.0991, median: 0.1458, slips: [0.1471, 0.143, 0.1426, 0.1471] };
const steepest = ({ pts }) => Math.max(...pts.slice(1).map((p, i) => Math.abs(p[1] - pts[i][1]) / Math.hypot(p[0] - pts[i][0], p[2] - pts[i][2])));
const pc = (g) => `${(g * 100).toFixed(2)}%`;

for (const name of ['sim-v3-seed7-t288.json.gz', 'sim-v3-seed3-t288.json.gz']) {
  test(`${name}: no ramp steeper than its limit`, () => {
    const { layout } = city(fixture(name)), P = plan(layout), wrong = [];
    for (const r of P.ramps) {
      const g = steepest(r), max = r.loop ? MAX.loop : MAX.sweep;
      if (g > max) wrong.push(`${r.loop ? 'loop' : 'sweep'} ${P.ramps.indexOf(r)}: ${pc(g)} > ${pc(max)}`);
    }
    for (const m of P.median) if (steepest(m) > MAX.median) wrong.push(`median ramp: ${pc(steepest(m))}`);
    for (const s of P.slips) {
      const k = P.ramps.indexOf(s.ramp);
      if (steepest(s) > MAX.slips[k]) wrong.push(`slip of ramp ${k}: ${pc(steepest(s))} > ${pc(MAX.slips[k])}`);
    }
    assert.deepEqual(wrong, []);
  });
}
