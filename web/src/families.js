// Building families: which architecture a house tile gets, and one builder per family. The family comes from
// fixed rules on the tile's height, district and age (familyOf); the style seed only varies a building within its
// family, so neighbours of one family share a look without repeating. Every building is exactly floors x F tall
// to its roof (crowns, plant and antennas sit above, as before), so the snapshot's heights stay true.
// Small parts (balconies, rooftop plant, pipes, planters) go into the group's `detail` child, which the city
// merges per sector and only draws near the camera (city.js, merge.js).
import * as THREE from 'three';
import { palette } from './palette.js';
import { box, cyl, part } from './geometry.js';
import { pipe, warningLamp } from './parts.js';
import { dress, podium } from './tiles.js';
import { roof, roofType } from './roofs.js';
import { F, WARM, pick } from './world.js';

// The rules, first match wins. They only use what stays fixed for a building while it stands (its floors, the tick
// it was built, its seed, and terrain and districts that never change), so a building keeps its family as the city
// grows around it. near: the tile's fixed surroundings (city.js surroundings).
export function familyOf(t, near, glassy) {
  if (t.f <= 10 && near.industry) return 'industrial';
  if ((near.oldTown && t.f < 16) || (t.b < 1500 && t.f < 10)) return 'old'; // the first generation, five days in
  if (t.f >= 20 && (near.park || near.centre)) return 'luxury';
  if (t.f >= 16 && near.inner && t.s % 3 === 0) return 'mega';
  if (t.f >= 10 && glassy) return 'office';
  return 'apartment';
}

// Builds the tile's building. fw: footprint width; lit: false in a blackout.
// slot: col + 2 x row, which steps neighbours through their family's roof types (roofs.js).
export function building(kit, t, rand, fw, family, slot) {
  const g = new THREE.Group(), detail = new THREE.Group();
  detail.name = 'detail';
  g.add(detail);
  const c = { kit, g, d: detail, rand, lit: t.on, fw, f: t.f, H: t.f * F, seed: Math.floor(rand() * 6), warm: pick(rand, WARM),
    m: details(kit), roof: roofType(family, t, slot) };
  ({ apartment, office, old, luxury, industrial, mega })[family](c);
  return g;
}

// ---- shared parts -------------------------------------------------------------------------------------------

// The only materials detail parts use, so each sector's details draw in four calls.
// steel is the same material pipe() uses for its flanges.
const details = (kit) => ({ steel: kit.steel(palette.charcoal, 0.4), slab: kit.concrete(palette.slate),
  green: kit.concrete(palette.teal), pipe: kit.mat('rusty_painted_metal', palette.gunmetal) });

// One volume of rooms from y0 to y1 with a roof cap (so windows never show on top). Returns the roof height.
function vol(c, w, d, y0, y1, wall, x = 0, z = 0, lip = 0.4, cap = palette.charcoal) {
  part(c.g, box(w, y1 - y0, d, 1), wall, x, (y0 + y1) / 2, z);
  part(c.g, box(w + lip, 0.6, d + lip, 1), c.kit.steel(cap), x, y1 + 0.3, z);
  return y1 + 0.6;
}

// A mechanical floor: one storey of louvres, set in a little from the rooms around it.
function mech(c, w, d, y, x = 0, z = 0) {
  part(c.g, box(w - 0.5, F, d - 0.5, 1), c.kit.mat('metal_grate_rusty', palette.gunmetal), x, y + F / 2, z);
}

// A body from y0 to y1 with a mechanical floor every `every` floors (none if 0). Returns the roof height.
function body(c, w, d, y0, y1, wall, every = 0, x = 0, z = 0) {
  if (!every) return vol(c, w, d, y0, y1, wall, x, z);
  let y = y0;
  while (y + (every + 1) * F < y1) {
    part(c.g, box(w, every * F, d, 1), wall, x, y + (every * F) / 2, z);
    mech(c, w, d, y + every * F, x, z);
    y += (every + 1) * F;
  }
  return vol(c, w, d, y, y1, wall, x, z);
}

// Balconies on a face (+z, or -z with side -1), in `stacks` columns, one per floor from y0 to y1.
function balconies(c, w, d, y0, y1, stacks, side = 1, x = 0, z = 0) {
  const { slab, steel: rail } = c.m, bw = Math.min(2.6, w / stacks - 0.6);
  for (let s = 0; s < stacks; s++) {
    const bx = x + (s - (stacks - 1) / 2) * (w / stacks);
    for (let y = y0 + F; y < y1 - 0.5; y += F) {
      part(c.d, box(bw, 0.18, 1.1, 0), slab, bx, y, z + side * (d / 2 + 0.55));
      part(c.d, box(bw, 0.9, 0.06, 0), rail, bx, y + 0.5, z + side * (d / 2 + 1.08));
    }
  }
}

