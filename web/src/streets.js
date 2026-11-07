// Street level: a hierarchy of main streets between sectors (a planted boulevard through the middle, full streets,
// narrow one-lane streets and pedestrian walks; see STREETS in world.js), raised sidewalks with curbs around every
// sector, a cross of service alleys and pedestrian lanes through each sector, sodium lamps along the curbs, and the
// traffic lanes cars drive in. Long flat parts are slabs cut into short pieces, so the city's warp bends them.
import * as THREE from 'three';
import { palette } from './palette.js';
import { box, cyl, part, REPEAT, ring, rng, slab } from './geometry.js';
import { telecomTower } from './landmarks.js';
import { streetLamp, tree } from './parts.js';
import { radialTexture } from './textures.js';
import { ALLEY, BLOCK, CAFES, FOOD, HALF, HUB, SIDEWALK, STREETS, TILE, WARM, pick } from './world.js';

const LAMP_EVERY = 55;
const MEDIAN = 6; // boulevard median width

export function buildStreets(kit, layout, root) {
  const { lines, lo, hi } = layout, rand = rng(31);
  const asphalt = kit.mat('aerial_asphalt_01', palette.gunmetal, 0.55); // wet, but not a mirror
  part(root, slab(hi - lo, 0.1, hi - lo, 8), asphalt, 0, -0.05, 0); // ends at the ring road's outer kerb line
  const hub = lines[lines.length >> 1];
  sectors(kit, root, layout, rand, hub);
  // Every main street, once per axis: centre c, width w, kind, and the axis it runs along.
  const streets = lines.flatMap((l) => ['x', 'z'].map((axis) => ({ c: l.c, w: l.w, kind: l.kind[axis], axis })));
  const ctx = { kit, root, lines, lo, hi, rand, hub: hub.c, paint: kit.glow(palette.cream, 0.35), lampsAt: [], benches: [], food: [] }; // road paint glows faintly
  perimeter(ctx);
  for (const s of streets) {
    if (s.kind === 'walk') walk(ctx, s);
    else road(ctx, s);
    lamps(ctx, s);
  }
  plaza(ctx, hub.c, hub.w);
  return { lanes: streets.flatMap((s) => trafficLanes(s, lo, hi, lines)), lines: lines.map((l) => l.c), lo, hi, lamps: ctx.lampsAt, benches: ctx.benches, food: ctx.food,
    hub: { c: hub.c, r: ISLAND + 1.2, w: hub.w / 2 } }; // life.js traffic: the roundabout
}

// A box laid along street s: `len` along it, `wide` across it, centred `v` along and `off` across the centre line.
function lay(ctx, s, len, h, wide, mat, v, off, y, seg = 0) {
  const [w, d] = s.axis === 'x' ? [len, wide] : [wide, len];
  const geo = Math.max(w, d) > 12 ? slab(w, h, d) : box(w, h, d, seg);
  return s.axis === 'x' ? part(ctx.root, geo, mat, v, y, s.c + off) : part(ctx.root, geo, mat, s.c + off, y, v);
}
const spot = (s, v, off) => (s.axis === 'x' ? [v, s.c + off] : [s.c + off, v]);

// Stretches of street s between the crossings, as [from, to] along it.
const stretches = ({ lines }, pad = 0) =>
  lines.slice(1).map((l, k) => [lines[k].c + lines[k].w / 2 + pad, l.c - l.w / 2 - pad]);
const inCrossing = ({ lines }, v, pad) => lines.some((l) => Math.abs(v - l.c) < l.w / 2 + pad);
// Whether v along street s is inside the tower's roundabout (the boulevards meet there), padded by pad.
const inRing = (ctx, s, v, pad = 0) => Math.abs(s.c - ctx.hub) < 1 && Math.abs(v - ctx.hub) < RING_OUT + pad;

