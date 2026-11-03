// Close-up mid-rise for the sample page, with more detail than city buildings carry.
import * as THREE from 'three';
import { palette } from './palette.js';
import { box, cyl, part } from './geometry.js';
import { antennaArray, dronePad, edgeLights, railing, waterTank } from './parts.js';

// Mid-rise on a 12 m tile: shop podium with neon, a glass tower with fins and a cantilevered wing,
// balconies, a vertical LED screen, an old fire escape on the back, and a roof with a drone pad and antennas.
export function midRise(kit, floors = 12) {
  const g = new THREE.Group(), F = 3.5;
  const base = 2 * F, bodyH = (floors - 4) * F, topH = 2 * F, roof = base + bodyH;

  // Podium
  part(g, box(12, base, 12), kit.concrete(palette.slate), 0, F, 0);
  part(g, box(11, 2.6, 0.1), kit.glow(palette.neonOrange, 0.6), 0, 1.6, 6.01);
  part(g, box(12.4, 0.25, 1.8), kit.mat('box_profile_metal_sheet', palette.neonPink), 0, 3.2, 6.9).rotation.x = 0.12;
  part(g, box(6, 1.2, 0.25), kit.sign('ODEN 24', palette.neonOrange), -2, 5.2, 6.15);
  part(g, box(0.25, 5, 1.2), kit.sign('NOVA', palette.neonPink, true), 6.15, 4.5, 4.6);
  part(g, box(12.3, 0.14, 12.3), kit.glow(palette.neonRed, 2), 0, base - 0.12, 0);

  // Glass tower with mullion fins and slab edges
  part(g, box(10, bodyH, 10), kit.windows(1), 0, base + bodyH / 2, 0);
  for (let k = -5; k <= 5; k += 1.25) {
    for (const [x, z, w, d] of [[k, 5.05, 0.12, 0.35], [k, -5.05, 0.12, 0.35], [5.05, k, 0.35, 0.12], [-5.05, k, 0.35, 0.12]]) {
      part(g, box(w, bodyH, d), kit.steel(palette.gunmetal, 0.35), x, base + bodyH / 2, z);
    }
  }
  for (let y = base + F; y < roof; y += F) part(g, box(10.3, 0.3, 10.3), kit.concrete(palette.gunmetal), 0, y, 0);
  edgeLights(kit, g, 10.4, bodyH, 10.4, 0, base, 0);

  // Cantilevered concrete wing with ribbon windows
  const wingH = 4 * F, wingY = base + 2 * F;
  part(g, box(3, wingH, 7), kit.concrete(palette.gunmetal), -6.3, wingY + wingH / 2, 0.5);
  for (let y = wingY; y < wingY + wingH; y += F) part(g, box(3.06, 1.5, 7.06), kit.windows(2), -6.3, y + 1.7, 0.5);
  part(g, box(0.4, 0.4, 7), kit.steel(palette.gunmetal), -7.6, wingY - 0.2, 0.5);

  // Balconies on the front, every other floor
  for (let y = base + F; y < roof - F; y += 2 * F) {
    part(g, box(4, 0.2, 1.4), kit.concrete(palette.slate), 2.5, y, 5.7);
    part(g, box(4, 0.9, 0.05), kit.glass(palette.glassHighlight), 2.5, y + 0.55, 6.4);
  }

  // Neon tube sign: a ring with a chevron inside, on the front
  const neon = kit.glow(palette.neonMagenta, 3);
  const sign = part(g, new THREE.TorusGeometry(1.6, 0.09, 8, 48), neon, -2.5, base + bodyH * 0.6, 5.35);
  for (const s of [-1, 1]) part(g, box(1.6, 0.16, 0.16), kit.glow(palette.neonOrange, 3), -2.5 + s * 0.45, base + bodyH * 0.6, 5.35).rotation.z = s * 0.8;
  part(g, cyl(1.5, 1.5, 0.1, 32), kit.steel(palette.charcoal, 0.6), -2.5, base + bodyH * 0.6, 5.25).rotation.x = Math.PI / 2;
  sign.castShadow = false;

  // Vertical LED screen and an old fire escape on the back
  part(g, box(0.3, bodyH * 0.6, 2.8), kit.sign('VX9', palette.neonViolet, true), 5.4, base + bodyH * 0.55, -2.6);
  for (let y = base + 3; y + 9 < roof; y += 9) {
    const fe = kit.piece('modular_fire_escape');
    fe.position.set(0, y, -5.4);
    g.add(fe);
  }

  // Setback crown with a drone pad, antennas, tank and ducts
  part(g, box(7, topH, 7), kit.concrete(palette.slate), -1, roof + topH / 2, -1);
  for (let y = roof; y < roof + topH; y += F) part(g, box(7.06, 1.6, 7.06), kit.windows(3), -1, y + 1.6, -1);
  edgeLights(kit, g, 7.1, topH, 7.1, -1, roof, -1, palette.neonPink);
  dronePad(kit, g, 2.6, -1, roof + topH, -1);
  antennaArray(kit, g, 3.6, roof, -3.6);
  const tank = waterTank(kit);
  tank.position.set(3.3, roof, 3.3);
  g.add(tank);
  const duct = kit.piece('modular_airduct_circular_01', 'modular_airduct_circular_triple');
  duct.scale.setScalar(1.5);
  duct.position.set(-1, roof + 0.4, 3.8);
  g.add(duct);
  part(g, new THREE.PlaneGeometry(5, 1.25), kit.holo('SEIRA', palette.neonMagenta), -1, roof + topH + 3, 2.6);
  const edge = railing(kit, 10);
  edge.position.set(0, roof, 5);
  g.add(edge);
  return g;
}
