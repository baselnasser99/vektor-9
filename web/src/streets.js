// Street level: a grid of street corridors between blocks of HALF x HALF tiles (cityLayout in city.js): a boulevard
// through the middle, main streets, local streets (the ring road, the narrow lines and every inner sector's mid
// street), pedestrian walks, the old town's market lanes and the outer sectors' service alleys (STREETS in world.js).
// Raised blocks of paving with kerbs and rounded corners sized by the streets that meet there, road markings,
// crossings, sodium lamps, and the traffic lanes cars drive in. Long flat parts are slabs cut into short pieces, so
// the city's warp bends them.
import * as THREE from 'three';
import { palette } from './palette.js';
import { box, cyl, part, REPEAT, ring, rng, slab } from './geometry.js';
import { telecomTower } from './landmarks.js';
import { streetLamp, tree } from './parts.js';
import { radialTexture } from './textures.js';
import { CAFES, CARS, FOOD, HUB, STREETS, TILE, WARM, WIDE, pick } from './world.js';
import { onRamp } from './interchange.js';

export function buildStreets(kit, layout, root) {
  const { lines, cross, lo, hi } = layout, rand = rng(31);
  const asphalt = kit.mat('aerial_asphalt_01', palette.gunmetal, 0.55); // wet, but not a mirror
  part(root, slab(hi - lo, 0.1, hi - lo, 8), asphalt, 0, -0.05, 0); // ends at the ring road's outer kerb line
  const hub = lines[lines.length >> 1];
  const ctx = { kit, root, layout, lines, cross, lo, hi, rand, hub: hub.c, paint: kit.glow(palette.cream, 0.35), lampsAt: [], benches: [], food: [], parked: [] }; // road paint glows faintly
  blocks(ctx, hub);
  // Every corridor, once per axis: centre c, width w, sidewalk side, kind, the axis it runs along and its corridor.
  const streets = cross.flatMap((l) => ['x', 'z'].map((axis) => ({ c: l.c, w: l.w, side: l.side, kind: l.kind[axis], axis, line: l })));
  perimeter(ctx);
  for (const s of streets) {
    if (s.kind === 'alley') {
      alley(ctx, s);
      continue;
    }
    const segs = segments(ctx, s);
    for (const g of segs) {
      if (g.kind === 'walk') walk(ctx, s, g);
      else if (g.kind === 'none') { // paved over, kerb to kerb of the streets at its ends
        const [a, b] = [g.a + kerbOf(g.l0), g.b - kerbOf(g.l1)];
        lay(ctx, s, b - a, 0.18, 2 * kerbOf(s), kit.concrete(palette.slate), (a + b) / 2, 0, 0.09);
        if (!layout.cut(s.line, s.axis, (a + b) / 2)) for (const f of [0.3, 0.7]) tree(kit, root, ...spot(s, a + f * (b - a), 0), 5.5); // a built-over stretch (T-junctions): a pocket square
      }
      else road(ctx, g.kind === s.kind ? s : { ...s, kind: g.kind }, g); // the boulevard's avenue stretches
    }
    crossings(ctx, s, segs);
    lamps(ctx, s, segs);
  }
  for (const s of streets) if (s.kind === 'street' || s.kind === 'boulevard') kerbside(ctx, s); // after every lamp: shelters keep clear of them
  plaza(ctx, hub);
  return { roads: roadNet(ctx, streets), lines: lines.map((l) => l.c), lo, hi, lamps: ctx.lampsAt, benches: ctx.benches, food: ctx.food,
    parked: ctx.parked, // life.js parkedCars: [x, z, heading] in the ring road's bays
    hub: { c: hub.c, r: ISLAND + 1.2, w: hub.w / 2, out: RING_OUT } }; // life.js traffic: the roundabout
}

// A box laid along street s: `len` along it, `wide` across it, centred `v` along and `off` across the centre line.
function lay(ctx, s, len, h, wide, mat, v, off, y, seg = 0) {
  const [w, d] = s.axis === 'x' ? [len, wide] : [wide, len];
  const geo = Math.max(w, d) > 12 ? slab(w, h, d) : box(w, h, d, seg);
  return s.axis === 'x' ? part(ctx.root, geo, mat, v, y, s.c + off) : part(ctx.root, geo, mat, s.c + off, y, v);
}
const spot = (s, v, off) => (s.axis === 'x' ? [v, s.c + off] : [s.c + off, v]);
const lift = ([x, z], y) => [x, y, z];

// Stretches of a boundary street between the main streets crossing it, as [from, to] along it (the perimeter).
const stretches = ({ lines }, pad = () => 0) =>
  lines.slice(1).map((l, k) => [lines[k].c + lines[k].w / 2 + pad(lines[k]), l.c - l.w / 2 - pad(l)]);
// Whether v along street s is inside the tower's roundabout (the boulevards meet there), padded by pad.
const inRing = (ctx, s, v, pad = 0) => Math.abs(s.c - ctx.hub) < 1 && Math.abs(v - ctx.hub) < RING_OUT + pad;

// The crossings along street s: every corridor across it that is a street on at least one side of s (an alley
// only meets it; a corridor stopped at the headquarters' campus on both sides is not there). Each: the corridor l
// and what it is either side of s ([-1 side, +1 side]). Segments: the stretches of s between them, each with its
// kind there (s itself may be a market lane in the old town, or paved over at the campus): { a, b, l0, l1, kind },
// a and b at the crossing corridors' centres. Both are worked out once per street and kept on it.
function crossingsOf(ctx, s) {
  if (s.xs) return s.xs;
  const across = s.axis === 'x' ? 'z' : 'x', reach = s.w / 2 + 1;
  return (s.xs = ctx.cross.flatMap((l) => {
    if (l.kind[across] === 'alley') return [];
    const sides = [-1, 1].map((d) => ctx.layout.kindAt(l, across, s.c + d * reach));
    return sides.some((k) => k && k !== 'none') ? [{ l, sides }] : [];
  }));
}
function segments(ctx, s) {
  if (s.segs) return s.segs;
  const xs = crossingsOf(ctx, s);
  return (s.segs = xs.slice(1).map((x, k) => {
    const a = xs[k].l.c, b = x.l.c;
    return { a, b, l0: xs[k].l, l1: x.l, kind: ctx.layout.kindAt(s.line, s.axis, (a + b) / 2) };
  }).filter((g) => g.kind));
}
const carries = (kind) => CARS.has(kind);

// Where things sit along a street, measured from the centre line of the street l it crosses: l's kerb, the zebra
// (in line with l's sidewalk, so walkers keep straight on across), the stop line just behind it, and where the
// lane paint ends. people.js and life.js use the same numbers. A crossing is only as big as the two carriageways.
export const ZEBRA_W = 3;
export const kerbOf = (l) => l.w / 2 - l.side;
export const zebraAt = (l) => kerbOf(l) + l.side / 2 + 0.5;
export const stopAt = (l) => zebraAt(l) + ZEBRA_W / 2 + 1.2; // the stop line's centre (0.45 m wide)
// Whether street s (corridor `line`, running along `axis`) has a zebra across it on side `side` (-1 or +1 along
// it) of corridor l, which crosses it (ADR-0010). Where two main lines meet (the boulevard is one), all four arms
// or all but one (walkers cross there, people.js network). Across a mid street beside a main street, about three in
// five; across a main street beside a mid street, or where two mid streets meet, rarely.
export function hasZebra(layout, axis, line, l, side) {
  const [jx, jz] = axis === 'x' ? [l.j, line.j] : [line.j, l.j], arm = (axis === 'x' ? 0 : 2) + (side > 0 ? 1 : 0);
  const draw = layout.chance(jx, jz, arm + 2);
  if (!line.mid && !l.mid) return layout.chance(jx, jz, 0) > 0.55 || Math.floor(layout.chance(jx, jz, 1) * 4) !== arm;
  if (line.mid && !l.mid) return draw < 0.6;
  return draw < (l.mid ? 0.1 : 0.12);
}
const SOLID = 15; // lane dividers turn solid this far before a stop line
const round = (ctx, s, l) => Math.abs(s.c - ctx.hub) < 1 && Math.abs(l.c - ctx.hub) < 1; // the tower's roundabout
const ends = (ctx, s, l) => (round(ctx, s, l) ? RING_OUT + 0.8 : stopAt(l) + 0.4); // where lane paint stops, from l's centre