// Roadway markings: dashed lane dividers, a double centre line (full streets), a planted median (boulevard) or a
// dashed centre line (narrow streets), and zebra crossings at every intersection.
function road(ctx, s) {
  const { kit, lo, hi, paint, lines } = ctx, { lanes } = STREETS[s.kind], roadway = s.w - 2 * SIDEWALK;
  const dividers = s.kind === 'lane' ? [0] : lanes.slice(1).flatMap((l, k) => [-(l + lanes[k]) / 2, (l + lanes[k]) / 2]);
  for (let v = lo; v < hi; v += 10) {
    if (inCrossing(ctx, v, 4) || inCrossing(ctx, v + 3, 4) || inRing(ctx, s, v, 3)) continue;
    for (const off of dividers) lay(ctx, s, 3, 0.02, 0.15, paint, v + 1.5, off, 0.01);
  }
  for (let [a, b] of stretches(ctx, 4)) {
    if (inRing(ctx, s, b)) b = ctx.hub - RING_OUT; // the median and centre lines stop at the roundabout
    if (inRing(ctx, s, a)) a = ctx.hub + RING_OUT;
    if (b <= a) continue;
    const len = b - a, mid = (a + b) / 2;
    if (s.kind === 'street') for (const off of [-0.2, 0.2]) lay(ctx, s, len, 0.02, 0.12, paint, mid, off, 0.01);
    if (s.kind === 'boulevard') {
      lay(ctx, s, len, 0.25, MEDIAN, kit.concrete(palette.roseGrey), mid, 0, 0.12);
      lay(ctx, s, len, 0.04, MEDIAN - 0.8, kit.concrete(palette.gunmetal), mid, 0, 0.26);
      for (let v = a + 7; v < b - 4; v += 14) tree(kit, ctx.root, ...spot(s, v, 0), 7);
    }
  }
  for (const l of lines) {
    for (const side of [-1, 1]) {
      const at = l.c + side * (l.w / 2 + 1.8);
      if (inRing(ctx, s, at) || at < lo || at > hi) continue; // none on the outside of the city: no one walks there
      for (let off = -roadway / 2 + 0.6; off < roadway / 2; off += 1.2) {
        if (s.kind === 'boulevard' && Math.abs(off) < MEDIAN / 2) continue; // the median is a refuge, not paint
        lay(ctx, s, 3, 0.02, 0.6, paint, at, off, 0.01);
      }
    }
  }
}

// Pedestrian street: the roadway paved over between crossings, with trees, planters and benches down the middle,
// and on most long stretches a food street (food below) in place of them for a while.
function walk(ctx, s) {
  const { kit, rand } = ctx, roadway = s.w - 2 * SIDEWALK;
  const paving = kit.concrete(palette.roseGrey), planter = kit.concrete(palette.gunmetal), bench = kit.steel(palette.charcoal, 0.8);
  for (const [a, b] of stretches(ctx, 0)) {
    lay(ctx, s, b - a, 0.18, roadway, paving, (a + b) / 2, 0, 0.09);
    const [f0, f1] = food(ctx, s, a, b);
    for (let v = a + 6; v < b - 4; v += 12) {
      // Every choice is drawn even where the food street is, so the rest of the planting stays as it was.
      const side = rand() < 0.5 ? -1 : 1, isTree = rand() < 0.6, h = isTree ? 5 + rand() * 2 : 0, seat = rand() < 0.5;
      if (v + 4 > f0 && v - 2 < f1) continue;
      if (isTree) tree(kit, ctx.root, ...spot(s, v, side * 2), h);
      else lay(ctx, s, 2.4, 0.6, 1.2, planter, v, side * 2, 0.48, 1);
      if (seat) {
        lay(ctx, s, 1.8, 0.45, 0.5, bench, v + 3, -side * 2.2, 0.4, 1);
        ctx.benches.push([...spot(s, v + 3, -side * 2.2), s.axis, -side]); // people.js seats people here, facing away from the trees
      }
    }
  }
}

