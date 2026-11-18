// The highway comes into the city (ADR-0011). The boulevard's highway on the +x side no longer ramps down at the
// city edge: it runs on as an expressway on a viaduct above the boulevard, over the ring road and the outermost
// main street, to an interchange on the four blocks the sim keeps for it (road terrain round that crossing). Four
// one-lane ramps loop down to that main street and up from it: two sweeping right turns on the outer blocks, two
// 270-degree loops on the inner ones, each with a slip road to the cross street beyond it. Past the loops the
// inner lanes carry on west as two ramps in the avenue's median, down to the boulevard's inner lanes. The
// boulevard below carries on as it was. Decoration and ambient traffic only (ADR-0002); the land is the snapshot's.
import * as THREE from 'three';
import { palette } from './palette.js';
import { box, cyl, part, REPEAT, rng } from './geometry.js';
import { streetLamp, tree } from './parts.js';
import { STREETS } from './world.js';
import { kerbOf, lanesMay, stopAt } from './streets.js';
import { parapetGeometry } from './parapets.js';

export const HIGH = 7.8; // deck centre; its top at 8.4 m, its underside at 7.2 m, over signal arms (6.6 m) and lamps (6.9 m)
const TOP = HIGH + 0.6;
const WIDE = 30; // deck width, like the highways out of town
const SWEEP = 55; // right-turn ramp radius, to its lane's centre (the outer blocks)
const LOOP = 27; // loop radius (the inner blocks)
const STEP = 4; // metres between a ramp's points
const LANE = STREETS.boulevard.lanes.at(-1); // the expressway's outer lane, where ramps leave and join
const INNER = STREETS.boulevard.lanes[0]; // its inner lane, on west down the median ramps
const KERB = STREETS.street.lanes.at(-1); // the main street's outer lane
const NEAR = STREETS.local.lanes[0]; // a cross street's lane (two-way or one-way alike), from its centre line
const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

// Whether this city has the interchange: the sim keeps its land as road terrain (schema 4).
export const hasInterchange = (snap) => snap.tiles.some((t) => t.k === 'road');

// The plan, from the layout (city.js cityLayout), kept on it: the expressway along x over the boulevard (z = z0),
// from where the loops peel off (x0) out to the city edge; the main street it crosses at xs; `west`, the crossing
// where the median ramps meet the boulevard, and `mid`, the mid street they pass over (right in, right out);
// and every deck, each a list of lane-centre points [x, y, z] (y: deck top), widest half-width `half`:
// - ramps: the four to the main street, with the lane each leaves and joins (the expressway's inbound or outbound
//   lane at x, or the main street heading +z or -z at z);
// - median: the two in the avenue's median, down (inbound) and up;
// - slips: one off each ramp down onto the cross street beyond it, one onto each ramp up from it, where that
//   street has a lane the right way on its near side: the ramp, the point it leaves or joins (at), that street,
//   its lane (z), the way that lane runs (dir) and where the slip meets it (x).
export function plan(layout) {
  if (layout.ramps) return layout.ramps;
  const xs = layout.lines.at(-2).c, z0 = layout.lines[layout.lines.length >> 1].c, west = layout.lines.at(-3);
  const mid = layout.mids.find((l) => l.c > west.c && l.c < xs);
  // An arc round (cx, cz) from angle a0 to a1 (x = cos, z = sin), from height y0 to y1, eased at both ends.
  const arc = (cx, cz, r, a0, a1, y0, y1) => {
    const n = Math.ceil((Math.abs(a1 - a0) * r) / STEP), pts = [];
    for (let k = 0; k <= n; k++) {
      const f = k / n, a = a0 + (a1 - a0) * f;
      pts.push([cx + r * Math.cos(a), y0 + (y1 - y0) * ease(f), z0 + cz + r * Math.sin(a)]);
    }
    return pts;
  };
  const ramps = [
    // Down: inbound (-x) right onto the main street heading -z, and left, round a loop, onto it heading +z.
    { pts: arc(xs + KERB + SWEEP, -LANE - SWEEP, SWEEP, Math.PI / 2, Math.PI, TOP, 0), from: ['in', xs + KERB + SWEEP], to: [-1, -LANE - SWEEP] },
    { pts: arc(xs - KERB - LOOP, -LANE - LOOP, LOOP, Math.PI / 2, 2 * Math.PI, TOP, 0), from: ['in', xs - KERB - LOOP], to: [1, -LANE - LOOP], loop: true },
    // Up: from the main street heading +z, round a loop, onto the outbound lane (+x); and from it heading -z, right onto it.
    { pts: arc(xs - KERB - LOOP, LANE + LOOP, LOOP, 0, 1.5 * Math.PI, 0, TOP), from: [1, LANE + LOOP], to: ['out', xs - KERB - LOOP], loop: true },
    { pts: arc(xs + KERB + SWEEP, LANE + SWEEP, SWEEP, Math.PI, 1.5 * Math.PI, 0, TOP), from: [-1, LANE + SWEEP], to: ['out', xs + KERB + SWEEP] },
  ];
  const x0 = xs - KERB - LOOP - 2; // the deck ends where the loops peel off
  // The median ramps: from just inside the deck's end down to the ground 22 m short of the crossing at `west`,
  // then level to its stop line, in the inner lane's line, so they run on as the boulevard's inner lanes.
  const xa = x0 + 6, xw = west.c + stopAt(west) + 0.05, foot = west.c + 22, down = [];
  for (let x = xa; x > xw; x -= STEP) down.push([x, TOP * ease((x - foot) / (x0 - foot)), z0 - INNER]);
  down.push([xw, 0, z0 - INNER]);
  const median = [{ pts: down, half: 1.75 }, { pts: down.map(([x, y, z]) => [x, y, 2 * z0 - z]).reverse(), half: 1.75 }];
  // Slip roads: [ramp, how far along it they part, turning radius]. Down: off the ramp, round to the right onto
  // the cross street's near lane heading +x. Up: off that street's near lane heading -x, round to the right onto
  // the ramp; built backward from the ramp (a left turn), then turned round.
  const cross = (side) => layout.mids.filter((l) => Math.sign(l.c - z0) === side).sort((a, b) => Math.abs(a.c - z0) - Math.abs(b.c - z0))[0];
  const slips = [[0, 0.3, 33], [1, 1 / 3, 20], [2, 0.567, 25], [3, 0.7, 33]].flatMap(([k, f, r]) => {
    const ramp = ramps[k], up = k > 1, side = up ? 1 : -1, l = cross(side), i = Math.round(f * (ramp.pts.length - 1));
    if (!l) return [];
    const p = ramp.pts[i], [a, b] = [ramp.pts[i - 1], ramp.pts[i + 1]], len = Math.hypot(b[0] - a[0], b[2] - a[2]), back = up ? -1 : 1;
    const z = l.c - side * NEAR, path = toLane([p[0], p[2]], [(back * (b[0] - a[0])) / len, (back * (b[2] - a[2])) / len], z, r, back);
    const x = path.at(-1)[0], kind = layout.kindAt(l, 'x', x), dir = -side;
    if (kind !== 'local' && !(kind === 'oneway' && l.flow.x === dir)) return []; // no lane that way there
    // Level with the ramp while it still lies across it (one deck, widening, as at a real fork), then down to the
    // street (or, built backward, up from it) over what is left.
    const beside = path.map((q) => nearest(ramp.pts, q)), apart = Math.max(1, beside.findIndex(([d]) => d > 4 + 2.4)), n = path.length - 1;
    const ys = beside[apart - 1][1], pts = path.map(([px, pz], j) => [px, j < apart ? beside[j][1] : ys * (1 - ease((j - apart + 1) / (n - apart + 1))), pz]);
    return [{ pts: up ? pts.reverse() : pts, half: 2.4, ramp, at: i, up, street: l, z, dir, x }];
  });
  return (layout.ramps = { xs, z0, x0, xa, west, mid, edge: layout.hi, ramps, median, slips, decks: [...ramps, ...median, ...slips] });
}