// Roadway markings on one segment g of street s, the same on every block so a street reads the same block after
// block: solid edge lines where the traffic lanes end (the ring road keeps bays between them and the kerb), lane
// dividers dashed along the block and solid on the approach, a double centre line (main streets), a dashed one
// (local) or the boulevard's median. Nothing is painted inside a crossing.
function road(ctx, s, g) {
  const { paint } = ctx, { lanes, edge, median } = STREETS[s.kind], R = kerbOf(s), inner = median / 2;
  const dividers = lanes.length === 1 || s.kind === 'oneway' ? [0] : lanes.slice(1).flatMap((l, k) => [-(l + lanes[k]) / 2, (l + lanes[k]) / 2]);
  const a = g.a + ends(ctx, s, g.l0), b = g.b - ends(ctx, s, g.l1);
  if (b <= a) return;
  const len = b - a, mid = (a + b) / 2, near = Math.min(SOLID, len / 2);
  for (const side of [-1, 1]) {
    lay(ctx, s, len, 0.02, 0.15, paint, mid, side * (edge === R ? R - 0.45 : edge), 0.01); // edge lines
    if (inner) lay(ctx, s, len, 0.02, 0.15, paint, mid, side * (inner + 0.35), 0.01);
  }
  for (const off of dividers) {
    for (const v of [a + near / 2, b - near / 2]) lay(ctx, s, near, 0.02, 0.15, paint, v, off, 0.01);
    for (let v = a + near + 3.5; v + 3 < b - near - 3; v += 10) lay(ctx, s, 3, 0.02, 0.15, paint, v + 1.5, off, 0.01);
  }
  if (s.kind === 'street') for (const off of [-0.3, 0.3]) lay(ctx, s, len, 0.02, 0.12, paint, mid, off, 0.01);
  if (inner) medianStrip(ctx, s, inner, g.l0, g.l1);
  block(ctx, s, a, b, g.l0, g.l1);
}

// At each crossing along street s: a stop line across the incoming lanes of every segment cars drive on (traffic
// keeps right, so cars heading +v use the `right` half), and a zebra across s in line with each of the crossing
// street's sidewalks wherever s carries cars on that side.
function crossings(ctx, s, segs) {
  const { paint, lo, hi } = ctx, R = kerbOf(s), right = s.axis === 'x' ? 1 : -1;
  for (const g of segs) {
    if (!carries(g.kind)) continue;
    const { edge, median } = STREETS[g.kind], inner = median / 2;
    for (const [l, dir] of [[g.l1, 1], [g.l0, -1]]) { // dir: the way the cars approaching l on this segment drive
      const stop = l.c - dir * (round(ctx, s, l) ? RING_OUT + 0.3 : stopAt(l)), flow = s.line.flow?.[s.axis];
      if (g.kind === 'oneway') { if (dir === flow && stop > lo && stop < hi) lay(ctx, s, 0.45, 0.02, 2 * edge - 0.3, paint, stop, 0, 0.01); } // all its lanes come in
      else if (stop > lo && stop < hi) lay(ctx, s, 0.45, 0.02, edge - inner - 0.3, paint, stop, dir * right * (inner + 0.15 + (edge - inner - 0.3) / 2), 0.01);
      const at = l.c - dir * zebraAt(l);
      if (round(ctx, s, l) || inRing(ctx, s, at) || at < lo || at > hi) continue; // none on the outside of the city: no one walks there
      if (!hasZebra(ctx.layout, s.axis, s.line, l, -dir)) continue;
      for (let off = -R + 0.6; off < R; off += 1.2) {
        if (Math.abs(off) < inner + 0.2) continue; // the median is a refuge, not paint
        lay(ctx, s, ZEBRA_W, 0.02, 0.6, paint, at, off, 0.01);
      }
    }
  }
}

// Along each block of a street (between the lane paint's ends a and b at crossings l0 and l1), the parts that
// depend on its kind. Approaches: a darker, oilier band down the middle of each lane where cars wait at the light
// (wear), and on main streets and the boulevard an arrow in each lane. The ring road: bays between the traffic lanes
// and the kerb, in runs of three 6 m bays marked off with short lines, then a kerb build-out with a tree; about half
// the bays hold a parked car facing the traffic. The boulevard: small cold-white studs set into the road along each
// zebra's edges, lit, so its crossings read from far off.
const BAY = 6;
function block(ctx, s, a, b, l0, l1) {
  const { kit, paint, rand, root } = ctx, { lanes, edge, median } = STREETS[s.kind], R = kerbOf(s), right = s.axis === 'x' ? 1 : -1;
  const wear = kit.mat('aerial_asphalt_01', palette.charcoal, 0.4), big = WIDE.has(s.kind) || s.kind === 'street' || s.kind === 'oneway';
  for (const [end, dir, l] of [[b, 1, l1], [a, -1, l0]]) { // dir: the way the cars approaching this end drive
    if (end < ctx.lo + 1 || end > ctx.hi - 1 || (s.kind === 'oneway' && dir !== s.line.flow[s.axis])) continue; // one way: arrows show which
    lanes.forEach((off, k) => {
      const o = dir * right * off, len = Math.min(14, b - a);
      lay(ctx, s, len, 0.01, 1.3, wear, end - dir * len / 2, o, 0.005);
      if (!big || round(ctx, s, l) || b - a <= 16) return;
      const can = exits(ctx, s, l, dir, k), moves = lanesMay(s.kind, k, lanes.length).filter((m) => can[m]);
      if (!moves.length && can.merge) moves.push('straight'); // nothing else open: it merges straight on (life.js)
      if (moves.length) arrow(ctx, s, end - dir * 7, o, dir, moves);
    });
  }
  if (s.kind === 'ring') {
    const curb = kit.concrete(palette.roseGrey), paving = kit.concrete(palette.slate), mid = (edge + R) / 2;
    for (const side of [-1, 1]) {
      let v = a + 4;
      while (v + 3 * BAY + 5 < b - 4) {
        for (let k = 0; k <= 3; k++) lay(ctx, s, 0.12, 0.02, R - edge, paint, v + k * BAY, side * mid, 0.01);
        for (let k = 0; k < 3; k++) {
          if (rand() < 0.5) continue;
          const dir = side * right, [x, z] = spot(s, v + (k + 0.5) * BAY, side * mid); // facing its side's traffic
          ctx.parked.push([x, z, s.axis === 'x' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : dir > 0 ? 0 : Math.PI]);
        }
        const bo = v + 3 * BAY + 2.5; // the build-out: paving out to the bays' edge, kerbed, with a tree
        lay(ctx, s, 5, 0.18, R - edge, paving, bo, side * mid, 0.09);
        lay(ctx, s, 5, 0.22, 0.35, curb, bo, side * (edge + 0.175), 0.11);
        tree(kit, root, ...spot(s, bo, side * mid), 5.5);
        v += 3 * BAY + 5;
      }
    }
  }
  if (s.kind === 'boulevard') {
    const stud = kit.glow(palette.coldWhite, 1.6);
    for (const [l, dir] of [[l0, 1], [l1, -1]]) {
      if (round(ctx, s, l) || !hasZebra(ctx.layout, s.axis, s.line, l, dir)) continue;
      for (const e of [-1, 1]) {
        const v = l.c + dir * (zebraAt(l) + e * (ZEBRA_W / 2 + 0.2));
        for (let off = -R + 0.8; off < R; off += 1.6) if (Math.abs(off) > median / 2 + 0.3) lay(ctx, s, 0.18, 0.03, 0.18, stud, v, off, 0.015);
      }
    }
  }
}

