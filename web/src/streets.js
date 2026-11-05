// Street level: a hierarchy of main streets between sectors (a planted boulevard through the middle, full streets,
// narrow one-lane streets and pedestrian walks; see STREETS in world.js), raised sidewalks with curbs around every
// sector, a cross of service alleys and pedestrian lanes through each sector, sodium lamps along the curbs, and the
// traffic lanes cars drive in. Long flat parts are slabs cut into short pieces, so the city's warp bends them.
import * as THREE from 'three';
import { palette } from './palette.js';
import { box, cyl, part, REPEAT, rng, slab } from './geometry.js';
import { telecomTower } from './landmarks.js';
import { streetLamp, tree } from './parts.js';
import { radialTexture } from './textures.js';
import { ALLEY, BLOCK, HALF, HUB, SIDEWALK, STREETS, TILE } from './world.js';

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
  const ctx = { kit, root, lines, lo, hi, rand, hub: hub.c, paint: kit.glow(palette.cream, 0.35) }; // road paint glows faintly
  perimeter(ctx);
  for (const s of streets) {
    if (s.kind === 'walk') walk(ctx, s);
    else road(ctx, s);
    lamps(ctx, s);
  }
  plaza(ctx, hub.c, hub.w);
  return { lanes: streets.flatMap((s) => trafficLanes(s, lo, hi, lines)), lines: lines.map((l) => l.c), lo, hi,
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
