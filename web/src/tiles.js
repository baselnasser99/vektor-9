// Builders for the non-house tiles (construction site, plaza, the HQ's court; the market hall is market.js) and the podium and roof dressing that houses
// share (families.js), in metres. fw is the building's footprint width (at most 12.5 m on a 14 m tile), so lots
// can hold smaller buildings with room around them.
// The style seed drives every choice; a blacked-out tile has dark rooms and no neon.
import * as THREE from 'three';
import { palette } from './palette.js';
import { box, cyl, outward, part, rng, signBoard } from './geometry.js';
import { kitPart, streetLamp, tree } from './parts.js';
import { lampPool } from './streets.js';
import { ENTRANCE, HQ, siteFrame } from './headquarters.js';
import { ADS, CAR_COLORS, F, SHOPS, TILE, WARM, WORDS, pick } from './world.js';

// Shop podium: concrete base with a lit shopfront, awning, sign and an LED strip. Dark during a blackout.
export function podium(kit, g, rand, lit, warm, fw) {
  const front = fw / 2;
  part(g, box(fw, 2 * F, fw, 1), kit.concrete(palette.slate), 0, F, 0);
  part(g, box(fw - 1, 2.6, 0.1, 1), lit ? kit.glow(palette.sodium, 0.8) : kit.glass(palette.charcoal), 0, 1.6, front + 0.01);
  part(g, box(fw + 0.4, 0.25, 1.8, 1), kit.mat('box_profile_metal_sheet', warm), 0, 3.2, front + 0.9).rotation.x = 0.12;
  if (!lit) return;
  if (rand() < 0.6) signBoard(g, Math.min(6, fw - 2), 1.2, 0.25, kit.steel(palette.graphite, 0.6), kit.sign(pick(rand, WORDS), warm), 0, 5.2, front + 0.15);
  if (rand() < 0.5) part(g, box(fw + 0.3, 0.14, fw + 0.3, 1), kit.glow(warm, 2), 0, 2 * F - 0.12, 0);
}

// Storefronts for the corner buildings at the busiest crossing (city.js storefrontTiles), in place of the plain
// shop strip and on its footprint: on each street side a Blender model (tools/blender/storefront.py, ADR-0005), a
// 14 m front 3 m deep, with a recessed mechanical entrance, a barred window, vending terminals, layered canopies,
// conduits and roof gear. Its plain armoured end goes into the corner where the two fronts meet (storefront_l is
// the mirror image, for sides where the corner is on the other hand). The shop's name is over each door, its mark
// on the first side's blade sign. Dark in a blackout. About 2k triangles a side, 0.6k more up close.
export function storefront(kit, root, rand, lit, dx, dz) {
  const [name, mark] = pick(rand, SHOPS), ink = pick(rand, [palette.agedAmber, palette.coldCyan, palette.glare]);
  const base = kit.industrial(lit), { dark } = base, f = TILE / 2 - 0.3;
  const roles = { ...base, sign: lit ? kit.sign(name, ink) : dark, blade: lit ? kit.sign(mark, ink, true) : dark };
  [['x', dx], ['z', dz]].filter(([, s]) => s).forEach(([axis, s], k) => {
    const turn = outward(axis, s); // the model's front out to the street
    const along = axis === 'x' ? -Math.sin(turn) : Math.cos(turn); // where its +x end, the plain one, points
    const g = kit.model(Math.round(along) === (axis === 'x' ? dz : dx) ? 'storefront' : 'storefront_l', roles);
    g.rotation.y = turn;
    g.position.set(axis === 'x' ? s * f : 0, 0.18, axis === 'x' ? 0 : s * f);
    if (axis === 'z') g.scale.y = 1.02; // a hair taller, so the two roofs never fight where they overlap
    if (k) g.getObjectByName('blade').removeFromParent();
    root.add(kit.foldDetail(g, [dark]));
  });
}