// Which ways lane k (0 innermost) of n on a street of `kind` may go at a crossing (life.js turns follow the same
// rule): on the boulevard and its avenue the inner lane turns left only, the outer goes straight or right, any
// between straight on; on other streets the inner lane goes straight or left, the outer straight or right; one-lane
// streets anywhere.
export const lanesMay = (kind, k, n) => {
  if (n === 1) return ['straight', 'left', 'right'];
  if (WIDE.has(kind)) return k === 0 ? ['left'] : k === n - 1 ? ['straight', 'right'] : ['straight'];
  return k === 0 ? ['straight', 'left'] : ['straight', 'right'];
};
// Whether the highway out of town past this end of street s is reached by the expressway, not from the street
// (interchange.js): the boulevard along x, heading +x.
const viaExpressway = (layout, s, dir) => layout.expressway && WIDE.has(s.kind) && s.axis === 'x' && dir > 0;
// Which ways a car in lane k heading dir along street s can really leave its crossing with corridor l, so arrows
// never point at a street that is not there: straight on if s goes on beyond l with a lane k (or out of town, for a
// main street at the ring road; merge: it goes on with fewer lanes), left or right if l carries cars that way.
function exits(ctx, s, l, dir, k) {
  const { layout } = ctx, across = s.axis === 'x' ? 'z' : 'x', r = dir * (s.axis === 'x' ? 1 : -1);
  const beyond = layout.kindAt(s.line, s.axis, l.c + dir * (l.w / 2 + 1));
  const side = (d) => {
    const kind = layout.kindAt(l, across, s.c + d * (s.w / 2 + 1));
    return carries(kind) && (kind !== 'oneway' || l.flow[across] === d);
  };
  const edge = !s.line.mid && (l === ctx.cross[0] || l === ctx.cross.at(-1)) && !viaExpressway(ctx.layout, s, dir);
  return { straight: edge || (carries(beyond) && STREETS[beyond].lanes.length > k), merge: carries(beyond), right: side(r), left: side(-r) };
}

// An arrow painted in a lane at v along street s, offset off, pointing dir (+1 or -1 along s): a head straight
// ahead and a bent arm for each turn, one for each of its moves.
function arrow(ctx, s, v, off, dir, moves) {
  const right = s.axis === 'x' ? 1 : -1, side = dir * right; // across, toward the right-hand kerb of these cars
  const stroke = (p, q) => { // a painted stroke from p to q, each [along, across]
    const [x0, z0] = spot(s, ...p), [x1, z1] = spot(s, ...q);
    part(ctx.root, box(0.18, 0.02, Math.hypot(x1 - x0, z1 - z0), 0), ctx.paint, (x0 + x1) / 2, 0.01, (z0 + z1) / 2).rotation.y = Math.atan2(x1 - x0, z1 - z0);
  };
  const head = (tip, along, across, L = 1.1) => { // two strokes meeting at `tip`, pointing (along, across), a unit vector
    for (const t of [-1, 1]) {
      const ca = Math.cos(0.6), sa = Math.sin(0.6), [ux, uy] = [along * ca - t * across * sa, across * ca + t * along * sa];
      stroke([tip[0] - L * ux, tip[1] - L * uy], tip);
    }
  };
  const straight = moves.includes('straight'), top = straight ? 0.9 : -0.9; // a turn-only arrow's shaft stops where its arm leaves
  stroke([v - dir * 2.1, off], [v + dir * top, off]);
  if (straight) head([v + dir * 1.5, off], dir, 0);
  for (const [t, w] of [['left', -1], ['right', 1]]) { // each turn: an arm branching low off the shaft, out and forward, its head clear of the straight one
    if (!moves.includes(t)) continue;
    const tip = [v + dir * 0.2, off + w * side * 1.05];
    stroke([v - dir * 0.9, off], tip);
    head(tip, dir * 0.45, w * side * 0.89, 0.7);
  }
}

// Kerbside on main streets and the boulevard: a shuttle stop on each side of most blocks, set at the kerb so the
// walkway behind it stays clear (walkers keep 1.9 m or more in from the kerb, people.js), sliding along to keep
// clear of lamps; the two sides' stops are staggered. A slim steel frame, a back panel of dark glass, a roof with a
// lit cold-cyan edge, a bench, and a small amber display with the line and the next shuttle.
function kerbside(ctx, s) {
  const { kit, root, lampsAt } = ctx, R = kerbOf(s), r = rng(Math.round(s.c * 3 + (s.axis === 'x' ? 11 : 17)) >>> 0);
  const steel = kit.steel(palette.charcoal, 0.6), glass = kit.veil(palette.smokedGlass, 0.55), edge = kit.glow(palette.neonCyan, 1.2);
  for (const g of segments(ctx, s)) {
    const a = g.a + stopAt(g.l0) + 4, b = g.b - stopAt(g.l1) - 4;
    if (!carries(g.kind) || b - a < 24 || r() < 0.4) continue;
    for (const side of [-1, 1]) {
      if (r() < 0.3) continue;
      let v = (a + b) / 2 + side * 6;
      while (lampsAt.some(([x, z]) => Math.hypot(x - spot(s, v, side * R)[0], z - spot(s, v, side * R)[1]) < 5)) v += 2;
      if (v > b || (ctx.layout.expressway && onRamp(ctx.layout, ...spot(s, v, side * R)))) continue;
      const grp = new THREE.Group(), [x, z] = spot(s, v, side * (R + 1)), line = pick(r, [3, 7, 9]); // few lines, few display textures
      grp.position.set(x, 0.18, z);
      grp.rotation.y = s.axis === 'z' ? (side > 0 ? -Math.PI / 2 : Math.PI / 2) : side > 0 ? Math.PI : 0; // open to the street (+z)
      root.add(grp);
      for (const px of [-1.6, 1.6]) part(grp, box(0.08, 2.5, 0.08, 0), steel, px, 1.25, -0.5);
      part(grp, box(3.4, 0.08, 1.5, 1), steel, 0, 2.55, 0.1);
      part(grp, box(3.4, 0.04, 0.04, 0), edge, 0, 2.5, 0.85);
      part(grp, box(3.2, 1.9, 0.04, 0), glass, 0, 1.25, -0.52);
      part(grp, box(2.2, 0.06, 0.4, 1), steel, 0, 0.45, -0.25);
      part(grp, new THREE.PlaneGeometry(0.9, 0.34), kit.display([`LINE ${line}`, `${pick(r, [2, 5])} MIN`], 240, 90), 1.1, 2.15, 0.15);
    }
  }
}

