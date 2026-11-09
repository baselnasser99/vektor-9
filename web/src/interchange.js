// The highway comes into the city (ADR-0011). The boulevard's highway on the +x side no longer ramps down at the
// city edge: it runs on as an expressway on a viaduct above the boulevard, over the ring road and the outermost
// main street, and ends at an interchange on the four blocks the sim keeps for it (road terrain round that
// crossing). Four one-lane ramps loop down to that main street and up from it: two sweeping right turns on the
// outer blocks, two 270-degree loops on the inner ones. The boulevard below carries on as it was. Decoration and
// ambient traffic only (ADR-0002); the land is the snapshot's.
import * as THREE from 'three';
import { palette } from './palette.js';
import { box, cyl, part, REPEAT, rng } from './geometry.js';
import { tree } from './parts.js';
import { STREETS } from './world.js';

export const HIGH = 7.8; // deck centre; its top at 8.4 m, its underside at 7.2 m, over signal arms (6.6 m) and lamps (6.9 m)
const TOP = HIGH + 0.6;
const WIDE = 30; // deck width, like the highways out of town
const SWEEP = 55; // right-turn ramp radius, to its lane's centre (the outer blocks)
const LOOP = 27; // loop radius (the inner blocks)
const STEP = 4; // metres between a ramp's points
const LANE = STREETS.boulevard.lanes.at(-1); // the expressway's outer lane, where ramps leave and join
const KERB = STREETS.street.lanes.at(-1); // the main street's outer lane

// Whether this city has the interchange: the sim keeps its land as road terrain (schema 4).
export const hasInterchange = (snap) => snap.tiles.some((t) => t.k === 'road');