// Signs: down one face a banner or (every third tower) a projected ad floating out from the wall; over a roof
// with room in the middle (free) a framed billboard or (on even floor counts, and every rooftop hologram) a
// projector throwing its ad into the air above. All carry odd ads (ADS). Framed displays animate like the corporate
// signs (materials.js liveSign); projections are light, in the hologram shader. Roof gear itself is roofs.js.
export function dress({ kit, g, rand, lit, H, y, w, tall }, floors, roofY, free) {
  const frame = kit.steel(palette.graphite, 0.6);
  if (lit && rand() < 0.45) {
    // Its foot above the one-storey shop strips and their roofs (city.js shopfronts), so they never cover it.
    const lo = Math.max(y + (H - y) * 0.2, 6), h = Math.min(24, y + (H - y) * 0.8 - lo), side = rand() < 0.5 ? 1 : -1;
    const ad = pick(rand, ADS), [name, line, mark, ink, color] = ad, x = side * (w / 2 + 0.3), cy = lo + h / 2;
    // Named 'banner' so a corporate sign on the same tower can take its place (city.js corpSigns).
    if (floors % 3 === 0 && cy - 3 >= 6) projector(kit, g, 'wall', ad, side * w / 2, cy - 3, w / 4, side * (Math.PI / 2)).name = 'banner'; // clear of the shops
    else if (h >= 4) {
      part(g, box(0.4, h, 2.6, 1), frame, x, cy, w / 4).name = 'banner';
      const shown = part(g, new THREE.PlaneGeometry(2.4, h - 0.3), kit.corp(name, line, mark, 128, 768, ink, color), x + side * 0.21, cy, w / 4);
      shown.rotation.y = side * (Math.PI / 2);
      shown.name = 'banner';
    }
  }
  if (!lit || !free) return;
  if (floors >= 8 && rand() < 0.3) {
    const ad = pick(rand, ADS), [name, line, mark, ink, color] = ad;
    rand(); // what the old word pick drew, so the rest of the tile is unchanged
    if (floors % 2 === 0) return projector(kit, g, 'roof', ad, 0, roofY, 0, 0);
    for (const x of [-3.5, 3.5]) part(g, box(0.3, 4, 0.3, 1), kit.steel(palette.charcoal), x, roofY + 2, 0);
    part(g, box(9, 4.5, 0.4, 1), frame, 0, roofY + 6, 0);
    const shown = kit.corp(name, line, mark, 512, 256, ink, color);
    for (const s of [-1, 1]) part(g, new THREE.PlaneGeometry(8.6, 4.1), shown, 0, roofY + 6, s * 0.21).rotation.y = s < 0 ? Math.PI : 0;
  } else if (tall && rand() < 0.25) {
    projector(kit, g, 'roof', pick(rand, ADS), 0, roofY, 0, 0);
  }
}

// A hologram projector (tools/blender/holo_projectors.py, kind 'roof' or 'wall') at (x, y, z) in g, turned by
// turn, throwing ad (an ADS entry) into the air in its ink's light.
function projector(kit, g, kind, [name, line, mark, ink, color], x, y, z, turn) {
  const base = kit.industrial(true), [w, h] = kind === 'roof' ? [512, 288] : [256, 384];
  const m = kit.foldDetail(kit.model(`holo_${kind}`, { ...base, panel: kit.mat('rusty_painted_metal', palette.gunmetal),
    holo: kit.projection(name, line, mark, ink, color, w, h), beam: kit.beam(ink), lens: kit.glow(palette.coldCyan, 1.6) }), [base.dark]);
  m.position.set(x, y, z);
  m.rotation.y = turn;
  g.add(m);
  return m;
}

// Empty lot as a small plaza: paving, parked cars (some of them taxis), sometimes a kiosk with a sign. The cars are
// drawn with the street's parked cars (life.js parkedCars); g.userData.parked holds them as [x, z, colour], facing +z.
export function plaza(kit, rand, lit) {
  const g = new THREE.Group();
  g.userData.parked = [];
  part(g, box(12.6, 0.2, 12.6, 1), kit.concrete(palette.slate), 0, 0.1, 0);
  const spots = new Map(); // two rows of three spots, 4.4 m cars with room between; a spot drawn twice holds one car
  for (let k = Math.floor(2 + rand() * 4); k > 0; k--) {
    const [x, z] = [-3.5 + Math.floor(rand() * 3) * 3.5, [-3.3, 2.3, 2.3][Math.floor(rand() * 3)]];
    spots.set(`${x},${z}`, [x, z, pick(rand, CAR_COLORS)]);
  }
  const hasKiosk = rand() < 0.5;
  for (const [key, car] of spots) if (!(hasKiosk && key === '3.5,2.3')) g.userData.parked.push(car); // the kiosk's corner
  if (hasKiosk) kiosk(kit, g, rand, lit, 4, 4);
  return g;
}