// The boulevard's median between crossings l0 and l1: a kerbed, planted strip running up to each zebra with a
// rounded nose, the zebra crossing it at grade between two pairs of bollards (a refuge for people waiting halfway),
// and a few slim dark-leaved trees: the median should read as landscaping, not a forest. Short of each stop line
// it narrows to a nose half a metre wide, leaving the inner lane as a left-turn lane (lanesMay).
function medianStrip(ctx, s, inner, l0, l1) {
  const { kit, root } = ctx, curb = kit.concrete(palette.roseGrey), bed = kit.concrete(palette.oliveGrey), steel = kit.steel(palette.charcoal, 0.6);
  const end = (l) => (round(ctx, s, l) ? RING_OUT + 2 : zebraAt(l) + ZEBRA_W / 2 + 0.3);
  const a = l0.c + end(l0), b = l1.c - end(l1);
  if (b - a < 2 * inner) return;
  lay(ctx, s, b - a - 2 * inner, 0.25, 2 * inner, curb, (a + b) / 2, 0, 0.12);
  lay(ctx, s, b - a - 2 * inner, 0.04, 2 * inner - 0.7, bed, (a + b) / 2, 0, 0.26);
  for (const v of [a + inner, b - inner]) { // the rounded noses
    part(root, cyl(inner, inner, 0.25, 16), curb, ...lift(spot(s, v, 0), 0.12));
    part(root, cyl(inner - 0.35, inner - 0.35, 0.04, 16), bed, ...lift(spot(s, v, 0), 0.26));
  }
  for (let v = a + 10; v < b - 8; v += s.kind === 'avenue' ? 14 : 28) tree(kit, root, ...spot(s, v, 0), 6, palette.mistTeal); // the avenue's wide median: a closer row
  for (const [l, dir] of [[l0, 1], [l1, -1]]) { // the zebras at this stretch's two ends
    if (round(ctx, s, l) || !hasZebra(ctx.layout, s.axis, s.line, l, dir)) continue;
    for (const off of [-inner + 0.3, inner - 0.3]) for (const e of [-1, 1]) {
      const v = l.c + dir * (zebraAt(l) + e * (ZEBRA_W / 2 + 0.15));
      part(root, cyl(0.1, 0.1, 0.9, 8), steel, ...lift(spot(s, v, off), 0.45));
      part(root, cyl(0.105, 0.105, 0.08, 8), ctx.paint, ...lift(spot(s, v, off), 0.82)); // a reflective band
    }
  }
}

// Pedestrian street on segment g: the roadway paved over between crossings, with trees, planters and benches down
// the middle, and on most long stretches a food street (food below) in place of them for a while. On a main line
// (a walk) people sit and buy there (people.js); the old town's market lanes are scenery for now.
function walk(ctx, s, g) {
  const { kit, rand } = ctx, roadway = 2 * kerbOf(s), own = !s.line.mid;
  const paving = kit.concrete(palette.roseGrey), planter = kit.concrete(palette.gunmetal), bench = kit.steel(palette.charcoal, 0.8);
  const a = g.a + g.l0.w / 2, b = g.b - g.l1.w / 2;
  lay(ctx, s, b - a, 0.18, roadway, paving, (a + b) / 2, 0, 0.09);
  const [f0, f1] = food(ctx, s, a, b, own);
  for (let v = a + 6; v < b - 4; v += 12) {
    // Every choice is drawn even where the food street is, so the rest of the planting stays as it was.
    const side = rand() < 0.5 ? -1 : 1, isTree = rand() < 0.6, h = isTree ? 5 + rand() * 2 : 0, seat = rand() < 0.5;
    if (v + 4 > f0 && v - 2 < f1) continue;
    if (isTree) tree(kit, ctx.root, ...spot(s, v, side * 2), h);
    else lay(ctx, s, 2.4, 0.6, 1.2, planter, v, side * 2, 0.48, 1);
    if (seat) {
      lay(ctx, s, 1.8, 0.45, 0.5, bench, v + 3, -side * 2.2, 0.4, 1);
      if (own) ctx.benches.push([...spot(s, v + 3, -side * 2.2), s.axis, -side]); // people.js seats people here, facing away from the trees
    }
  }
}

// A food street on a walk's stretch from a to b, on about three in four of the long ones: two or three stalls down
// one side, facing the middle, each a different kind (stall below), and a cafe terrace down the other: small
// round tables, each under its own hexagonal parasol with a lit rim, and a neon totem with the cafe's name. Warm
// light pools on the paving under every stall and table. Returns the part of the stretch it takes, [from, to]
// ([Infinity, -Infinity] if none). ctx.food gets every stall and stool (people.js puts vendors, customers and
// diners there).
function food(ctx, s, a, b, own = true) {
  const r = rng(Math.round(s.c * 7 + a * 13 + 5) >>> 0);
  if (b - a < 46 || r() < 0.25) return [Infinity, -Infinity];
  const len = 34, from = a + 6 + r() * (b - a - len - 12), side = r() < 0.5 ? -1 : 1;
  const { kit, root } = ctx, m = {
    steel: kit.steel(palette.gunmetal, 0.6), dark: kit.steel(palette.charcoal, 0.7), cream: kit.steel(palette.cream, 0.5),
    bulbs: kit.glow(palette.warmWindow, 2.2), lantern: kit.glow(palette.neonRed, 1.1) };
  const face = (toward) => (s.axis === 'z' ? (toward > 0 ? Math.PI / 2 : -Math.PI / 2) : toward > 0 ? 0 : Math.PI);
  const group = (v, off, toward) => { // a frame on the paving whose +z faces across the street, toward side `toward`
    const g = new THREE.Group(), [x, z] = spot(s, v, off);
    g.position.set(x, 0.18, z);
    g.rotation.y = face(toward);
    root.add(g);
    g.updateMatrixWorld(true);
    return g;
  };
  const kinds = ['noodle', 'cart', 'grill', 'drinks'].sort(() => r() - 0.5), stalls = 2 + (r() < 0.5 ? 1 : 0);
  for (let k = 0; k < stalls; k++) {
    const v = from + 4 + (k * (len - 8)) / (stalls - 1), g = group(v, side * 2.8, -side), color = pick(r, WARM);
    const vent = stall(kit, g, kinds[k], color, r, m);
    pool(g, 2.4, color, 0, 0.6);
    const [x, z] = spot(s, v, side * 2.8);
    if (own) ctx.food.push({ kind: 'stall', x, z, heading: face(-side), along: s.axis, line: s.c,
      steam: vent && new THREE.Vector3(...vent).applyMatrix4(g.matrixWorld).toArray() });
  }
  // The terrace.
  const tint = pick(r, [palette.neonCyan, palette.sodium, palette.neonPink]), rim = kit.glow(tint, 1.4);
  const totem = group(from + (r() < 0.5 ? 1 : len - 1), -side * 2.4, side);
  part(totem, box(0.3, 2.8, 0.7, 1), m.dark, 0, 1.4, 0);
  part(totem, new THREE.PlaneGeometry(0.55, 2.3), kit.sign(pick(r, CAFES), tint, true), 0, 1.5, 0.16);
  part(totem, box(0.32, 0.05, 0.72), rim, 0, 2.82, 0);
  const tables = 3 + (r() < 0.5 ? 1 : 0);
  for (let k = 0; k < tables; k++) {
    const v = from + 5 + (k * (len - 10)) / (tables - 1), g = group(v, -side * 2.4, side);
    part(g, cyl(0.42, 0.42, 0.04, 16), m.dark, 0, 0.76, 0);
    part(g, cyl(0.05, 0.05, 0.74, 6), m.steel, 0, 0.38, 0);
    part(g, cyl(0.24, 0.26, 0.03, 12), m.steel, 0, 0.015, 0);
    part(g, cyl(0.05, 0.05, 0.09, 8), rim, 0, 0.83, 0); // a small lamp on each table
    part(g, cyl(0.03, 0.03, 1.55, 6), m.steel, 0, 1.6, 0); // the parasol: pole, hexagonal top, lit rim, bulbs
    part(g, cyl(0.12, 1.25, 0.28, 6), m.dark, 0, 2.48, 0);
    ring(g, 1.22, 0.025, rim, 0, 2.34, 0, 6, 4).rotation.z = Math.PI / 6; // its corners under the parasol's
    for (let c = 0; c < 6; c++) part(g, box(0.06, 0.06, 0.06, 0), m.bulbs, Math.cos(c * Math.PI / 3) * 1.1, 2.26, Math.sin(c * Math.PI / 3) * 1.1);
    pool(g, 1.8, palette.sodium, 0, 0);
    const seats = 2 + Math.floor(r() * 3), turn = r() * Math.PI, [tx, tz] = spot(s, v, -side * 2.4);
    for (let n = 0; n < seats; n++) {
      const ang = turn + (n * Math.PI * 2) / seats, sx = Math.sin(ang) * 0.75, sz = Math.cos(ang) * 0.75;
      part(g, cyl(0.17, 0.17, 0.05, 12), m.dark, sx, 0.42, sz);
      part(g, cyl(0.03, 0.04, 0.4, 6), m.steel, sx, 0.2, sz);
      part(g, cyl(0.07, 0.05, 0.05, 10), m.cream, sx * 0.55, 0.8, sz * 0.55); // a bowl in front of each seat
      const w = new THREE.Vector3(sx, 0, sz).applyMatrix4(g.matrixWorld);
      if (own) ctx.food.push({ kind: 'stool', x: w.x, z: w.z, heading: Math.atan2(tx - w.x, tz - w.z), table: [tx, tz], along: s.axis, line: s.c });
    }
  }
  return [from, from + len];
}