// The distance from q [x, z] to polyline pts ([x, y, z] points) and its height there: [d, y].
function nearest(pts, q) {
  let best = [Infinity, 0];
  for (let m = 1; m < pts.length; m++) {
    const [a, b] = [pts[m - 1], pts[m]], dx = b[0] - a[0], dz = b[2] - a[2];
    const t = Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[2]) * dz) / (dx * dx + dz * dz)));
    const d = Math.hypot(q[0] - a[0] - t * dx, q[1] - a[2] - t * dz);
    if (d < best[0]) best = [d, a[1] + (b[1] - a[1]) * t];
  }
  return best;
}

// From p [x, z] heading h (unit [x, z]): straight on, then round a circle of radius r turning right (turn 1) or
// left (-1) until heading along x, ending on the line z = zc; straight as far as that needs, or not at all and a
// tighter circle where it would need less than none. Points [x, z] about STEP apart.
function toLane(p, h, zc, r, turn) {
  const a0 = Math.atan2(-turn * h[0], turn * h[1]), q = Math.PI / 2; // the start, seen from the circle's centre
  const a1 = q + Math.PI * (turn > 0 ? Math.ceil((a0 - q) / Math.PI + 1e-9) : Math.floor((a0 - q) / Math.PI - 1e-9)); // heading along x
  const k = turn * h[0] + Math.sin(a1); // the end's z is p's + s * h.z + r * k
  let s = (zc - p[1] - r * k) / h[1];
  if (s < 0) [s, r] = [0, (zc - p[1]) / k];
  const pts = [];
  for (let d = 0; d < s; d += STEP) pts.push([p[0] + h[0] * d, p[1] + h[1] * d]);
  const c = [p[0] + h[0] * s - turn * h[1] * r, p[1] + h[1] * s + turn * h[0] * r], n = Math.max(2, Math.ceil((Math.abs(a1 - a0) * r) / STEP));
  for (let j = 0; j <= n; j++) {
    const a = a0 + ((a1 - a0) * j) / n;
    pts.push([c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]);
  }
  return pts;
}

// Whether (x, z) is under or on a deck below 6 m, where nothing may stand at street level (streets.js lamps).
export function onRamp(layout, x, z) {
  return plan(layout).decks.some(({ pts }) => pts.some(([px, py, pz]) => py < 6 && Math.hypot(px - x, pz - z) < 6));
}

// Where polyline pts ([x, y, z]: a deck's points, or a lane's along one, `lift` m above it) crosses a main
// street's sidewalk at street level: the low ends of the ramps, where people.js walkers cross them and life.js cars
// give way. Each crossing is { key, axis, c, u0, u1, a, b }: the sidewalk runs along `axis` with its middle at c,
// walkers are on the deck from u0 to u1 along it (anywhere across the sidewalk, measured along both of the deck's
// edges at the width buildInterchange draws it, plus half a metre), and cars along pts are on the sidewalk from a
// to b metres along them. The key is the same from a deck's points as from its lane's, so walkers and cars agree
// on it. Not inside a street crossing (no sidewalk there).
export function sidewalkCrossings(layout, pts, lift = 0) {
  const out = [], { lines, cross } = layout, at = [0];
  for (let i = 1; i < pts.length; i++) at.push(at[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][2] - pts[i - 1][2]));
  const street = pts[0][1] - lift < 1 ? 0 : at.at(-1), half = at.map((v) => 1.8 + 2.2 * Math.min(1, Math.abs(v - street) / 25)); // as buildInterchange
  const edges = [-1, 1].map((s) => pts.map((p, i) => {
    const [nx, nz] = normal(pts, i);
    return [p[0] + s * nx * half[i], p[1], p[2] + s * nz * half[i]];
  }));
  // The stretches of polyline P inside the band |P[across] - c| < w / 2 at street level: [{ i, t0, t1 }] per run,
  // from segment i at t0 to its last segment's t1 (as [segment, t] pairs).
  const runs = (P, across, c, w) => {
    const found = [];
    let run = null;
    for (let i = 1; i < P.length; i++) {
      const [p, q] = [P[i - 1], P[i]], [v0, v1] = [p[across] - c, q[across] - c];
      let [t0, t1] = v0 === v1 ? (Math.abs(v0) < w / 2 ? [0, 1] : [1, 0]) : [(-w / 2 - v0) / (v1 - v0), (w / 2 - v0) / (v1 - v0)].sort((m, n) => m - n);
      [t0, t1] = [Math.max(0, t0), Math.min(1, t1)];
      if (t0 >= t1 || Math.max(p[1], q[1]) - lift > 2) {
        run = null;
        continue;
      }
      if (!run) found.push((run = { from: [i, t0] }));
      run.to = [i, t1];
      if (t1 < 1) run = null;
    }
    return found;
  };
  const point = (P, [i, t], k) => P[i - 1][k] + (P[i][k] - P[i - 1][k]) * t;
  for (const l of lines) for (const axis of ['x', 'z']) for (const s of [-1, 1]) {
    const c = l.c + s * (l.w / 2 - l.side / 2), across = axis === 'x' ? 2 : 0, along = 2 - across;
    for (const run of runs(pts, across, c, l.side)) {
      const us = [run.from, run.to].map((st) => point(pts, st, along)), mid = (us[0] + us[1]) / 2;
      if (cross.some((m) => Math.abs(mid - m.c) < m.w / 2 - m.side)) continue; // in a crossing: no sidewalk
      for (const E of edges) for (const r of runs(E, across, c, l.side)) { // the deck's edges where they cross the same band near it
        const ue = [r.from, r.to].map((st) => point(E, st, along));
        if (Math.min(...ue) < Math.max(...us) + 15 && Math.max(...ue) > Math.min(...us) - 15) us.push(...ue);
      }
      const [x, z] = [(point(pts, run.from, 0) + point(pts, run.to, 0)) / 2, (point(pts, run.from, 2) + point(pts, run.to, 2)) / 2];
      const a = at[run.from[0] - 1] + (at[run.from[0]] - at[run.from[0] - 1]) * run.from[1], b = at[run.to[0] - 1] + (at[run.to[0]] - at[run.to[0] - 1]) * run.to[1];
      out.push({ key: `ramp|${Math.round(x)}|${Math.round(z)}`, axis, c, u0: Math.min(...us) - 0.5, u1: Math.max(...us) + 0.5, a, b });
    }
  }
  return out;
}

// Lane rules where the median ramps meet the boulevard (at `west`) and under them (at `mid`, right in and right
// out: the median is closed): the moves lane k of a street of `kind`, along `axis` with centre line c, heading dir,
// may make at the crossing `at` along it; null where the usual rules hold (streets.js lanesMay). At `west` the
// inner lanes go straight on (to and from the median ramps) as well as left, and the avenue's inner lane, which
// would turn left across the ramp's, goes straight on only; at `mid` nothing turns left and the mid street turns right.
export function turnsAt(layout, axis, c, at, dir, k, kind) {
  const { z0, west, mid } = plan(layout);
  if (axis === 'z') return Math.abs(c - mid.c) < 1 && Math.abs(at - z0) < 1 ? ['right'] : null;
  if (Math.abs(c - z0) > 1 || k !== 0) return null;
  if (Math.abs(at - mid.c) < 1) return ['straight'];
  if (Math.abs(at - west.c) > 1) return null;
  return kind === 'avenue' ? ['straight'] : ['straight', 'left'];
}
// Whether street s's crossing with corridor l is the one under the median ramps (right in, right out).
export const underRamps = (layout, s, l) => {
  const { z0, mid } = plan(layout), [a, b] = s.axis === 'x' ? [s.c, l.c] : [l.c, s.c];
  return Math.abs(a - z0) < 1 && Math.abs(b - mid.c) < 1;
};