// A kiosk at (x, z), its lit sign and window facing +z.
function kiosk(kit, g, rand, lit, x, z) {
  const warm = pick(rand, WARM);
  part(g, box(3, 2.6, 2.4, 1), kit.steel(palette.charcoal), x, 1.5, z);
  if (lit) {
    signBoard(g, 2.6, 0.6, 0.15, kit.steel(palette.graphite, 0.6), kit.sign(pick(rand, WORDS), warm), x, 3.2, z + 1.25);
    part(g, box(2.4, 0.9, 0.1, 1), kit.glow(palette.warmWindow, 1), x, 1.4, z + 1.22);
  }
}

// The headquarters' court (ADR-0015): a tile of the forecourt the simulation reserves across the avenue from the
// campus. Its own paving edge to edge, so the tiles read as one square and not as sidewalk: warm stone slabs, 3.5 m
// along x (toward the avenue and the HQ) by 1.75 m, in running bond over dark joints, the pattern carried on across
// tile edges; steel bollards along its kerb where it meets the avenue (kerb: the tile's +x side does); a security
// kiosk on some tiles (securityKiosk, below).
const SLAB = [3.5, 1.75], JOINT = 0.08;
export function court(kit, rand, lit, kerb, plan = null) {
  const g = new THREE.Group(), stone = kit.concrete(palette.courtStone), h = TILE / 2;
  part(g, box(TILE, 0.18, TILE, 1), kit.concrete(palette.gunmetal), 0, 0.09, 0); // the bed, seen in the joints
  for (let r = 0; r < TILE / SLAB[1]; r++) {
    const z = -h + (r + 0.5) * SLAB[1], off = r % 2 ? SLAB[0] / 2 : 0;
    const cuts = [-h, ...Array.from({ length: Math.ceil(TILE / SLAB[0]) + 1 }, (_, k) => -h + off + k * SLAB[0]).filter((x) => x > -h && x < h), h];
    for (let k = 1; k < cuts.length; k++) { // a half slab at an offset row's tile edge meets its neighbour's with no joint
      const a = cuts[k - 1] + (k > 1 || !off ? JOINT / 2 : 0), b = cuts[k] - (k < cuts.length - 1 || !off ? JOINT / 2 : 0);
      part(g, box(b - a, 0.02, SLAB[1] - JOINT, 0), stone, (a + b) / 2, 0.19, z);
    }
  }
  if (kerb) for (let z = -TILE / 2 + 1.5; z < TILE / 2; z += 2.5) part(g, cyl(0.1, 0.1, 0.9, 8), kit.steel(palette.charcoal, 0.6), TILE / 2 - 0.6, 0.65, z);
  if (rand() < 0.35) securityKiosk(kit, g, rand, lit, kerb);
  if (plan) dressCourt(kit, g, rand, lit, plan); // no plan (courtPlan's guard, or a tile built alone): paving and kiosk only
  return g;
}