// A terrace on a setback roof: planters along its edge and a glass rail.
function terrace(c, w, d, y, inner) {
  const { slab: planter, green, steel: rail } = c.m;
  for (const side of [-1, 1]) {
    part(c.d, box(w - 1, 0.6, 0.8, 0), planter, 0, y + 0.3, side * (d / 2 - 0.6));
    part(c.d, box(w - 1.2, 0.4, 0.6, 0), green, 0, y + 0.8, side * (d / 2 - 0.6));
    part(c.d, box(w, 0.08, 0.08, 0), rail, 0, y + 1.1, side * (d / 2 - 0.05)); // rail
  }
  if (inner) part(c.d, box(inner, 0.08, inner, 0), planter, 0, y + 0.04, 0); // decking
}

// Bay windows: a column of rooms standing out from a face, the full height of a body.
function bay(c, w, y0, y1, wall, x, z, side = 1) {
  part(c.g, box(w, y1 - y0 - 0.6, 1.2, 1), wall, x, (y0 + y1) / 2, z + side * 0.6);
}

// ---- the six families ---------------------------------------------------------------------------------------

// 1. Apartment towers: a slab, an L or twin towers on a shop podium; balconies, bay windows, the family's roofs
// and the street's signs and billboards (tiles.js dress).
function apartment(c) {
  const { kit, fw, f, H, seed, lit } = c, wall = (s) => kit.windows(s, lit, true);
  let y = 0;
  if (f >= 8) { podium(kit, c.g, c.rand, lit, c.warm, fw); y = 2 * F; }
  const top = H, shape = f < 8 ? 0 : seed % 3; // 0 slab, 1 L, 2 twin
  let roofY, free;
  if (shape === 2) { // twin towers on a shared core
    const tw = fw * 0.42;
    for (const s of [-1, 1]) {
      roofY = vol(c, tw, fw * 0.7, y, top, wall(seed), s * fw * 0.26, 0);
      roof(c, c.roof, tw, fw * 0.7, roofY, wall(seed), false, s * fw * 0.26);
    }
    vol(c, fw * 0.3, fw * 0.4, y, top - F, wall((seed + 1) % 6));
    balconies(c, tw, fw * 0.7, y, top, 1, 1, -fw * 0.26);
    balconies(c, tw, fw * 0.7, y, top, 1, -1, fw * 0.26);
    free = false;
  } else {
    const d = shape === 1 ? fw * 0.55 : fw * 0.68, z = shape === 1 ? -fw * 0.2 : 0;
    roofY = vol(c, fw * 0.86, d, y, top, wall(seed), 0, z);
    if (shape === 1) vol(c, fw * 0.4, fw * 0.5, y, top - 2 * F, wall((seed + 2) % 6), fw * 0.23, fw * 0.22); // the L's wing
    balconies(c, fw * 0.86, d, y, top, 2, -1, 0, z);
    if (shape === 0) balconies(c, fw * 0.86, d, y, top, 2, 1);
    if (f >= 8 && seed % 2) bay(c, 2.4, y, top, wall(seed), -fw * 0.2, z + d / 2);
    free = roof(c, c.roof, fw * 0.86, d, roofY, wall(seed), false, 0, z);
  }
  dress({ kit, g: c.g, rand: c.rand, lit, warm: c.warm, H, y, w: fw * 0.86, tall: f >= 20 }, f, roofY, free);
}