// A warm pool of light on the paving, radius rad, in frame g (one additive material a colour, shared).
const pools = new Map();
function pool(g, rad, color, x, z) {
  if (!pools.has(color)) pools.set(color, new THREE.MeshBasicMaterial({ map: radialTexture(128), color, transparent: true,
    opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }));
  part(g, new THREE.CircleGeometry(rad, 20), pools.get(color), x, 0.03, z).rotation.x = -Math.PI / 2;
}

// One food stall of `kind` in frame g (+z toward its customers; they stand 1.35 m out and sit on two stools 0.95 m
// out, the vendor 0.6 m behind the front): a noodle counter with its kitchen unit and canopy, a noodle cart on
// wheels under a small roof, a skewer grill of glowing coals under a smoke hood with a flue, or a drinks kiosk with
// a lit fridge and a neon ring. Every kind has a lit name, a menu screen (a live amber display), a blade sign on a
// pole beside it, warm bulbs and two stools. Returns where its steam rises from, in g (null: none).
function stall(kit, g, kind, color, r, m) {
  const light = kit.glow(color, 1.6), name = pick(r, FOOD[kind]), menu = pick(r, {
    noodle: [['NOODLES', '6 CR'], ['DUMPLINGS', '9 CR'], ['HOT SOUP', '5 CR']], cart: [['BUNS', '3 CR'], ['ODEN', '5 CR']],
    grill: [['SKEWERS', '4 CR'], ['VAT MEAT', '7 CR']], drinks: [['ICE TEA', '2 CR'], ['SODA', '2 CR'], ['KOFI', '3 CR']] }[kind]);
  const bulbs = (y, z, w) => {
    part(g, box(w, 0.012, 0.012), m.dark, 0, y + 0.03, z);
    for (let i = 0; i < 8; i++) part(g, box(0.07, 0.07, 0.07, 0), m.bulbs, -w / 2 + (i + 0.5) * (w / 8), y - 0.07 * Math.sin(((i + 0.5) / 8) * Math.PI), z);
  };
  const front = (w, h, d, y = 0) => { // a counter: body, top and a lit edge
    part(g, box(w, h, d, 1), m.steel, 0, y + h / 2, 0);
    part(g, box(w + 0.15, 0.05, d + 0.15), m.dark, 0, y + h + 0.02, 0.05);
    part(g, box(w, 0.05, 0.02), light, 0, y + h - 0.15, d / 2 + 0.01);
  };
  let vent = null;
  if (kind === 'noodle') {
    front(2.4, 0.95, 0.8);
    part(g, box(2.4, 2.3, 0.45, 1), m.dark, 0, 1.15, -0.95); // the vendor stands between
    part(g, new THREE.PlaneGeometry(1.4, 0.5), kit.display(menu, 280, 100), 0, 1.75, -0.72);
    for (const x of [-1.2, 1.2]) part(g, box(0.06, 1.6, 0.06), m.dark, x, 1.8, 0.45);
    part(g, box(2.9, 0.08, 2.1, 1), m.dark, 0, 2.62, -0.2);
    part(g, box(2.9, 0.06, 0.04), light, 0, 2.58, 0.85);
    part(g, new THREE.PlaneGeometry(2.1, 0.5), kit.sign(name, color), 0, 2.95, 0.86);
    for (const x of [-1.05, 1.05]) part(g, cyl(0.12, 0.12, 0.3, 10), m.lantern, x, 2.28, 0.7);
    bulbs(2.47, 0.88, 2.7);
    part(g, cyl(0.2, 0.18, 0.28, 14), m.steel, -0.6, 1.13, -0.15);
    vent = [-0.6, 1.3, -0.15];
  } else if (kind === 'cart') {
    front(1.9, 0.7, 0.85, 0.32);
    for (const x of [-0.7, 0.7]) for (const z of [-0.38, 0.38]) part(g, cyl(0.22, 0.22, 0.08, 14), m.dark, x, 0.22, z).rotation.x = Math.PI / 2;
    part(g, box(0.05, 0.05, 0.9), m.steel, 1.15, 0.9, 0); // the push bar
    for (const x of [-0.9, 0.9]) part(g, box(0.05, 1.3, 0.05), m.dark, x, 1.7, -0.35);
    const roof = part(g, box(2.3, 0.06, 1.5, 1), m.dark, 0, 2.38, 0);
    roof.rotation.x = -0.12; // a slight pitch toward the customers
    part(g, box(2.3, 0.05, 0.04), light, 0, 2.27, 0.73);
    part(g, new THREE.PlaneGeometry(1.7, 0.42), kit.sign(name, color), 0, 2.65, 0.6);
    part(g, new THREE.PlaneGeometry(0.9, 0.34), kit.display(menu, 240, 90), 0, 0.7, 0.44);
    bulbs(2.2, 0.74, 2.1);
    part(g, cyl(0.17, 0.15, 0.24, 14), m.steel, -0.45, 1.18, 0);
    part(g, cyl(0.12, 0.12, 0.3, 10), m.lantern, 0.95, 2.0, 0.6);
    vent = [-0.45, 1.32, 0];
  } else if (kind === 'grill') {
    front(2.4, 0.95, 0.8);
    part(g, box(1.6, 0.06, 0.5), kit.glow(palette.neonOrange, 2.2), 0, 1.0, -0.05); // the coals
    for (let i = 0; i < 9; i++) part(g, box(0.02, 0.02, 0.52), m.dark, -0.72 + i * 0.18, 1.05, -0.05);
    for (let i = 0; i < 6; i++) part(g, box(0.5, 0.015, 0.015), m.cream, -0.5 + i * 0.2, 1.08, -0.05).rotation.y = Math.PI / 2;
    part(g, box(2.4, 1.6, 0.45, 1), m.dark, 0, 0.8, -0.95);
    part(g, box(2.1, 0.55, 1.0, 1), m.steel, 0, 2.25, -0.15); // the hood
    part(g, cyl(0.12, 0.12, 1.4, 10), m.dark, 0.6, 3.2, -0.3); // its flue
    part(g, box(2.1, 0.05, 0.04), light, 0, 1.97, 0.36);
    for (const x of [-1.0, 1.0]) part(g, box(0.06, 1.0, 0.06), m.dark, x, 1.5, 0.3);
    part(g, new THREE.PlaneGeometry(1.8, 0.42), kit.sign(name, color), 0, 2.27, 0.36);
    part(g, new THREE.PlaneGeometry(1.2, 0.4), kit.display(menu, 260, 90), 0, 1.25, -0.72);
    bulbs(1.92, 0.42, 2.0);
    vent = [0, 1.4, -0.05];
  } else {
    front(2.4, 1.05, 0.7);
    part(g, box(2.2, 2.1, 0.5, 1), m.dark, 0, 1.05, -0.95);
    part(g, new THREE.PlaneGeometry(1.8, 1.4), kit.glow(palette.coldCyan, 0.9), 0, 1.25, -0.69); // the fridge's glass
    for (let i = 0; i < 4; i++) part(g, box(1.8, 0.03, 0.06), m.dark, 0, 0.7 + i * 0.37, -0.68);
    for (let i = 0; i < 5; i++) part(g, cyl(0.04, 0.035, 0.18, 8), kit.glow(pick(r, [palette.neonCyan, palette.neonPink, palette.sodium]), 1.2), -0.7 + i * 0.35, 0.95 + (i % 2) * 0.37, -0.75);
    part(g, box(2.7, 0.1, 1.9, 1), m.dark, 0, 2.5, -0.2);
    part(g, box(2.7, 0.05, 0.04), light, 0, 2.46, 0.75);
    ring(g, 0.42, 0.04, kit.glow(palette.neonCyan, 2), 0, 3.0, 0.3).rotation.x = 0; // standing, facing the street
    part(g, new THREE.PlaneGeometry(1.6, 0.4), kit.sign(name, color), -0.1, 2.8, 0.76);
    part(g, new THREE.PlaneGeometry(1.0, 0.36), kit.display(menu, 240, 90), 0, 0.75, 0.37);
    for (const x of [-0.6, -0.3, 0.5]) part(g, cyl(0.04, 0.035, 0.12, 8), m.cream, x, 1.13, 0.1);
    bulbs(2.35, 0.78, 2.5);
  }
  // The blade sign on its pole beside the stall, lit both ways along the street.
  part(g, box(0.06, 3.4, 0.06), m.dark, 1.5, 1.7, 0.55);
  for (const t of [-1, 1]) part(g, new THREE.PlaneGeometry(0.42, 1.5), kit.sign(name, color, true), 1.5 + t * 0.03, 2.55, 0.8).rotation.y = (t * Math.PI) / 2;
  part(g, new THREE.PlaneGeometry(1.5, 0.38), kit.holo(pick(r, ['OPEN 24H', 'HOT', 'FRESH VAT', 'SPICY', 'TAKE AWAY']), pick(r, [palette.neonCyan, palette.neonPink])), 0, 3.6, 0.2);
  for (const x of [-0.55, 0.55]) {
    part(g, cyl(0.17, 0.17, 0.05, 12), m.dark, x, 0.42, 0.95);
    part(g, cyl(0.03, 0.04, 0.4, 6), m.steel, x, 0.2, 0.95);
  }
  return vent;
}

