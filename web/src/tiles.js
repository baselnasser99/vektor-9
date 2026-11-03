// One builder per tile kind (tower, construction site, market, plaza), all in metres on a 12 m footprint.
// The style seed drives every choice; a blacked-out tile has dark rooms and no neon.
import * as THREE from 'three';
import { palette } from './palette.js';
import { box, cyl, part } from './geometry.js';
import { antennaArray, dronePad, edgeLights } from './parts.js';

export const F = 3.5; // floor height
const TALL = 20; // floors; matches sim/rules.py
const WORDS = ['ODEN 24', 'NOVA', 'VX9', 'KORU', 'SEIRA', 'ZENKO', 'NEXA', 'TOKU']; // invented
const WARM = [palette.neonRed, palette.neonPink, palette.sodium, palette.neonOrange];
const AD_COLORS = [[palette.neonPink, palette.neonViolet], [palette.neonOrange, palette.neonRed], [palette.neonCyan, palette.neonViolet], [palette.sodium, palette.neonPink]];
const CAR_COLORS = [palette.charcoal, palette.slate, palette.sodium, palette.gunmetal, palette.cream];
const pick = (rand, list) => list[Math.floor(rand() * list.length)];

// Shop podium: concrete base with a lit shopfront, awning, sign and an LED strip. Dark during a blackout.
function podium(kit, g, rand, lit, warm) {
  part(g, box(12, 2 * F, 12, 1), kit.concrete(palette.slate), 0, F, 0);
  part(g, box(11, 2.6, 0.1, 1), lit ? kit.glow(palette.sodium, 0.8) : kit.glass(palette.charcoal), 0, 1.6, 6.01);
  part(g, box(12.4, 0.25, 1.8, 1), kit.mat('box_profile_metal_sheet', warm), 0, 3.2, 6.9).rotation.x = 0.12;
  if (!lit) return;
  if (rand() < 0.6) part(g, box(6, 1.2, 0.25, 1), kit.sign(pick(rand, WORDS), warm), 0, 5.2, 6.15);
  if (rand() < 0.5) part(g, box(12.3, 0.14, 12.3, 1), kit.glow(warm, 2), 0, 2 * F - 0.12, 0);
}

// Rooftop clutter: AC units and sometimes a water tank.
function clutter(kit, g, w, top, rand) {
  for (let k = Math.floor(rand() * 3); k > 0; k--) {
    part(g, box(1.6, 1, 1.2, 1), kit.steel(palette.slate), (rand() - 0.5) * (w - 2), top + 0.5, (rand() - 0.5) * (w - 2));
  }
  if (rand() < 0.3) {
    const [x, z] = [(rand() - 0.5) * (w - 3), (rand() - 0.5) * (w - 3)];
    part(g, cyl(1.3, 1.3, 2.2, 12), kit.mat('box_profile_metal_sheet', palette.gunmetal), x, top + 1.1, z);
    part(g, cyl(0.2, 1.4, 0.6, 12), kit.steel(palette.charcoal), x, top + 2.5, z);
  }
}

// One volume of rooms with a roof cap, so window textures never show on top. Returns the roof height.
function block(kit, g, w, y0, y1, wall, x = 0, z = 0) {
  part(g, box(w, y1 - y0, w, 1), wall, x, (y0 + y1) / 2, z);
  part(g, box(w + 0.4, 0.6, w + 0.4, 1), kit.steel(palette.charcoal), x, y1 + 0.3, z);
  return y1 + 0.6;
}