// 2. Offices: a double-height glass lobby, a curtain wall framed by corner columns, a mechanical floor every
// dozen storeys, a setback for the tall ones, and the family's roofs.
function office(c) {
  const { kit, fw, f, H, seed, lit } = c, glass = kit.windows(seed, lit, false), frame = kit.steel(palette.gunmetal, 0.5);
  const lobby = 2 * F, w = fw * (seed % 2 ? 0.82 : 0.76);
  vol(c, fw * 0.92, fw * 0.92, 0, lobby, kit.windows(3, lit, true, 'shop'), 0, 0, 0.6);
  const split = f >= 18 && seed % 3 !== 0 ? lobby + (H - lobby) * 0.7 : H; // setback for the tall ones
  let roofY = body(c, w, w, lobby, split, glass, 12);
  const columns = (cw, y0, y1) => {
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) part(c.g, box(0.7, y1 - y0, 0.7, 1), frame, sx * cw / 2, (y0 + y1) / 2, sz * cw / 2);
  };
  columns(w, lobby, split);
  if (lit && seed % 2) warningLamp(kit, c.g, fw * 0.46 + 0.05, 2.4, fw * 0.3, 0.3); // security panel at the lobby
  if (lit && seed === 4 && f >= 14) { // now and then a narrow red corporate sign up one corner
    const h = Math.min(12, (split - lobby) * 0.35);
    part(c.g, box(0.3, h, 1.1, 1), kit.sign(['NOVA', 'VX9', 'SEIRA'][f % 3], palette.crimson, true), w / 2 + 0.5, split - F - h / 2, w / 2 - 1);
  }
  let top = w;
  if (split < H) {
    top = w * 0.78;
    roofY = body(c, top, top, roofY, H, glass);
    columns(top, split + 0.6, H);
  }
  roof(c, c.roof, top, top, roofY, glass, true);
}

// 3. Older buildings: one simple block of brick or weathered concrete with small deep windows, a heavy cornice,
// a fire escape down one side, a chimney, and the family's roofs (now and then a mansard).
function old(c) {
  const { kit, fw, f, H, seed, lit } = c, wall = kit.windows(seed, lit, true, 'old'), d = fw * (0.72 + (seed % 3) * 0.1);
  part(c.g, box(fw * 0.9, H, d, 1), wall, 0, H / 2, 0);
  part(c.g, box(fw * 0.9 + 1, 0.8, d + 1, 1), kit.concrete(palette.roseGrey), 0, H + 0.4, 0); // cornice
  if (f >= 3) { // fire escape: a landing per floor and a ladder, on the -z face
    const { steel } = c.m, x = (seed % 2 ? 1 : -1) * fw * 0.2;
    for (let y = F; y < H - 0.5; y += F) part(c.d, box(3, 0.1, 1.2, 0), steel, x, y, -d / 2 - 0.6);
    part(c.d, box(0.4, H - F, 0.08, 0), steel, x + 1.3, (H + F) / 2, -d / 2 - 1.15);
  }
  roof(c, c.roof, fw * 0.9, d, H + 0.8, wall, false);
  if (c.roof !== 'mansard') part(c.g, box(1, 2.4, 1, 0), kit.concrete(palette.brick), -fw * 0.3, H + 2, d * 0.25); // chimney
}

// 4. Luxury towers: a glass lobby, two or three tiers stepping back with planted terraces, tall glass, and the
// family's roofs (terraces, stepped tops, distinctive crowns).
function luxury(c) {
  const { kit, fw, H, seed, lit } = c, glass = kit.windows(seed, lit, false, 'luxury'), lobby = 2 * F;
  vol(c, fw * 0.95, fw * 0.95, 0, lobby, kit.windows(3, lit, true, 'shop'), 0, 0, 0.6, palette.gunmetal);
  let y = lobby, w = fw * 0.88;
  const tiers = seed % 2 ? [[0.55, 0.88], [0.27, 0.72], [0.18, 0.56]] : [[0.65, 0.86], [0.35, 0.64]];
  tiers.forEach(([frac, scale], k) => {
    const nw = fw * scale, y1 = k === tiers.length - 1 ? H : Math.min(H - F, y + Math.max(1, Math.round(((H - lobby) * frac) / F)) * F);
    if (y > lobby) terrace(c, w, w, y, w - 1.5);
    w = nw;
    y = vol(c, w, w, y, Math.max(y1, y + F), glass, 0, 0, 0.3, palette.gunmetal);
  });
  roof(c, c.roof, w, w, y, glass, true);
}