// Where the boulevards meet: the tower's plaza. A big roundabout circles the tower's island (life.js traffic, hub);
// the corners of the four sectors round it, HUB tiles each way (park terrain in the sim, sim/rules.py HUB_PLAZA),
// are paved squares outside the ring road, kerbed along it, with trees. The tower and its hub stand on the island.
const ISLAND = 26;
const RING_OUT = ISLAND + 1.2 + STREETS.boulevard.lanes.at(-1) + 2.1; // the ring road's outer kerb
function plaza({ kit, root, paint }, hub) {
  const { c, w } = hub, lanes = STREETS.boulevard.lanes, R = RING_OUT, near = kerbOf(hub), far = w / 2 + HUB * TILE;
  for (let k = 1; k < lanes.length; k++) { // dashed rings between the circling lanes
    const r = ISLAND + 1.2 + (lanes[k - 1] + lanes[k]) / 2;
    for (let a = 0; a < Math.PI * 2; a += 3 / r) {
      part(root, box(0.15, 0.02, 1.5, 0), paint, c + Math.cos(a) * r, 0.01, c + Math.sin(a) * r).rotation.y = -a;
    }
  }
  const paving = kit.concrete(palette.slate), curb = kit.concrete(palette.roseGrey);
  part(root, cyl(ISLAND, ISLAND + 0.3, 0.4, 64), paving, c, 0.2, c);
  // One corner square outside the ring: x and z from `near` (the sectors' paving edge) to `far`, less the ring's disc.
  const knee = Math.sqrt(R * R - near * near), t0 = Math.atan2(knee, near), t1 = Math.atan2(near, knee);
  const arc = Array.from({ length: 13 }, (_, k) => t0 + ((t1 - t0) * k) / 12).map((t) => [Math.cos(t) * R, Math.sin(t) * R]);
  const corner = [[far, far], [near, far], ...arc, [far, near]];
  for (const [sx, sz] of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) {
    // Shape y is -z: rotateX(-90 deg) lays the shape flat and turns the extrusion upwards.
    const shape = new THREE.Shape(corner.map(([x, z]) => new THREE.Vector2(sx * x, -sz * z)));
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.18, bevelEnabled: false });
    geo.rotateX(-Math.PI / 2);
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / REPEAT, uv.getY(i) / REPEAT); // metres, as everywhere
    part(root, geo, paving, c, 0, c);
    for (let k = 0; k < arc.length - 1; k++) { // kerb along the ring
      const [[x0, z0], [x1, z1]] = [arc[k], arc[k + 1]].map(([x, z]) => [sx * x, sz * z]);
      const kerb = part(root, box(Math.hypot(x1 - x0, z1 - z0) + 0.1, 0.22, 0.35, 0), curb, c + (x0 + x1) / 2, 0.11, c + (z0 + z1) / 2);
      kerb.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
    }
    for (const [x, z] of [[far - 6, far - 6], [far - 6, far - 16], [far - 16, far - 6]]) tree(kit, root, c + sx * x, c + sz * z, 7);
  }
  telecomTower(kit, root, c, 0.4, c);
}

