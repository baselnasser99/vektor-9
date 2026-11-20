// Parapet continuity (ADR-0011, amendment of 2026-11-20, later), on the frozen v3 fixtures: along both edges of every
// deck as drawn (interchange.js decksDrawn), every 0.5 m from its top to its low end, the edge either is an opening
// (interchange.js openingAt: onto the expressway, a fork or join with another deck, an unlanded ramp's low end at its
// street) or carries a parapet (barriers) with a cap rail (parapets.js railSpan); the rail may stop only over a landed
// deck's sloped terminal (its last 6 m along it to the landing point) and within 2 m of an opening or a capped end, where
// the barrier tapers. The openings are listed (diagnostics).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { barriers, decksDrawn, openingAt, plan } from '../../web/src/interchange.js';
import { railSpan } from '../../web/src/parapets.js';
import { city, fixture } from './harness.mjs';

const flat = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const TERMINAL = 6, TAPER = 2; // the taper's 1.5 m, and a sample's spacing

for (const name of ['sim-v3-seed7-t288.json.gz', 'sim-v3-seed3-t288.json.gz']) {
  const { layout } = city(fixture(name)), P = plan(layout), runs = barriers(layout).map((r) => ({ r, span: railSpan(r), s: r.pts.reduce((s, p, i) => [...s, i ? s[i - 1] + flat(p, r.pts[i - 1]) : 0], []) }));
  const label = (d) => (P.median.includes(d) ? `median ${P.median.indexOf(d)}` : P.ramps.includes(d) ? `ramp ${P.ramps.indexOf(d)}` : `slip of ramp ${P.ramps.indexOf(d.ramp)}`);
  // The run nearest q on the same edge (within 3 cm in plan, 0.5 m in height) and how far along it q lies.
  const onRun = (q) => {
    for (const R of runs) for (let i = 1; i < R.r.pts.length; i++) {
      const [a, b] = [R.r.pts[i - 1], R.r.pts[i]], l = flat(a, b), t = Math.max(0, Math.min(1, ((q[0] - a[0]) * (b[0] - a[0]) + (q[2] - a[2]) * (b[2] - a[2])) / (l * l || 1)));
      const p = a.map((v, k) => v + (b[k] - v) * t);
      if (flat(p, q) < 0.03 && Math.abs(p[1] - q[1]) < 0.5) return { R, u: R.s[i - 1] + t * l };
    }
    return null;
  };
  const openings = [], wrong = [];
  for (const D of decksDrawn(layout)) {
    if (D.pts.length < 2) continue;
    const d = D.deck, landed = d.land !== undefined, up = D.pts[0][1] < D.pts.at(-1)[1];
    const normal = (i) => { const a = D.pts[Math.max(0, i - 1)], b = D.pts[Math.min(D.pts.length - 1, i + 1)], l = flat(a, b); return [(b[2] - a[2]) / l, -(b[0] - a[0]) / l]; };
    for (const side of [-1, 1]) {
      const E = D.pts.map((p, i) => { const n = normal(i), o = side * D.half(i); return [p[0] + n[0] * o, p[1], p[2] + n[1] * o]; });
      const samples = [];
      for (let i = 1; i < E.length; i++) {
        const l = flat(E[i - 1], E[i]), m = Math.max(1, Math.ceil(l / 0.5));
        for (let k = i === 1 ? 0 : 1; k <= m; k++) samples.push({ q: E[i - 1].map((v, j) => v + ((E[i][j] - v) * k) / m), v: (samples.at(-1)?.v ?? 0) + (k || i > 1 ? l / m : 0) });
      }
      const cum = D.pts.reduce((c, p, i) => [...c, i ? c[i - 1] + flat(p, D.pts[i - 1]) : 0], []), fromLanding = (q) => { const k = D.pts.reduce((b, r, i) => (flat(r, q) < flat(D.pts[b], q) ? i : b), 0); return up ? cum[k] : cum.at(-1) - cum[k]; }; // along the deck, as barriers measures its terminal
      const why = samples.map(({ q }) => openingAt(layout, d, q)), ends = samples.filter((_, k) => why[k] || k === 0 || k === samples.length - 1).map(({ q }) => q);
      let run = null;
      samples.forEach(({ q, v }, k) => {
        if (why[k]) {
          if (run?.why === why[k] && run.k === k - 1) Object.assign(run, { k, to: q });
          else openings.push((run = { deck: label(d), side, why: why[k], k, from: q, to: q }));
          return;
        }
        const near = why[k - 1] || why[k + 1]; // next to an opening: where its edge is cut lies between two samples
        const hit = onRun(q), where = `${label(d)} ${side < 0 ? 'left' : 'right'} edge at ${q.map((c) => c.toFixed(1))}`;
        if (!hit) return near || wrong.push(`${where}: no parapet`);
        const free = (landed && fromLanding(q) < TERMINAL + 1) || ends.some((e) => flat(e, q) < TAPER); // the barrier keeps a point about every metre over the fill
        if (!free && !(hit.u >= hit.R.span[0] - 1e-6 && hit.u <= hit.R.span[1] + 1e-6)) wrong.push(`${where}: no rail`);
      });
    }
  }

  test(`${name}: every deck edge has a parapet with a rail from its top to its landing terminal, but at its openings`, (t) => {
    for (const o of openings) t.diagnostic(`opening (${o.why}): ${o.deck} ${o.side < 0 ? 'left' : 'right'} edge, ${o.from.map((c) => c.toFixed(1))} to ${o.to.map((c) => c.toFixed(1))}`);
    assert.deepEqual([...new Set(wrong)].slice(0, 30), []);
  });
}