// The structure, into root: the expressway deck from its inner end out over the city edge (the highway beyond,
// desert.js, carries on at its height), on single piers with caps in the boulevard's median, with a barrier down
// the middle with a faint glowing strip, edge and lane lines, and two sign gantries; every other deck as a
// continuous band following its curve and climb, on slim piers (the median ramps on shared ones); parapets along
// every deck edge, open only where it joins something a car drives onto (barriers). Then the land round the ramps.
export function buildInterchange(kit, root, layout, snap) {
  const { x0, z0, edge, median } = plan(layout);
  const pier = kit.concrete(palette.slate), strip = kit.glow(palette.cream, 0.35);
  const surface = kit.mat('aerial_asphalt_01', palette.gunmetal, 0.55); // every driving surface: the streets' asphalt (streets.js)
  const len = edge - x0, mid = (x0 + edge) / 2;
  // The deck: built like every other deck (ribbon), so its asphalt lies and catches the light as theirs does where
  // they meet (as a box its top read as a different surface beside the ramps); its inner end closed by a thin slab
  // (the outer end runs on into the highway out of town, desert.js).
  part(root, ribbon([[x0, TOP, z0], [edge, TOP, z0]], () => 0, () => WIDE / 2, -1.2, 1.2), surface);
  part(root, box(0.05, 1.19, WIDE, 0), surface, x0 + 0.025, HIGH - 0.005, z0);
  for (const s of [-1, 1]) part(root, box(1.2, 1.4, 1.2, 0), pier, x0 + 0.6, TOP + 0.5, z0 + s * 5.6); // the deck's end, between a median ramp and its loop
  // The barrier down the middle, end to end; the parapets along every deck edge are drawn below (barriers).
  part(root, box(len, 0.9, 0.7, 0), pier, mid, TOP + 0.45, z0);
  part(root, box(len, 0.06, 0.12, 0), strip, mid, TOP + 0.93, z0);
  const lanes = STREETS.boulevard.lanes;
  // The inner lanes go on down the median ramps and the outer ones round the loops, so the middle ones end in
  // hatching over the last stretch, between solid lines.
  const GORE = 40, [d0, d1] = lanes.slice(1).map((l, k) => (l + lanes[k]) / 2), w = d1 - d0;
  for (const s of [-1, 1]) {
    part(root, box(len, 0.02, 0.15, 0), strip, mid, TOP + 0.01, z0 + s * (LANE + 1.5));
    for (const d of [d0, d1]) {
      for (let x = x0 + GORE; x < edge - 3; x += 12) part(root, box(3, 0.02, 0.15, 0), strip, x + 1.5, TOP + 0.01, z0 + s * d);
      part(root, box(GORE, 0.02, 0.15, 0), strip, x0 + GORE / 2, TOP + 0.01, z0 + s * d);
    }
    for (let x = x0 + 2 + w / 2; x < x0 + GORE - w / 2; x += 4) {
      part(root, box(0.3, 0.02, w * Math.SQRT2, 0), strip, x, TOP + 0.01, z0 + s * (d0 + w / 2)).rotation.y = (s * Math.PI) / 4;
    }
  }
  // Piers in the median, clear of every street crossing the boulevard (and its zebras and stop lines).
  const crossing = (x) => layout.cross.some((l) => Math.abs(x - l.c) < l.w / 2 + 8);
  for (let x = x0 + 6; x < edge; x += 26) {
    if (crossing(x)) continue;
    part(root, box(2.2, HIGH - 0.6, 2.2, 0), pier, x, (HIGH - 0.6) / 2, z0);
    part(root, box(3, 0.8, 16, 0), pier, x, HIGH - 1, z0);
  }
  // The median ramps share piers: one between them, its cap under both.
  median[0].pts.forEach(([x, y], i) => {
    if (i % 6 !== 3 || x > x0 || y < 2.5) return;
    part(root, box(1.6, y - 1.2, 1.6, 0), pier, x, (y - 1.2) / 2, z0);
    part(root, box(2.4, 0.6, 9.6, 0), pier, x, y - 0.93, z0);
  });
  gantries(kit, root, layout);
  // Every other deck, as drawn (decksDrawn), on slim piers. Where it lies on another deck at its level or under the
  // expressway's, its top is a few centimetres under that deck's (no flicker; a slip road under its ramp); elsewhere
  // its top is its own height. The place where it passes onto or off another deck is found exactly and added as a
  // point, its top there at its own height, so the change is at the other deck's edge, not up to 4 m before it; a
  // dark steel expansion joint lies across it there, standing a little proud of both surfaces so the step between
  // them (a few centimetres) and the change of structure read as one deliberate strip. Another lies across each
  // deck's low end, where it meets the street.
  const shapes = outlines(layout), seam = kit.steel(palette.graphite, 0.45);
  const joint = ([x, y, z], [tx, tz], wide, top) => { // across the way [tx, tz], from 3 cm under y up to 1.2 cm over top
    const h = Math.max(y, top) + 0.012 - (Math.min(y, top) - 0.03);
    part(root, box(0.25, h, wide, 0), seam, x, Math.max(y, top) + 0.012 - h / 2, z).rotation.y = Math.atan2(-tz, tx);
  };
  for (const { deck: d, pts: raw, half: rawHalf } of decksDrawn(layout)) {
    if (raw.length < 2) continue;
    // The top of the deck p lies on (the expressway's, or another at its level), or null.
    const below = (p) => (onExpressway(layout, p) ? TOP : shapes.some((S) => S.D.deck !== d && Math.abs((heightOn(S, p) ?? Infinity) - p[1]) < 0.3) ? p[1] : null);
    const on = (p) => below(p) !== null;
    const pts = [], halves = [], under = [];
    raw.forEach((p, i) => {
      const a = raw[i - 1];
      if (a && on(a) !== on(p)) {
        let lo = 0, hi = 1;
        for (let k = 0; k < 24; k++) { const m = (lo + hi) / 2; if (on(a.map((v, j) => v + (p[j] - v) * m)) === on(a)) lo = m; else hi = m; }
        const q = a.map((v, j) => v + (p[j] - v) * hi), w = rawHalf(i - 1) + (rawHalf(i) - rawHalf(i - 1)) * hi, l = Math.hypot(p[0] - a[0], p[2] - a[2]);
        const other = below(on(a) ? a : p);
        if (Math.abs(other - q[1]) < 0.3) joint(q, [(p[0] - a[0]) / l, (p[2] - a[2]) / l], 2 * w, other); // not where a sweep ramp drops out from under the expressway
        pts.push(q);
        halves.push(w);
        under.push(false);
      }
      pts.push(p);
      halves.push(rawHalf(i));
      under.push(on(p));
    });
    const half = (i) => halves[i];
    part(root, ribbon(pts, () => 0, half, (i) => (under[i] ? (d.ramp !== undefined ? -0.66 : -0.63) : -0.6), 0.6), surface);
    const [e, f] = raw[0][1] < raw.at(-1)[1] ? [0, 1] : [raw.length - 1, raw.length - 2], l = Math.hypot(raw[f][0] - raw[e][0], raw[f][2] - raw[e][2]);
    joint(raw[e], [(raw[f][0] - raw[e][0]) / l, (raw[f][2] - raw[e][2]) / l], 2 * rawHalf(e), raw[e][1]); // its low end, at the street
    if (median.includes(d)) continue;
    pts.forEach((p, i) => {
      const [x, y, z] = p;
      if (i % 6 === 3 && y > 2.5 && !onExpressway(layout, p)) part(root, box(1.4, y - 0.6, 1.4, 0), pier, x, (y - 0.6) / 2, z);
    });
  }
  // The ramps' paint (rampMarkings), in the streets' paint, 1.2 cm over the deck.
  const { lines: painted, hatch } = rampMarkings(layout), up = (L) => L.map(([x, y, z]) => [x, y + 0.012, z]);
  for (const L of painted) part(root, ribbon(up(L), () => 0, () => 0.075, 0, 0, 1), strip);
  for (const L of hatch) part(root, ribbon(up(L), () => 0, () => 0.15, 0, 0, 1), strip);
  // Parapets along every deck edge (barriers, drawn by parapets.js), the concrete shaded by vertex colours.
  const parapets = parapetGeometry(barriers(layout)), cast = kit.concrete(palette.weatheredConcrete).clone();
  cast.vertexColors = true;
  cast.name += ':parapet';
  part(root, parapets.concrete, cast);
  part(root, parapets.steel, kit.steel(palette.wornGunmetal, 0.5));
  part(root, parapets.lamps, kit.glow(palette.agedAmber, 0.5));
  park(kit, root, layout, snap);
  yard(kit, root, layout);
}