// Blocks: between every two corridors each way, a raised slab of paving out to the kerbs (the sidewalks are its
// edges), kerbed all round. Each corner is rounded by the smaller radius of the two streets that meet there
// (STREETS r: wide enough for a car turning out of the outer lane), or kept nearly square beside a service alley.
// The four blocks at the central crossing give up a corner to the tower's plaza (plaza() paves it). The outline
// is cut into short edges so the old town's warp bends it with the streets.
function blocks(ctx, hub) {
  const { kit, root, cross } = ctx, paving = kit.concrete(palette.slate), curb = kit.concrete(palette.roseGrey);
  const reach = hub.w / 2 + HUB * TILE;
  const radius = (x, z) => Math.min(STREETS[x.kind.z].r, STREETS[z.kind.x].r); // x runs along z, z along x
  for (let j = 0; j + 1 < cross.length; j++) for (let k = 0; k + 1 < cross.length; k++) {
    const [X0, X1, Z0, Z1] = [cross[j], cross[j + 1], cross[k], cross[k + 1]];
    const [x0, x1, z0, z1] = [X0.c + kerbOf(X0), X1.c - kerbOf(X1), Z0.c + kerbOf(Z0), Z1.c - kerbOf(Z1)];
    // Corners counter-clockwise seen from above (x right, z down the page), each with its radius.
    let pts = [[x0, z0, radius(X0, Z0)], [x1, z0, radius(X1, Z0)], [x1, z1, radius(X1, Z1)], [x0, z1, radius(X0, Z1)]];
    const sx = Math.sign((x0 + x1) / 2 - hub.c), sz = Math.sign((z0 + z1) / 2 - hub.c);
    if ([X0, X1].includes(hub) && [Z0, Z1].includes(hub)) { // a plaza block: its corner at the crossing is the plaza's
      const [kx, kz] = [hub.c + sx * reach, hub.c + sz * reach], at = pts.findIndex(([x, z]) => Math.abs(x - hub.c) < hub.w && Math.abs(z - hub.c) < hub.w);
      const [cx, cz] = pts[at], before = pts[(at + 3) % 4];
      // Walk round the notch: along the edge from the previous corner to the plaza, in to its far corner, out again.
      const viaX = before[0] === cx; // the previous corner shares this corner's x: that edge runs along z
      const notch = viaX ? [[cx, kz, 0], [kx, kz, 0], [kx, cz, 0]] : [[kx, cz, 0], [kx, kz, 0], [cx, kz, 0]];
      pts = [...pts.slice(0, at), ...notch, ...pts.slice(at + 1)];
    }
    slabOutline(kit, root, outline(pts), paving, curb);
  }
}

// The outline of a polygon (corners [x, z, r]) with each corner rounded to its radius, as points every few metres.
function outline(corners) {
  const n = corners.length, out = [];
  for (let i = 0; i < n; i++) {
    const [px, pz, r] = corners[i], [ax, az] = corners[(i + n - 1) % n], [bx, bz] = corners[(i + 1) % n];
    const d1 = norm(px - ax, pz - az), d2 = norm(bx - px, bz - pz);
    const convex = d1[0] * d2[1] - d1[1] * d2[0] > 0;
    if (!r || !convex) {
      out.push([px, pz]);
      continue;
    }
    const cx = px - d1[0] * r + d2[0] * r, cz = pz - d1[1] * r + d2[1] * r; // the arc's centre
    for (let k = 0; k <= 4; k++) {
      const t = (k / 4) * (Math.PI / 2);
      out.push([cx + r * (-d2[0] * Math.cos(t) + d1[0] * Math.sin(t)), cz + r * (-d2[1] * Math.cos(t) + d1[1] * Math.sin(t))]);
    }
  }
  const fine = []; // long edges cut into pieces, so the warp can bend them
  out.forEach(([x, z], i) => {
    const [nx, nz] = out[(i + 1) % out.length], steps = Math.max(1, Math.ceil(Math.hypot(nx - x, nz - z) / 8));
    for (let k = 0; k < steps; k++) fine.push([x + ((nx - x) * k) / steps, z + ((nz - z) * k) / steps]);
  });
  return fine;
}
const norm = (x, z) => {
  const l = Math.hypot(x, z) || 1;
  return [x / l, z / l];
};

// Paving inside an outline (0.18 m, textured in metres) and a kerb along it (0.35 m wide, standing 0.04 m proud).
function slabOutline(kit, root, pts, paving, curb) {
  const shape = (ring) => ring.map(([x, z]) => new THREE.Vector2(x, -z)); // shape y is -z: rotateX(-90 deg) lays it flat
  const geo = (s, depth) => {
    const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 1 });
    g.rotateX(-Math.PI / 2);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / REPEAT, uv.getY(i) / REPEAT); // metres, as everywhere
    return g;
  };
  part(root, geo(new THREE.Shape(shape(pts)), 0.18), paving, 0, 0, 0);
  for (let i = 0; i < pts.length; i++) {
    const [x0, z0] = pts[i], [x1, z1] = pts[(i + 1) % pts.length], len = Math.hypot(x1 - x0, z1 - z0);
    if (len < 0.01) continue;
    const [nx, nz] = norm(-(z1 - z0), x1 - x0); // inward for a counter-clockwise ring (x right, z down the page)
    const kerb = part(root, box(len + 0.04, 0.22, 0.35, 0), curb, (x0 + x1) / 2 + nx * 0.175, 0.11, (z0 + z1) / 2 + nz * 0.175);
    kerb.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
  }
}

// A service alley (the outer sectors' mid streets): the asphalt between two blocks, with dumpsters and the odd
// planter along its edges, between the streets that cross it.
function alley(ctx, s) {
  const { kit, root, rand } = ctx, steel = kit.steel(palette.gunmetal, 0.8), planter = kit.concrete(palette.gunmetal), shrub = kit.concrete(palette.teal);
  const xs = crossingsOf(ctx, s);
  xs.slice(1).forEach((x, k) => {
    const a = xs[k].l.c + xs[k].l.w / 2 + 3, b = x.l.c - x.l.w / 2 - 3;
    for (let n = 0; n < 3 && b > a; n++) {
      const v = a + rand() * (b - a), side = rand() < 0.5 ? -1 : 1, bin = rand() < 0.7;
      const item = bin ? lay(ctx, s, 1.9, 1.3, 1.2, steel, v, side * 2.2, 0.65, 0) : lay(ctx, s, 1.4, 0.6, 1.4, planter, v, side * 2.2, 0.3, 1);
      if (!bin) part(root, box(1.1, 0.25, 1.1, 1), shrub, item.position.x, 0.72, item.position.z);
    }
  });
}

// The city's outer edge: the ring road's outer sidewalk, raised and kerbed like the blocks', open only where a
// main street carries on out of town (as a dirt track or a highway). The outer lamps of the ring road stand on it.
function perimeter(ctx) {
  const { kit, lo, hi } = ctx, paving = kit.concrete(palette.slate), curb = kit.concrete(palette.roseGrey);
  for (const axis of ['x', 'z']) {
    const W = ctx.lines[0].side, runs = stretches(ctx, (l) => -l.side), last = runs.length - 1; // gaps the width of each crossing roadway
    runs[0][0] = lo + W; // out to the corners, where the kerbs meet
    runs[last][1] = hi - W;
    const corner = axis === 'x' ? W : 0; // the x runs also pave the corner squares
    for (const [c, side] of [[lo, 1], [hi, -1]]) {
      runs.forEach(([a, b], k) => {
        lay(ctx, { axis, c }, b - a, 0.22, 0.35, curb, (a + b) / 2, side * (W - 0.175), 0.11);
        const [a0, b0] = [k === 0 ? a - corner : a, k === last ? b + corner : b];
        lay(ctx, { axis, c }, b0 - a0, 0.18, W, paving, (a0 + b0) / 2, side * (W / 2), 0.09);
      });
    }
  }
}

