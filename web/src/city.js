// The whole city from a snapshot: streets, then one building per tile, then one merged mesh per material.
import * as THREE from 'three';
import { palette } from './palette.js';
import { box, part, rng } from './geometry.js';
import { powerPlant } from './plant.js';
import { construction, market, plaza, storefront } from './tiles.js';
import { building, familyOf } from './families.js';
import { mergeByMaterial } from './merge.js';
import { buildStreets } from './streets.js';
import { retrofit, spire } from './landmarks.js';
import { park, railGround, railLine, railway, works } from './terrain.js';
import { ALLEY, BLOCK, F, HALF, HUB, STREETS, TALL, TERRAIN, TILE, WARM, WORDS, pick } from './world.js';

// Tile centres in metres, before the district warp (cityWarp). Main streets run between sectors; an alley splits
// every sector in half both ways. lines: every main street, k = 0 and the last being the ring road: its centre c,
// width w, and kind per axis (kind.x runs along x at z = c, kind.z along z at x = c). The same lines serve both axes.
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
  const centres = Array.from({ length: n }, (_, i) => i * TILE + before(Math.floor(i / BLOCK))
    + (Math.floor(i / HALF) - Math.floor(i / BLOCK)) * ALLEY - span / 2 + TILE / 2);
  const pos = (i) => centres[i];
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
// and the rest of the city stay straight, and round the tower's plaza at the centre, so its roundabout stays round.
// Buildings ride it whole (settle), only the ground bends.
function cityWarp(snap, layout, rail) {
  const { lines, town } = layout, rand = rng(snap.seed * 31 + 7), [a, b, c, d] = [0, 0, 0, 0].map(() => rand() * Math.PI * 2);
  const [x0, x1, z0, z1] = [lines[town[0]].c, lines[town[0] + 2].c, lines[town[1]].c, lines[town[1] + 2].c];
  const k1 = (2 * Math.PI) / 150, k2 = (2 * Math.PI) / 80, hub = lines[lines.length >> 1].c;
  const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
  // The shift at (x, z), written into out as [dx, dz] (no garbage: merge calls it for every vertex).
  return (x, z, out) => {
    // Two crossed waves, full strength from 50 m inside the old town's bounding streets; zero outside it.
    const old = smooth(Math.min(x - x0, x1 - x, z - z0, z1 - z) / 50) * smooth((Math.hypot(x - hub, z - hub) - 80) / 50);
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
  const signature = signatureTowers(snap), shops = storefrontTiles(snap), near = surroundings(snap, layout), detail = new Map(); // sector -> centre

  snap.tiles.forEach((t, i) => {
    const col = i % n, row = Math.floor(i / n);
    const atHub = Math.abs(col + 0.5 - n / 2) < HUB && Math.abs(row + 0.5 - n / 2) < HUB;
    if (atHub && t.k === 'park') return; // the tower's plaza, paved by streets.js; a snapshot from before it still draws
    const rand = rng(t.s), fw = footprint(t, rand);
    const sector = Math.floor(row / BLOCK) * (n / BLOCK) + Math.floor(col / BLOCK);
    // Each sector leans glass or concrete; about one building in four goes the other way.
    const concrete = ((sector * 7 + snap.seed) % 2 === 0) !== (rand() < 0.25);
    const family = t.k === 'house' && familyOf(t, near[i], !concrete);
    const g = { house: () => building(kit, t, rand, fw, family, col + 2 * row), build: () => construction(kit, t.f, rand, t.on, fw),
      market: () => market(kit, rand, t.on, fw), plant: () => powerPlant(kit), lot: () => plaza(kit, rand, t.on),
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
    if (shops.has(i)) {
      if (t.on) rand(); // what shopfronts would have drawn (its awning colour), so the rest of this tile is unchanged
      storefront(kit, lot, rng(t.s * 11 + 5), t.on, dx, dz);
    } else if (!['plant', 'lot', 'market'].includes(t.k)) shopfronts(kit, lot, t, rand, dx, dz); // a market is its own shop
    if (signature.has(i)) {
      spire(kit, g, t.f * F, fw, t.on);
      retrofit(kit, g, (k) => openAbove(snap, col, row, g.rotation.y, k), rng(t.s * 7 + 3)); // its own generator: other buildings keep theirs
    }
    let small = false; // small parts are drawn only near the camera, merged per sector (a storefront has its own)
    lot.traverse((o) => { if (o.name === 'detail') small = o.userData.lod = sector; });
    if (small !== false && !detail.has(sector)) detail.set(sector, [pos(Math.floor(col / BLOCK) * BLOCK + BLOCK / 2), pos(Math.floor(row / BLOCK) * BLOCK + BLOCK / 2)]);
    settle(lot, warp);
    // Skybridge to the east neighbour in the same sector when both are tall enough.
    const east = snap.tiles[i + 1];
    const linked = family === 'mega' && east?.f >= 16 ? 0.45 : 0.12; // megastructures link up more often
    if (t.k === 'house' && east?.k === 'house' && col % BLOCK !== BLOCK - 1 && Math.min(t.f, east.f) >= 12 && rand() < linked) {
      const y = Math.min(t.f, east.f) * F * (0.4 + rand() * 0.2), [a, b] = [cx, pos(col + 1)];
      part(root, box(b - a, 3.2, 3.6, 1), kit.windows(2, t.on && east.on), (a + b) / 2, y, cz);
      if (t.on) part(root, box(b - a, 0.12, 0.12, 1), kit.glow(palette.neonCyan, 2), (a + b) / 2, y - 1.7, cz + 1.8);
    }
  });
  for (const bridge of bridgePairs(snap, layout, signature)) root.add(skybridge(kit, snap, pos, bridge));
  const rail = railway(kit, root, rails, streets.hi);
  detail.set('tower', [streets.hub.c, streets.hub.c]); // the tower's small parts (landmarks.js)
  const city = mergeByMaterial(root, warp);
  const details = city.userData.lods.map((g) => ({ group: g, at: detail.get(g.userData.lod) }));
  return { city, details, warp, rail, hub: streets.hub, lanes: streets.lanes, lines: streets.lines, edge: streets.hi };
}

// What is around each tile that never changes, for the building family rules (families.js familyOf): industry
// (the old works or the railway within 2 tiles), a park within 3, the centre within 8 or 14 tiles, and whether it
// is in the old town.
function surroundings({ size: n, tiles }, { inTown }) {
  const c = n / 2;
  const any = (i, r, test) => {
    const [x, y] = [i % n, Math.floor(i / n)];
    for (let v = Math.max(0, y - r); v <= Math.min(n - 1, y + r); v++) {
      for (let u = Math.max(0, x - r); u <= Math.min(n - 1, x + r); u++) if (test(tiles[v * n + u])) return true;
    }
    return false;
  };
  return tiles.map((t, i) => {
    const [x, y] = [i % n, Math.floor(i / n)], ring = Math.max(Math.abs(x + 0.5 - c), Math.abs(y + 0.5 - c));
    return { oldTown: inTown(x, y), centre: ring <= 8, inner: ring <= 14,
      industry: any(i, 2, (o) => o.k === 'works' || o.k === 'rail'), park: any(i, 3, (o) => o.k === 'park') };
  });
}

// Signature towers: the tallest, then the next tallest at least 12 tiles from those picked, up to three (ties to
// the first in row order), so they mark different parts of the skyline. Returns their tile indices.
function signatureTowers({ size: n, tiles }) {
  const picked = new Set();
  const far = (i, j) => Math.max(Math.abs((i % n) - (j % n)), Math.abs(Math.floor(i / n) - Math.floor(j / n))) >= 12;
  const tall = tiles.flatMap((t, i) => (t.k === 'house' && t.f >= TALL ? [i] : []));
  for (const i of tall.sort((a, b) => tiles[b].f - tiles[a].f || a - b)) {
    if (picked.size === 3) break;
    if ([...picked].every((j) => far(i, j))) picked.add(i);
  }
  return picked;
}

// Storefront tiles: the buildings on the corners where the boulevard (through the centre) meets the next full
// street toward the opening view, or the one the other way if that crossing has fewer than three. Up to three.
function storefrontTiles({ size: n, tiles }) {
  const mid = n / BLOCK / 2;
  for (const k of [mid + 2, mid - 2]) {
    const corners = [mid * BLOCK - 1, mid * BLOCK].flatMap((col) => [k * BLOCK - 1, k * BLOCK].map((row) => row * n + col));
    const houses = corners.filter((i) => tiles[i]?.k === 'house');
    if (houses.length >= 3) return new Set(houses.slice(0, 3));
  }
  return new Set();
}

// Two skybridges over main streets (skybridge below): the pairs of towers facing each other across one with the
// most floors between them, both 16 floors or more, outside the old town (its streets bend) and not signature
// towers (their machinery faces the streets), the second at least 16 tiles from the first. Each is
// { a, b, axis }: tile a on the low side, b across the street, the bridge running along axis.
function bridgePairs({ size: n, tiles }, { inTown }, signature) {
  const ok = (i) => tiles[i].k === 'house' && tiles[i].f >= 16 && !signature.has(i) && !inTown(i % n, Math.floor(i / n));
  const pairs = [];
  for (let k = 1; k < n / BLOCK; k++) {
    for (let r = 0; r < n; r++) {
      const [c, d] = [k * BLOCK - 1, k * BLOCK];
      for (const [axis, a, b] of [['x', r * n + c, r * n + d], ['z', c * n + r, d * n + r]]) {
        if (ok(a) && ok(b)) pairs.push({ a, b, axis, f: Math.min(tiles[a].f, tiles[b].f) });
      }
    }
  }
  const at = (i) => [i % n, Math.floor(i / n)], picked = [];
  for (const p of pairs.sort((p, q) => q.f - p.f || p.a - q.a)) {
    if (picked.length === 2) break;
    if (picked.every((q) => Math.max(...at(p.a).map((v, j) => Math.abs(v - at(q.a)[j]))) >= 16)) picked.push(p);
  }
  return picked;
}

// An enclosed corridor from tower a to tower b over the street between them, from the Blender modules
// (tools/blender/skybridge.py): an end portal at each tower's face (perimeter towers stand up to their street,
// 6.5 m from their tile's centre), then 4 m bays, every third with a small window, stretched to fit. Its floor is a
// floor of both towers, about 40% of the lower one's height. Lit inside unless either tower is blacked out.
function skybridge(kit, { size: n, tiles }, pos, { a, b, axis, f }) {
  const lit = tiles[a].on && tiles[b].on, dark = kit.steel(palette.charcoal, 0.6);
  const roles = {
    graphite: kit.steel(palette.graphite, 0.6), steel: kit.steel(palette.gunmetal, 0.6), olive: kit.steel(palette.oliveGrey, 0.6),
    titanium: kit.steel(palette.weatheredTitanium, 0.6), hazard: kit.steel(palette.hazardPaint, 0.7), dark,
    sheet: kit.mat('box_profile_metal_sheet', palette.gunmetal), interior: lit ? kit.glow(palette.warmWindow, 0.5) : dark,
    lamp: lit ? kit.glow(palette.dirtyAmber, 1.2) : dark, glow_amber: lit ? kit.glow(palette.agedAmber, 1) : dark,
  };
  const along = (i) => pos(axis === 'x' ? i % n : Math.floor(i / n)), across = pos(axis === 'x' ? Math.floor(a / n) : a % n);
  const [u0, u1] = [along(a) + (TILE - 1) / 2, along(b) - (TILE - 1) / 2], g = new THREE.Group();
  const piece = (name, u, turn = 0, stretch = 1) => {
    const m = kit.foldDetail(kit.model(name, roles), [dark]);
    m.position.x = u;
    m.rotation.y = turn;
    m.scale.x = stretch;
    g.add(m);
  };
  piece('skybridge_end', u0);
  piece('skybridge_end', u1, Math.PI);
  const span = u1 - u0 - 2.1, bays = Math.max(1, Math.round(span / 4)), bay = span / bays; // between the portals' rings
  for (let k = 0; k < bays; k++) piece(k % 3 === 1 ? 'skybridge_window' : 'skybridge_bay', u0 + 1.05 + (k + 0.5) * bay, 0, bay / 4);
  g.position.set(axis === 'x' ? 0 : across, 0.18 + Math.round(f * 0.4) * F, axis === 'x' ? across : 0);
  g.rotation.y = axis === 'x' ? 0 : -Math.PI / 2; // the span along x, or turned to run along z
  g.userData.rigid = true;
  return g;
}

// How high (m) the building next to face k (+x, +z, -x, -z, before the building's turn by `turn`) of the tile at
// col, row stands: 0 where that face looks onto a main street or off the map, else the neighbour's roof.
function openAbove({ size: n, tiles }, col, row, turn, k) {
  const [lx, lz] = [[1, 0], [0, 1], [-1, 0], [0, -1]][k];
  const dx = Math.round(lx * Math.cos(turn) + lz * Math.sin(turn)), dz = Math.round(lz * Math.cos(turn) - lx * Math.sin(turn));
  const street = (i, d) => (d > 0 ? i % BLOCK === BLOCK - 1 : d < 0 && i % BLOCK === 0);
  if (street(col, dx) || street(row, dz)) return 0;
  const [u, v] = [col + dx, row + dz];
  return u < 0 || v < 0 || u >= n || v >= n ? 0 : (tiles[v * n + u].f ?? 0) * F;
}

// Which side of its quarter-block a tile row or column faces: -1 or 1 on the edge, 0 inside.
const frontage = (i) => (i % HALF === 0 ? -1 : i % HALF === HALF - 1 ? 1 : 0);

// A one-storey strip of shops along each street side of the lot, the full lot wide, so neighbouring strips join
// into a street wall even where the buildings above are narrow. Each side is one of the Blender strips
// (tools/blender/shop_strips.py: shutter stalls, a food counter, a framed glass front, an arcade) or, one time in
// five, the plain lit strip with its awning light. Construction sites get a site hoarding instead.
const STRIPS = ['stalls', 'counter', 'frame', 'arcade'];
function shopfronts(kit, root, t, rand, dx, dz) {
  const site = t.k === 'build', [h, d] = site ? [2.4, 0.3] : [4.5, 3];
  const wall = site ? kit.steel(palette.gunmetal, 0.8) : kit.windows(3, t.on, true, 'shop');
  const awning = t.on && !site && kit.glow(pick(rand, WARM), 1.2);
  const at = TILE / 2 - 0.3 - d / 2, own = rng(t.s * 17 + 9); // its own generator: the tile's other choices stay
  // x-facing strips are a hair lower than z-facing ones so their roofs never fight at the corner.
  for (const [axis, s] of [['x', dx], ['z', dz]]) {
    if (!s) continue;
    const kind = !site && own() >= 0.2 && pick(own, STRIPS);
    if (kind) {
      root.add(strip(kit, kind, t.on, own, axis, s, at + d / 2));
      continue;
    }
    const tall = axis === 'z' ? 0.1 : 0;
    if (axis === 'x') part(root, box(d, h, TILE, 0), wall, s * at, 0.18 + h / 2, 0);
    else part(root, box(TILE, h + tall, d, 0), wall, 0, 0.18 + (h + tall) / 2, s * at);
    if (!awning) continue;
    if (axis === 'x') part(root, box(0.15, 0.15, TILE - 1, 0), awning, s * (at + d / 2 + 0.1), h - 0.4, 0);
    else part(root, box(TILE - 1, 0.15, 0.15, 0), awning, 0, h - 0.4, s * (at + d / 2 + 0.1));
  }
}

// One Blender shop strip with its front (the model's +z) on the street side s of axis, `front` metres out.
function strip(kit, kind, lit, rand, axis, s, front) {
  const dark = kit.steel(palette.charcoal, 0.6), off = (m) => (lit ? m : dark);
  const g = kit.model(`shop_${kind}`, {
    graphite: kit.steel(palette.graphite, 0.6), steel: kit.steel(palette.gunmetal, 0.6), olive: kit.steel(palette.oliveGrey, 0.6),
    titanium: kit.steel(palette.weatheredTitanium, 0.6), hazard: kit.steel(palette.hazardPaint, 0.7), dark,
    sheet: kit.mat('box_profile_metal_sheet', palette.gunmetal), shopwall: kit.windows(pick(rand, [3, 3, 6]), lit, true, 'shop'),
    lamp: off(kit.glow(palette.dirtyAmber, 1.2)), glow_amber: off(kit.glow(palette.agedAmber, 1)),
    glow_cyan: off(kit.glow(palette.coldCyan, 0.8)), sign: off(kit.sign(pick(rand, WORDS), pick(rand, WARM))),
  });
  g.rotation.y = axis === 'x' ? (s * Math.PI) / 2 : s > 0 ? 0 : Math.PI;
  g.position.set(axis === 'x' ? s * front : 0, 0.18, axis === 'x' ? 0 : s * front);
  if (axis === 'z') g.scale.y = 1.02; // as the plain strips: z-facing roofs a hair higher, so corners never fight
  return kit.foldDetail(g, [dark]);
}

// Footprint width from the style seed: low-rises are small, towers fill most of their lot.
function footprint(t, rand) {
  if (!['build', 'house', 'market'].includes(t.k)) return 12;
  const [lo, hi] = t.k === 'market' ? [9, 11] : t.f < 6 ? [7.5, 10.5] : t.f < TALL ? [9.5, 12.5] : [11, 12.5];
  return lo + rand() * (hi - lo);
}
