// The market hall, built in code for every market tile (it replaced the market_hall glTF modelled in Blender, as
// plant.js replaced the power plant's, ADR-0018).
import * as THREE from 'three';
import { palette } from './palette.js';
import { box, cyl, part, rng, signBoard } from './geometry.js';
import { kitPart } from './parts.js';
import { SHOPS, pick } from './world.js';

const AWNINGS = [palette.deepRed, palette.oliveGrey, palette.armorWhite, palette.hazardPaint, palette.warningYellow];

// A covered market on the fw x fw footprint (9 to 11 m, city.js footprint), front to +z. The tile's own generator
// (rand) draws only the shop's name, as the glTF did, so the tile's later draws (its placement) are unchanged; every
// variant comes from the hall's own generator, seeded from the tile (s). A nave with a clerestory band under a barrel
// or a sawtooth roof; an open colonnade of steel posts along the front and, on some halls, along one end, its bays
// (three or four along the front, by the footprint) holding stalls with counters, awnings and lamps, or shutters;
// a loading bay at the back; the shop's name on a sign on the ridge, the hall number on the colonnade's fascia.
// Warm light spills from the open bays, the clerestory glows, the stalls' lamps are aged amber; all dark in a
// blackout (lit false). Small parts (ribs, mullions, sign posts) go into `detail`. The detail kit (parts.js kitPart)
// gives the stalls, the shutters and the loading dock.
export function market(kit, rand, lit, fw, s) {
  const [name] = pick(rand, SHOPS), own = rng(s * 23 + 17);
  const g = new THREE.Group(), d = new THREE.Group();
  d.name = 'detail';
  g.add(d);
  const dark = kit.steel(palette.charcoal, 0.6), off = (m) => (lit ? m : dark);
  const roof = own() < 0.5 ? 'barrel' : 'sawtooth', open = ['front', 'front+left', 'front+right'][Math.floor(own() * 3)];
  const awnings = [pick(own, AWNINGS), pick(own, AWNINGS)].map((c) => kit.steel(c, 0.7));
  const m = {
    plinth: kit.concrete(palette.slate), wall: own() < 0.5 ? kit.steel(palette.oliveGrey, 0.6) : kit.concrete(palette.weatheredConcrete),
    steel: kit.mat('rusty_painted_metal', palette.gunmetal, 0.7), graphite: kit.steel(palette.graphite, 0.6), trim: kit.steel(palette.armorWhite, 0.6),
    sheet: kit.mat('box_profile_metal_sheet', palette.gunmetal), mech: kit.steel(palette.slate, 0.6), hazard: kit.steel(palette.hazardPaint, 0.7), dark,
    spill: kit.windows(3, lit, true, 'shop'), // shopfront glass with lit rooms behind (facade.js), dark in a blackout
    clere: lit ? kit.glow(palette.agedAmber, 0.3) : kit.glass(palette.charcoal),
    lamp: off(kit.glow(palette.agedAmber, 1.2)), sign: off(kit.sign(name, palette.glare)),
    number: off(kit.sign(`HALL ${String(1 + Math.floor(own() * 12)).padStart(2, '0')}`, palette.agedAmber)), // twelve numbers: each is a texture
  };
  const shutter = { slats: m.sheet, frame: m.graphite };
  const L = fw, D = fw, c = 2.2, y0 = 0.2, Hw = 3.9 + own() * 0.6, Hc = 0.9, yr = y0 + Hw + Hc;
  const x0 = -L / 2 + (open === 'front+left' ? c : 0), x1 = L / 2 - (open === 'front+right' ? c : 0);
  const zb = -D / 2, zf = D / 2 - c, nx = x1 - x0, nd = zf - zb, cx = (x0 + x1) / 2, cz = (zb + zf) / 2;
  const signShift = [0, -1, 1][Math.floor(own() * 3)] * (nx - Math.min(5.5, nx - 1.5)) * 0.4;
  g.userData = { hall: true, roof, open }; // for the tests and probes

  part(g, box(L, y0, D, 0), m.plinth, 0, y0 / 2, 0);
  part(g, box(nx, Hw, nd, 1), m.wall, cx, y0 + Hw / 2, cz); // the nave
  part(g, box(nx - 0.2, Hc, nd - 0.2, 0), m.clere, cx, y0 + Hw + Hc / 2, cz); // the clerestory band
  for (const z of [zf - 0.08, zb + 0.08]) for (let x = x0 + 0.6; x < x1 - 0.4; x += 1.2) part(d, box(0.1, Hc, 0.12, 0), m.graphite, x, y0 + Hw + Hc / 2, z);
  part(g, box(nx + 0.1, 0.18, nd + 0.1, 0), m.graphite, cx, y0 + Hw + 0.09, cz); // the band's sill

  let top; // the roof's highest line: [y, z] where the sign stands
  if (roof === 'barrel') {
    const r = nd / 2 + 0.3, len = nx + 0.6, rise = 0.4;
    part(g, cyl(r, r, len, 16, 0, Math.PI).rotateZ(Math.PI / 2).scale(1, rise, 1), m.sheet, cx, yr, cz);
    const rib = new THREE.TorusGeometry(r + 0.03, 0.06, 3, 10, Math.PI).rotateY(Math.PI / 2).scale(1, rise, 1);
    const bays = Math.max(3, Math.round(nx / 2.5));
    for (let k = 0; k <= bays; k++) part(d, rib, m.graphite, x0 - 0.25 + (k * (nx + 0.5)) / bays, yr, cz);
    part(g, box(len * 0.6, 0.35, 0.9, 0), m.mech, cx - signShift, yr + r * rise + 0.1, cz); // a ridge vent, clear of the sign
    top = [yr + r * rise, cz];
  } else { // teeth along the hall, glazed faces to the front
    const k = nd > 6.5 ? 3 : 2, td = (nd + 0.4) / k, th = 1.4, len = nx + 0.3;
    const tri = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(td, 0), new THREE.Vector2(td, th)]);
    const end = new THREE.ExtrudeGeometry(tri, { depth: 0.12, bevelEnabled: false }).rotateY(-Math.PI / 2);
    for (let i = 0; i < k; i++) {
      const za = zb - 0.2 + i * td;
      part(g, box(len, 0.14, Math.hypot(td, th), 0), m.sheet, cx, yr + th / 2, za + td / 2).rotation.x = -Math.atan2(th, td);
      part(g, box(len - 0.2, th - 0.15, 0.08, 0), m.clere, cx, yr + th / 2, za + td - 0.04);
      for (let x = x0 + 0.6; x < x1 - 0.4; x += 1.2) part(d, box(0.1, th - 0.15, 0.12, 0), m.graphite, x, yr + th / 2, za + td - 0.04);
      for (const x of [x0 - 0.15 + 0.12, x1 + 0.15]) part(g, end, m.graphite, x, yr, za);
    }
    top = [yr + th, zf + 0.2 - 0.3];
  }
  // The ridge sign on two posts, its place along the ridge by seed.
  const sw = Math.min(5.5, nx - 1.5);
  signBoard(g, sw, 1, 0.18, m.graphite, m.sign, cx + signShift, top[0] + 0.75, top[1], 0, true);
  for (const s2 of [-1, 1]) part(d, box(0.1, 0.5, 0.1, 0), m.graphite, cx + signShift + s2 * sw * 0.35, top[0] + 0.1, top[1]);

  // An open colonnade along a side: `len` long, its inner face (the nave's wall) at the origin, out to +z, turned and
  // placed in the hall. Steel posts, a beam, a lean-to roof down from the nave and a fascia; under it, bay by bay,
  // a lit opening behind the kit's stall (counter, goods, framed awning, lamp, menu board), or the kit's shutter, where
  // the nave's wall is behind (walled, by the bay's centre along it). number: the hall number on its fascia, toward the end it gives (1 or -1), or none (0).
  const aisle = (len, x, z, turn, number, walled = () => true) => {
    const a = new THREE.Group(), Hp = 3.5, bays = Math.max(2, Math.round(len / 3)), bw = len / bays;
    a.position.set(x, 0, z);
    a.rotation.y = turn;
    g.add(a);
    for (let k = 0; k <= bays; k++) part(a, box(0.22, Hp, 0.22, 0), m.steel, -len / 2 + 0.11 + (k * (len - 0.22)) / bays, y0 + Hp / 2, c - 0.15);
    part(a, box(len, 0.25, 0.25, 0), m.steel, 0, y0 + Hp + 0.12, c - 0.15);
    const drop = Hw - Hp - 0.25, run = c + 0.3;
    part(a, box(len + 0.2, 0.14, Math.hypot(run, drop), 0), m.sheet, 0, y0 + Hp + 0.3 + drop / 2, run / 2).rotation.x = Math.atan2(drop, run);
    part(a, box(len + 0.2, 0.4, 0.1, 0), m.graphite, 0, y0 + Hp + 0.25, c + 0.2);
    part(a, box(len + 0.2, 0.06, 0.12, 0), m.trim, 0, y0 + Hp + 0.02, c + 0.2);
    if (number) part(a, new THREE.PlaneGeometry(1.4, 0.35), m.number, number * (len / 2 - 1.2), y0 + Hp + 0.25, c + 0.29); // 4 cm proud of the fascia
    for (let k = 0; k < bays; k++) {
      const bx = -len / 2 + (k + 0.5) * bw;
      if (!walled(bx)) continue; // the corner where the front meets an open end: a way in
      if (own() < 0.3) { // shuttered, 2.8 m tall (its hood clears the colonnade's beam)
        kitPart(kit, a, 'shutter', shutter, bx, y0, 0, 0, (bw - 0.5) / 3, 2.8 / 3, 1);
        continue;
      }
      part(a, box(bw - 0.5, 2.6, 0.06, 0), m.spill, bx, y0 + 1.3, 0.03);
      kitPart(kit, a, 'stall', { counter: k % 2 ? m.trim : m.graphite, goods: m.mech, frame: m.graphite, awning: awnings[k % 2], lit: m.lamp },
        bx, y0, 0, 0, bw / 3.2); // modelled for a 3.2 m bay
    }
  };
  const side = own() < 0.5 ? 1 : -1; // the end the hall number goes to
  aisle(L, 0, zf, 0, side, (bx) => bx > x0 && bx < x1);
  if (open === 'front+left') aisle(nd, x0, cz, -Math.PI / 2, 0);
  if (open === 'front+right') aisle(nd, x1, cz, Math.PI / 2, 0);

  // The kit's loading dock at the back (platform, steps, hazard posts, canopy, lamp) with the kit's shutter in its
  // 3 m by 2.8 m door, kept 2.7 m in from the nave's ends so its steps stay on the wall.
  const lx = cx + (own() - 0.5) * (nx - 5.4);
  kitPart(kit, g, 'dock', { concrete: m.plinth, frame: m.graphite, hazard: m.hazard, dark: m.dark, lit: m.lamp }, lx, 0, zb, Math.PI);
  kitPart(kit, g, 'shutter', shutter, lx, 0.9, zb, Math.PI, 1, 2.8 / 3, 1);
  return g;
}