// The court as a whole (city.js gives each tile its part): the court is the site tiles the campus does not take. For
// each tile: the view axes in its frame (z of the line out from each tower's entrance and from the gateway between
// them, across the avenue; kept clear AXIS m either side), which of its sides face a street, and what it holds of the
// court's one central feature (on the far column of the outer half, the one farther from the city's centre, beside
// its axis), two open gathering spots by it, and its two or three wayfinding pillars (one by each axis where it meets
// the avenue, sometimes one more by the feature's axis on the far column), each with the places it may stand, in
// order; and whether it is in the outer half (sparse: fewer trees, spaced unevenly). Map tile index -> plan.
// Guard: the axes run along x, so only a campus facing -x or +x (every v3 and v4 seed) gets a plan; any other facing
// gets none, and its court is drawn bare (paving, bollards, kiosks).
export const AXIS = 2.5;
export const facesX = (heading) => Math.abs(Math.abs(Math.sin(heading)) - 1) < 1e-6;
export function courtPlan(snap, { n, pos }, hq) {
  const out = new Map(), cells = snap.tiles.flatMap((t, i) => (t.k === 'site' && !hq?.tiles.has(i) ? [i] : []));
  if (!hq || !cells.length || !facesX(hq.heading)) return out; // the guard (above)
  const { at } = siteFrame(hq), z = (i) => pos(Math.floor(i / n)), x = (i) => pos(i % n);
  const doors = [-1, 1].map((s) => at(s * HQ.TOWER[0], ENTRANCE.DOOR_OUT)[1]).sort((a, b) => a - b), axes = [doors[0], hq.z, doors[1]];
  const cols = [...new Set(cells.map((i) => i % n))].sort((a, b) => a - b), r = rng(snap.seed * 31 + 7);
  const [kerbCol, farCol] = Math.abs(pos(cols[0]) - hq.x) < Math.abs(pos(cols.at(-1)) - hq.x) ? [cols[0], cols.at(-1)] : [cols.at(-1), cols[0]];
  const toHQ = Math.sign(hq.x - pos(kerbCol)), street = (a, b) => Math.abs(a - b) > TILE + 0.5;
  const tileAt = (col, wz) => cells.find((i) => i % n === col && Math.abs(z(i) - wz) <= TILE / 2);
  const outer = Math.abs(doors[0]) > Math.abs(doors[1]) ? 0 : 1, nearer = (i) => (Math.abs(z(i) - doors[0]) < Math.abs(z(i) - doors[1]) ? 0 : 1);
  for (const i of cells) {
    const col = i % n, row = Math.floor(i / n);
    out.set(i, { axes: axes.map((a) => a - z(i)), things: [], sparse: nearer(i) === outer, street: { px: street(pos(col + 1), x(i)), nx: street(pos(col - 1), x(i)),
      pz: street(pos(row + 1), z(i)), nz: street(pos(row - 1), z(i)) } });
  }
  const put = (kind, i, spots) => i !== undefined && out.get(i).things.push([kind, spots.map(([wx, wz]) => [wx - x(i), wz - z(i)])]);
  r(); // what the feature's half drew when it was picked at random, so the pillars stay as they were
  doors.forEach((a, k) => {
    const half = cells.filter((i) => Math.abs(z(i) - a) < Math.abs(z(i) - doors[1 - k])), mid = half.reduce((m, i) => m + z(i), 0) / half.length;
    const away = Math.sign(mid - a) || 1, side = r() < 0.5 ? -1 : 1, by = [side, -side].map((s) => a + s * (AXIS + 1.1));
    const kerbX = [3.2, 1.2, -1].map((u) => pos(kerbCol) + toHQ * u);
    for (const wz of by) put('pillar', tileAt(kerbCol, wz), kerbX.map((wx) => [wx, wz]));
    if (k !== outer) return;
    const fz = a + away * 7.5;
    put('feature', tileAt(farCol, fz), [0, 1.5, -1.5].flatMap((u) => [0, 1, -1].map((v) => [pos(farCol) + toHQ * u, fz + away * v])));
    put('gather', tileAt(farCol, fz + away * 5), [0, 1.5, -1.5].map((u) => [pos(farCol) + toHQ * u, fz + away * 5])); // beyond the plinth
    put('gather', tileAt(kerbCol, fz), [-2.5, -1, 0.5].map((u) => [pos(kerbCol) + toHQ * u, fz])); // in front of it, toward the avenue
    if (r() < 0.5) for (const wz of by) put('pillar', tileAt(farCol, wz), [3.5, 0, -3.5].map((u) => [pos(farCol) + toHQ * u, wz]));
  });
  return out;
}

