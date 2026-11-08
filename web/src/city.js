// The whole city from a snapshot: streets, then one building per tile, then one merged mesh per material.
import * as THREE from 'three';
import { palette } from './palette.js';
import { box, outward, part, rng } from './geometry.js';
import { powerPlant } from './plant.js';
import { construction, market, plaza, storefront } from './tiles.js';
import { building, familyOf } from './families.js';
import { mergeByMaterial } from './merge.js';
import { LOOK_STEP, lightingIdentity } from './facade.js';
import { buildStreets } from './streets.js';
import { exoframe, flagship, retrofit, roofworks } from './landmarks.js';
import { park, railGround, railLine, railway, works } from './terrain.js';
import { warningLamp } from './parts.js';
import { buildHQ, hqSite } from './headquarters.js';
import { ALLEY, BLOCK, F, HALF, HUB, STREETS, TALL, TERRAIN, TILE, WARM, WORDS, BRANDS, CORPS, MESSAGES, pick } from './world.js';

// Tile centres in metres, before the district warp (cityWarp). Main streets run between sectors; an alley splits
// every sector in half both ways. lines: every main street, k = 0 and the last being the ring road: its centre c,
// width w, and kind per axis (kind.x runs along x at z = c, kind.z along z at x = c). The same lines serve both axes.
export function cityLayout(snap) {
  const n = snap.size, sectors = n / BLOCK, mid = sectors / 2, rand = rng(snap.seed * 13 + 5);
  // A boulevard through the middle (it meets the highways), then narrow and full streets alternating out to the
  // ring road. Widths mirror around the centre so the boulevard sits at 0; whether a narrow one carries traffic
  // or is a pedestrian walk is picked per axis from the seed.
  const kinds = Array.from({ length: sectors + 1 }, (_, k) => {
    if (k === 0 || k === sectors) return { x: 'local', z: 'local' }; // the ring road: quiet, with parking bays
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
  const lines = kinds.map((kind, k) => ({ kind, w: widths[k], side: STREETS[kind.x].side, // both axes' sidewalks match too
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
  const signature = signatureTowers(snap), heavy = heavyTowers(snap, layout, signature), shops = storefrontTiles(snap), towers = new Map(), near = surroundings(snap, layout), detail = new Map(); // sector -> centre

  let flag = flagshipTower(snap, layout, signature, heavy); // -1 if none, or if it has no shaft to dress
  // The headquarters (headquarters.js): its 24 tiles are drawn as one campus, and nothing else lands on them.
  const hq = hqSite(snap, layout, new Set(crossing(snap).corners)), hqTiles = hq?.tiles ?? new Set();
  for (const i of hqTiles) {
    signature.delete(i);
    heavy.delete(i);
  }
  if (hqTiles.has(flag)) flag = -1;
  snap.tiles.forEach((t, i) => {
    const col = i % n, row = Math.floor(i / n);
    if (hqTiles.has(i)) return; // drawn as the headquarters, below
    const atHub = Math.abs(col + 0.5 - n / 2) < HUB && Math.abs(row + 0.5 - n / 2) < HUB;
    if (atHub && t.k === 'park') return; // the tower's plaza, paved by streets.js; a snapshot from before it still draws
    const rand = rng(t.s), fw = footprint(t, rand);
    const sector = Math.floor(row / BLOCK) * (n / BLOCK) + Math.floor(col / BLOCK);
    // Each sector leans glass or concrete; about one building in four goes the other way.
    const concrete = ((sector * 7 + snap.seed) % 2 === 0) !== (rand() < 0.25);
    const family = t.k === 'house' && familyOf(t, near[i], !concrete);
    const g = { house: () => building(kit, t, rand, fw, family, col + 2 * row, signature.has(i)), build: () => construction(kit, t.f, rand, t.on, fw),
      market: () => market(kit, rand, t.on, fw), plant: () => powerPlant(kit), lot: () => plaza(kit, rand, t.on),
      rail: () => railGround(kit), park: () => park(kit, rand, t.on), works: () => works(kit, rand, t.on) }[t.k]();
    // Perimeter blocks: lots on a street or alley push their building up to it, so streets get a continuous wall
    // and each quarter-block keeps a courtyard behind; inner lots sit anywhere on theirs.
    const [cx, cz] = [pos(col), pos(row)], slack = TILE - 1 - fw;
    const [dx, dz] = [frontage(col), frontage(row)], lot = new THREE.Group();
    lot.position.set(cx, 0, cz);
    // Its windows' light tones (facade.js): the tile, plus the building's lighting identity; 0 is anything outside a lot.
    lot.userData.building = i + 1 + LOOK_STEP * lightingIdentity(t, family, col, row, snap.seed, signature.has(i));
    lot.add(g);
    root.add(lot);
    if (t.k === 'house') towers.set(i, g); // for the skybridges over streets, which meet their walls
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
      retrofit(kit, g, (k) => openAbove(snap, col, row, g.rotation.y, k), rng(t.s * 7 + 3)); // its own generator: other buildings keep theirs
    }
    if (heavy.has(i)) { // the same retrofit, held in an exoskeleton, with plant on the roof
      const clear = (k) => openAbove(snap, col, row, g.rotation.y, k), own = rng(t.s * 7 + 3), used = retrofit(kit, g, clear, own);
      if (used) {
        exoframe(g, clear, own, used);
        roofworks(kit, g, own);
      } else heavy.delete(i); // no shaft to dress: it stays as it was, sign and all
    }
    if (i === flag) { // the flagship: its showcase face is the one that looks most toward the centre
      const turn = g.rotation.y, clear = (k) => openAbove(snap, col, row, turn, k);
      const toward = (k) => { // face k's outward direction in the world, against the way to the centre
        const [x, z] = [[1, 0], [0, 1], [-1, 0], [0, -1]][k];
        return -(x * Math.cos(turn) + z * Math.sin(turn)) * cx - (z * Math.cos(turn) - x * Math.sin(turn)) * cz;
      };
      if (!flagship(kit, g, clear, toward, rng(t.s * 13 + 7), t.on, CORPS[0])) flag = -1;
    }
    let small = false; // small parts are drawn only near the camera, merged per sector (a storefront has its own)
    lot.traverse((o) => { if (o.name === 'detail') small = o.userData.lod = sector; });
    if (small !== false && !detail.has(sector)) detail.set(sector, [pos(Math.floor(col / BLOCK) * BLOCK + BLOCK / 2), pos(Math.floor(row / BLOCK) * BLOCK + BLOCK / 2)]);
    settle(lot, warp);
    // Skybridge to the east neighbour in the same sector when both are tall enough.
    const east = snap.tiles[i + 1];
    const linked = family === 'mega' && east?.f >= 16 ? 0.45 : 0.12; // megastructures link up more often
    if (t.k === 'house' && east?.k === 'house' && !hqTiles.has(i + 1) && col % BLOCK !== BLOCK - 1 && Math.min(t.f, east.f) >= 12 && rand() < linked) {
      const y = Math.min(t.f, east.f) * F * (0.4 + rand() * 0.2), [a, b] = [cx, pos(col + 1)];
      part(root, box(b - a, 3.2, 3.6, 1), kit.windows(2, t.on && east.on), (a + b) / 2, y, cz);
      if (t.on) part(root, box(b - a, 0.12, 0.12, 1), kit.glow(palette.neonCyan, 2), (a + b) / 2, y - 1.7, cz + 1.8);
      if (t.on) for (const x of [a + 6.5, b - 6.5]) warningLamp(kit, root, x, y - 1.7, cz - 1.85); // clearance lamps
    }
  });
  const bridges = bridgePairs(snap, layout, new Set([...signature, ...heavy, flag, ...hqTiles]), towers); // their machinery faces the streets
  for (const bridge of bridges) root.add(skybridge(kit, snap, bridge));
  billboards(kit, root, snap, towers);
  const askew = [...towers.keys()].filter((i) => inTown(i % n, Math.floor(i / n))); // turned a little: signs would not sit flush
  corpSigns(kit, root, snap, towers, new Set([...signature, ...heavy, flag, ...hqTiles, ...crossing(snap).houses, ...bridges.flatMap((b) => [b.a, b.b]), ...askew]));
  streetProps(kit, root, snap, layout, streets.lamps);
  const rail = railway(kit, root, rails, streets.hi);
  if (hq) { // a lot of its own, settled like any other; its windows corporate blue (lighting identity 1)
    const lot = new THREE.Group(), ref = [...hq.tiles].find((i) => snap.tiles[i].k === 'house') ?? [...hq.tiles][0], tower = buildHQ(kit, hq, snap.tiles[ref].on !== false);
    lot.position.set(hq.x, 0, hq.z);
    lot.userData.building = ref + 1 + LOOK_STEP;
    tower.position.y = 0.18;
    tower.rotation.y = hq.heading;
    lot.add(tower);
    root.add(lot);
    lot.traverse((o) => { if (o.name === 'detail') o.userData.lod = hq.sector; });
    if (!detail.has(hq.sector)) detail.set(hq.sector, [hq.x, hq.z]);
    settle(lot, warp);
  }
  detail.set('tower', [streets.hub.c, streets.hub.c]); // the tower's small parts (landmarks.js)
  const city = mergeByMaterial(root, warp);
  // Depth first: the facades are drawn once more, before everything, writing only depth (nudged back a hair so
  // the real pass still meets it), so the facade shader and every part behind a wall only run where they show.
  // Merged batches cannot be sorted front to back, and walls hid each other after paying for the shader.
  const depth = new THREE.MeshBasicMaterial({ colorWrite: false, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
  for (const m of [...city.children]) if (m.material.userData.facade) {
    const first = new THREE.Mesh(m.geometry, depth);
    first.renderOrder = -1;
    city.add(first);
  }
  const details = city.userData.lods.map((g) => ({ group: g, at: detail.get(g.userData.lod) }));
  return { city, details, warp, rail, hub: streets.hub, lanes: streets.lanes, parked: streets.parked, lines: streets.lines, edge: streets.hi,
    benches: streets.benches, lamps: streets.lamps, food: streets.food, hq: hq && { x: hq.x, z: hq.z, heading: hq.heading, sector: hq.sector, street: hq.street } };
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

// Heavy towers: up to five buildings on a main street (a lot on a sector's edge), 16 floors or more, outside the
// old town (askew) and off the busiest crossing (its billboards), each at least 10 tiles from the others and from
// the signature towers, so they spread along the streets. The most prominent first: the most wall standing clear
// of the neighbouring roofs, summed over the four sides, so their add-ons have room and show from the air. They get
// the signature towers' industrial retrofit plus an exoskeleton and rooftop plant (landmarks.js), and no corporate
// sign or skybridge.
function heavyTowers(snap, { inTown }, signature) {
  const { size: n, tiles } = snap, at = (i) => [i % n, Math.floor(i / n)], picked = new Set(), corner = new Set(crossing(snap).houses);
  const far = (i, j) => Math.max(Math.abs(at(i)[0] - at(j)[0]), Math.abs(at(i)[1] - at(j)[1])) >= 10;
  const main = (i) => at(i).some((v) => v % BLOCK === 0 || v % BLOCK === BLOCK - 1);
  const ok = (t, i) => t.k === 'house' && t.f >= 16 && main(i) && !signature.has(i) && !corner.has(i) && !inTown(...at(i));
  const clear = (i) => [0, 1, 2, 3].reduce((sum, k) => sum + Math.max(0, tiles[i].f * F - openAbove(snap, ...at(i), 0, k)), 0);
  const score = new Map(tiles.flatMap((t, i) => (ok(t, i) ? [[i, clear(i)]] : [])));
  for (const i of [...score.keys()].sort((a, b) => score.get(b) - score.get(a) || a - b)) {
    if (picked.size === 5) break;
    if ([...picked, ...signature].every((j) => far(i, j))) picked.add(i);
  }
  return picked;
}

// The flagship tower (landmarks.js flagship): the tallest building of 16 floors or more on a main street within 3
// tiles of the centre (where the boulevards meet at the plaza), ties to the first in row order, that is no
// signature or heavy tower, not on the busiest crossing and outside the old town. Its tile index, or -1.
function flagshipTower(snap, { inTown }, signature, heavy) {
  const { size: n, tiles } = snap, c = n / 2, corner = new Set(crossing(snap).houses);
  let best = -1;
  tiles.forEach((t, i) => {
    const [col, row] = [i % n, Math.floor(i / n)];
    if (t.k !== 'house' || t.f < 16 || signature.has(i) || heavy.has(i) || corner.has(i) || inTown(col, row)) return;
    if (Math.max(Math.abs(col + 0.5 - c), Math.abs(row + 0.5 - c)) > 3 || ![col, row].some((v) => v % BLOCK === 0 || v % BLOCK === BLOCK - 1)) return;
    if (best < 0 || t.f > tiles[best].f) best = i;
  });
  return best;
}

// Storefront tiles: the buildings on the corners where the boulevard (through the centre) meets the next full
// street toward the opening view, or the one the other way if that crossing has fewer than three. Up to three.
function storefrontTiles(snap) {
  return new Set(crossing(snap).houses.slice(0, 3));
}

// The busiest crossing: where the boulevard meets the next full street toward the opening view, or the one the
// other way if that has fewer than three corner buildings. { corners, houses }: its four corner tiles and those of
// them that are buildings (tile indices, row order). Its storefronts, billboards and street props are here.
export function crossing({ size: n, tiles }) {
  const mid = n / BLOCK / 2;
  for (const k of [mid + 2, mid - 2]) {
    const corners = [mid * BLOCK - 1, mid * BLOCK].flatMap((col) => [k * BLOCK - 1, k * BLOCK].map((row) => row * n + col));
    const houses = corners.filter((i) => tiles[i]?.k === 'house');
    if (houses.length >= 3) return { corners, houses };
  }
  return { corners: [], houses: [] };
}

// The street-prop kit (tools/blender/street_props.py) on the busiest crossing's four corner sidewalks, three a
// corner. Each corner has a traffic sign or a camera pole by its kerb, set back from the crosswalk, and two of a
// vending machine, a delivery locker, an electrical cabinet and a utility pedestal along its sidewalks. They stand
// in a strip along the kerb, the walkway clear behind them, each one sliding along its sidewalk to clear a lamp.
// Machines face the walkway; signs face the traffic coming to the crossing; cameras look across it.
const PROPS = { vending: 0.8, sign: 0.3, cabinet: 0.5, camera: 0.3, locker: 0.7, utility: 0.6 }; // depth (m)
const CORNERS = [[['a', 3.8, 'sign'], ['a', 9, 'vending'], ['b', 10, 'cabinet']], [['b', 3.8, 'camera'], ['a', 10, 'locker'], ['b', 16, 'utility']],
  [['a', 3.8, 'sign'], ['b', 9, 'vending'], ['a', 15, 'cabinet']], [['b', 3.8, 'camera'], ['b', 10, 'locker'], ['a', 9, 'utility']]];
function streetProps(kit, root, snap, { pos, n, lines }, lamps) {
  // shortcut: one sidewalk width for both streets; true while the boulevard and main streets share STREETS side.
  const { tiles } = snap, kerb = TILE / 2 + lines[lines.length >> 1].side, rand = rng(snap.seed * 43 + 1);
  crossing(snap).corners.forEach((i, k) => {
    const [col, row] = [i % n, Math.floor(i / n)], [dx, dz] = [frontage(col), frontage(row)], [cx, cz] = [pos(col), pos(row)];
    const lit = tiles[i].on !== false, base = kit.industrial(lit);
    for (const [side, from, kind] of CORNERS[k]) {
      // Side a runs along the boulevard (along z), b along the cross street (along x); `from` the corner's kerb.
      const back = kerb - 0.5 - PROPS[kind] / 2; // its centre, in from the kerb
      const at = (d) => (side === 'a' ? [cx + dx * back, cz + dz * (kerb - d)] : [cx + dx * (kerb - d), cz + dz * back]);
      let d = from;
      while (lamps.some(([x, z]) => Math.hypot(x - at(d)[0], z - at(d)[1]) < 2.2)) d += 1.5;
      const [x, z] = at(d), out = side === 'a' ? [dx, 0] : [0, dz]; // toward the street
      const face = kind === 'sign' ? (side === 'a' ? [0, -dz] : [-dx, 0]) // the traffic coming in
        : kind === 'camera' ? [dx, dz] : [-out[0], -out[1]]; // across the crossing; else the walkway
      const message = pick(rand, MESSAGES); // every prop draws one, so the signs' messages stay put
      const g = kit.foldDetail(kit.model(`prop_${kind}`, { ...base, panel: lit ? kit.message(message) : base.dark }), [base.dark]);
      g.rotation.y = Math.atan2(face[0], face[1]); // its front (+z) toward face
      g.position.set(x, 0.18, z); // on the raised sidewalk
      root.add(g);
    }
  });
}

// Tower g's wall toward dir (+1 or -1) along axis between heights y0 and y1, measured from its parts: the
// frontmost one at least `wide` m across and 2 m deep that covers those heights (so signs and balconies don't
// count), as { front, lo, hi }: where its face is along axis, and its extent across. null if none.
const bounds = new THREE.Box3();
function wallOf(g, axis, dir, y0, y1, wide) {
  const side = axis === 'x' ? 'z' : 'x';
  let best = null;
  g.updateWorldMatrix(true, true);
  g.traverse((o) => {
    if (!o.isMesh) return;
    bounds.setFromObject(o);
    if (bounds.min.y > y0 + 0.2 || bounds.max.y < y1 || bounds.max[side] - bounds.min[side] < wide || bounds.max[axis] - bounds.min[axis] < 2) return;
    const front = dir > 0 ? bounds.max[axis] : bounds.min[axis];
    if (!best || (front - best.front) * dir > 0) best = { front, lo: bounds.min[side], hi: bounds.max[side] };
  });
  return best;
}

// Billboards (tools/blender/billboards.py) on the corner towers of the busiest crossing, facing its streets: the
// tallest gets a tower sign on its boulevard side and a blade on the other, the next a wide board, the next a
// tower sign, the last a blade, each near the corner and only where the wall there is big enough. Each carries an
// ad for an invented brand (BRANDS): its product drawn on the display. Dark in a blackout.
// w and h: each one's size over its frame; need: the wall it needs across (its display and brackets); y: where it
// hangs (its model's origin), low: how far below that it reaches (the tower sign's service platform).
const BOARDS = { tower: { w: 5.2, h: 12.7, need: 4, y: 9, low: 1.6 }, wide: { w: 7.4, h: 5.8, need: 6.6, y: 9, low: 0.1 },
  blade: { w: 1.2, h: 7.3, need: 1.5, y: 10, low: 0.15 } };
const PIXELS = { tower: [256, 1024], wide: [384, 448], blade: [256, 1280] }; // each display's shape, for its poster
function billboards(kit, root, snap, towers) {
  const { size: n, tiles } = snap, rand = rng(snap.seed * 41 + 3), brands = [...BRANDS];
  const corners = crossing(snap).houses.filter((i) => towers.has(i)).sort((a, b) => tiles[b].f - tiles[a].f || a - b);
  const used = new Set(); // tile and face, so a board that moves to a tower's other face never lands on another
  for (const [k, planned, kind] of [[0, 'x', 'tower'], [0, 'z', 'blade'], [1, 'z', 'wide'], [2, 'z', 'tower'], [3, 'x', 'blade']]) {
    const { w, h, need, y, low } = BOARDS[kind];
    // Its planned tower and face, else that tower's other street face, else the other corner towers' free faces:
    // the first wall there big enough for it.
    const tries = [...new Set([corners[k], ...corners])].filter((i) => i !== undefined)
      .flatMap((i) => [planned, planned === 'x' ? 'z' : 'x'].map((axis) => [i, axis]));
    const [i, axis, dir, wall] = tries.map(([i, axis]) => {
      const dir = frontage(axis === 'x' ? i % n : Math.floor(i / n));
      const wall = dir && !used.has(i + axis) && wallOf(towers.get(i), axis, dir, y - low, y + h, need);
      return [i, axis, dir, wall];
    }).find(([, , , wall]) => wall) ?? [];
    if (!wall) continue;
    used.add(i + axis);
    const [col, row] = [i % n, Math.floor(i / n)], toward = frontage(axis === 'x' ? row : col); // which end of the wall is at the corner
    const across = wall.hi - wall.lo < w + 1 ? (wall.lo + wall.hi) / 2 : toward > 0 ? wall.hi - w / 2 - 0.6 : wall.lo + w / 2 + 0.6;
    const base = kit.industrial(tiles[i].on), ad = (b) => (tiles[i].on ? kit.poster(...b, ...PIXELS[kind]) : base.dark);
    const draw = () => brands.splice(Math.floor(rand() * brands.length), 1)[0] ?? BRANDS[0]; // each brand once
    const first = draw(), second = kind === 'wide' ? draw() : first;
    const g = kit.foldDetail(kit.model(`billboard_${kind}`, { ...base, ad: ad(first), ad2: ad(second) }), [base.dark]);
    g.rotation.y = outward(axis, dir); // its display out to the street
    g.position.set(axis === 'x' ? wall.front : across, y, axis === 'x' ? across : wall.front);
    g.userData.rigid = true;
    root.add(g);
  }
}

// Large corporate signs (tools/blender/corp_signs.py) on prominent towers: the tallest of 14+ floors, at least
// SPREAD tiles apart, never on a tower in `skip` (the billboard crossing, signature towers, skybridge ends, the old
// town), and in place of the tower's own banner or wall projection (tiles.js dress). Each
// gets a crown on the roof line, a pylon high on a street wall or a band across one lower down (stepped by tower,
// so they sit at different heights and neighbours differ), else the next kind that fits its measured wall. Each carries an invented corporation (CORPS): its
// deep red mark and cold-white name, and a muted amber info display. Dark in a blackout.
// w: the wall it needs across; low and high: how far below and above its origin it reaches; face and info: each
// display's pixels.
const SIGNS = {
  crown: { w: 8.6, low: 4, high: 0, face: [512, 256], info: [448, 80] },
  pylon: { w: 5.4, low: 0, high: 18, face: [256, 1024], info: [272, 120] },
  band: { w: 9.4, low: 2, high: 4.6, face: [768, 224], info: [432, 64] },
};
const SPREAD = 6, COUNT = 16, ORDER = ['crown', 'pylon', 'band'];
function corpSigns(kit, root, { size: n, tiles }, towers, skip) {
  const picked = [];
  const ids = [...towers.keys()].filter((i) => tiles[i].f >= 14 && !skip.has(i)).sort((a, b) => tiles[b].f - tiles[a].f || a - b);
  for (const i of ids) {
    if (picked.length >= COUNT) break;
    const [col, row] = [i % n, Math.floor(i / n)];
    if (picked.some((j) => Math.max(Math.abs((j % n) - col), Math.abs(Math.floor(j / n) - row)) < SPREAD)) continue;
    const H = tiles[i].f * F + 0.18; // its roof line
    let hit = null;
    for (let k = 0; k < ORDER.length && !hit; k++) {
      const kind = ORDER[(col + 2 * row + k) % ORDER.length], s = SIGNS[kind];
      const y = kind === 'crown' ? H : kind === 'pylon' ? Math.max(8, H * 0.55 - 9) : Math.max(10, H * 0.3);
      for (const axis of ['x', 'z']) {
        const dir = frontage(axis === 'x' ? col : row);
        const wall = dir && wallOf(towers.get(i), axis, dir, y - s.low, kind === 'crown' ? H - 0.6 : y + s.high, s.w);
        if (wall) { hit = [kind, s, y, axis, dir, wall]; break; }
      }
    }
    if (!hit) continue;
    const banners = [];
    towers.get(i).traverse((o) => { if (o.name === 'banner') banners.push(o); });
    for (const o of banners) o.removeFromParent();
    const [kind, s, y, axis, dir, wall] = hit, on = tiles[i].on, [name, line, mark, lines] = CORPS[picked.length % CORPS.length];
    const base = kit.industrial(on), across = (wall.lo + wall.hi) / 2;
    const g = kit.foldDetail(kit.model(`corp_${kind}`, { ...base, panel: kit.mat('rusty_painted_metal', palette.gunmetal),
      face: on ? kit.corp(name, line, mark, ...s.face) : base.dark, info: on ? kit.display(lines, ...s.info) : base.dark }), [base.dark]);
    g.rotation.y = outward(axis, dir); // its displays out to the street
    g.position.set(axis === 'x' ? wall.front : across, y, axis === 'x' ? across : wall.front);
    g.userData.rigid = true;
    root.add(g);
    picked.push(i);
  }
}

// Two skybridges over main streets (skybridge below): the pairs of towers facing each other across one with the
// most floors between them, both 16 floors or more, outside the old town (its streets bend) and not signature
// towers (their machinery faces the streets), whose walls a corridor can meet (meet), the second at least 16 tiles
// from the first. Each is { a, b, axis, y, u0, u1, across }: tile a on the low side, b across the street, the
// bridge running along axis at floor height y from a's wall at u0 to b's at u1, centred on `across`.
function bridgePairs({ size: n, tiles }, { inTown, pos }, signature, towers) {
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
    if (!picked.every((q) => Math.max(...at(p.a).map((v, j) => Math.abs(v - at(q.a)[j]))) >= 16)) continue;
    const along = (i) => pos(p.axis === 'x' ? i % n : Math.floor(i / n)), fit = meet(towers, p, along);
    if (fit) picked.push({ ...p, ...fit });
  }
  return picked;
}

// Where a corridor between towers a and b meets both: at the floor about 40% of the lower one's height, each
// tower's wall toward the street there, measured from its parts (anything at least 4.6 m wide and 2 m deep that
// covers the corridor's height, so signs and balconies don't count), set back at most 4 m from its lot's street
// edge, and the two walls overlapping by the corridor's width or more. null if they don't.
function meet(towers, { a, b, axis, f }, along) {
  const y = 0.18 + Math.round(f * 0.4) * F;
  const wall = (i, dir) => {
    const best = wallOf(towers.get(i), axis, dir, y, y + 3.2, 4.6);
    return best && (along(i) + dir * (TILE - 1) / 2 - best.front) * dir <= 4 ? best : null;
  };
  const [wa, wb] = [wall(a, 1), wall(b, -1)];
  if (!wa || !wb) return null;
  const [lo, hi] = [Math.max(wa.lo, wb.lo), Math.min(wa.hi, wb.hi)];
  return hi - lo >= 4.6 ? { y, u0: wa.front, u1: wb.front, across: (lo + hi) / 2 } : null;
}

// An enclosed corridor from tower a to tower b over the street between them, from the Blender modules
// (tools/blender/skybridge.py): an end portal at each tower's wall (meet), then 4 m bays, every third with a
// small window, stretched to fit. Lit inside unless either tower is blacked out.
function skybridge(kit, { tiles }, { a, b, axis, y, u0, u1, across }) {
  const roles = kit.industrial(tiles[a].on && tiles[b].on), { dark } = roles;
  const g = new THREE.Group();
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
  g.position.set(axis === 'x' ? 0 : across, y, axis === 'x' ? across : 0);
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
// (tools/blender/shop_strips.py: shutter stalls, a food counter, a framed glass front, an arcade) or, four times in
// ten, the plain lit strip with its awning light. Construction sites get a site hoarding instead.
const STRIPS = ['stalls', 'counter', 'frame', 'arcade'];
function shopfronts(kit, root, t, rand, dx, dz) {
  const site = t.k === 'build', [h, d] = site ? [2.4, 0.3] : [4.5, 3];
  const wall = site ? kit.steel(palette.gunmetal, 0.8) : kit.windows(3, t.on, true, 'shop');
  const awning = t.on && !site && kit.glow(pick(rand, WARM), 1.2);
  const at = TILE / 2 - 0.3 - d / 2, own = rng(t.s * 17 + 9); // its own generator: the tile's other choices stay
  // x-facing strips are a hair lower than z-facing ones so their roofs never fight at the corner.
  for (const [axis, s] of [['x', dx], ['z', dz]]) {
    if (!s) continue;
    const kind = !site && own() >= 0.4 && pick(own, STRIPS);
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
  const base = kit.industrial(lit), { dark } = base;
  const shopwall = kit.windows(pick(rand, [3, 3, 6]), lit, true, 'shop'), word = pick(rand, WORDS), color = pick(rand, WARM);
  const g = kit.model(`shop_${kind}`, { ...base, shopwall, sign: lit ? kit.sign(word, color) : dark });
  g.rotation.y = outward(axis, s);
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
