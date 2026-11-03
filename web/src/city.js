// The whole city from a snapshot: streets, then one building per tile, then one merged mesh per material.
import * as THREE from 'three';
import { palette } from './palette.js';
import { box, part, rng } from './geometry.js';
import { powerPlant } from './plant.js';
import { construction, market, plaza, tower } from './tiles.js';
import { mergeByMaterial } from './merge.js';
import { buildStreets } from './streets.js';
import { ALLEY, BLOCK, F, HALF, STREET, TALL, TILE, WARM, pick } from './world.js';

// Tile centres in metres. Main streets run between sectors; an alley splits every sector in half both ways.
export function cityLayout(snap) {
  const n = snap.size, sectors = n / BLOCK;
  const span = n * TILE + (sectors - 1) * STREET + sectors * ALLEY;
  const pos = (i) => i * TILE + Math.floor(i / BLOCK) * STREET + (Math.floor(i / HALF) - Math.floor(i / BLOCK)) * ALLEY
    - span / 2 + TILE / 2;
  return { n, span, pos };
}

export function buildCity(kit, snap) {
  const layout = cityLayout(snap), { n, pos } = layout, root = new THREE.Group();
  const streets = buildStreets(kit, layout, root);

  snap.tiles.forEach((t, i) => {
    const rand = rng(t.s), fw = footprint(t, rand);
    const sector = Math.floor(i / n / BLOCK) * (n / BLOCK) + Math.floor((i % n) / BLOCK);
    // Each sector leans glass or concrete; about one building in four goes the other way.
    const concrete = ((sector * 7 + snap.seed) % 2 === 0) !== (rand() < 0.25);
    const g = { house: () => tower(kit, t.f, rand, t.on, concrete, fw), build: () => construction(kit, t.f, rand, t.on, fw),
      market: () => market(kit, rand, t.on, fw), plant: () => powerPlant(kit, { props: false }), lot: () => plaza(kit, rand, t.on) }[t.k]();
    // Perimeter blocks: lots on a street or alley push their building up to it, so streets get a continuous wall
    // and each quarter-block keeps a courtyard behind; inner lots sit anywhere on theirs.
    const [cx, cz] = [pos(i % n), pos(Math.floor(i / n))], slack = TILE - 1 - fw;
    const [dx, dz] = [frontage(i % n), frontage(Math.floor(i / n))];
    g.position.set(cx + (dx ? dx / 2 : rand() - 0.5) * slack, 0.18, cz + (dz ? dz / 2 : rand() - 0.5) * slack);
    g.rotation.y = Math.floor(rand() * 4) * (Math.PI / 2);
    root.add(g);
    if (t.k !== 'plant' && t.k !== 'lot') shopfronts(kit, root, t, rand, cx, cz, dx, dz);
    // Skybridge to the east neighbour in the same sector when both are tall enough.
    const east = snap.tiles[i + 1];
    if (t.k === 'house' && east?.k === 'house' && (i % n) % BLOCK !== BLOCK - 1 && Math.min(t.f, east.f) >= 12 && rand() < 0.12) {
      const y = Math.min(t.f, east.f) * F * (0.4 + rand() * 0.2), [a, b] = [pos(i % n), pos((i % n) + 1)], z = pos(Math.floor(i / n));
      part(root, box(b - a, 3.2, 3.6, 1), kit.windows(2, t.on && east.on), (a + b) / 2, y, z);
      if (t.on) part(root, box(b - a, 0.12, 0.12, 1), kit.glow(palette.neonCyan, 2), (a + b) / 2, y - 1.7, z + 1.8);
    }
  });
  return { city: mergeByMaterial(root), lanes: streets.lanes, lines: streets.lines, edge: streets.hi };
}

// Which side of its quarter-block a tile row or column faces: -1 or 1 on the edge, 0 inside.
const frontage = (i) => (i % HALF === 0 ? -1 : i % HALF === HALF - 1 ? 1 : 0);

// A one-storey strip of shops along each street side of the lot, the full lot wide, so neighbouring strips join
// into a street wall even where the buildings above are narrow. Construction sites get a site hoarding instead.
function shopfronts(kit, root, t, rand, cx, cz, dx, dz) {
  const site = t.k === 'build', [h, d] = site ? [2.4, 0.3] : [4.5, 3];
  const wall = site ? kit.steel(palette.gunmetal, 0.8) : kit.windows(3, t.on, true);
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
  if (t.k === 'plant' || t.k === 'lot') return 12;
  const [lo, hi] = t.k === 'market' ? [9, 11] : t.f < 6 ? [7.5, 10.5] : t.f < TALL ? [9.5, 12.5] : [11, 12.5];
  return lo + rand() * (hi - lo);
}
