// Cars on the interchange's ramps never pass through another deck: every car path on every ramp (the lanes with
// their own points, life.js), sampled every metre, stays out of every other deck's slab, inside its footprint and
// between its underside and its top. The expressway's slab is 1.2 m deep, every other deck's 0.6 m (interchange.js).
// On the frozen v3 fixtures.
// Known defect, recorded as todo: the two sweep ramps start down while still under the expressway, so their cars pass
// through its slab near the expressway's edge. Holding a sweep at deck level until clear of the slab lifts it over
// the main street's east sidewalk where walkers now cross it (sidewalkCrossings), so the fix waits for a follow-up PR
// that settles that crossing (ADR-0011, amendment of 2026-11-16). Every other deck is checked for real.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decksDrawn, HIGH, plan } from '../../web/src/interchange.js';
import { city, fixture } from './harness.mjs';

const TOP = HIGH + 0.6, WIDE = 30;
const flat = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
// The height of drawn deck D's top under p if p lies on it in plan, else null.
const topOf = ({ pts, half }, p) => {
  for (let j = 1; j < pts.length; j++) {
    const a = pts[j - 1], b = pts[j], dx = b[0] - a[0], dz = b[2] - a[2], t = ((p[0] - a[0]) * dx + (p[2] - a[2]) * dz) / (dx * dx + dz * dz || 1);
    if (t < 0 || t > 1) continue;
    if (Math.hypot(p[0] - a[0] - t * dx, p[2] - a[2] - t * dz) < half(j - 1) + (half(j) - half(j - 1)) * t) return a[1] + (b[1] - a[1]) * t;
  }
  return null;
};

const SWEEP_TODO = 'sweep ramps clip the expressway slab: the fix conflicts with the sidewalk crossing at the sweep foot; follow-up PR (ADR-0011 amendment)';
// Every sample inside another deck's slab, each with the deck its lane runs on.
function clipping(name) {
  const { layout, roads } = city(fixture(name)), P = plan(layout), drawn = decksDrawn(layout);
  const inside = [];
  for (const L of roads.links.filter((O) => O.pts)) {
    const own = drawn.find((D) => D.deck.pts.some((q) => flat(q, L.pts[0]) < 0.01 || flat(q, L.pts.at(-1)) < 0.01))?.deck;
    for (let i = 1; i < L.pts.length; i++) {
      const [a, b] = [L.pts[i - 1], L.pts[i]], n = Math.max(1, Math.ceil(flat(a, b)));
      for (let k = 0; k < n; k++) {
        const p = a.map((v, j) => v + ((b[j] - v) * k) / n);
        const slabs = [];
        if (p[0] > P.x0 && p[0] < P.edge && Math.abs(p[2] - P.z0) < WIDE / 2) slabs.push(['expressway', TOP - 1.2, TOP]);
        for (const D of drawn) {
          if (D.deck === own) continue;
          const y = topOf(D, p);
          if (y !== null) slabs.push([`deck ${P.decks.indexOf(D.deck)}`, y - 0.6, y]);
        }
        for (const [what, lo, hi] of slabs) if (p[1] > lo && p[1] < hi) inside.push({ own, at: `${what} at ${p.map((v) => v.toFixed(1))}` });
      }
    }
  }
  return { P, inside };
}
const isSweep = (P, d) => P.ramps.includes(d) && !d.loop;

for (const name of ['sim-v3-seed7-t288.json.gz', 'sim-v3-seed3-t288.json.gz']) {
  test(`${name}: no car on a ramp passes through another deck's slab (sweep ramps aside)`, () => {
    const { P, inside } = clipping(name);
    assert.deepEqual(inside.filter((c) => !isSweep(P, c.own)).map((c) => c.at), []);
  });
  test(`${name}: no car on a sweep ramp passes through another deck's slab`, { todo: SWEEP_TODO }, () => {
    const { P, inside } = clipping(name);
    assert.deepEqual(inside.filter((c) => isSweep(P, c.own)).map((c) => c.at), []);
  });
}
