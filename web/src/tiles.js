// Builders for the non-house tiles (construction site, plaza, the HQ's court; the market hall is market.js) and the podium and roof dressing that houses
// share (families.js), in metres. fw is the building's footprint width (at most 12.5 m on a 14 m tile), so lots
// can hold smaller buildings with room around them.
// The style seed drives every choice; a blacked-out tile has dark rooms and no neon.
import * as THREE from 'three';
import { palette } from './palette.js';
import { box, cyl, outward, part, signBoard } from './geometry.js';
import { kitPart } from './parts.js';
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
export function court(kit, rand, lit, kerb) {
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
  return g;
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