// Whether p [x, y, z] is on the expressway's deck, in plan.
const onExpressway = (layout, [x, , z]) => {
  const { x0, z0, edge } = plan(layout);
  return x > x0 && x < edge && Math.abs(z - z0) < WIDE / 2;
};
// Whether p [x, y, z] is within a street's corridor, out to reach(l) from its centre line (its kerb, or its
// sidewalk's back edge).
const inStreet = (layout, [x, , z], reach) => layout.cross.some((l) => Math.abs(x - l.c) < reach(l) || Math.abs(z - l.c) < reach(l));

// Every deck but the expressway's, as buildInterchange draws it: [{ deck, pts, half }], half(i) its half-width at
// point i. Each narrows to one lane's width where it meets a road at its level, so it runs into that lane; it is
// left out over the carriageway it comes down to (the street's own asphalt is the road there) and raised a little
// over the sidewalk it crosses, like a driveway, so the paving does not show through it.
export function decksDrawn(layout) {
  const P = plan(layout);
  return (P.drawn ??= P.decks.map((d) => {
    const along = [0];
    for (let i = 1; i < d.pts.length; i++) along.push(along[i - 1] + Math.hypot(d.pts[i][0] - d.pts[i - 1][0], d.pts[i][2] - d.pts[i - 1][2]));
    const low = (i) => (d.pts[0][1] < 1 ? along[i] : along.at(-1) - along[i]); // from its street end
    const keep = d.pts.flatMap((p, i) => (p[1] < 0.6 && inStreet(layout, p, kerbOf) ? [] : [i]));
    const pts = keep.map((i) => (inStreet(layout, d.pts[i], (l) => l.w / 2) ? [d.pts[i][0], Math.max(d.pts[i][1], 0.26), d.pts[i][2]] : d.pts[i]));
    const halves = keep.map((i) => Math.min(d.half ?? 4, 1.8 + 2.2 * Math.min(1, low(i) / 25)));
    return { deck: d, pts, half: (i) => halves[i] };
  }));
}

// The paint on every deck but the expressway's (which has its own): a solid edge line each side of its lane, 0.3 m
// inside the deck's edge and at most 2 m from its centre (a ramp is one lane; where it is wider, a shoulder), and
// hatching in the gore where a slip road parts from or joins its ramp, between the two lanes' edge lines until the
// decks part. Lines stop where a deck lies on the expressway or on another deck's lane at its level, and at a
// street's corridor. Each as polylines [x, y, z] on the deck's top: { lines, hatch } (hatch: two-point stripes).
const PAINT = 0.3, LANE_HALF = 2; // m: a line's inset from the deck edge; the most a line lies from the lane's centre
export function rampMarkings(layout) {
  const P = plan(layout);
  if (P.markings) return P.markings;
  const drawn = decksDrawn(layout), lines = [], hatch = [];
  const W = (D, i) => Math.min(D.half(i) - PAINT, LANE_HALF);
  // A deck as drawn, resampled every metre: [{ p, w, n }] (its point, its line offset, its normal).
  const fine = (D) => D.pts.flatMap((b, i) => {
    if (!i) return [];
    const a = D.pts[i - 1], m = Math.max(1, Math.ceil(flat(a, b))), [na, nb] = [normal(D.pts, i - 1), normal(D.pts, i)];
    return Array.from({ length: m + (i === D.pts.length - 1 ? 1 : 0) }, (_, k) => {
      const t = k / m, n = [na[0] + (nb[0] - na[0]) * t, na[1] + (nb[1] - na[1]) * t], l = Math.hypot(...n);
      return { p: a.map((v, j) => v + (b[j] - v) * t), w: W(D, i - 1) + (W(D, i) - W(D, i - 1)) * t, h: D.half(i - 1) + (D.half(i) - D.half(i - 1)) * t, n: [n[0] / l, n[1] / l] };
    });
  });
  const samples = new Map(drawn.filter((D) => D.pts.length > 1).map((D) => [D, fine(D)]));
  // Whether q lies in another deck's lane at its level (within that deck's lines).
  const inLane = (q, self) => [...samples].some(([D, S]) => D !== self && S.some((s) => flat(s.p, q) < s.w - 0.05 && Math.abs(s.p[1] - q[1]) < 0.3));
  const bare = (q) => onExpressway(layout, q) || (q[1] < 1.5 && inStreet(layout, q, (l) => l.w / 2)); // a street's corridor at its level, as the parapets
  for (const [D, S] of samples) for (const side of [-1, 1]) {
    let run = [];
    const end = () => { if (run.length > 1) lines.push(run); run = []; };
    for (const { p, w, n } of S) {
      const q = [p[0] + side * n[0] * w, p[1], p[2] + side * n[1] * w];
      if (bare(p) || bare(q) || inLane(q, D)) end();
      else run.push(q);
    }
    end();
  }
  // The gore: along each slip, where its lane's edge toward the ramp lies outside the ramp's lane and the two decks
  // still touch, a stripe every 2 m from that edge to the ramp's edge line, slanted back along the slip's way.
  for (const s of P.slips) {
    const D = drawn.find((x) => x.deck === s), R = drawn.find((x) => x.deck === s.ramp), S = samples.get(D), RS = samples.get(R);
    if (!S || !RS) continue;
    let last = -Infinity;
    S.forEach(({ p, w, h, n }, k) => {
      const r = RS.reduce((b, x) => (flat(x.p, p) < flat(b.p, p) ? x : b)), d = flat(r.p, p);
      if (d > r.h + h || Math.abs(r.p[1] - p[1]) > 0.3 || k - last < 2) return; // apart, or not due
      const toward = Math.sign((r.p[0] - p[0]) * n[0] + (r.p[2] - p[2]) * n[1]) || 1;
      const a = [p[0] + toward * n[0] * w, p[1], p[2] + toward * n[1] * w], away = -toward;
      const b = [r.p[0] + away * r.n[0] * r.w, r.p[1], r.p[2] + away * r.n[1] * r.w];
      if (flat(a, r.p) < r.w + 0.2 || flat(b, p) < w + 0.2) return; // the lanes still overlap: no gore yet
      const back = S[Math.max(0, k - 2)].p, along = [(p[0] - back[0]) / 2, (p[2] - back[2]) / 2];
      hatch.push([a, [b[0] - along[0] * 1.5, b[1], b[2] - along[1] * 1.5]]);
      last = k;
    });
  }
  return (P.markings = { lines, hatch });
}