// The court's dressing on one tile (plan: from courtPlan): its share of the feature and the pillars (each at the first
// of its places that is free; a pillar's places on both sides of its axis, so it stands on whichever side has room),
// and the gathering spots by the feature, kept open for a group; then, from a loose 3 x 3 grid (jittered), a lighting
// column like the street's with its pool of light (POOL m, whole on the tile), up to four planters with trees (three in the
// outer half, spaced unevenly; some with a bench beside), and up to two spots for small groups standing about, apart
// and off the axes' edges (g.userData.standing: [x, z, count] in the tile's frame, for people.js). All of it in one
// group (name 'dressing'). Nothing on a view axis, within CLEAR.KIOSK m of the kiosk, within CLEAR.KERB m of a side
// facing a street, or over the tile's edge (a building that replaces the tile takes all of it). In a blackout the
// column, the pool, the pillars' panels and the emblem are dark.
export const CLEAR = { KIOSK: 1.5, KERB: 1, EDGE: 0.4 };
const POOL = 3; // a court lamp's pool radius (the street's are 5 m; a 14 m tile has no room for those)
function dressCourt(kit, tile, rand, lit, { axes = [], street = {}, things = [], sparse = false }) {
  const h = TILE / 2, used = [], kiosk = tile.children.find((c) => c.userData.kiosk), g = new THREE.Group();
  tile.updateMatrixWorld(true);
  const kb = kiosk && new THREE.Box3().setFromObject(kiosk).expandByScalar(CLEAR.KIOSK);
  const standing = [];
  g.name = 'dressing';
  tile.add(g);
  const fits = (x, z, r, beside = null) => { // beside: one placed thing it may touch (a bench its planter)
    const edge = (s) => (street[s] ? CLEAR.KERB : CLEAR.EDGE) + r;
    if (x + edge('px') > h || x - edge('nx') < -h || z + edge('pz') > h || z - edge('nz') < -h) return false;
    if (axes.some((a) => Math.abs(z - a) < AXIS + r)) return false;
    if (kb && x + r > kb.min.x && x - r < kb.max.x && z + r > kb.min.z && z - r < kb.max.z) return false;
    return used.every((u) => u === beside || Math.hypot(u[0] - x, u[1] - z) >= u[2] + r + 0.6);
  };
  const dark = kit.steel(palette.charcoal, 0.6), frame = kit.steel(palette.graphite, 0.6);
  for (const [kind, spots] of things) {
    const r = { feature: 1.8, gather: 1.6 }[kind] ?? 0.5, at = spots.find(([x, z]) => fits(x, z, r));
    if (!at || (kind === 'pillar' && used.some((u) => u[3] === 'pillar'))) continue; // one pillar a tile
    const [x, z] = at;
    used.push([x, z, r, kind]);
    if (kind === 'gather') { // an open spot for a group of three to five
      standing.push([x, z, 3 + Math.floor(rand() * 3)]);
    } else if (kind === 'feature') { // a stepped plinth carrying the court's emblem: three lit cyan blades turned against each other on a steel stem, a lit crystal over them
      const emblem = lit ? kit.glow(palette.coldCyan, 1.6) : dark, e = new THREE.Group();
      part(g, box(3, 0.3, 3, 1), kit.concrete(palette.slate), x, 0.35, z);
      part(g, box(2.2, 0.9, 2.2, 1), kit.concrete(palette.charcoal), x, 0.95, z);
      e.position.set(x, 1.4, z);
      g.add(e);
      part(e, cyl(0.06, 0.08, 1.7, 8), frame, 0, 0.85, 0);
      [0, 1, 2].forEach((k) => (part(e, box(1.2 - k * 0.2, 0.07, 0.42, 0), emblem, 0, 0.4 + k * 0.42, 0).rotation.y = (k * Math.PI) / 3.5));
      part(e, new THREE.OctahedronGeometry(0.3, 0), emblem, 0, 1.95, 0).scale.set(0.8, 1.7, 0.8);
    } else { // a wayfinding pillar, its panel lit on both faces, read along the court
      part(g, box(0.5, 0.2, 0.5, 0), frame, x, 0.3, z);
      signBoard(g, 0.4, 2.2, 0.22, frame, lit ? kit.sign('COURT', palette.coldCyan, true) : dark, x, 1.5, z, Math.PI / 2, true);
    }
  }
  const spots = [];
  for (const a of [-4.5, 0, 4.5]) for (const b of [-4.5, 0, 4.5]) spots.push([a + (rand() - 0.5) * 1.4, b + (rand() - 0.5) * 1.4, rand()]);
  spots.sort((p, q) => p[2] - q[2]);
  let lamp = false, trees = 0, groups = 0;
  for (const [x, z, k] of spots) {
    // its arm turned (from k, then on round) to the first way whose head is clear and whose whole pool lies on the tile
    const turn = !lamp && fits(x, z, 0.4) && [0, 1, 2, 3].map((j) => ((Math.floor(k * 4) + j) % 4) * (Math.PI / 2)).find((t) => {
      const hx = x + Math.cos(t) * 1.7, hz = z - Math.sin(t) * 1.7;
      return fits(hx, hz, 0.4) && Math.max(Math.abs(hx), Math.abs(hz)) + POOL <= h;
    });
    if (turn !== undefined && turn !== false) {
      used.push([x, z, 0.4, 'lamp']);
      const head = streetLamp(kit, g, x, z, turn, lit);
      if (lit) part(g, new THREE.CircleGeometry(POOL, 20), lampPool(), head.x, 0.22, head.z).rotation.x = -Math.PI / 2;
      lamp = true;
      continue;
    }
    const tall = 4.5 + k, crown = tall * 0.28; // the crown's reach (parts.js tree) keeps the clearances, not just the planter
    const room = sparse ? k * 0.15 : 0; // the outer half's spacing, uneven: room kept round each of its trees
    if (trees < (sparse ? 3 : 4) && k < 0.8 && fits(x, z, Math.max(1, crown) + room)) { // a planter with a tree, now and then a bench beside it
      used.push([x, z, Math.max(1, crown) + room, 'planter']);
      part(g, box(1.5, 0.55, 1.5, 1), kit.concrete(palette.gunmetal), x, 0.475, z);
      part(g, box(1.2, 0.04, 1.2, 0), kit.concrete(palette.charcoal), x, 0.76, z);
      const raised = new THREE.Group();
      raised.position.y = 0.7;
      g.add(raised);
      tree(kit, raised, x, z, tall);
      trees++;
      const bx = x + (k < 0.4 ? -1 : 1) * 1.65;
      if (rand() < 0.45 && fits(bx, z, 0.95, used.at(-1))) {
        used.push([bx, z, 0.95, 'bench']);
        part(g, box(0.5, 0.45, 1.8, 1), kit.steel(palette.charcoal, 0.8), bx, 0.425, z);
      }
      continue;
    }
    if (groups < 2 && fits(x, z, 1.1)) { // open paving kept for a small group (2 to 5)
      used.push([x, z, 1.1, 'group']);
      const count = 2 + Math.floor(rand() * 4);
      groups++;
      // People only where the group stands apart (3.7 m from another) and 2 m off an axis band's edge, so groups never line it.
      const apart = standing.every(([sx, sz]) => Math.hypot(sx - x, sz - z) >= 3.7);
      if (apart && !axes.some((a) => Math.abs(z - a) < AXIS + 2)) standing.push([x, z, count]);
    }
  }
  Object.assign(tile.userData, { court: used, standing }); // used: [x, z, r, kind] in the tile's frame, for the tests and probes
}

