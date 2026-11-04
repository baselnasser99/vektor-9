// Landmarks the eye finds first: the telecom tower on the plaza where the boulevards meet, the railway station,
// and the spires on the city's tallest towers. Steady lights only (no flashing).
import * as THREE from 'three';
import { palette } from './palette.js';
import { box, cyl, part, ring } from './geometry.js';
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
  const g = kit.piece('telecom_tower');
  g.traverse((o) => {
    if (!o.isMesh) return;
    o.material = roles[o.material.name];
    if (!o.material) throw new Error(`telecom tower: no material for mesh ${o.name}`);
  });
  g.getObjectByName('detail').userData.lod = 'tower';
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