// Each deck's outline, for barriers and the deck seams: every deck as drawn (decksDrawn) with its two edges, L and
// R, as polylines [x, y, z] (y its top).
function outlines(layout) {
  const P = plan(layout);
  return (P.outlines ??= decksDrawn(layout).filter((D) => D.pts.length > 1).map((D) => {
    const side = (s) => D.pts.map((p, i) => { const [nx, nz] = normal(D.pts, i), o = s * D.half(i); return [p[0] + nx * o, p[1], p[2] + nz * o]; });
    return { D, L: side(-1), R: side(1) };
  }));
}
// The height of outline S's deck at q [x, y, z] if q is on it in plan, else null.
function heightOn(S, q) {
  const { D, L, R } = S;
  for (let i = 1; i < L.length; i++) {
    const poly = [L[i - 1], L[i], R[i], R[i - 1]];
    let inside = false;
    for (let a = 0, b = 3; a < 4; b = a++) {
      const [xa, , za] = poly[a], [xb, , zb] = poly[b];
      if (za > q[2] !== zb > q[2] && q[0] < ((xb - xa) * (q[2] - za)) / (zb - za) + xa) inside = !inside;
    }
    if (!inside) continue;
    const [a, b] = [D.pts[i - 1], D.pts[i]], dx = b[0] - a[0], dz = b[2] - a[2];
    const t = Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[2] - a[2]) * dz) / (dx * dx + dz * dz || 1)));
    return a[1] + (b[1] - a[1]) * t;
  }
  return null;
}
const flat = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
// Where segment a-b crosses segment c-d in plan, as a fraction along a-b, or null.
function crossing(a, b, c, d) {
  const rx = b[0] - a[0], rz = b[2] - a[2], sx = d[0] - c[0], sz = d[2] - c[2], den = rx * sz - rz * sx;
  if (Math.abs(den) < 1e-12) return null;
  const t = ((c[0] - a[0]) * sz - (c[2] - a[2]) * sx) / den, u = ((c[0] - a[0]) * rz - (c[2] - a[2]) * rx) / den;
  return t > 1e-9 && t < 1 - 1e-9 && u >= -1e-9 && u <= 1 + 1e-9 ? t : null;
}
// The inward normal of segment a-b: whichever of its two normals is on the side of ref, [x, z].
function inward(a, b, ref) {
  const dx = b[0] - a[0], dz = b[2] - a[2], l = Math.hypot(dx, dz) || 1, n = [-dz / l, dx / l];
  return n[0] * ref[0] + n[1] * ref[1] < 0 ? [-n[0], -n[1]] : n;
}
// Where two inward normals meet at a corner: the vector to the corner of the two lines a metre inward, at most 2.5 m
// long (at a sharp nose, where two decks part, the parapets merge), or null where the two turn right back.
const mitre = (m, n) => {
  const s = Math.hypot(m[0] + n[0], m[1] + n[1]), f = Math.min(2.5, Math.sqrt(2 / Math.max(1e-9, 1 + m[0] * n[0] + m[1] * n[1])));
  return s < 1e-3 ? null : [((m[0] + n[0]) / s) * f, ((m[1] + n[1]) / s) * f];
};

// The parapets (parapets.js draws them): runs { pts, cross, caps, depth } along every deck edge, on the edge itself: both
// sides of the expressway and across its inner end, and both sides of every other deck as drawn. An edge is open
// only where it joins something a car drives onto: another deck within 1.2 m of its height, the expressway's deck
// (under which a ramp's edges are hidden), or a street at its level (a ramp's low end, below 1.5 m in a street's
// corridor). Each edge is cut exactly where it crosses another deck's outline or a street corridor's side, and
// every metre between, so where an edge runs into another deck its run ends on the same point as the run of that
// deck's edge coming out of it. Such ends are joined: at one height (the higher), their cross vectors mitred.
// Every other end is an opening and is capped: where the expressway's outer end carries on as the highway out of
// town (desert.js), where a ramp comes down into a street, and where the two sweep ramps come out from under the
// expressway (they drop while still under it, so their edges and its own cross there a step apart in height).
// cross[i] is the inward normal at point i, mitred where the run bends. Runs keep a point every 3 m or so.
// tests/js/barriers.test.mjs checks the joins, the caps and the coverage.
export function barriers(layout) {
  const P = plan(layout);
  if (P.barriers) return P.barriers;
  const { x0, z0, edge } = P, H = WIDE / 2, shapes = outlines(layout);
  const box = [[x0, TOP, z0 - H], [edge, TOP, z0 - H], [edge, TOP, z0 + H], [x0, TOP, z0 + H]];
  const bounds = (S) => { // an outline's sides and ends, as segments
    const ring = S ? [...S.L, ...[...S.R].reverse(), S.L[0]] : [...box, box[0]];
    return ring.slice(1).map((p, i) => [ring[i], p]);
  };
  const walls = new Map([[null, bounds(null)], ...shapes.map((S) => [S, bounds(S)])]);
  const sides = layout.cross.flatMap((l) => [-1, 1].flatMap((s) => [['x', l.c + (s * l.w) / 2], ['z', l.c + (s * l.w) / 2]]));
  const atStreet = (q) => q[1] < 1.5 && inStreet(layout, q, (l) => l.w / 2);
  const open = (self, q) => {
    if (!self) return shapes.some((S) => Math.abs((heightOn(S, q) ?? Infinity) - TOP) < 1.2);
    return onExpressway(layout, q) || atStreet(q) || shapes.some((S) => S !== self && Math.abs((heightOn(S, q) ?? Infinity) - q[1]) < 1.2);
  };
  // Every edge: its line, the way inward at each of its points, and whose edge it is (null: the expressway's).
  const edges = [
    { line: [box[0], box[1]], ref: () => [0, 1], self: null },
    { line: [box[3], box[2]], ref: () => [0, -1], self: null },
    { line: [box[0], box[3]], ref: () => [1, 0], self: null },
    ...shapes.flatMap((S) => ['L', 'R'].map((k) => ({ line: S[k], ref: (i) => [S.D.pts[i][0] - S[k][i][0], S.D.pts[i][2] - S[k][i][2]], self: S }))),
  ];
  const runs = [];
  for (const { line, ref, self } of edges) {
    let run = null;
    const close = () => {
      if (run && run.pts.length > 1) runs.push(run);
      run = null;
    };
    for (let k = 1; k < line.length; k++) {
      const [a, b] = [line[k - 1], line[k]], n = Math.max(1, Math.ceil(flat(a, b))), ts = new Set([0, 1]);
      for (let j = 1; j < n; j++) ts.add(j / n);
      for (const [S, segs] of walls) if (S !== self) for (const [c, d] of segs) { const t = crossing(a, b, c, d); if (t !== null) ts.add(t); }
      for (const [axis, v] of sides) { // a street corridor's sides, where the deck is low enough to meet the street
        const [pa, pb] = axis === 'x' ? [a[0], b[0]] : [a[2], b[2]], t = (v - pa) / (pb - pa);
        if (t > 1e-9 && t < 1 - 1e-9 && Math.min(a[1], b[1]) < 1.5) ts.add(t);
      }
      const t = [...ts].sort((p, q) => p - q), at = (f) => a.map((v, j) => v + (b[j] - v) * f);
      const r0 = ref(k - 1), r1 = ref(k), dir = [r0[0] + r1[0], r0[1] + r1[1]];
      for (let m = 1; m < t.length; m++) {
        if (t[m] - t[m - 1] < 1e-9) continue;
        if (open(self, at((t[m - 1] + t[m]) / 2))) { close(); continue; }
        run ??= { pts: [at(t[m - 1])], refs: [dir], corner: [t[m - 1] === 0], depth: self ? 0.6 : 1.2 }; // its deck's thickness: a ramp's, the expressway's
        run.pts.push(at(t[m]));
        run.refs.push(dir);
        run.corner.push(t[m] === 1);
      }
    }
    close();
  }
  // A point every 3 m or so, the ends and the edge's own corners kept; then the inward normals, mitred.
  for (const run of runs) {
    const keep = [0];
    let since = 0;
    for (let i = 1; i < run.pts.length; i++) {
      since += flat(run.pts[i], run.pts[i - 1]);
      if (since >= 2.9 || run.corner[i] || i === run.pts.length - 1) { keep.push(i); since = 0; }
    }
    const pts = keep.map((i) => run.pts[i]), refs = keep.map((i) => run.refs[i]);
    run.normals = pts.slice(1).map((p, i) => inward(pts[i], p, refs[i + 1]));
    run.pts = pts;
    run.cross = pts.map((_, i) => (i === 0 ? run.normals[0] : i === pts.length - 1 ? run.normals.at(-1) : mitre(run.normals[i - 1], run.normals[i]) ?? run.normals[i]));
    run.caps = [true, true];
    delete run.refs;
    delete run.corner;
  }
  // Join the ends that meet: on the same point in plan (2 cm), within 30 cm in height (the parapet's foot reaches 35 cm into the deck).
  const ends = runs.flatMap((run) => [0, 1].map((e) => ({ run, e, i: e ? run.pts.length - 1 : 0 })));
  const normalAt = ({ run, e }) => (e ? run.normals.at(-1) : run.normals[0]);
  for (const A of ends) {
    if (!A.run.caps[A.e]) continue;
    const p = A.run.pts[A.i];
    const B = ends.find((B) => B.run !== A.run && B.run.caps[B.e] && flat(p, B.run.pts[B.i]) < 0.02 && Math.abs(p[1] - B.run.pts[B.i][1]) < 0.3);
    const m = B && mitre(normalAt(A), normalAt(B));
    if (!m) continue;
    const q = B.run.pts[B.i], meet = [(p[0] + q[0]) / 2, Math.max(p[1], q[1]), (p[2] + q[2]) / 2];
    for (const { run, i } of [A, B]) { // the lower one raised to the meeting height, eased in over its last 3 m
      const raise = meet[1] - run.pts[i][1], step = i ? -1 : 1;
      for (let j = i, d = 0; j >= 0 && j < run.pts.length && d < 3; d += flat(run.pts[j], run.pts[j + step] ?? run.pts[j]), j += step) {
        run.pts[j] = [run.pts[j][0], run.pts[j][1] + raise * (1 - d / 3), run.pts[j][2]];
      }
    }
    A.run.pts[A.i] = B.run.pts[B.i] = meet;
    A.run.cross[A.i] = B.run.cross[B.i] = m;
    A.run.caps[A.e] = B.run.caps[B.e] = false;
  }
  for (const run of runs) delete run.normals;
  return (P.barriers = runs);
}