// The court's security kiosk, the detail kit's (tools/blender/detail_kiosk.py, ADR-0020), front +z. On a kerb tile it
// stands by the kerb facing the avenue, mostly with its barrier arm out along the kerb; elsewhere at (-3, -3), turned
// any of four ways. The seed picks the door's side (away from the arm), the canopy's colour and the post's name; its
// lit slot (service slot, downlight), lamp (ceiling light, monitor), sign and the glass's warm cast are dark in a blackout.
const CANOPIES = [palette.deepRed, palette.armorWhite, palette.hazardPaint, palette.oliveGrey];
const POSTS = ['GATE A', 'GATE B', 'POST 3', 'POST 7', 'CHECK 2', 'WATCH 9']; // invented post names
function securityKiosk(kit, g, rand, lit, kerb) {
  const dark = kit.steel(palette.charcoal, 0.6), door = kit.steel(palette.charcoal, 0.5);
  const on = (make) => (lit ? make() : dark), glass = kit.veil(palette.glassBand, 0.35, ...(lit ? [palette.warmWindow, 0.5] : []));
  const arm = kerb && rand() < 0.75, canopy = pick(rand, CANOPIES), name = pick(rand, POSTS);
  const [x, z, turn] = kerb ? [4.6, 3, Math.PI / 2] : [-3, -3, Math.floor(rand() * 4) * (Math.PI / 2)];
  const shut = arm || rand() < 0.5 ? 'door_r' : 'door_l'; // the arm swings out on the +x side
  const k = kitPart(kit, g, 'kiosk', { base: kit.concrete(palette.slate), frame: kit.steel(palette.graphite, 0.6),
    panel: kit.steel(palette.gunmetal, 0.6), glass, canopy: kit.steel(canopy, 0.6),
    door_l: door, door_r: door, boom: kit.steel(palette.armorWhite, 0.6), stripe: kit.steel(palette.deepRed, 0.7),
    lit: on(() => kit.glow(palette.warmWindow, 2.5)), lamp: on(() => kit.glow(palette.warmWindow, 1)),
    sign: on(() => kit.sign(name, palette.coldCyan)) }, x, 0.19, z, turn);
  for (const slot of [shut, ...(arm ? [] : ['boom', 'stripe'])]) k.getObjectByName(slot).removeFromParent();
  k.userData.kiosk = { arm, door: shut === 'door_r' ? 'door_l' : 'door_r', canopy, name, turn }; // for the tests and probes
}

