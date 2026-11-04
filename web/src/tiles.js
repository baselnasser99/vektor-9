// Builders for the non-house tiles (construction site, market, plaza) and the podium and roof dressing that houses
// share (families.js), in metres. fw is the building's footprint width (at most 12.5 m on a 14 m tile), so lots
// can hold smaller buildings with room around them.
// The style seed drives every choice; a blacked-out tile has dark rooms and no neon.
import * as THREE from 'three';
import { palette } from './palette.js';
import { box, cyl, part } from './geometry.js';
import { AD_COLORS, CAR_COLORS, F, WARM, WORDS, pick } from './world.js';

// Shop podium: concrete base with a lit shopfront, awning, sign and an LED strip. Dark during a blackout.
export function podium(kit, g, rand, lit, warm, fw) {
  const front = fw / 2;
  part(g, box(fw, 2 * F, fw, 1), kit.concrete(palette.slate), 0, F, 0);
  part(g, box(fw - 1, 2.6, 0.1, 1), lit ? kit.glow(palette.sodium, 0.8) : kit.glass(palette.charcoal), 0, 1.6, front + 0.01);
  part(g, box(fw + 0.4, 0.25, 1.8, 1), kit.mat('box_profile_metal_sheet', warm), 0, 3.2, front + 0.9).rotation.x = 0.12;
  if (!lit) return;
  if (rand() < 0.6) part(g, box(Math.min(6, fw - 2), 1.2, 0.25, 1), kit.sign(pick(rand, WORDS), warm), 0, 5.2, front + 0.15);
  if (rand() < 0.5) part(g, box(fw + 0.3, 0.14, fw + 0.3, 1), kit.glow(warm, 2), 0, 2 * F - 0.12, 0);
}

// Signs: a banner down one face, and over a roof with room in the middle (free) a billboard or, on tall
// buildings, a hologram. Roof gear itself is roofs.js.
export function dress({ kit, g, rand, lit, warm, H, y, w, tall }, floors, roofY, free) {
  if (lit && rand() < 0.45) {
    const h = Math.min(24, (H - y) * 0.6), side = rand() < 0.5 ? 1 : -1;
    part(g, box(0.4, h, 2.6, 1), kit.sign(pick(rand, WORDS), warm, true), side * (w / 2 + 0.3), y + (H - y) * 0.5, w / 4);
  }
  if (!lit || !free) return;
  if (floors >= 8 && rand() < 0.3) {
    const [a, b] = pick(rand, AD_COLORS);
    for (const x of [-3.5, 3.5]) part(g, box(0.3, 4, 0.3, 1), kit.steel(palette.charcoal), x, roofY + 2, 0);
    part(g, box(9, 4.5, 0.4, 1), kit.billboard(pick(rand, WORDS), a, b), 0, roofY + 6, 0);
  } else if (tall && rand() < 0.25) {
    part(g, new THREE.PlaneGeometry(8, 2), kit.holo(pick(rand, WORDS), warm), 0, roofY + 6, 0);
  }
}

// Empty lot as a small plaza: paving, parked cars (some of them taxis), sometimes a kiosk with a sign.
export function plaza(kit, rand, lit) {
  const g = new THREE.Group();
  part(g, box(12.6, 0.2, 12.6, 1), kit.concrete(palette.slate), 0, 0.1, 0);
  for (let k = Math.floor(2 + rand() * 4); k > 0; k--) {
    const [x, z] = [-3.5 + Math.floor(rand() * 3) * 3.5, -4 + Math.floor(rand() * 3) * 4];
    parkedCar(kit, g, x, z, rand);
  }
  if (rand() < 0.5) {
    const warm = pick(rand, WARM);
    part(g, box(3, 2.6, 2.4, 1), kit.steel(palette.charcoal), 4, 1.5, 4);
    if (lit) {
      part(g, box(2.6, 0.6, 0.15, 1), kit.sign(pick(rand, WORDS), warm), 4, 3.2, 5.25);
      part(g, box(2.4, 0.9, 0.1, 1), kit.glow(palette.warmWindow, 1), 4, 1.4, 5.22);
    }
  }
  return g;
}

function parkedCar(kit, g, x, z, rand) {
  part(g, box(1.9, 1.1, 4.4, 1), kit.steel(pick(rand, CAR_COLORS), 0.5), x, 0.85, z);
  part(g, box(1.7, 0.6, 2.4, 1), kit.glass(palette.charcoal), x, 1.7, z - 0.2);
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
    part(g, new THREE.SphereGeometry(0.3, 8, 6), kit.glow(palette.signal, 3), c - 22, mast + 0.8, c);
  }
  return g;
}

// Market hall: low curved-roof shed with striped awnings, stall lights and a big sign.
export function market(kit, rand, lit, fw) {
  const g = new THREE.Group(), warm = pick(rand, WARM), w = fw * 0.92, bay = w / 4.2;
  part(g, box(w, 4, w, 1), kit.concrete(palette.gunmetal), 0, 2, 0);
  part(g, cyl(w / 2, w / 2, w, 16, -Math.PI / 2, Math.PI), kit.mat('box_profile_metal_sheet', palette.charcoal), 0, 4, 0).rotation.x = -Math.PI / 2;
  for (let k = 0; k < 4; k++) {
    part(g, box(bay, 0.2, 1.6, 1), kit.mat('box_profile_metal_sheet', k % 2 ? palette.cream : warm), (k - 1.5) * bay, 3, w / 2 + 0.7).rotation.x = 0.2;
  }
  if (!lit) return g;
  for (let k = 0; k < 4; k++) part(g, box(bay * 0.77, 0.15, 0.15, 1), kit.glow(palette.warmWindow, 2), (k - 1.5) * bay, 2.6, w / 2 + 1.4);
  part(g, box(7, 1.6, 0.3, 1), kit.sign(pick(rand, WORDS), warm), 0, 9.8, 0).rotation.y = Math.PI / 2;
  return g;
}