// Residential tower: optional shop podium, then a body whose shape comes from the style seed
// (plain, stepped, round, or with a wing), a setback crown on tall plain ones, signs and roof dressing.
export function tower(kit, floors, rand, lit, concrete) {
  const g = new THREE.Group(), H = floors * F, seed = Math.floor(rand() * 6), warm = pick(rand, WARM);
  const wall = (s) => kit.windows(s, lit, concrete);
  let y = 0;
  if (floors >= 6) {
    podium(kit, g, rand, lit, warm);
    y = 2 * F;
  }
  const shape = floors < 8 ? 'plain' : pick(rand, ['plain', 'plain', 'stepped', 'round', 'wing']);
  const tall = floors >= TALL, w = rand() < 0.5 ? 10.5 : 9.5;
  let roofW = w, roofY;
  if (shape === 'round') {
    const r = w / 2;
    part(g, cyl(r, r, H - y, 32), wall(seed), 0, (y + H) / 2, 0);
    part(g, cyl(r + 0.2, r + 0.2, 0.6, 32), kit.steel(palette.charcoal), 0, H + 0.3, 0);
    if (lit) for (let ry = y + 4 * F; ry < H; ry += 4 * F) ring(kit, g, r + 0.08, ry, warm);
    roofY = H + 0.6;
    roofW = w * 0.7;
  } else if (shape === 'stepped') {
    // Three tiers, each narrower, like a classic setback skyscraper.
    let y0 = y;
    for (const [frac, scale] of [[0.5, 1], [0.3, 0.8], [0.2, 0.6]]) {
      const y1 = y0 + (H - y) * frac;
      roofY = block(kit, g, w * scale, y0, y1, wall((seed + Math.round(scale * 5)) % 6));
      if (lit && scale < 1) edgeLights(kit, g, w * scale + 0.1, y1 - y0, w * scale + 0.1, 0, y0, 0, warm);
      y0 = y1;
    }
    roofW = w * 0.6;
  } else {
    const crown = tall ? (2 + Math.floor(rand() * 2)) * F : 0, top = H - crown;
    roofY = block(kit, g, w, y, top, wall(seed));
    if (lit && (tall || rand() < 0.35)) edgeLights(kit, g, w + 0.1, top - y, w + 0.1, 0, y, 0, warm);
    if (shape === 'wing') {
      // A wing hanging off one side, propped on a steel beam, with a lit strip underneath.
      const wy = y + (top - y) * (0.3 + rand() * 0.3), wh = Math.min(5 * F, top - wy);
      part(g, box(4, wh, 6.5, 1), wall((seed + 2) % 6), w / 2 + 2, wy + wh / 2, 0);
      part(g, box(4.4, 0.6, 6.9, 1), kit.steel(palette.charcoal), w / 2 + 2, wy - 0.3, 0);
      if (lit) part(g, box(4, 0.12, 0.12, 1), kit.glow(warm, 2), w / 2 + 2, wy - 0.65, 3.4);
    }
    if (crown) {
      roofW = w * 0.7;
      roofY = block(kit, g, roofW, roofY, H, wall((seed + 1) % 6));
      if (lit) edgeLights(kit, g, roofW + 0.1, crown, roofW + 0.1, 0, H - crown + 0.6, 0, rand() < 0.5 ? palette.neonPink : palette.neonCyan);
    }
  }
  // Vertical banner down one face.
  if (lit && rand() < 0.45) {
    const h = Math.min(24, (H - y) * 0.6), side = rand() < 0.5 ? 1 : -1;
    part(g, box(0.4, h, 2.6, 1), kit.sign(pick(rand, WORDS), warm, true), side * (w / 2 + 0.3), y + (H - y) * 0.5, w / 4);
  }
  clutter(kit, g, roofW, roofY, rand);
  if (tall && rand() < 0.6) antennaArray(kit, g, roofW / 2 - 1, roofY, -roofW / 2 + 1);
  if (tall && lit && rand() < 0.2) dronePad(kit, g, 2.2, -0.5, roofY, 0.5);
  // Rooftop billboard on a steel frame, or a hologram floating over the roof.
  if (lit && floors >= 8 && rand() < 0.22) {
    const [a, b] = pick(rand, AD_COLORS);
    for (const x of [-3.5, 3.5]) part(g, box(0.3, 4, 0.3, 1), kit.steel(palette.charcoal), x, roofY + 2, 0);
    part(g, box(9, 4.5, 0.4, 1), kit.billboard(pick(rand, WORDS), a, b), 0, roofY + 6, 0);
  } else if (lit && tall && rand() < 0.2) {
    part(g, new THREE.PlaneGeometry(8, 2), kit.holo(pick(rand, WORDS), warm), 0, roofY + 6, 0);
  }
  return g;
}

