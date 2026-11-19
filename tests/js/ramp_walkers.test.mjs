// Walkers at the landed loops' ends (interchange.js landCuts, people.js network), on the frozen v3 fixtures (ADR-0011,
// amendment of 2026-11-19): every walking-network edge that comes to a loop's end, sampled every 0.5 m at three
// distances in from the kerb and two wait depths, is on the sidewalk (the main street's, clear of the ramp's fill and of
// its deck where that is too low to walk under) or on the marked crossing, at road height there (network.ground 0)
// and at the paving's 0.18 m on the sidewalk.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decksDrawn, landCuts, plan } from '../../web/src/interchange.js';
import { insideRing } from '../../web/src/geometry.js';
import { kerbOf } from '../../web/src/streets.js';
import { city, fixture } from './harness.mjs';

const flat = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);

for (const name of ['sim-v3-seed7-t288.json.gz', 'sim-v3-seed3-t288.json.gz']) {
  const { layout, net } = city(fixture(name)), P = plan(layout), main = layout.lines.at(-2), cuts = landCuts(layout);
  const loops = P.decks.filter((d) => d.landing?.main);
  test(`${name}: both loops have a marked crossing`, () => assert.deepEqual(loops, [P.ramps[1], P.ramps[2]]));
  for (const d of loops) {
    const { crossing, notch } = cuts[P.decks.filter((x) => x.landing).indexOf(d)], D = decksDrawn(layout).find((x) => x.deck === d);
    const [b0, b1] = main.c > D.pts[0][0] ? [main.c - main.w / 2, main.c - kerbOf(main)] : [main.c + kerbOf(main), main.c + main.w / 2]; // its side's sidewalk
    const low = (x, z) => D.pts.some((p, i) => p[1] < 2.5 + 1.8 && flat(p, [x, 0, z]) < D.half(i) + 0.05); // the fill, or deck too low to walk under
    const zs = notch.map((p) => p[1]), [zlo, zhi] = [Math.min(...zs) - 6, Math.max(...zs) + 6];
    test(`${name}: ramp ${P.ramps.indexOf(d)}: walkers at its end are on the sidewalk or the marked crossing`, () => {
      const wrong = [], edges = new Set();
      let n = 0, on = 0;
      for (let a = 0; a < net.N; a++) for (const e of net.adj[a]) for (const lane of [1.9, 2.45, 3]) for (const back of [0, 1.8]) {
        const pts = [net.node(a, lane), ...e.path({ lane, jit: 0, back, speed: 1.3 }).map((q) => [q[0], q[1]]), net.node(e.to, lane)], fine = [];
        pts.forEach((q, i) => {
          if (i) { const p = pts[i - 1], m = Math.max(1, Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / 0.5)); for (let k = 1; k < m; k++) fine.push([p[0] + ((q[0] - p[0]) * k) / m, p[1] + ((q[1] - p[1]) * k) / m]); }
          fine.push(q);
        });
        const here = fine.filter(([x, z]) => insideRing(notch, x, z) || low(x, z) || (z > zlo && z < zhi && x > b0 - 3 && x < b1 + 3));
        if (!here.some(([x, z]) => insideRing(crossing, x, z) || low(x, z))) continue; // not at this end
        edges.add(`${a}>${e.to}`);
        for (const [x, z] of here) {
          n++;
          const cross = insideRing(crossing, x, z), side = x >= b0 && x <= b1 && !insideRing(notch, x, z) && !low(x, z), g = net.ground(x, z);
          if (cross) on++;
          if (!(cross || side)) wrong.push(`${a}>${e.to} lane ${lane} at ${x.toFixed(2)}, ${z.toFixed(2)}`);
          else if (g !== (cross ? 0 : 0.18)) wrong.push(`${a}>${e.to} ground ${g} at ${x.toFixed(2)}, ${z.toFixed(2)}`);
        }
      }
      assert.equal(edges.size, 2, `walker edges ${[...edges]}`);
      assert.ok(n > 500 && on > 100, `${n} samples, ${on} on the crossing`);
      assert.deepEqual(wrong.slice(0, 8), []);
    });
  }
}