// 5. Industrial: a hall with high strip windows, a sawtooth roof on low halls (the family's utility roofs on the
// rest), external pipes up a face and over the roof, an exposed steel frame and sometimes a stack.
function industrial(c) {
  const { kit, fw, f, H, seed, lit, rand } = c, wall = kit.windows(seed, lit, true, 'industrial');
  const w = fw * 0.94, d = fw * 0.78, steel = kit.steel(palette.slate, 0.5), pipes = c.m.pipe;
  part(c.g, box(w, H, d, 1), wall, 0, H / 2, 0);
  if (f <= 3) { // sawtooth roof
    for (let k = 0; k < 3; k++) {
      part(c.g, box(w / 3 + 0.2, 0.25, d, 0), kit.mat('box_profile_metal_sheet', palette.gunmetal), -w / 3 + k * (w / 3), H + 1.2, 0).rotation.z = 0.55;
      if (lit) part(c.g, box(0.1, 1.4, d - 1, 0), kit.glow(palette.warmWindow, 0.8), -w / 3 + k * (w / 3) + 1.6, H + 1, 0);
    }
  } else {
    part(c.g, box(w + 0.3, 0.5, d + 0.3, 1), kit.steel(palette.charcoal), 0, H + 0.25, 0);
    roof(c, c.roof, w, d, H + 0.5, wall, false);
  }
  // Exposed frame on the +z face: columns and one brace per bay.
  for (let k = 0; k <= 3; k++) part(c.g, box(0.45, H, 0.45, 0), steel, -w / 2 + (k * w) / 3, H / 2, d / 2 + 0.3);
  for (let k = 0; k < 3; k++) {
    const len = Math.hypot(w / 3, H);
    part(c.d, box(len, 0.2, 0.2, 0), c.m.steel, -w / 2 + (k + 0.5) * (w / 3), H / 2, d / 2 + 0.3).rotation.z = Math.atan2(H, w / 3) * (k % 2 ? 1 : -1);
  }
  // Indicator lamps along the frame on lit halls of every other seed: a working section.
  if (lit && seed % 2) for (let k = 0; k <= 3; k++) warningLamp(kit, c.g, -w / 2 + (k * w) / 3, H - 0.6, d / 2 + 0.6);
  // Pipes up the -x face and across the roof.
  for (const [z, r] of [[-d * 0.25, 0.3], [d * 0.1, 0.2]]) pipe(kit, c.d, [[-w / 2 - 0.5, 0.4, z], [-w / 2 - 0.5, H + 1, z], [w * 0.2, H + 1, z]], r, pipes, 8);
  if (seed % 3 === 0) {
    part(c.g, cyl(0.6, 0.9, H + 12, 10), kit.concrete(palette.slate), w * 0.35, (H + 12) / 2, -d * 0.3);
    if (lit) part(c.g, new THREE.SphereGeometry(0.3, 8, 6), kit.warning(), w * 0.35, H + 12.3, -d * 0.3);
  }
}

// 6. Megastructures: layered sections stepping in and out off-centre, lit seams between them, an exoskeleton up
// one face, mixed homes and offices, the family's roofs and billboards; the city links neighbouring ones with
// skybridges.
function mega(c) {
  const { kit, fw, f, H, seed, lit } = c, frame = kit.steel(palette.gunmetal, 0.4), seam = kit.glow(seed % 2 ? palette.neonCyan : c.warm, 1.6);
  podium(kit, c.g, c.rand, lit, c.warm, fw);
  const layers = 3 + (seed % 2), base = 2 * F, per = Math.max(2, Math.floor((f - 2) / layers));
  let y = base, top;
  for (let k = 0; k < layers; k++) {
    const y1 = k === layers - 1 ? H : y + per * F, scale = [0.9, 0.76, 0.86, 0.7][(k + seed) % 4];
    const ox = ((k + seed) % 3 - 1) * 0.8, w = fw * scale, d = fw * (scale - 0.06);
    const wall = kit.windows((seed + k) % 6, lit, k % 2 === 0, k % 2 ? 'office' : 'residential');
    top = { w, d, ox, wall, glass: k % 2 === 1 };
    y = vol(c, w, d, y, y1, wall, ox, 0, 0.6);
    if (lit && k < layers - 1) part(c.g, box(w + 0.7, 0.18, d + 0.7, 0), seam, ox, y - 0.25, 0);
  }
  // Exoskeleton: two columns up the +x face, braced at every layer.
  for (const z of [-fw * 0.3, fw * 0.3]) part(c.g, box(0.8, H - base, 0.8, 0), frame, fw * 0.47, (H + base) / 2, z);
  for (let yy = base + per * F; yy < H; yy += per * F) part(c.d, box(0.4, 0.4, fw * 0.6, 0), c.m.steel, fw * 0.47, yy, 0);
  const free = roof(c, c.roof, top.w, top.d, y, top.wall, top.glass, top.ox);
  dress({ kit, g: c.g, rand: c.rand, lit, warm: c.warm, H, y: base, w: fw * 0.86, tall: true }, f, y, free);
}