// Construction site: bare concrete core in scaffolding, hoarding at street level, work lights, sometimes a tower crane.
export function construction(kit, floors, rand, lit, fw) {
  const g = new THREE.Group(), H = Math.max(floors, 1) * F, scaffold = kit.steel(palette.sodium, 0.6), s = fw * 0.43, c = fw * 0.54;
  part(g, box(fw * 0.75, H, fw * 0.75, 1), kit.concrete(palette.gunmetal), 0, H / 2, 0);
  for (const [x, z] of [[-s, -s], [s, -s], [-s, s], [s, s]]) part(g, box(0.3, H + 2, 0.3, 1), scaffold, x, (H + 2) / 2, z);
  for (let y = 2 * F; y <= H + 1; y += 2 * F) {
    for (const z of [-s, s]) part(g, box(2 * s + 0.3, 0.25, 0.25, 1), scaffold, 0, y, z);
    for (const x of [-s, s]) part(g, box(0.25, 0.25, 2 * s + 0.3, 1), scaffold, x, y, 0);
  }
  part(g, box(fw, 2.4, fw, 1), kit.steel(palette.charcoal), 0, 1.2, 0);
  if (lit) {
    part(g, box(fw + 0.1, 0.12, fw + 0.1, 1), kit.glow(palette.sodium, 2), 0, 2.4, 0);
    for (const x of [-s * 0.8, s * 0.8]) part(g, box(0.8, 0.4, 0.4, 1), kit.glow(palette.glare, 3), x, H + 2.2, s);
  }
  if (rand() < 0.35) {
    const mast = H + 18, lattice = kit.mat('metal_grate_rusty', palette.sodium);
    part(g, box(1.4, mast, 1.4, 1), lattice, c, mast / 2, c);
    part(g, box(28, 1.2, 1.2, 1), lattice, c - 8, mast, c);
    part(g, box(3, 2, 2, 1), kit.concrete(palette.slate), c + 7, mast - 0.4, c);
    part(g, box(2, 2, 2, 1), kit.steel(palette.charcoal), c, mast - 2, c);
    part(g, new THREE.SphereGeometry(0.3, 8, 6), kit.warning(), c - 22, mast + 0.8, c);
  }
  return g;
}
