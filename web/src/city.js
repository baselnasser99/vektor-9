// The whole city from a snapshot: streets, then one building per tile, then one merged mesh per material.
import * as THREE from 'three';
import { palette } from './palette.js';
import { box, part, rng } from './geometry.js';
import { powerPlant } from './plant.js';
import { construction, market, plaza, tower } from './tiles.js';
import { mergeByMaterial } from './merge.js';
import { buildStreets } from './streets.js';
import { spire } from './landmarks.js';
import { park, railGround, railLine, railway, works } from './terrain.js';
import { ALLEY, BLOCK, F, HALF, STREETS, TALL, TERRAIN, TILE, WARM, pick } from './world.js';

// Tile centres in metres, before the district warp (cityWarp). Main streets run between sectors; an alley splits every sector in half
// both ways. lines: every main street, k = 0 and the last being the ring road: its centre c, width w, and kind per
// axis (kind.x runs along x at z = c, kind.z along z at x = c). The same lines serve both axes.
export function cityLayout(snap) {
  const n = snap.size, sectors = n / BLOCK, mid = sectors / 2, rand = rng(snap.seed * 13 + 5);
  // A boulevard through the middle (it meets the highways), then narrow and full streets alternating out to the
  // ring road. Widths mirror around the centre so the boulevard sits at 0; whether a narrow one carries traffic
  // or is a pedestrian walk is picked per axis from the seed.
  const kinds = Array.from({ length: sectors + 1 }, (_, k) => {
    if (k === 0 || k === sectors) return { x: 'street', z: 'street' };
    if (k === mid) return { x: 'boulevard', z: 'boulevard' };
    if (Math.abs(k - mid) % 2 === 0) return { x: 'street', z: 'street' };
    return { x: rand() < 0.5 ? 'walk' : 'lane', z: rand() < 0.5 ? 'walk' : 'lane' };
  });
  const widths = kinds.map((k) => STREETS[k.x].w); // both axes' kinds at a line have the same width
  const before = (s) => widths.slice(1, s + 1).reduce((a, b) => a + b, 0); // street width before sector s
  const span = n * TILE + before(sectors - 1) + sectors * ALLEY;
  const pos = (i) => i * TILE + before(Math.floor(i / BLOCK)) + (Math.floor(i / HALF) - Math.floor(i / BLOCK)) * ALLEY
    - span / 2 + TILE / 2;
  const lines = kinds.map((kind, k) => ({ kind, w: widths[k],
    c: k < sectors ? pos(k * BLOCK) - TILE / 2 - widths[k] / 2 : pos(n - 1) + TILE / 2 + widths[k] / 2 }));
  // Old town: of the four 2x2-sector quarters touching the centre, the one with the least terrain.
  const within = (col, row, [sx, sz]) => [col / BLOCK - sx, row / BLOCK - sz].every((v) => v >= 0 && v < 2);
  const terrain = (q) => snap.tiles.filter((t, i) => TERRAIN.includes(t.k) && within(i % n, Math.floor(i / n), q)).length;
  const quarters = [[mid - 2, mid - 2], [mid, mid - 2], [mid - 2, mid], [mid, mid]].map((q) => [terrain(q) + rand(), q]);
  const town = quarters.sort((p, q) => p[0] - q[0])[0][1];
  const inTown = (col, row) => within(col, row, town);
  return { n, span, pos, lines, town, inTown, lo: lines[0].c - widths[0] / 2, hi: lines[sectors].c + widths[sectors] / 2 };
}