// Two sign gantries over the expressway (Blender, tools/blender/interchange_props.py), one ahead of each pair of
// ramps; amber messages for each way (invented).
const SIGNS = [[['CENTRE', 'KEEP LEFT'], ['RING RD', 'EXIT']], [['MAIN ST', 'EXIT'], ['HIGHWAY', 'EAST']]];
function gantries(kit, root, layout) {
  const { xs, z0 } = plan(layout), base = kit.industrial();
  [xs + 22.5, xs + 112.5].forEach((x, k) => {
    const g = kit.foldDetail(kit.model('ix_gantry', { ...base, panel: kit.message(SIGNS[k][0]), panel_b: kit.message(SIGNS[k][1]) }), [base.dark]);
    g.rotation.y = Math.PI / 2; // spanning the deck: its +z face (the inbound signs) toward +x
    g.position.set(x, TOP, z0);
    root.add(g);
  });
}

// The two inner blocks, inside the loops: a small park. A dark pond with a faintly glowing cold rim and the
// interchange's landmark on an island in it (two leaning graphite blades, Blender), a paved
// path round it and two out to the mid street's sidewalk, passing under the loop where it is high, benches facing
// the water, two lamps, and trees as tall as fit under the decks above them (a metre under), down to shrubs, none
// on a path, a deck's low end or under the expressway; on the outer blocks too, round the service yard (yard).
// Both teals, the bright one sparingly, as on the walks.
// Seeded from each tile, so it is the same on every load.
const POND = 9, RING = POND + 3.5;
function park(kit, root, layout, snap) {
  const { xs, x0, z0, edge, mid, ramps, decks } = plan(layout), { n, pos } = layout;
  const water = kit.steel(palette.deepNavy, 0.15), rim = kit.glow(palette.coldCyan, 0.5), paving = kit.concrete(palette.roseGrey), seat = kit.steel(palette.charcoal, 0.8);
  const ponds = ramps.filter((r) => r.loop).map((r) => centre(r.pts)), paths = [], westEdge = mid.c + mid.w / 2;
  const walk = (a, b) => { // a paved path from a to b ([x, z])
    paths.push([a, b]);
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    part(root, box(l, 0.06, 2, 0), paving, (a[0] + b[0]) / 2, 0.45, (a[1] + b[1]) / 2).rotation.y = -Math.atan2(b[1] - a[1], b[0] - a[0]);
  };
  for (const [x, z] of ponds) {
    part(root, cyl(POND + 0.35, POND + 0.35, 0.06, 40), rim, x, 0.44, z);
    part(root, cyl(POND, POND, 0.08, 40), water, x, 0.46, z);
    const blades = kit.model('ix_monument', { ...kit.industrial(), concrete: kit.concrete(palette.slate) }); // no small parts to fold
    blades.position.set(x, 0.48, z); // on its island in the pond
    blades.rotation.y = z < z0 ? 0 : Math.PI; // the taller blade on the same side seen from the expressway
    root.add(blades);
    const around = (a) => [x + RING * Math.cos(a), z + RING * Math.sin(a)];
    for (let k = 0; k < 24; k++) walk(around((k * Math.PI) / 12), around(((k + 1.05) * Math.PI) / 12));
    for (const dz of [-14, 14]) walk(around(Math.atan2(dz, westEdge - x)), [westEdge, z + dz]); // out west, under the loop's high side
    for (let k = 0; k < 4; k++) { // benches on the pond's side of the path, facing it
      const a = Math.PI / 4 + (k * Math.PI) / 2, r = RING - 1.6;
      part(root, box(1.8, 0.45, 0.55, 1), seat, x + r * Math.cos(a), 0.65, z + r * Math.sin(a)).rotation.y = -a + Math.PI / 2;
    }
    for (const a of [0.15 * Math.PI, 1.15 * Math.PI]) streetLamp(kit, root, x + (RING + 1.6) * Math.cos(a), z + (RING + 1.6) * Math.sin(a), -a + Math.PI);
  }
  const offPath = (x, z) => paths.every(([a, b]) => {
    const dx = b[0] - a[0], dz = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)));
    return Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz) > 2.2;
  });
  // On the outer blocks, clear of the service yard in the corner and of the sound walls along the edges (yard below).
  const east = layout.mids.find((l) => l.c > xs), side = layout.mids.find((l) => l.c > z0), [ex, ez] = [east ? east.c - east.w / 2 : Infinity, side ? side.c - side.w / 2 - z0 : Infinity];
  const outside = (x, z) => x < xs || (x < ex - 3 && Math.abs(z - z0) < ez - 3 && !(x > ex - 20 && Math.abs(z - z0) > ez - 31));
  const room = (x, z, h) => outside(x, z) && !ponds.some(([px, pz]) => Math.hypot(x - px, z - pz) < POND + 2) && offPath(x, z)
    && !(x > x0 - 4 && x < edge && Math.abs(z - z0) < WIDE / 2 + 4 && h > HIGH - 1.5)
    && decks.every(({ pts }) => pts.every(([px, py, pz]) => Math.hypot(px - x, pz - z) > 5.5 || py - 1.2 > h));
  snap.tiles.forEach((t, i) => {
    if (t.k !== 'road') return;
    const rand = rng(t.s * 3 + 11), [cx, cz] = [pos(i % n), pos(Math.floor(i / n))];
    for (let k = 0; k < 4; k++) {
      const x = cx + (rand() - 0.5) * 12, z = cz + (rand() - 0.5) * 12, tall = 3 + rand() * 6, bright = rand() < 0.2;
      for (const h of [tall, tall * 0.6, 2.4]) { // as tall as it fits, down to a shrub
        if (!room(x, z, h)) continue;
        tree(kit, root, x, z, h, bright ? palette.teal : palette.mistTeal);
        break;
      }
    }
  });
}

