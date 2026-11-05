// Landmarks the eye finds first: the telecom tower on the plaza where the boulevards meet, the railway station,
// and the spires on the city's tallest towers. Steady lights only (no flashing).
import * as THREE from 'three';
import { palette } from './palette.js';
import { box, cyl, part, ring } from './geometry.js';
import { pipe } from './parts.js';
import { F } from './world.js';

// The city's telecom tower, in the middle of the plaza where the boulevards meet (streets.js). Modelled in Blender by
// tools/blender/telecom_tower.py (its proportions live there) and loaded as a glTF: an old concrete frame (tapered
// core, three legs on web walls, a transfer ring) carrying decades of steel retrofits at three plant nodes, a command
// crown (panoramic glass behind angular armour, a reinforced control level, one curved display) and a short mast;
// at its foot a hub with a portal, garages, a power yard and vent towers. Each mesh is named by its material role and
// gets a palette material here; its "detail" node (rails, slats, small fittings) is drawn only near the camera
// (userData.lod 'tower', city.js). Warm light first; cyan on one conduit and the info panels; steady red lamps.
export function telecomTower(kit, root, x, y, z) {
  const roles = {
    concrete: kit.concrete(palette.weatheredConcrete), steel: kit.steel(palette.gunmetal, 0.5),
    mech: kit.steel(palette.slate, 0.6), panel: kit.steel(palette.charcoal, 0.4), dark: kit.steel(palette.deepNavy, 0.6),
    glass: kit.windows(1, true, false, 'panorama'), orange: kit.steel(palette.amber, 0.6),
    interior: kit.glow(palette.warmWindow, 1.2), amber: kit.glow(palette.sodium, 2.5), white: kit.glow(palette.glare, 1.5),
    cyan: kit.glow(palette.neonCyan, 1.5), ad: kit.billboard('NEON NOODLES', palette.neonMagenta, palette.neonCyan),
    red: kit.glow(palette.signal, 4),
  };
  const g = kit.model('telecom_tower', roles);
  g.getObjectByName('detail').userData.lod = 'tower';
  g.userData.rigid = true; // placed whole at the hub, where the warp is zero anyway: skip it for every vertex
  g.position.set(x, y, z);
  root.add(g);
}

// Station on the viaduct, built along x with the deck at y = 0: platforms either side of the tracks, a glass hall
// under a shallow pitched roof with a lit ridge, and a sign tower at the terminus end (+x).
export function station(kit) {
  const g = new THREE.Group(), len = 72, steel = kit.steel(palette.slate, 0.4), paving = kit.concrete(palette.roseGrey);
  const glass = kit.windows(3, true), ridge = kit.glow(palette.neonCyan, 2), warm = kit.glow(palette.sodium, 1.5);
  for (const side of [-1, 1]) {
    part(g, box(len, 1, 3, 0), paving, 0, 0.3, side * 6);
    part(g, box(len, 4.6, 0.3, 0), glass, 0, 3.1, side * 7.4);
    part(g, box(len, 0.1, 0.1, 0), warm, 0, 0.9, side * 4.6); // platform edge
    const roof = part(g, box(len + 2, 0.35, 8.4, 0), steel, 0, 6.9, side * 3.8);
    roof.rotation.x = side * 0.22;
  }
  for (let x = -len / 2; x <= len / 2; x += 12) for (const side of [-1, 1]) part(g, box(0.4, 6, 0.4, 0), steel, x, 3.3, side * 7.2);
  part(g, box(len + 2, 0.2, 0.3, 0), ridge, 0, 7.8, 0);
  // The terminus end (+x): an end wall, and buffer stops with steady red lamps on both tracks.
  part(g, box(0.4, 7, 15, 0), steel, len / 2 + 0.8, 3.5, 0);
  for (const off of [-1.85, 1.85]) {
    part(g, box(1, 1.4, 2.6, 0), steel, len / 2 - 0.5, 1.3, off);
    part(g, box(0.1, 0.3, 0.6, 0), kit.glow(palette.signal, 3), len / 2 - 1.05, 1.7, off);
  }
  const tower = part(g, box(3, 22, 3, 1), steel, len / 2 + 2, 2, 8.5);
  part(tower, box(0.3, 16, 2.4, 0), kit.glow(palette.neonPink, 2.5), 1.6, 2, 0);
  return g;
}