// Districts: the city is not one plan. The old town (a quarter of 2x2 sectors beside the centre, the one with the
// least terrain, ties broken by the seed) has winding streets and oddly shaped blocks; everything else is modern
// and stays straight. The warp is zero on the old town's bounding streets and along the railway, so the viaduct
// and the rest of the city stay straight. Buildings ride it whole (settle), only the ground bends.
export function cityWarp(snap, layout, rail) {
  const { lines, town } = layout, rand = rng(snap.seed * 31 + 7), [a, b, c, d] = [0, 0, 0, 0].map(() => rand() * Math.PI * 2);
  const [x0, x1, z0, z1] = [lines[town[0]].c, lines[town[0] + 2].c, lines[town[1]].c, lines[town[1] + 2].c];
  const k1 = (2 * Math.PI) / 150, k2 = (2 * Math.PI) / 80;
  const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
  // The shift at (x, z), written into out as [dx, dz] (no garbage: merge calls it for every vertex).
  return (x, z, out) => {
    // Two crossed waves, full strength from 50 m inside the old town's bounding streets; zero outside it.
    const old = smooth(Math.min(x - x0, x1 - x, z - z0, z1 - z) / 50);
    if (old === 0) {
      out[0] = out[1] = 0;
      return out;
    }
    const keep = rail ? smooth((Math.abs((x - rail.mx) * rail.uz - (z - rail.mz) * rail.ux) - 12) / 40) : 1;
    out[0] = keep * old * (6 * Math.sin(k1 * z + a) + 3.5 * Math.sin(k2 * (x + z) + b));
    out[1] = keep * old * (6 * Math.sin(k1 * x + c) + 3.5 * Math.sin(k2 * (x - z) + d));
    return out;
  };
}

// Moves and turns a tile's group with the warp at its centre, as a whole, so its buildings never bend.
function settle(g, warp) {
  const { x, z } = g.position, [dx, dz] = warp(x, z, []), [ex, ez] = warp(x + 1, z, []);
  g.rotation.y -= Math.atan2(ez - dz, 1 + ex - dx);
  g.position.x += dx;
  g.position.z += dz;
  g.userData.rigid = true; // mergeByMaterial leaves it unwarped
}

export function buildCity(kit, snap) {
  const layout = cityLayout(snap), { n, pos, inTown } = layout, root = new THREE.Group();
  const rails = snap.tiles.flatMap((t, i) => (t.k === 'rail' ? [[pos(i % n), pos(Math.floor(i / n))]] : []));
  const warp = cityWarp(snap, layout, railLine(rails)), streets = buildStreets(kit, layout, root);
  // Signature towers: the tallest, then the next tallest at least 12 tiles from those picked, up to three
  // (ties to the first in row order), so they mark different parts of the skyline.
  const signature = new Set(), far = (i, j) => Math.max(Math.abs((i % n) - (j % n)), Math.abs(Math.floor(i / n) - Math.floor(j / n))) >= 12;
  for (const [, i] of snap.tiles.map((t, i) => [t.k === 'house' && t.f >= TALL ? t.f : -1, i]).filter(([f]) => f >= 0)
    .sort((p, q) => q[0] - p[0] || p[1] - q[1])) if (signature.size < 3 && [...signature].every((j) => far(i, j))) signature.add(i);

  snap.tiles.forEach((t, i) => {
    const rand = rng(t.s), fw = footprint(t, rand), col = i % n, row = Math.floor(i / n);
    const sector = Math.floor(row / BLOCK) * (n / BLOCK) + Math.floor(col / BLOCK);
    // Each sector leans glass or concrete; about one building in four goes the other way.
    const concrete = ((sector * 7 + snap.seed) % 2 === 0) !== (rand() < 0.25);
    const g = { house: () => tower(kit, t.f, rand, t.on, concrete, fw), build: () => construction(kit, t.f, rand, t.on, fw),
      market: () => market(kit, rand, t.on, fw), plant: () => powerPlant(kit, { close: false }), lot: () => plaza(kit, rand, t.on),
      rail: () => railGround(kit), park: () => park(kit, rand, t.on), works: () => works(kit, rand, t.on) }[t.k]();
    // Perimeter blocks: lots on a street or alley push their building up to it, so streets get a continuous wall
    // and each quarter-block keeps a courtyard behind; inner lots sit anywhere on theirs.
    const [cx, cz] = [pos(col), pos(row)], slack = TILE - 1 - fw;
    const [dx, dz] = [frontage(col), frontage(row)], lot = new THREE.Group();
    lot.position.set(cx, 0, cz);
    lot.add(g);
    root.add(lot);
    if (TERRAIN.includes(t.k)) { // terrain fills its whole tile, square to the grid
      g.position.y = 0.18;
      return settle(lot, warp);
    }
    g.position.set((dx ? dx / 2 : rand() - 0.5) * slack, 0.18, (dz ? dz / 2 : rand() - 0.5) * slack);
    g.rotation.y = Math.floor(rand() * 4) * (Math.PI / 2) + (inTown(col, row) ? (rand() - 0.5) * 0.2 : 0); // old town: a little askew
    if (t.k !== 'plant' && t.k !== 'lot') shopfronts(kit, lot, t, rand, 0, 0, dx, dz);
    if (signature.has(i)) spire(kit, g, t.f * F, fw, t.on);
    settle(lot, warp);
    // Skybridge to the east neighbour in the same sector when both are tall enough.
    const east = snap.tiles[i + 1];
    if (t.k === 'house' && east?.k === 'house' && col % BLOCK !== BLOCK - 1 && Math.min(t.f, east.f) >= 12 && rand() < 0.12) {
      const y = Math.min(t.f, east.f) * F * (0.4 + rand() * 0.2), [a, b] = [cx, pos(col + 1)];
      part(root, box(b - a, 3.2, 3.6, 1), kit.windows(2, t.on && east.on), (a + b) / 2, y, cz);
      if (t.on) part(root, box(b - a, 0.12, 0.12, 1), kit.glow(palette.neonCyan, 2), (a + b) / 2, y - 1.7, cz + 1.8);
    }
  });
  const rail = railway(kit, root, rails, streets.hi);
  return { city: mergeByMaterial(root, warp), warp, rail, hub: streets.hub, lanes: streets.lanes, lines: streets.lines, edge: streets.hi };
}