function ring(kit, g, r, y, color) {
  part(g, new THREE.TorusGeometry(r, 0.07, 4, 24), kit.glow(color, 2), 0, y, 0).rotation.x = Math.PI / 2;
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
export function construction(kit, floors, rand, lit) {
  const g = new THREE.Group(), H = Math.max(floors, 1) * F, scaffold = kit.steel(palette.sodium, 0.6);
  part(g, box(9, H, 9, 1), kit.concrete(palette.gunmetal), 0, H / 2, 0);
  for (const [x, z] of [[-5.2, -5.2], [5.2, -5.2], [-5.2, 5.2], [5.2, 5.2]]) part(g, box(0.3, H + 2, 0.3, 1), scaffold, x, (H + 2) / 2, z);
  for (let y = 2 * F; y <= H + 1; y += 2 * F) {
    for (const z of [-5.2, 5.2]) part(g, box(10.7, 0.25, 0.25, 1), scaffold, 0, y, z);
    for (const x of [-5.2, 5.2]) part(g, box(0.25, 0.25, 10.7, 1), scaffold, x, y, 0);
  }
  part(g, box(12, 2.4, 12, 1), kit.steel(palette.charcoal), 0, 1.2, 0);
  if (lit) {
    part(g, box(12.1, 0.12, 12.1, 1), kit.glow(palette.sodium, 2), 0, 2.4, 0);
    for (const x of [-4, 4]) part(g, box(0.8, 0.4, 0.4, 1), kit.glow(palette.glare, 3), x, H + 2.2, 5.2);
  }
  if (rand() < 0.35) {
    const mast = H + 18, lattice = kit.mat('metal_grate_rusty', palette.sodium);
    part(g, box(1.4, mast, 1.4, 1), lattice, 6.5, mast / 2, 6.5);
    part(g, box(28, 1.2, 1.2, 1), lattice, 6.5 - 8, mast, 6.5);
    part(g, box(3, 2, 2, 1), kit.concrete(palette.slate), 6.5 + 7, mast - 0.4, 6.5);
    part(g, box(2, 2, 2, 1), kit.steel(palette.charcoal), 6.5, mast - 2, 6.5);
    part(g, new THREE.SphereGeometry(0.3, 8, 6), kit.glow(palette.signal, 3), 6.5 - 22, mast + 0.8, 6.5);
  }
  return g;
}

// Market hall: low curved-roof shed with striped awnings, stall lights and a big sign.
export function market(kit, rand, lit) {
  const g = new THREE.Group(), warm = pick(rand, WARM);
  part(g, box(11, 4, 11, 1), kit.concrete(palette.gunmetal), 0, 2, 0);
  part(g, cyl(5.5, 5.5, 11, 16, -Math.PI / 2, Math.PI), kit.mat('box_profile_metal_sheet', palette.charcoal), 0, 4, 0).rotation.x = -Math.PI / 2;
  for (let k = 0; k < 4; k++) {
    part(g, box(2.6, 0.2, 1.6, 1), kit.mat('box_profile_metal_sheet', k % 2 ? palette.cream : warm), -3.9 + k * 2.6, 3, 6.2).rotation.x = 0.2;
  }
  if (!lit) return g;
  for (let k = 0; k < 4; k++) part(g, box(2, 0.15, 0.15, 1), kit.glow(palette.warmWindow, 2), -3.9 + k * 2.6, 2.6, 6.9);
  part(g, box(7, 1.6, 0.3, 1), kit.sign(pick(rand, WORDS), warm), 0, 9.8, 0).rotation.y = Math.PI / 2;
  return g;
}