// The two outer blocks, inside the sweeps: a highway service yard in the corner the slip road leaves free (a
// paved apron, a depot shed with roller doors, a stock of spare barriers and cable drums; Blender,
// tools/blender/interchange_props.py), and sound walls along the blocks' outer edges toward the neighbours, open
// wherever a deck passes low, and at the yard's gate.
function yard(kit, root, layout) {
  const { xs, z0, decks } = plan(layout), base = kit.industrial(), roles = { ...base, concrete: kit.concrete(palette.slate), yellow: base.hazard };
  const east = layout.mids.find((l) => l.c > xs), apron = kit.concrete(palette.gunmetal);
  if (!east) return;
  const x1 = east.c - east.w / 2; // the blocks' east edge
  const blocked = (x, z) => decks.some(({ pts, half = 4 }) => pts.some(([px, py, pz]) => py < 5 && Math.hypot(px - x, pz - z) < half + 1.2));
  const model = (name, x, z, face) => {
    const g = kit.foldDetail(kit.model(name, roles), [base.dark]);
    g.rotation.y = face;
    g.position.set(x, 0.42, z);
    root.add(g);
  };
  for (const side of [-1, 1]) {
    const l = layout.mids.filter((m) => Math.sign(m.c - z0) === side).sort((a, b) => Math.abs(a.c - z0) - Math.abs(b.c - z0))[0];
    if (!l) continue;
    const z1 = l.c - side * (l.w / 2); // the block's edge on the cross street
    const yx = x1 - 9, yz = z1 - side * 15, gate = x1 - 6.5; // the yard: 17 x 29 m in the corner
    part(root, box(16, 0.06, 28, 0), apron, yx, 0.45, yz);
    model('ix_depot', x1 - 6, z1 - side * 21, -Math.PI / 2); // its doors toward the yard (-x)
    model('ix_stock', x1 - 12, z1 - side * 6, side > 0 ? Math.PI : 0);
    // Sound walls in 6 m panels along the cross street's edge and the east edge, clear of decks and the gate.
    const runs = [[[xs + STREETS.street.w / 2 + 1, z1 - side * 0.6], [x1 - 0.6, z1 - side * 0.6]], [[x1 - 0.6, z1 - side * 0.6], [x1 - 0.6, z0 + side * (WIDE / 2 + 3)]]];
    for (const [a, b] of runs) {
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]), u = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
      for (let s = 3; s + 3 <= L; s += 6) {
        const x = a[0] + u[0] * s, z = a[1] + u[1] * s;
        if (blocked(x - u[0] * 3, z - u[1] * 3) || blocked(x + u[0] * 3, z + u[1] * 3) || blocked(x, z) || (Math.abs(z - z1) < 1 && Math.abs(x - gate) < 4)) continue;
        model('ix_wall', x, z, Math.atan2(u[0], u[1]) - Math.PI / 2 + (side > 0 ? Math.PI : 0));
      }
    }
  }
}

