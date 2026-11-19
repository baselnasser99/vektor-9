// Ramp grades (interchange.js plan) on the frozen v3 fixtures, measured between consecutive points: no deck is
// steeper than on origin/main at 1d9d988. The two loop slip roads ease down over what is left once they part from
// their loop and reach about 21 and 19 percent; a straight grade brings them to about 14.3 percent but held their
// low ends higher over the cross street's lane, so it waits for the low-end redesign (ADR-0011, amendment of
// 2026-11-16) and is recorded here as todo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plan } from '../../web/src/interchange.js';
import { city, fixture } from './harness.mjs';

// Rounded up to 0.01 %. slips[k]: the slip road off or onto ramp k (one per ramp at most; 1 and 2 are the loops').
const MAX = { sweep: 0.1455, loop: 0.0991, median: 0.1458, slips: [0.1471, 0.2137, 0.1888, 0.1471] };
const LOOP_SLIP_TARGET = 0.143; // the straight grade's maximum
const LANDED = 0.143; // every landed end (the loops and the median ramps), as ramp_landings
const LOW_END_TODO = 'low-end redesign, follow-up';
const steepest = ({ pts }) => Math.max(...pts.slice(1).map((p, i) => Math.abs(p[1] - pts[i][1]) / Math.hypot(p[0] - pts[i][0], p[2] - pts[i][2])));
const pc = (g) => `${(g * 100).toFixed(2)}%`;

for (const name of ['sim-v3-seed7-t288.json.gz', 'sim-v3-seed3-t288.json.gz']) {
  test(`${name}: no ramp steeper than its limit`, () => {
    const { layout } = city(fixture(name)), P = plan(layout), wrong = [];
    for (const r of P.ramps) {
      const g = steepest(r), max = r.land !== undefined ? LANDED : r.loop ? MAX.loop : MAX.sweep;
      if (g > max) wrong.push(`${r.loop ? 'loop' : 'sweep'} ${P.ramps.indexOf(r)}: ${pc(g)} > ${pc(max)}`);
    }
    for (const m of P.median) if (steepest(m) > (m.land !== undefined ? LANDED : MAX.median)) wrong.push(`median ramp: ${pc(steepest(m))}`);
    for (const s of P.slips) {
      const k = P.ramps.indexOf(s.ramp);
      if (steepest(s) > MAX.slips[k]) wrong.push(`slip of ramp ${k}: ${pc(steepest(s))} > ${pc(MAX.slips[k])}`);
    }
    assert.deepEqual(wrong, []);
  });
  test(`${name}: loop slip roads at most 14.3 percent`, { todo: LOW_END_TODO }, () => {
    const { layout } = city(fixture(name)), P = plan(layout);
    const steep = P.slips.filter((s) => s.ramp.loop && steepest(s) > LOOP_SLIP_TARGET).map((s) => `slip of ramp ${P.ramps.indexOf(s.ramp)}: ${pc(steepest(s))}`);
    assert.deepEqual(steep, []);
  });
}