// Sodium lamps along each segment, arms over the street, with a soft pool of light under each: about every 40 m on
// both kerbs of main streets and the boulevard, staggered from kerb to kerb on narrower ones.
let lampPools = null; // one material for every lamp's pool, so they all merge into one draw call
function lamps(ctx, s, segs) {
  const { kit, root } = ctx;
  const pools = (lampPools ??= new THREE.MeshBasicMaterial({ map: radialTexture(128), color: palette.sodium, transparent: true, opacity: 0.16,
    blending: THREE.AdditiveBlending, depthWrite: false }));
  const kerb = kerbOf(s) + 0.6, both = s.kind === 'street' || s.kind === 'boulevard';
  let flip = 1;
  for (const g of segs) {
    if (g.kind === 'none') continue;
    const a = g.a + g.l0.w / 2 + 4, b = g.b - g.l1.w / 2 - 4, count = Math.max(1, Math.round((b - a) / 40));
    for (let k = 0; k < count; k++) {
      const v = a + ((k + 0.5) * (b - a)) / count;
      if (inRing(ctx, s, v, 4)) continue;
      for (const side of both ? [-1, 1] : [(flip = -flip)]) {
        const [x, z] = spot(s, v, side * kerb);
        if (ctx.layout.expressway && onRamp(ctx.layout, x, z)) continue; // a ramp comes down here
        const facing = s.axis === 'z' ? (side > 0 ? Math.PI : 0) : side > 0 ? Math.PI / 2 : -Math.PI / 2;
        const p = streetLamp(kit, root, x, z, facing);
        ctx.lampsAt.push([x, z]); // so street props (city.js) keep clear
        part(root, new THREE.CircleGeometry(6, 20), pools, p.x, 0.25, p.z).rotation.x = -Math.PI / 2;
      }
    }
  }
}

// The road graph the cars drive (life.js traffic): a node at every crossing where a car lane starts or ends, and
// a link for every lane of every segment cars drive on, in each direction, from just past one crossing's far zebra
// to its stop line at the next. Driving on the right (seen from above, +x traffic keeps to +z and +z traffic to -x).
// Nodes: { key, x, z (unwarped), kinds: { x, z } of the car streets meeting there, walk (a walk crosses: lights for
// walkers), type }: 'round' (the tower's roundabout), 'signal' (a main street or the boulevard meets another
// street, or a walk crosses), 'yield' (local streets only: no lights, cars take turns), and in/out links. Links:
// { axis, c, at (offset line), off, k (0 innermost), n, kind, dir, from, to (along), start, end (nodes; null out of
// town), reach (the stop's distance from the end node's centre), zebra (its zebra's, null at the roundabout),
// mid, out ('sink' or 'source': leaves or enters town, desert.js outOfTown carries it to the edge of the world) }.
function roadNet(ctx, streets) {
  const nodes = new Map(), links = [], hubC = ctx.hub;
  const node = (x, z) => {
    const key = `${Math.round(x)}|${Math.round(z)}`;
    if (!nodes.has(key)) nodes.set(key, { key, x, z, kinds: {}, walk: false, ins: [], outs: [] });
    return nodes.get(key);
  };
  const reachOf = (s, l) => (round(ctx, s, l) ? RING_OUT + 0.55 : stopAt(l) + 0.05);
  for (const s of streets) {
    if (!carries(s.kind)) continue;
    const right = s.axis === 'x' ? 1 : -1, at = (v) => (s.axis === 'x' ? [v, s.c] : [s.c, v]);
    const add = (o) => {
      links.push(o);
      o.start?.outs.push(o);
      o.end?.ins.push(o);
    };
    const lane = (k, dir, extra, kind = s.kind) => {
      const { lanes } = STREETS[kind]; // per stretch: the boulevard's avenue stretches have fewer lanes
      return { axis: s.axis, c: s.c, w: s.w, side: s.side, kind, off: lanes[k], at: s.c + dir * right * lanes[k], k, n: lanes.length, dir,
        mid: s.line.mid, y: 0.65, ...extra };
    };
    for (const g of segments(ctx, s)) {
      if (!carries(g.kind)) continue;
      const A = node(...at(g.a)), B = node(...at(g.b));
      for (const N of [A, B]) N.kinds[s.axis] = N.kinds[s.axis] === 'boulevard' ? 'boulevard' : g.kind; // where it narrows, the boulevard's lights
      for (let k = 0; k < STREETS[g.kind].lanes.length; k++) for (const dir of g.kind === 'oneway' ? [s.line.flow[s.axis]] : [1, -1]) {
        const [n0, n1, l0, l1, a, b] = dir > 0 ? [A, B, g.l0, g.l1, g.a, g.b] : [B, A, g.l1, g.l0, g.b, g.a];
        add(lane(k, dir, { from: a + dir * reachOf(s, l0), to: b - dir * reachOf(s, l1), start: n0, end: n1, reach: reachOf(s, l1),
          zebra: round(ctx, s, l1) || !hasZebra(ctx.layout, s.axis, s.line, l1, -dir) ? null : zebraAt(l1) }, g.kind));
      }
    }
    // Main streets carry on out of town as tracks and highways: a lane out from the ring road's crossing and one in.
    if (!s.line.mid) for (const [ring, out] of [[ctx.cross[0], -1], [ctx.cross.at(-1), 1]]) {
      if (viaExpressway(ctx.layout, s, out)) continue; // interchange.js joins the expressway to it
      const R = node(...at(ring.c)), reach = reachOf(s, ring);
      R.kinds[s.axis] = s.kind;
      for (let k = 0; k < STREETS[s.kind].lanes.length; k++) {
        add(lane(k, out, { from: ring.c + out * reach, to: ring.c + out * (reach + 1), start: R, end: null, out: 'sink' }));
        add(lane(k, -out, { from: ring.c + out * (reach + 1), to: ring.c + out * reach, start: null, end: R, reach, zebra: null, out: 'source' }));
      }
    }
  }
  for (const s of streets) { // walks crossing a car street (pedestrian streets and market lanes): walkers get lights there
    if (s.kind === 'alley') continue;
    for (const g of segments(ctx, s)) {
      if (g.kind !== 'walk') continue;
      for (const v of [g.a, g.b]) {
        const N = nodes.get(`${Math.round(s.axis === 'x' ? v : s.c)}|${Math.round(s.axis === 'x' ? s.c : v)}`);
        if (N) N.walk = true;
      }
    }
  }
  for (const N of nodes.values()) {
    const big = [N.kinds.x, N.kinds.z].some((k) => k === 'street' || WIDE.has(k));
    N.type = Math.abs(N.x - hubC) < 1 && Math.abs(N.z - hubC) < 1 ? 'round' : big || N.walk ? 'signal' : 'yield';
  }
  return { nodes: [...nodes.values()], links };
}
