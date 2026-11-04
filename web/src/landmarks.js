// Landmarks the eye finds first: the telecom tower on the roundabout where the boulevards meet, the railway station,
// and the spires on the city's tallest towers. Steady lights only (no flashing).
import * as THREE from 'three';
import { palette } from './palette.js';
import { box, cyl, part, ring } from './geometry.js';
import { F } from './world.js';

// The city's telecom tower, about 330 m to the tip: three tapering legs round a hexagonal core up to a main pod
// at 200 m (skirt, glazed band, observation deck, roof cone), a slimmer shaft to a small upper pod, then a white
// antenna mast. Lit halo rings and leg edges, steady red aircraft lamps up the mast.
const POD = 198;
export function telecomTower(kit, root, x, z) {
  const g = new THREE.Group(), stone = kit.concrete(palette.roseGrey), glass = kit.windows(3, true);
  const halo = kit.glow(palette.neonViolet, 3), edge = kit.glow(palette.neonPink, 2), red = kit.glow(palette.signal, 4);
  part(g, cyl(2.4, 3.4, POD, 6), stone, 0, POD / 2, 0);
  for (let k = 0; k < 3; k++) {
    const leg = new THREE.Group(), [foot, top] = [7, 2.6];
    part(leg, taper(foot, top, POD, 2.6), stone);
    part(leg, box(0.25, Math.hypot(POD, foot - top), 0.25, 0), edge, (foot + top) / 2, POD / 2, 0).rotation.z = Math.atan2(foot - top, POD);
    leg.rotation.y = (k * Math.PI * 2) / 3 + Math.PI / 6;
    g.add(leg);
  }
  part(g, cyl(12, 3, 12, 32), stone, 0, POD - 6, 0); // skirt under the pod
  part(g, cyl(12.5, 12.5, 6, 32), glass, 0, POD + 3, 0);
  part(g, cyl(13.6, 12.5, 2, 32), stone, 0, POD + 7, 0); // observation deck
  part(g, cyl(4, 13, 7, 32), stone, 0, POD + 11.5, 0);
  for (const [r, y] of [[12.2, POD], [13.7, POD + 6.2]]) ring(g, r, 0.18, halo, 0, y, 0, 64, 4);
  part(g, cyl(1.5, 2.3, 55, 6), stone, 0, POD + 15 + 27.5, 0);
  part(g, cyl(4, 4, 5, 20), glass, 0, POD + 72.5, 0); // upper pod
  part(g, cyl(1.2, 4, 2, 20), stone, 0, POD + 76, 0);
  ring(g, 4.2, 0.12, halo, 0, POD + 70, 0, 32, 4);
  part(g, cyl(0.35, 1.3, 58, 8), kit.steel(palette.cream, 0.5), 0, POD + 77 + 29, 0);
  for (const y of [POD + 95, POD + 118, POD + 135]) part(g, new THREE.SphereGeometry(0.6, 10, 8), red, 0, y, 0);
  g.position.set(x, 0, z);
  root.add(g);
}

// A prism along +x from the origin, `foot` long at the bottom narrowing to `top` long at height h, d thick.
function taper(foot, top, h, d) {
  const geo = new THREE.BoxGeometry(1, 1, d).translate(0.5, 0.5, 0), p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setXY(i, p.getX(i) * (p.getY(i) > 0.5 ? top : foot), p.getY(i) * h);
  geo.computeVertexNormals();
  return geo;
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
