// Street level: a hierarchy of main streets between sectors (a planted boulevard through the middle, full streets,
// narrow one-lane streets and pedestrian walks; see STREETS in world.js), raised sidewalks with curbs around every
// sector, a cross of service alleys and pedestrian lanes through each sector, sodium lamps along the curbs, and the
// traffic lanes cars drive in. Long flat parts are slabs cut into short pieces, so the city's warp bends them.
import * as THREE from 'three';
import { palette } from './palette.js';
import { box, cyl, part, rng, slab } from './geometry.js';
import { telecomTower, towerBase } from './landmarks.js';
import { streetLamp, tree } from './parts.js';
import { radialTexture } from './textures.js';
import { ALLEY, BLOCK, HALF, SIDEWALK, STREETS, TILE } from './world.js';

const LAMP_EVERY = 55;
const MEDIAN = 6; // boulevard median width

export function buildStreets(kit, layout, root) {
  const { lines, lo, hi } = layout, rand = rng(31);
  const asphalt = kit.mat('aerial_asphalt_01', palette.gunmetal, 0.55); // wet, but not a mirror
  part(root, slab(hi - lo + 80, 0.1, hi - lo + 80, 8), asphalt, 0, -0.05, 0);
  sectors(kit, root, layout, rand);
  // Every main street, once per axis: centre c, width w, kind, and the axis it runs along.
  const streets = lines.flatMap((l) => ['x', 'z'].map((axis) => ({ c: l.c, w: l.w, kind: l.kind[axis], axis })));
  const ctx = { kit, root, lines, lo, hi, rand, paint: kit.glow(palette.cream, 0.35) }; // road paint glows faintly
  for (const s of streets) {
    if (s.kind === 'walk') walk(ctx, s);
    else road(ctx, s);
    lamps(ctx, s);
  }
  const hub = lines[lines.length >> 1];
  plaza(ctx, hub.c, hub.w);
  return { lanes: streets.flatMap((s) => trafficLanes(s, lo, hi)), lines: lines.map((l) => l.c), lo, hi,
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

// Roadway markings: dashed lane dividers, a double centre line (full streets), a planted median (boulevard) or a
// dashed centre line (narrow streets), and zebra crossings at every intersection.
function road(ctx, s) {
  const { kit, lo, hi, paint, lines } = ctx, { lanes } = STREETS[s.kind], roadway = s.w - 2 * SIDEWALK;
  const dividers = s.kind === 'lane' ? [0] : lanes.slice(1).flatMap((l, k) => [-(l + lanes[k]) / 2, (l + lanes[k]) / 2]);
  for (let v = lo; v < hi; v += 10) {
    if (inCrossing(ctx, v, 4) || inCrossing(ctx, v + 3, 4)) continue;
    for (const off of dividers) lay(ctx, s, 3, 0.02, 0.15, paint, v + 1.5, off, 0.01);
  }
  for (const [a, b] of stretches(ctx, 4)) {
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
      for (let off = -roadway / 2 + 0.6; off < roadway / 2; off += 1.2) {
        if (s.kind === 'boulevard' && Math.abs(off) < MEDIAN / 2) continue; // the median is a refuge, not paint
        lay(ctx, s, 3, 0.02, 0.6, paint, at, off, 0.01);
      }
    }
  }
}

// Pedestrian street: the roadway paved over between crossings, with trees, planters and benches down the middle.
function walk(ctx, s) {
  const { kit, rand } = ctx, roadway = s.w - 2 * SIDEWALK;
  const paving = kit.concrete(palette.roseGrey), planter = kit.concrete(palette.gunmetal), bench = kit.steel(palette.charcoal, 0.8);
  for (const [a, b] of stretches(ctx, 0)) {
    lay(ctx, s, b - a, 0.18, roadway, paving, (a + b) / 2, 0, 0.09);
    for (let v = a + 6; v < b - 4; v += 12) {
      const side = rand() < 0.5 ? -1 : 1;
      if (rand() < 0.6) tree(kit, ctx.root, ...spot(s, v, side * 2), 5 + rand() * 2);
      else lay(ctx, s, 2.4, 0.6, 1.2, planter, v, side * 2, 0.48, 1);
      if (rand() < 0.5) lay(ctx, s, 1.8, 0.45, 0.5, bench, v + 3, -side * 2.2, 0.4, 1);
    }
  }
}

// Where the boulevards meet: a roundabout. Cars circle the island (life.js traffic, hub), which carries the
// city's telecom tower and its raised plaza (landmarks.js).
const ISLAND = 8;
function plaza({ kit, root, paint }, c, w) {
  // Dashed rings between the circling lanes, inside the crossing and off its corner sidewalks.
  const lanes = STREETS.boulevard.lanes, inner = w / 2 - SIDEWALK;
  for (let k = 1; k < lanes.length; k++) {
    const r = ISLAND + 1.2 + (lanes[k - 1] + lanes[k]) / 2;
    for (let a = 0; a < Math.PI * 2; a += 3 / r) {
      const [x, z] = [Math.cos(a) * r, Math.sin(a) * r];
      if (Math.max(Math.abs(x), Math.abs(z)) > w / 2 || Math.min(Math.abs(x), Math.abs(z)) > inner) continue;
      part(root, box(0.15, 0.02, 1.5, 0), paint, c + x, 0.01, c + z).rotation.y = -a;
    }
  }
  part(root, cyl(ISLAND, ISLAND + 0.3, 0.4, 40), kit.concrete(palette.roseGrey), c, 0.2, c);
  part(root, cyl(ISLAND - 0.6, ISLAND - 0.6, 0.1, 40), kit.concrete(palette.teal), c, 0.42, c);
  telecomTower(kit, root, c, c);
  towerBase(kit, root, c, w);
}

// Sectors: raised paving out to the curb, a curb line, and an alley cross through the middle.
function sectors(kit, root, { n, pos, inTown }, rand) {
  const paving = kit.concrete(palette.slate), curb = kit.concrete(palette.roseGrey), alley = kit.mat('aerial_asphalt_01', palette.gunmetal);
  const planter = kit.concrete(palette.gunmetal), shrub = kit.concrete(palette.teal);
  for (let by = 0; by < n; by += BLOCK) {
    for (let bx = 0; bx < n; bx += BLOCK) {
      const [x0, x1] = [pos(bx) - TILE / 2 - SIDEWALK, pos(bx + BLOCK - 1) + TILE / 2 + SIDEWALK];
      const [z0, z1] = [pos(by) - TILE / 2 - SIDEWALK, pos(by + BLOCK - 1) + TILE / 2 + SIDEWALK];
      const [cx, cz, w, d] = [(x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0];
      part(root, slab(w, 0.18, d), paving, cx, 0.09, cz);
      for (const z of [z0, z1]) part(root, slab(w, 0.22, 0.35), curb, cx, 0.11, z);
      for (const x of [x0, x1]) part(root, slab(0.35, 0.22, d), curb, x, 0.11, cz);
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

// Sodium lamps on both curbs, arms over the street, with a soft pool of light under each.
function lamps(ctx, s) {
  const { kit, root, lo, hi } = ctx;
  const pools = new THREE.MeshBasicMaterial({ map: radialTexture(128), color: palette.sodium, transparent: true, opacity: 0.16,
    blending: THREE.AdditiveBlending, depthWrite: false });
  const kerb = s.w / 2 - SIDEWALK + 0.6;
  for (let v = lo + 20; v < hi - 20; v += LAMP_EVERY) {
    if (inCrossing(ctx, v, 2)) continue;
    for (const side of [-1, 1]) {
      const [x, z] = spot(s, v, side * kerb);
      const facing = s.axis === 'z' ? (side > 0 ? Math.PI : 0) : side > 0 ? Math.PI / 2 : -Math.PI / 2;
      const p = streetLamp(kit, root, x, z, facing);
      part(root, new THREE.CircleGeometry(6, 20), pools, p.x, 0.25, p.z).rotation.x = -Math.PI / 2;
    }
  }
}

// Traffic lanes of street s, each way, driving on the right (seen from above, +x traffic keeps to +z and +z
// traffic to -x). A lane runs along `axis` at offset `at`, from `from` to `to`.
function trafficLanes(s, lo, hi) {
  const { lanes, cars } = STREETS[s.kind], right = s.axis === 'x' ? 1 : -1;
  return lanes.flatMap((off) => [
    { axis: s.axis, at: s.c + right * off, from: lo, to: hi, y: 0.65, cars },
    { axis: s.axis, at: s.c - right * off, from: hi, to: lo, y: 0.65, cars },
  ]);
}