// A food street on a walk's stretch from a to b, on about three in four of the long ones: two or three stalls down
// one side, facing the middle, each a different kind (stall below), and a cafe terrace down the other: small
// round tables, each under its own hexagonal parasol with a lit rim, and a neon totem with the cafe's name. Warm
// light pools on the paving under every stall and table. Returns the part of the stretch it takes, [from, to]
// ([Infinity, -Infinity] if none). ctx.food gets every stall and stool (people.js puts vendors, customers and
// diners there).
function food(ctx, s, a, b) {
  const r = rng(Math.round(s.c * 7 + a * 13 + 5) >>> 0);
  if (b - a < 70 || r() < 0.25) return [Infinity, -Infinity];
  const len = 34, from = a + 10 + r() * (b - a - len - 20), side = r() < 0.5 ? -1 : 1;
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
    ctx.food.push({ kind: 'stall', x, z, heading: face(-side), along: s.axis, line: s.c,
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
      ctx.food.push({ kind: 'stool', x: w.x, z: w.z, heading: Math.atan2(tx - w.x, tz - w.z), table: [tx, tz], along: s.axis, line: s.c });
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
function plaza({ kit, root, paint }, c, w) {
  const lanes = STREETS.boulevard.lanes, R = RING_OUT, near = w / 2 - SIDEWALK, far = w / 2 + HUB * TILE;
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

// Sectors: raised paving out to the curb, a curb line, and an alley cross through the middle.
function sectors(kit, root, { n, pos, inTown }, rand, hub) {
  const paving = kit.concrete(palette.slate), curb = kit.concrete(palette.roseGrey), alley = kit.mat('aerial_asphalt_01', palette.gunmetal);
  const planter = kit.concrete(palette.gunmetal), shrub = kit.concrete(palette.teal);
  for (let by = 0; by < n; by += BLOCK) {
    for (let bx = 0; bx < n; bx += BLOCK) {
      const [x0, x1] = [pos(bx) - TILE / 2 - SIDEWALK, pos(bx + BLOCK - 1) + TILE / 2 + SIDEWALK];
      const [z0, z1] = [pos(by) - TILE / 2 - SIDEWALK, pos(by + BLOCK - 1) + TILE / 2 + SIDEWALK];
      const [cx, cz, w, d] = [(x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0];
      // The four sectors at the central crossing give up a corner to the tower's plaza (plaza() paves it).
      const sx = Math.sign(cx - hub.c), sz = Math.sign(cz - hub.c), reach = hub.w / 2 + HUB * TILE;
      const touches = Math.min(Math.abs(x0 - hub.c), Math.abs(x1 - hub.c)) < hub.w / 2 &&
        Math.min(Math.abs(z0 - hub.c), Math.abs(z1 - hub.c)) < hub.w / 2;
      const [kx, kz] = [hub.c + sx * reach, hub.c + sz * reach]; // the plaza corner's far edges
      const rect = (a0, a1, b0, b1) => part(root, slab(a1 - a0, 0.18, b1 - b0), paving, (a0 + a1) / 2, 0.09, (b0 + b1) / 2);
      const kerbX = (a0, a1, z) => part(root, slab(a1 - a0, 0.22, 0.35), curb, (a0 + a1) / 2, 0.11, z);
      const kerbZ = (b0, b1, x) => part(root, slab(0.35, 0.22, b1 - b0), curb, x, 0.11, (b0 + b1) / 2);
      if (!touches) {
        rect(x0, x1, z0, z1);
        for (const z of [z0, z1]) kerbX(x0, x1, z);
        for (const x of [x0, x1]) kerbZ(z0, z1, x);
      } else {
        const [ox0, ox1] = sx > 0 ? [kx, x1] : [x0, kx], [oz0, oz1] = sz > 0 ? [kz, z1] : [z0, kz];
        const [pz0, pz1] = sz > 0 ? [z0, kz] : [kz, z1];
        rect(x0, x1, oz0, oz1); // the rows past the corner, full width
        rect(ox0, ox1, pz0, pz1); // and the corner's rows, beside it
        const [hz, fz] = sz > 0 ? [z0, z1] : [z1, z0], [hx, fx] = sx > 0 ? [x0, x1] : [x1, x0];
        kerbX(x0, x1, fz);
        kerbX(ox0, ox1, hz);
        kerbZ(z0, z1, fx);
        kerbZ(oz0, oz1, hx);
      }
      // Each half of the cross is a service alley (asphalt, dumpsters) or a paved pedestrian lane with planters,
      // so neighbouring sectors do not repeat.
      const [ax, az] = [pos(bx + HALF) - TILE / 2 - ALLEY / 2, pos(by + HALF) - TILE / 2 - ALLEY / 2];
      // In the old town each of the four arms is its own passage: through, a dead end walled off short of the
      // middle, or built over (the gap left as a closed yard).
      const arms = inTown(bx, by) ? [-1, 1] : [0];
      for (const [x, z, full, across] of [[ax, cz, d - 2 * SIDEWALK, 'z'], [cx, az, w - 2 * SIDEWALK, 'x']]) for (const arm of arms) {
        const lane = rand() < 0.4, fate = arm ? rand() : 1;
        if (fate < 0.15) continue;
        const along = arm ? (full / 2) * (fate < 0.5 ? 0.55 : 1) : full, mid = arm * (full / 2 - along / 2);
        const [x1, z1] = across === 'z' ? [x, z + mid] : [x + mid, z];
        const size = across === 'z' ? [ALLEY, 0.04, along] : [along, 0.04, ALLEY];
        part(root, slab(...size), lane ? curb : alley, x1, 0.19, z1);
        if (fate < 0.5) { // dead end: a wall across the inner end
          const end = mid - (arm * along) / 2, wall = across === 'z' ? [ALLEY, 1.8, 0.4] : [0.4, 1.8, ALLEY];
          part(root, box(...wall, 0), curb, across === 'z' ? x : x + end, 0.9, across === 'z' ? z + end : z);
        }
        for (let k = 0; k < (lane ? 5 : 3) * (along / full); k++) {
          const s = mid + (rand() - 0.5) * (along - 6), side = rand() < 0.5 ? -1 : 1;
          const [px, pz] = across === 'z' ? [x + side * 1.6, z + s] : [x + s, z + side * 1.6];
          const item = lane ? part(root, box(1.4, 0.6, 1.4, 1), planter, px, 0.5, pz)
            : part(root, box(1.2, 1.3, 1.9, 0), kit.steel(palette.gunmetal, 0.8), px, 0.85, pz);
          item.rotation.y = across === 'z' ? 0 : Math.PI / 2;
          if (lane) part(root, box(1.1, 0.25, 1.1, 1), shrub, px, 0.9, pz);
        }
      }
    }
  }
}

// The city's outer edge: the ring road's outer sidewalk, raised and kerbed like the sectors', open only where a
// street carries on out of town (as a dirt track or a highway). The outer lamps of the ring road stand on it.
function perimeter(ctx) {
  const { kit, lo, hi } = ctx, paving = kit.concrete(palette.slate), curb = kit.concrete(palette.roseGrey);
  for (const axis of ['x', 'z']) {
    const runs = stretches(ctx, -SIDEWALK), last = runs.length - 1; // gaps the width of each crossing roadway
    runs[0][0] = lo + SIDEWALK; // out to the corners, where the kerbs meet
    runs[last][1] = hi - SIDEWALK;
    const corner = axis === 'x' ? SIDEWALK : 0; // the x runs also pave the corner squares
    for (const [c, side] of [[lo, 1], [hi, -1]]) {
      runs.forEach(([a, b], k) => {
        lay(ctx, { axis, c }, b - a, 0.22, 0.35, curb, (a + b) / 2, side * (SIDEWALK - 0.175), 0.11);
        const [a0, b0] = [k === 0 ? a - corner : a, k === last ? b + corner : b];
        lay(ctx, { axis, c }, b0 - a0, 0.18, SIDEWALK, paving, (a0 + b0) / 2, side * (SIDEWALK / 2), 0.09);
      });
    }
  }
}

// Sodium lamps on both curbs, arms over the street, with a soft pool of light under each.
function lamps(ctx, s) {
  const { kit, root, lo, hi } = ctx;
  const pools = new THREE.MeshBasicMaterial({ map: radialTexture(128), color: palette.sodium, transparent: true, opacity: 0.16,
    blending: THREE.AdditiveBlending, depthWrite: false });
  const kerb = s.w / 2 - SIDEWALK + 0.6;
  for (let v = lo + 20; v < hi - 20; v += LAMP_EVERY) {
    if (inCrossing(ctx, v, 2) || inRing(ctx, s, v, 4)) continue;
    for (const side of [-1, 1]) {
      const [x, z] = spot(s, v, side * kerb);
      const facing = s.axis === 'z' ? (side > 0 ? Math.PI : 0) : side > 0 ? Math.PI / 2 : -Math.PI / 2;
      const p = streetLamp(kit, root, x, z, facing);
      ctx.lampsAt.push([x, z]); // so street props (city.js) keep clear
      part(root, new THREE.CircleGeometry(6, 20), pools, p.x, 0.25, p.z).rotation.x = -Math.PI / 2;
    }
  }
}

// Traffic lanes of street s, each way, driving on the right (seen from above, +x traffic keeps to +z and +z
// traffic to -x). A lane runs along `axis` at offset `at`, from `from` to `to`, on the street centred at `c`;
// stops: the crossings along it as [centre, half width], where life.js traffic lights hold it.
function trafficLanes(s, lo, hi, lines) {
  const { lanes, cars } = STREETS[s.kind], right = s.axis === 'x' ? 1 : -1, across = s.axis === 'x' ? 'z' : 'x';
  const stops = lines.filter((l) => l.kind[across] !== 'walk').map((l) => [l.c, l.w / 2]); // walks carry no cars
  return lanes.flatMap((off) => [
    { axis: s.axis, c: s.c, at: s.c + right * off, from: lo, to: hi, y: 0.65, cars, stops },
    { axis: s.axis, c: s.c, at: s.c - right * off, from: hi, to: lo, y: 0.65, cars, stops },
  ]);
}
