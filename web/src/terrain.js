// Terrain the simulation lays out and never changes (ADR-0003): the railway, parks and the old industrial site.
// One builder per terrain tile, plus the railway viaduct, drawn once along the line the rail tiles follow.
import * as THREE from 'three';
import { palette } from './palette.js';
import { box, cyl, part } from './geometry.js';
import { streetLamp, tree } from './parts.js';
import { TILE } from './world.js';
import { duneHeight } from './desert.js';
import { station } from './landmarks.js';

const DECK = 8; // viaduct deck height: streets and alleys pass under it
const RUN = 1500; // metres of line each way from the city: past there the haze hides it

// Rail tile: a gravel bed under the viaduct.
export function railGround(kit) {
  const g = new THREE.Group();
  part(g, box(TILE, 0.2, TILE, 0), kit.concrete(palette.charcoal), 0, 0.1, 0);
  return g;
}

// Park: dark lawn, a path across it, a few trees, and a lamp when the park has power.
export function park(kit, rand, lit) {
  const g = new THREE.Group();
  part(g, box(13.4, 0.3, 13.4, 1), kit.concrete(palette.gunmetal), 0, 0.15, 0);
  part(g, box(2.2, 0.06, 13.4, 0), kit.concrete(palette.roseGrey), (rand() - 0.5) * 4, 0.32, 0);
  for (let k = 2 + Math.floor(rand() * 3); k > 0; k--) tree(kit, g, (rand() - 0.5) * 11, (rand() - 0.5) * 11, 5 + rand() * 4);
  if (lit) streetLamp(kit, g, 3, 3, rand() * Math.PI * 2);
  return g;
}

// Old industrial site: a corrugated-iron shed with a sawtooth roof, sometimes a chimney with a warning light.
export function works(kit, rand, lit) {
  const g = new THREE.Group(), h = 6 + Math.floor(rand() * 3) * 1.5;
  part(g, box(12, h, 12, 1), kit.mat('rusty_corrugated_iron', palette.brick), 0, h / 2, 0);
  for (let k = 0; k < 3; k++) {
    const tooth = part(g, box(4.1, 0.25, 12, 1), kit.mat('box_profile_metal_sheet', palette.gunmetal), -4 + k * 4, h + 1.1, 0);
    tooth.rotation.z = 0.55;
    if (lit) part(g, box(0.1, 1.4, 11, 0), kit.glow(palette.warmWindow, 0.8), -2.3 + k * 4, h + 0.9, 0);
  }
  if (rand() < 0.35) {
    part(g, cyl(0.7, 1, 24, 12), kit.concrete(palette.slate), 4, 12, 4);
    part(g, new THREE.SphereGeometry(0.3, 8, 6), kit.glow(palette.signal, 3), 4, 24.3, 4);
  }
  return g;
}

// The straight line through the rail tile centres (a least-squares fit): a point on it, its direction and angle.
export function railLine(centres) {
  if (centres.length < 2) return null;
  const n = centres.length, [mx, mz] = centres.reduce(([a, b], [x, z]) => [a + x / n, b + z / n], [0, 0]);
  let [sxx, szz, sxz] = [0, 0, 0];
  for (const [x, z] of centres) [sxx, szz, sxz] = [sxx + (x - mx) ** 2, szz + (z - mz) ** 2, sxz + (x - mx) * (z - mz)];
  const angle = Math.atan2(2 * sxz, sxx - szz) / 2;
  return { mx, mz, angle, ux: Math.cos(angle), uz: Math.sin(angle) };
}

// The viaduct along the rail line: a deck with two tracks and a lit edge, from a terminus station at the end
// nearer the centre, out past the city edge over the desert (riding the dunes) until the haze swallows it. Piers
// stand on rail tiles inside the city, everywhere outside it. centres: [x, z] of every rail tile; edge: the city's
// outer edge. Returns the line for the trains (life.js trains).
export function railway(kit, root, centres, edge) {
  const line = railLine(centres);
  if (!line) return null;
  const { mx, mz, angle, ux, uz } = line, ground = duneHeight(edge);
  const at = (t) => {
    const [x, z] = [mx + ux * t, mz + uz * t];
    return [x, DECK + ground(x, z), z];
  };
  const along = centres.map(([x, z]) => (x - mx) * ux + (z - mz) * uz), [lo, hi] = [Math.min(...along), Math.max(...along)];
  const dir = Math.hypot(...[0, 2].map((k) => at(lo)[k])) < Math.hypot(...[0, 2].map((k) => at(hi)[k])) ? 1 : -1;
  const end = dir > 0 ? lo - TILE / 2 : hi + TILE / 2, out = dir * RUN; // terminus, and the far end in the haze
  const deck = kit.concrete(palette.gunmetal), steel = kit.steel(palette.slate, 0.4), led = kit.glow(palette.sodium, 1);
  const onRail = (x, z) => centres.some(([cx, cz]) => Math.abs(x - cx) < TILE / 2 - 1 && Math.abs(z - cz) < TILE / 2 - 1);
  const span = 12, [t0, t1] = [Math.min(end, out), Math.max(end, out)];
  for (let t = t0; t < t1; t += span) {
    const [x, y, z] = at(t + span / 2), rise = at(t + span)[1] - at(t)[1], inside = Math.max(Math.abs(x), Math.abs(z)) < edge;
    const piece = new THREE.Group();
    part(piece, box(span + 0.05, 1.2, 9, 0), deck, 0, 0, 0);
    for (const off of [-2.6, -1.1, 1.1, 2.6]) part(piece, box(span + 0.05, 0.18, 0.12, 0), steel, 0, 0.69, off);
    for (const side of [-1, 1]) {
      part(piece, box(span + 0.05, 0.9, 0.3, 0), deck, 0, 1.05, side * 4.35);
      part(piece, box(span + 0.05, 0.1, 0.1, 0), led, 0, -0.65, side * 4.5);
    }
    piece.position.set(x, y, z);
    piece.rotation.set(0, -angle, Math.atan2(rise, span)); // a box's length runs along x; -angle points it along (ux, uz)
    root.add(piece);
    if (inside ? onRail(x, z) : Math.round(t / span) % 2 === 0) {
      const h = y - 0.6 - ground(x, z) + 1;
      part(root, box(1.6, h, 5, 1), deck, x, y - 0.6 - h / 2, z).rotation.y = -angle;
    }
  }
  const [sx, sy, sz] = at(end + dir * 37), hall = station(kit);
  hall.position.set(sx, sy, sz);
  hall.rotation.y = -angle + (dir > 0 ? Math.PI : 0); // its closed end, with the buffers, at the terminus
  root.add(hall);
  return { at, angle, side: [-uz, ux], end, out };
}