// The plan, from the layout (city.js cityLayout): the expressway along x over the boulevard (z = 0), from its inner
// end x0 out to the city edge; the main street it crosses at xs; and the ramps, each a list of lane-centre points
// [x, y, z] (y: deck top) with the lane it leaves and the one it joins: the expressway's inbound or outbound lane
// at x, or the main street heading +z or -z at z. Kept on the layout.
export function plan(layout) {
  if (layout.ramps) return layout.ramps;
  const xs = layout.lines.at(-2).c, z0 = layout.lines[layout.lines.length >> 1].c;
  // An arc round (cx, cz) from angle a0 to a1 (x = cos, z = sin), from height y0 to y1, eased at both ends.
  const arc = (cx, cz, r, a0, a1, y0, y1) => {
    const n = Math.ceil((Math.abs(a1 - a0) * r) / STEP), pts = [];
    for (let k = 0; k <= n; k++) {
      const f = k / n, a = a0 + (a1 - a0) * f;
      pts.push([cx + r * Math.cos(a), y0 + (y1 - y0) * f * f * (3 - 2 * f), z0 + cz + r * Math.sin(a)]);
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
  return (layout.ramps = { xs, z0, x0: xs - KERB - LOOP - 2, edge: layout.hi, ramps }); // the deck ends where the loops peel off
}

// Whether (x, z) is under or on a ramp below 6 m, where nothing may stand at street level (streets.js lamps).
export function onRamp(layout, x, z) {
  return plan(layout).ramps.some(({ pts }) => pts.some(([px, py, pz]) => py < 6 && Math.hypot(px - x, pz - z) < 6));
}

// The structure, into root: the expressway deck from its inner end out over the city edge (the highway beyond,
// desert.js, carries on at its height), on single piers with caps in the boulevard's median, with barriers along
// both edges and down the middle, each with a faint glowing strip, edge and lane lines; and each ramp, a chain of
// short deck pieces following its curve and climb, a barrier each side, on slim piers. Barriers facing the road a
// ramp leaves or joins stop short of it, so the lanes run together there. A few trees inside each loop, and plain
// verge on the rest of the land.
export function buildInterchange(kit, root, layout, snap) {
  const { x0, z0, edge, ramps } = plan(layout);
  const deck = kit.concrete(palette.gunmetal), pier = kit.concrete(palette.slate), strip = kit.glow(palette.cream, 0.35);
  const len = edge - x0, mid = (x0 + edge) / 2;
  part(root, box(len, 1.2, WIDE, 0), deck, mid, HIGH, z0);
  part(root, box(1.2, 1.4, 2 * (LANE - 3.8), 0), pier, x0 + 0.6, TOP + 0.5, z0); // the end wall, between the two loops
  // Barriers: down the middle end to end; along each edge in runs, open wherever a ramp peels off or joins.
  const rail = (a, b, z, w) => {
    part(root, box(b - a, 0.9, w, 0), pier, (a + b) / 2, TOP + 0.45, z);
    part(root, box(b - a, 0.06, 0.12, 0), strip, (a + b) / 2, TOP + 0.93, z);
  };
  rail(x0, edge, z0, 0.7);
  for (const s of [-1, 1]) {
    const z = z0 + s * (WIDE / 2 - 0.25), open = (x) => ramps.some(({ pts }) => pts.some(([px, py, pz]) => py > 5 && Math.hypot(px - x, pz - z) < 6));
    let a = null;
    for (let x = x0; x <= edge; x += 2) {
      if (!open(x) && x < edge) a ??= x;
      else if (a !== null) {
        rail(a, x, z, 0.4);
        a = null;
      }
    }
  }
  const lanes = STREETS.boulevard.lanes;
  // Only the outer lanes reach the loops: the inner ones end in hatching over the last stretch, behind a solid line.
  const GORE = 40, inner = (lanes.at(-1) + lanes.at(-2)) / 2;
  for (const s of [-1, 1]) {
    part(root, box(len, 0.02, 0.15, 0), strip, mid, TOP + 0.01, z0 + s * (LANE + 1.5));
    for (const d of lanes.slice(1).map((l, k) => (l + lanes[k]) / 2)) for (let x = x0 + GORE; x < edge - 3; x += 12) part(root, box(3, 0.02, 0.15, 0), strip, x + 1.5, TOP + 0.01, z0 + s * d);
    part(root, box(GORE, 0.02, 0.15, 0), strip, x0 + GORE / 2, TOP + 0.01, z0 + s * inner);
    const w = inner - 0.6; // from the median barrier to that line
    for (let x = x0 + 2 + w / 2; x < x0 + GORE - w / 2; x += 4) {
      part(root, box(0.3, 0.02, w * Math.SQRT2, 0), strip, x, TOP + 0.01, z0 + s * (0.35 + w / 2)).rotation.y = (s * Math.PI) / 4;
    }
  }
  // Piers in the median, clear of every street crossing the boulevard (and its zebras and stop lines).
  const crossing = (x) => layout.cross.some((l) => Math.abs(x - l.c) < l.w / 2 + 8);
  for (let x = x0 + 6; x < edge; x += 26) {
    if (crossing(x)) continue;
    part(root, box(2.2, HIGH - 0.6, 2.2, 0), pier, x, (HIGH - 0.6) / 2, z0);
    part(root, box(3, 0.8, 16, 0), pier, x, HIGH - 1, z0);
  }
  // Each ramp: a continuous deck that narrows to one lane's width where it meets a road, so it runs into that
  // lane; a barrier each side wherever it is not over the road it joins; slim piers.
  const kerb = STREETS.street.w / 2 - STREETS.street.side + 0.5;
  const onRoad = ([x, , z]) => (x > x0 && x < edge && Math.abs(z - z0) < WIDE / 2) || Math.abs(x - plan(layout).xs) < kerb;
  for (const { pts } of ramps) {
    const along = [0];
    for (let i = 1; i < pts.length; i++) along.push(along[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][2] - pts[i - 1][2]));
    // Narrow only at the street end: the expressway end lies under its deck, and past the deck's end it is a full ramp.
    const total = along.at(-1), low = (i) => (pts[0][1] < 1 ? along[i] : total - along[i]), taper = (i) => 1.8 + 2.2 * Math.min(1, low(i) / 25);
    part(root, ribbon(pts, () => 0, taper, -0.63, 0.6), deck); // its top a few centimetres under the road it joins: no flicker
    for (const side of [-1, 1]) {
      const at = (i) => side * (taper(i) - 0.2), runs = [[]];
      pts.forEach((p, i) => {
        const [nx, nz] = normal(pts, i), b = [p[0] + nx * at(i), p[1], p[2] + nz * at(i)];
        if (onRoad(b)) runs.push([]);
        else runs.at(-1).push(i);
      });
      for (const run of runs.filter((r) => r.length > 1)) {
        const sub = run.map((i) => pts[i]), off = (k) => at(run[k]);
        part(root, ribbon(sub, off, () => 0.2, -0.03, 0.9), pier);
        part(root, ribbon(sub, off, () => 0.06, 0.87, 0.06), strip);
      }
    }
    pts.forEach(([x, y, z], i) => {
      if (i % 6 === 3 && y > 2.5) part(root, box(1.4, y - 0.6, 1.4, 0), pier, x, (y - 0.6) / 2, z);
    });
  }
  grove(kit, root, layout, snap);
}

// The land round the ramps as a small urban forest: inside each loop a dark pond with a faintly glowing cold rim,
// and trees everywhere else on the land, tall where they stand clear, small enough to fit where a ramp passes over
// them (a metre under its deck), none on a ramp's low end or under the expressway. Both teals, the bright one
// sparingly, as on the walks. Seeded from each tile, so it is the same on every load.
const POND = 9;
function grove(kit, root, layout, snap) {
  const { x0, z0, edge, ramps } = plan(layout), { n, pos } = layout;
  const ponds = ramps.filter((r) => r.loop).map((r) => centre(r.pts));
  const water = kit.steel(palette.deepNavy, 0.15), rim = kit.glow(palette.coldCyan, 0.5);
  for (const [x, z] of ponds) {
    part(root, cyl(POND + 0.35, POND + 0.35, 0.06, 40), rim, x, 0.44, z);
    part(root, cyl(POND, POND, 0.08, 40), water, x, 0.46, z);
  }
  const room = (x, z, h) => !ponds.some(([px, pz]) => Math.hypot(x - px, z - pz) < POND + 2)
    && !(x > x0 - 4 && x < edge && Math.abs(z - z0) < WIDE / 2 + 4 && h > HIGH - 1.5)
    && ramps.every(({ pts }) => pts.every(([px, py, pz]) => Math.hypot(px - x, pz - z) > 5.5 || py - 1.2 > h));
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
// The horizontal normal of polyline pts at point i (to the right of travel, seen with +z down).
function normal(pts, i) {
  const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dx = b[0] - a[0], dz = b[2] - a[2], l = Math.hypot(dx, dz);
  return [dz / l, -dx / l];
}
// A band along polyline pts: shifted off(k) across at point k, half(k) either side of that, from dy to dy + h above
// each point; top, both sides and bottom, each face with its own vertices (crisp edges), UVs in metres.
function ribbon(pts, off, half, dy, h) {
  const pos = [], uv = [], index = [], ring = [[-1, h], [1, h], [1, 0], [-1, 0]]; // left top, right top, right bottom, left bottom
  let run = 0;
  for (let f = 0; f < 4; f++) {
    const base = pos.length / 3;
    pts.forEach((p, i) => {
      if (i) run += f === 0 ? Math.hypot(p[0] - pts[i - 1][0], p[2] - pts[i - 1][2]) : 0;
      const [nx, nz] = normal(pts, i), u = (f === 0 ? run : i * 4) / REPEAT;
      for (const [s, y] of [ring[f], ring[(f + 1) % 4]]) {
        const o = off(i) + s * half(i);
        pos.push(p[0] + nx * o, p[1] + dy + y, p[2] + nz * o);
        uv.push(u, (o + y) / REPEAT);
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
// meet the expressway's outer lane at the city edge: coming in, only the outer one carries cars (the two ramps
// down are all the way off); going out, cars fan out to all three. Inbound, the expressway lane splits for the right-turn ramp and ends in the loop; outbound, it starts
// at the other loop and takes in the other right turn. On the main street the ramps split off and join its outer
// lanes. Every split and merge is a 'free' node: cars go on without stopping, waiting only for room ahead.
export function interchangeLanes(roads, layout, reach) {
  const { links, nodes } = roads, { xs, z0, edge, ramps } = plan(layout), lanes = STREETS.boulevard.lanes;
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
  lane(outer, -1, reach, edge + 60, { out: 'source', end: inEdge }); // one lane in: what the two ramps down can take
  lane(outer, -1, edge + 20, split.x + 1, { start: inEdge, end: split });
  lane(outer, -1, split.x - 1, end.x + 1, { start: split, end });
  // Outbound: from the loop, past the right turn's join, to the edge, fanning out to three lanes into the haze.
  const begin = node(rLoopOut.to[1], z0 + LANE), join = node(rOut.to[1], z0 + LANE), outEdge = node(edge + 40, z0 + LANE);
  lane(outer, 1, begin.x + 1, join.x - 1, { start: begin, end: join });
  lane(outer, 1, join.x + 1, edge + 20, { start: join, end: outEdge });
  for (let k = 0; k < lanes.length; k++) lane(k, 1, edge + 60, reach, { out: 'sink', start: outEdge });
  // The main street's outer lanes, cut where the ramps meet them.
  const street = (dir, v) => links.find((L) => L.axis === 'z' && Math.abs(L.c - xs) < 1 && L.dir === dir && L.k === L.n - 1
    && Math.min(L.from, L.to) < v && v < Math.max(L.from, L.to));
  const ends = [[rIn, split, cut(street(-1, rIn.to[1] + z0), rIn.to[1] + z0)], [rLoopIn, end, cut(street(1, rLoopIn.to[1] + z0), rLoopIn.to[1] + z0)],
    [rLoopOut, cut(street(1, rLoopOut.from[1] + z0), rLoopOut.from[1] + z0), begin], [rOut, cut(street(-1, rOut.from[1] + z0), rOut.from[1] + z0), join]];
  for (const [r, start, endN] of ends) {
    wire({ kind: 'boulevard', k: 0, n: 1, dir: 1, y: 0, from: 0, to: 1, start, end: endN, ramp: true, pts: r.pts.map(([x, y, z]) => [x, y + 0.65, z]),
      share: r === rIn ? 3 : undefined }); // inbound, half go right and half round the loop
  }
  return roads;
}