// Which side of its quarter-block a tile row or column faces: -1 or 1 on the edge, 0 inside.
const frontage = (i) => (i % HALF === 0 ? -1 : i % HALF === HALF - 1 ? 1 : 0);

// A one-storey strip of shops along each street side of the lot, the full lot wide, so neighbouring strips join
// into a street wall even where the buildings above are narrow. Construction sites get a site hoarding instead.
function shopfronts(kit, root, t, rand, cx, cz, dx, dz) {
  const site = t.k === 'build', [h, d] = site ? [2.4, 0.3] : [4.5, 3];
  const wall = site ? kit.steel(palette.gunmetal, 0.8) : kit.windows(3, t.on, true, 'shop');
  const awning = t.on && !site && kit.glow(pick(rand, WARM), 1.2);
  const at = TILE / 2 - 0.3 - d / 2;
  // x-facing strips are a hair lower than z-facing ones so their roofs never fight at the corner.
  if (dx) {
    part(root, box(d, h, TILE, 0), wall, cx + dx * at, 0.18 + h / 2, cz);
    if (awning) part(root, box(0.15, 0.15, TILE - 1, 0), awning, cx + dx * (at + d / 2 + 0.1), h - 0.4, cz);
  }
  if (dz) {
    part(root, box(TILE, h + 0.1, d, 0), wall, cx, 0.18 + (h + 0.1) / 2, cz + dz * at);
    if (awning) part(root, box(TILE - 1, 0.15, 0.15, 0), awning, cx, h - 0.4, cz + dz * (at + d / 2 + 0.1));
  }
}

// Footprint width from the style seed: low-rises are small, towers fill most of their lot.
function footprint(t, rand) {
  if (!['build', 'house', 'market'].includes(t.k)) return 12;
  const [lo, hi] = t.k === 'market' ? [9, 11] : t.f < 6 ? [7.5, 10.5] : t.f < TALL ? [9.5, 12.5] : [11, 12.5];
  return lo + rand() * (hi - lo);
}