// Crown for a signature tower: a narrow lantern storey, a needle half the tower's height, halo rings up it and
// a steady beacon at the tip. h: roof height; w: footprint width.
export function spire(kit, g, h, w, lit) {
  const steel = kit.steel(palette.slate, 0.35), halo = kit.glow(palette.neonViolet, 2.5), needle = h / 2;
  part(g, box(w * 0.45, 2 * F, w * 0.45, 1), kit.windows(2, lit), 0, h + F, 0);
  part(g, cyl(0.25, w * 0.18, needle, 6), steel, 0, h + 2 * F + needle / 2, 0);
  if (lit) for (let k = 0; k < 3; k++) ring(g, w * (0.3 - k * 0.07), 0.12, halo, 0, h + 2 * F + 4 + k * needle * 0.22, 0, 28, 4);
  part(g, new THREE.SphereGeometry(0.4, 8, 6), kit.glow(palette.signal, 3), 0, h + 2 * F + needle + 0.3, 0);
}

// Retrofit for a signature tower (the city's three tallest, city.js): heavy industrial add-ons hung on its main
// shaft, so it reads as cyberpunk from its architecture rather than from light. Asymmetric on purpose: armoured
// plate modules on one face, a mechanical spine with ventilation units on the next, a cantilevered machine pod
// with maintenance platforms on the opposite face, and exposed conduits climbing beside the spine. Worn dark
// steel and titanium, louvred grates, one dull hazard band; no neon, only two dim work lamps. The shaft and spire
// keep their size and place. clear(k): the height (m) above which face k (+x, +z, -x, -z) is open, 0 where it looks
// onto a street; anything deeper than a plate stays above it, so it overhangs the neighbour's roof, never its wall.
// The pod and the vents go on the most open faces. rand: the tower's own generator.
export function retrofit(kit, g, clear, rand) {
  // The shaft to dress: the tower's volumes come as stacks of boxes on one footprint (segments between mechanical
  // floors, setbacks above, families.js); take the stack that stands the most clear of the neighbouring roofs.
  const size = (o) => {
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    return o.geometry.boundingBox.getSize(new THREE.Vector3());
  };
  const stacks = [];
  for (const o of g.children) {
    if (!o.isMesh || o.rotation.y || o.geometry.attributes.position.count > 2000) continue;
    const v = size(o), { x, y, z } = o.position;
    if (v.x < 6 || v.z < 6 || v.y < 2) continue;
    const s = stacks.find((q) => Math.abs(q.x - x) < 0.1 && Math.abs(q.z - z) < 0.1 && Math.abs(q.W - v.x) < 0.7 && Math.abs(q.D - v.z) < 0.7);
    if (s) [s.y0, s.y1] = [Math.min(s.y0, y - v.y / 2), Math.max(s.y1, y + v.y / 2)];
    else stacks.push({ x, z, W: v.x, D: v.z, y0: y - v.y / 2, y1: y + v.y / 2 });
  }
  const low = Math.min(...[0, 1, 2, 3].map(clear));
  const shaft = stacks.filter((q) => q.y1 - q.y0 > 15).sort((p, q) => (q.y1 - Math.max(q.y0, low)) * q.W - (p.y1 - Math.max(p.y0, low)) * p.W)[0];
  if (!shaft) return;
  const { x: cx, z: cz, W, D, y0, y1 } = shaft;
  const Hs = y1 - y0, top = (k) => Math.max(clear(k) + 4, y0 + Hs * 0.3); // where deep parts may start on face k
  // Painted steel, not the fully metallic worn texture: at night a metal surface has little to reflect and goes black.
  const mat = { steel: kit.steel(palette.gunmetal, 0.6), titanium: kit.steel(palette.weatheredTitanium, 0.6), dark: kit.steel(palette.charcoal, 0.6),
    grate: kit.mat('metal_grate_rusty', palette.gunmetal), hazard: kit.steel(palette.hazardPaint, 0.7), lamp: kit.glow(palette.dirtyAmber, 1.2),
    small: kit.steel(palette.charcoal, 0.4) }; // small: the steel every building's near-camera detail already uses (families.js)
  const detail = g.getObjectByName('detail') ?? g;
  // Face k (0..3: +x, +z, -x, -z) of the shaft: a box `w` along the face, `h` tall, `d` deep, `u` along the face
  // from its middle, `out` metres off it (its back), centred at height y.
  const face = (k, parent, w, h, d, m, u, y, out) => {
    const [nx, nz] = [[1, 0], [0, 1], [-1, 0], [0, -1]][k], half = nx ? W / 2 : D / 2, off = half + out + d / 2;
    const geo = nx ? box(d, h, w, 1) : box(w, h, d, 1);
    return part(parent, geo, m, cx + nx * off - nz * u, y, cz + nz * off + nx * u);
  };
  const span = (k) => (k % 2 ? W : D); // width of face k
  // c: the most open face (ties by chance) for the pod; a, opposite, for the armour; b, the more open of the other two.
  const c = [0, 1, 2, 3].map((k) => [clear(k) + rand(), k]).sort((p, q) => p[0] - q[0])[0][1], a = (c + 2) % 4;
  const b = clear((c + 1) % 4) <= clear((c + 3) % 4) ? (c + 1) % 4 : (c + 3) % 4;

  // Face a: armoured plates, three staggered columns of modules three to six storeys tall, set out at different
  // depths, a storey apart; one column wraps round the corner onto the face before it.
  const d = (a + 3) % 4, cols = [[a, -span(a) * 0.3, 0.1], [a, span(a) * 0.05, 0.28], [a, span(a) * 0.36, 0.18], [d, span(d) * 0.38, 0.22]];
  for (const [k, u, start] of cols) {
    for (let y = y0 + Hs * start; y < y1 - Hs * 0.15;) {
      const h = (3 + Math.floor(rand() * 4)) * F, w = 2.8 + rand() * 1.2, deep = 0.45 + rand() * 0.4;
      face(k, g, w, h, deep, rand() < 0.5 ? mat.steel : mat.titanium, u, y + h / 2, 0.1);
      face(k, g, w + 0.4, 0.35, deep + 0.35, mat.dark, u, y + h + 0.17, 0); // a ledge on top of each module
      y += h + F;
    }
  }
  // Face b: a mechanical spine from the shaft's lower third to near its top, ribbed, with vent units on it.
  // It rises from the neighbour's roof on that side, if that is higher.
  const u = span(b) * (rand() < 0.5 ? -0.25 : 0.25), s0 = Math.max(y0 + Hs * 0.3, clear(b) + 0.5), s1 = y1 - Hs * 0.08;
  if (s1 - s0 > 8) {
    face(b, g, 3.6, s1 - s0, 1.8, mat.steel, u, (s0 + s1) / 2, 0.4);
    for (let y = s0 + 3; y < s1; y += 6) face(b, g, 4.2, 0.5, 2.4, mat.dark, u, y, 0.2);
  }
  for (const t of s1 - s0 > 8 ? [0.42, 0.62, 0.84] : []) { // vents only on a spine
    const y = s0 + (s1 - s0) * t;
    if (y < top(b)) continue;
    face(b, g, 3.4, 3, 2.2, mat.grate, u, y, 2.2); // louvred ventilation unit, further out than the spine
    face(b, g, 3.6, 0.3, 2.4, mat.hazard, u, y + 1.65, 2.1); // a dull hazard band on its hood
    face(b, detail, 1.6, 1.6, 0.4, mat.small, u, y, 4.4); // fan housing on its face
  }
  // Conduits: three pipes of different sizes up face b beside the spine, from street level to the vents.
  const side = Math.sign(u) || 1;
  [[0.3, -2.6], [0.45, -3.5], [0.22, -4.3]].forEach(([r, du], k) => {
    const along = u + side * du, end = s0 + (s1 - s0) * (0.5 + k * 0.12), [nx, nz] = [[1, 0], [0, 1], [-1, 0], [0, -1]][b];
    const off = (nx ? W / 2 : D / 2) + 0.3 + r, x = cx + nx * off - nz * along, z = cz + nz * off + nx * along;
    pipe(kit, g, [[x, y0 + 0.5, z], [x, end, z]], r, mat.steel, 8);
    for (let y = y0 + 4; y < end; y += 6) part(detail, box(r * 3, 0.2, r * 3, 0), mat.small, x, y, z); // clamps
  });
  // Face c: a machine pod cantilevered high up on raking struts, a grated maintenance platform under it and a
  // second one lower down at the other end of the face, each with a rail and one dim work lamp.
  const py = Math.max(top(c) + 7.5, y0 + Hs * 0.55), pu = span(c) * (rand() < 0.5 ? -0.15 : 0.15);
  if (py + 7 < y1) {
    face(c, g, 7, 10, 3, mat.titanium, pu, py, 0.2);
    face(c, g, 7.6, 0.6, 3.5, mat.dark, pu, py + 5.3, 0); // its roof
    face(c, g, 4, 5, 1.6, mat.steel, pu + Math.sign(pu || 1) * 4.5, py + 2, 0.2); // a smaller block beside it
    for (const du of [-2.6, 2.6]) {
      const strut = face(c, g, 0.45, 7, 0.45, mat.dark, pu + du, py - 7.5, 1.4);
      if (c % 2) strut.rotation.x = (c === 1 ? 1 : -1) * 0.45; else strut.rotation.z = (c === 0 ? -1 : 1) * 0.45;
    }
  }
  for (const [y, du] of [[py - 5.8, pu], [Math.max(top(c), y0 + Hs * 0.4), -pu * 2]]) {
    if (y + 2 > y1) continue;
    face(c, g, 6.5, 0.2, 1.6, mat.grate, du, y, 0);
    face(c, detail, 6.5, 1.1, 0.06, mat.small, du, y + 0.65, 1.5); // rail
    face(c, g, 0.3, 0.2, 0.15, mat.lamp, du + 2.8, y + 2.4, 0); // work lamp, always drawn like every light
  }
}