// The horizontal normal of polyline pts at point i (to the right of travel, seen with +z down).
function normal(pts, i) {
  const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dx = b[0] - a[0], dz = b[2] - a[2], l = Math.hypot(dx, dz);
  return [dz / l, -dx / l];
}
// A band along polyline pts: shifted off(k) across at point k, half(k) either side of that, from dy to dy + h above
// each point (dy a number, or dy(k) per point); top, both sides and bottom (or the top alone: faces 1), each face
// with its own vertices (crisp edges), UVs in metres (the top's in plan).
function ribbon(pts, off, half, dy, h, faces = 4) {
  const lift = typeof dy === 'function' ? dy : () => dy;
  const pos = [], uv = [], index = [], ring = [[-1, h], [1, h], [1, 0], [-1, 0]]; // left top, right top, right bottom, left bottom
  let run = 0;
  for (let f = 0; f < faces; f++) {
    const base = pos.length / 3;
    pts.forEach((p, i) => {
      if (i) run += f === 0 ? Math.hypot(p[0] - pts[i - 1][0], p[2] - pts[i - 1][2]) : 0;
      const [nx, nz] = normal(pts, i), u = (f === 0 ? run : i * 4) / REPEAT;
      for (const [s, y] of [ring[f], ring[(f + 1) % 4]]) {
        const o = off(i) + s * half(i);
        pos.push(p[0] + nx * o, p[1] + lift(i) + y, p[2] + nz * o);
        if (f === 0) uv.push((p[0] + nx * o) / REPEAT, (p[2] + nz * o) / REPEAT); // the top projected on the ground, as box and slab do: the asphalt's relief lies the same way on every deck and street
        else uv.push(u, (o + y) / REPEAT);
      }
    });
    for (let i = 0; i < pts.length - 1; i++) {
      const [p, q, P, Q] = [base + 2 * i, base + 2 * i + 1, base + 2 * i + 2, base + 2 * i + 3];
      index.push(p, P, q, q, P, Q);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}
// The centre of the circle an arc's points lie on (from its ends and middle).
function centre(pts) {
  const [a, b, c] = [pts[0], pts[pts.length >> 1], pts.at(-1)];
  const d = 2 * (a[0] * (b[2] - c[2]) + b[0] * (c[2] - a[2]) + c[0] * (a[2] - b[2])), s = (p) => p[0] ** 2 + p[2] ** 2;
  return [(s(a) * (b[2] - c[2]) + s(b) * (c[2] - a[2]) + s(c) * (a[2] - b[2])) / d, (s(a) * (c[0] - b[0]) + s(b) * (a[0] - c[0]) + s(c) * (b[0] - a[0])) / d];
}

// The traffic (life.js), after desert.js outOfTown. The highway's three lanes each way on the +x side, out of town,
// meet the expressway at the city edge: coming in, the outer lane carries cars to the four ramps down and the inner
// one to the median ramp; going out, both fan out to all three. Inbound, the outer lane splits for the right-turn
// ramp and ends in the loop; outbound, it starts at the other loop and takes in the other right turn. On the main
// street the ramps split off and join its outer lanes, and the slip roads off the cross streets' near lanes. The
// median ramps run between the expressway's inner lanes and the boulevard's at `west`, whose lanes there follow
// turnsAt and go straight on lane by lane by their place across the road (so the avenue's lanes keep their line),
// and the crossing at `mid` gives priority to the avenue. Every split and merge is a 'free' node: at a split cars go
// on without stopping, waiting only for room ahead; at a merge they take turns, a ramp or slip waiting for a gap
// (life.js merging). Each ramp also gives way to walkers where its low end crosses a sidewalk (walks).
export function interchangeLanes(roads, layout, reach) {
  const { links, nodes } = roads, { xs, z0, xa, edge, ramps, median, slips, west, mid } = plan(layout), lanes = STREETS.boulevard.lanes;
  const node = (x, z) => {
    const N = { key: `ix|${Math.round(x)}|${Math.round(z)}`, x, z, kinds: {}, walk: false, type: 'free', ins: [], outs: [] };
    nodes.push(N);
    return N;
  };
  const wire = (L) => {
    links.push(L);
    L.start?.outs.push(L);
    L.end?.ins.push(L);
    return L;
  };
  // A straight lane along x at z0 + dir * off (driving on the right), on the expressway or the highway beyond.
  const lane = (k, dir, from, to, extra) => wire({ axis: 'x', c: z0, w: WIDE, side: 0, kind: 'boulevard', off: lanes[k], at: z0 + dir * lanes[k],
    k, n: lanes.length, dir, mid: false, y: TOP + 0.65, from, to, start: null, end: null, ...extra });
  const outer = lanes.length - 1;
  // Splits straight lane L at v along it into two joined by a free node; returns the node.
  const cut = (L, v) => {
    const N = L.axis === 'x' ? node(v, L.at) : node(L.at, v), after = { ...L, from: v + L.dir, start: N, through: false };
    Object.assign(L, { to: v - L.dir, end: N, out: L.out === 'sink' ? undefined : L.out });
    if (after.end) after.end.ins.splice(after.end.ins.indexOf(L), 1, after);
    links.push(after);
    N.ins.push(L);
    N.outs.push(after);
    return N;
  };
  const [rIn, rLoopIn, rLoopOut, rOut] = ramps;
  // Inbound: three lanes from the haze to the edge, into one; a split for the right turn; the loop at its end.
  const inEdge = node(edge + 40, z0 - LANE), split = node(rIn.from[1], z0 - LANE), end = node(rLoopIn.from[1], z0 - LANE);
  lane(outer, -1, reach, edge + 60, { out: 'source', end: inEdge }); // one lane in for the ramps: what they can take
  lane(outer, -1, edge + 20, split.x + 1, { start: inEdge, end: split });
  lane(outer, -1, split.x - 1, end.x + 1, { start: split, end });
  // Outbound: from the loop, past the right turn's join, to the edge, fanning out to three lanes into the haze.
  const begin = node(rLoopOut.to[1], z0 + LANE), join = node(rOut.to[1], z0 + LANE), outEdge = node(edge + 40, z0 + LANE);
  lane(outer, 1, begin.x + 1, join.x - 1, { start: begin, end: join });
  lane(outer, 1, join.x + 1, edge + 20, { start: join, end: outEdge });
  for (let k = 0; k < lanes.length; k++) lane(k, 1, edge + 60, reach, { out: 'sink', start: outEdge });
  // The inner lanes and the median ramps, to and from the boulevard at `west`.
  const W = nodes.find((N) => N.key === `${Math.round(west.c)}|${Math.round(z0)}`), down = node(xa, z0 - INNER), up = node(xa, z0 + INNER);
  const like = (dir) => links.find((L) => L.axis === 'x' && Math.abs(L.c - z0) < 1 && L.dir === dir && (dir < 0 ? L.end : L.start) === W);
  lane(0, -1, reach, xa + 1, { out: 'source', end: down });
  wire({ ...like(-1), kind: 'boulevard', k: 0, n: lanes.length, off: INNER, at: z0 - INNER, from: xa, start: down, y: 0.65, pts: median[0].pts.map(([x, y, z]) => [x, y + 0.65, z]) });
  const climb = like(1);
  wire({ ...climb, kind: 'boulevard', k: 0, n: lanes.length, off: INNER, at: z0 + INNER, to: xa, end: up, y: 0.65, reach: undefined, zebra: null,
    pts: median[1].pts.map(([x, y, z]) => [x, y + 0.65, z]) });
  lane(0, 1, xa + 1, edge + 20, { start: up, end: outEdge });
  for (const L of W.ins) L.may = turnsAt(layout, L.axis, L.c, west.c, L.dir, L.k, L.kind) ?? lanesMay(L.kind, L.k, L.n);
  // Under the median ramps: no lights (the decks are too low for signal arms), the avenue has priority.
  const M = nodes.find((N) => N.key === `${Math.round(mid.c)}|${Math.round(z0)}`);
  M.type = 'priority';
  for (const L of M.ins) L.may = turnsAt(layout, L.axis, L.c, L.axis === 'x' ? mid.c : z0, L.dir, L.k, L.kind) ?? lanesMay(L.kind, L.k, L.n);
  // The main street's outer lanes, cut where the ramps meet them; each ramp cut where its slip road parts or joins.
  const street = (dir, v) => links.find((L) => L.axis === 'z' && Math.abs(L.c - xs) < 1 && L.dir === dir && L.k === L.n - 1
    && Math.min(L.from, L.to) < v && v < Math.max(L.from, L.to));
  const ends = [[rIn, split, cut(street(-1, rIn.to[1] + z0), rIn.to[1] + z0)], [rLoopIn, end, cut(street(1, rLoopIn.to[1] + z0), rLoopIn.to[1] + z0)],
    [rLoopOut, cut(street(1, rLoopOut.from[1] + z0), rLoopOut.from[1] + z0), begin], [rOut, cut(street(-1, rOut.from[1] + z0), rOut.from[1] + z0), join]];
  const ramp = (pts, start, endN, extra) => wire({ kind: 'boulevard', k: 0, n: 1, dir: 1, y: 0, from: 0, to: 1, start, end: endN, ramp: true,
    pts: pts.map(([x, y, z]) => [x, y + 0.65, z]), walks: sidewalkCrossings(layout, pts), ...extra }); // walks: where it gives way to walkers
  for (const [r, start, endN] of ends) {
    const s = slips.find((p) => p.ramp === r), share = r === rIn ? 3 : undefined; // inbound, half go right and half round the loop
    if (!s) {
      ramp(r.pts, start, endN, { share });
      continue;
    }
    // The ramp's pieces end at point k - 1 and start at k, and the slip starts (down) or ends (up) at `at`, one of
    // the two: every connector through the node is a point's gap long. A zero-long one, cars could never leave.
    const N = node(r.pts[s.at][0], r.pts[s.at][2]), k = s.up ? s.at + 1 : s.at;
    ramp(r.pts.slice(0, k), start, N, { share });
    ramp(r.pts.slice(k), N, endN, { share: s.up ? undefined : 2 }); // two in three stay on the ramp down
    const L = links.find((O) => O.axis === 'x' && Math.abs(O.c - s.street.c) < 1 && O.dir === s.dir && Math.abs(O.at - s.z) < 0.5
      && Math.min(O.from, O.to) < s.x && s.x < Math.max(O.from, O.to));
    console.assert(L, `interchange: no lane on the cross street at ${s.street.c} for a slip road`);
    if (!L) continue;
    const S = cut(L, s.x);
    if (s.up) ramp(s.pts, S, N, { share: 1 }); // a quarter of the street's cars there take it
    else ramp(s.pts, N, S, { share: 1 });
  }
  return roads;
}
