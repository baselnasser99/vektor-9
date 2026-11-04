// Landmarks the eye finds first: the telecom tower on the roundabout where the boulevards meet, the railway station,
// and the spires on the city's tallest towers. Steady lights only (no flashing).
import * as THREE from 'three';
import { palette } from './palette.js';
import { box, cyl, part, ring } from './geometry.js';
import { F } from './world.js';
import { tree } from './parts.js';

// The city's telecom tower on the roundabout island, proportions in TOWER. One structural idea: three separate
// tapered concrete legs, leaning in from a foundation on the island to a point under the deck, tied together by
// concrete ring beams (with a maintenance walk on each), and a slim glass lift shaft between them. Six slender struts
// carry the deck from the leg tops; there is no cone. The deck is compact: one panoramic level of continuous
// glass, a set-back maintenance level under it and a shallow roof; above it a slender mast. Small parts (mullions,
// rails, walks, antenna gear) go in a detail group drawn only near the camera (userData.lod 'tower', city.js).
// Accents are thin cyan strips only; the aircraft lamps are steady red.
export const TOWER = {
  height: 260, // to the mast tip; the tallest towers reach about 100 m, so about 2.6x
  deck: 160, // floor of the maintenance level, under the observation level
  spread: 6.4, // leg centres from the middle at the ground (the island is 8 m)
  waist: 4.8, // leg centres from the middle where they stop, under the deck
  leg: [2.6, 1.8], // leg thickness at the ground and at the top
  ties: [40, 80, 120], // heights of the ring beams tying the legs together
  deckRadius: 10, // the observation glass: 20 m across
};

export function telecomTower(kit, root, x, z) {
  const { height, deck, spread, waist, leg, ties, deckRadius: R } = TOWER;
  const g = new THREE.Group(), detail = new THREE.Group();
  detail.userData.lod = 'tower';
  g.add(detail);
  const concrete = kit.concrete(palette.roseGrey), steel = kit.steel(palette.slate, 0.45), dark = kit.steel(palette.charcoal, 0.45);
  const cyan = kit.glow(palette.neonCyan, 1.2), red = kit.glow(palette.signal, 4), frame = kit.steel(palette.warmGrey, 0.4);
  const lamp = (lx, y, lz, r = 0.45) => part(g, new THREE.SphereGeometry(r, 8, 6), red, lx, y, lz);
  const top = deck - 6; // where the legs end, just under the struts' feet
  const at = (k, y) => { // centre of leg k at height y
    const a = (k * Math.PI * 2) / 3 + Math.PI / 2, r = spread + (waist - spread) * (y / top);
    return [Math.cos(a) * r, Math.sin(a) * r, a];
  };

  // Legs: tapered, leaning in, each squared to face the middle.
  for (let k = 0; k < 3; k++) {
    const [x0, z0, a] = at(k, 0), [x1, z1] = at(k, top);
    part(g, member([x0, 0, z0], [x1, top, z1], leg[0], leg[1], a), concrete);
  }
  // Concrete ring beams between the legs, a steel walk on each, a lamp on one leg at each beam.
  for (const y of ties) {
    for (let k = 0; k < 3; k++) {
      const [ax, az] = at(k, y), [bx, bz] = at((k + 1) % 3, y), len = Math.hypot(bx - ax, bz - az);
      const beam = part(g, box(len, 1.8, 1, 0), concrete, (ax + bx) / 2, y, (az + bz) / 2);
      beam.rotation.y = -Math.atan2(bz - az, bx - ax);
      const walk = part(detail, box(len, 0.12, 1.8, 0), dark, (ax + bx) / 2, y + 0.96, (az + bz) / 2);
      walk.rotation.y = beam.rotation.y;
    }
    const [lx, lz, a] = at(0, y);
    lamp(lx + Math.cos(a) * leg[0] * 0.5, y + 1.2, lz + Math.sin(a) * leg[0] * 0.5);
  }
  // The lift: a slim dark-glass shaft up the middle, a thin lit strip up one side.
  part(g, cyl(1.5, 1.5, deck, 8), kit.glass(palette.charcoal), 0, deck / 2, 0);
  part(g, box(0.12, deck - 4, 0.12, 0), cyan, 1.52, deck / 2 + 2, 0);

  // Six struts from the leg tops out to the deck's support ring, two per leg.
  for (let k = 0; k < 3; k++) {
    const [lx, lz, a] = at(k, top);
    for (const s of [-1, 1]) {
      const b = a + s * 0.45, foot = [lx, top, lz], head = [Math.cos(b) * (R - 1.6), deck, Math.sin(b) * (R - 1.6)];
      part(g, member(foot, head, 0.7, 0.5, b), steel);
    }
  }
  ring(g, R - 1.6, 0.3, steel, 0, deck, 0, 48, 6); // support ring under the deck

  // Deck: maintenance level (set back, louvred), floor slab, the panoramic level, a shallow roof with a cyan edge.
  part(g, cyl(R - 2, R - 2.4, 2.6, 36), kit.mat('metal_grate_rusty', palette.gunmetal), 0, deck + 1.3, 0);
  const glassY = 0.18 + 5.5 * Math.round((deck + 3 - 0.18) / 5.5); // on the facade grid (panorama style), one band
  part(g, cyl(R + 0.4, R + 0.4, 0.4, 48), dark, 0, glassY - 0.2, 0);
  part(g, cyl(R, R - 0.4, 5.5, 48), kit.windows(1, true, false, 'panorama'), 0, glassY + 2.75, 0);
  for (let k = 0; k < 36; k++) {
    const a = (k * Math.PI * 2) / 36, r = R - 0.15;
    part(detail, box(0.12, 5.5, 0.22, 0), frame, Math.cos(a) * r, glassY + 2.75, Math.sin(a) * r).rotation.y = -a;
  }
  ring(detail, R + 0.35, 0.04, dark, 0, glassY + 1.1, 0, 48, 3); // rail round the slab's edge
  const roofY = glassY + 5.5;
  part(g, cyl(R + 0.6, R + 0.6, 0.35, 48), dark, 0, roofY + 0.17, 0);
  part(g, cyl(R * 0.55, R + 0.2, 1.2, 48), steel, 0, roofY + 0.95, 0);
  for (let k = 0; k < 12; k++) { // seams across the roof, and a hut at the mast's foot
    const a = (k * Math.PI) / 6, slope = Math.atan2(1.2, R * 0.45 + 0.2), mid = (R * 0.55 + R + 0.2) / 2;
    part(detail, box(R * 0.45 + 0.3, 0.1, 0.18, 0), frame, Math.cos(a) * mid, roofY + 1, Math.sin(a) * mid).rotation.set(0, -a, -slope);
  }
  part(g, box(3.2, 2, 2.4, 0), steel, 0, roofY + 2.5, 2.2);
  ring(g, R + 0.62, 0.05, cyan, 0, roofY + 0.3, 0, 64, 3);

  // Mast: tapered steel, two small antenna platforms with panels, red lamps up it and at the tip.
  const m0 = roofY + 1.5, mast = height - m0;
  part(g, cyl(0.25, 0.9, mast, 8), kit.steel(palette.cream, 0.5), 0, m0 + mast / 2, 0);
  for (const f of [0.2, 0.5]) {
    const py = m0 + mast * f, r = 0.9 - 0.65 * f + 1;
    part(detail, cyl(r, r, 0.2, 10), dark, 0, py, 0);
    for (let k = 0; k < 3; k++) {
      const a = (k * Math.PI * 2) / 3;
      part(detail, box(0.2, 2.4, 0.7, 0), steel, Math.cos(a) * (r - 0.25), py + 1.3, Math.sin(a) * (r - 0.25)).rotation.y = -a;
    }
    lamp(r - 0.1, py + 0.3, 0, 0.35);
  }
  lamp(0, height + 0.3, 0, 0.5);
  g.position.set(x, 0, z);
  root.add(g);
}

// The tower's ground: the roundabout island as its plaza, reached like monuments on big roundabouts are, by
// underpasses. A stepped concrete foundation with a pile cap under each leg, a low glass entrance pavilion round the
// lift between the legs, paving and planting, an underpass stair on the island, and glazed underpass entrances on
// the four corner sidewalks. Nothing stands in the roads. c: the roundabout centre; w: the boulevard width.
export function towerBase(kit, root, c, w) {
  const g = new THREE.Group(), detail = new THREE.Group();
  detail.userData.lod = 'tower';
  g.add(detail);
  const concrete = kit.concrete(palette.roseGrey), paving = kit.concrete(palette.slate), dark = kit.steel(palette.charcoal, 0.45);
  const glass = kit.windows(3, true, false, 'shop'), green = kit.concrete(palette.teal), cyan = kit.glow(palette.neonCyan, 1);
  const { spread, leg } = TOWER;
  part(g, cyl(7.7, 7.9, 0.8, 40), concrete, 0, 0.6, 0); // foundation, stepped
  part(g, cyl(6.6, 7, 0.7, 40), paving, 0, 1.35, 0);
  for (let k = 0; k < 3; k++) {
    const a = (k * Math.PI * 2) / 3 + Math.PI / 2;
    const cap = part(g, box(leg[0] + 1.6, 1.4, leg[0] + 1.6, 1), concrete, Math.cos(a) * spread, 2.1, Math.sin(a) * spread);
    cap.rotation.y = -a;
    // Planting between the legs, one bed in each gap but the one with the underpass stair.
    const b = a + Math.PI / 3;
    if (k === 1) continue;
    part(detail, box(2.6, 0.5, 1.2, 0), green, Math.cos(b) * 5.4, 1.95, Math.sin(b) * 5.4).rotation.y = -b + Math.PI / 2;
    tree(kit, detail, Math.cos(b) * 5.4, Math.sin(b) * 5.4, 3.5);
  }
  // Entrance pavilion round the lift: low glass with a thin roof and a lit edge.
  part(g, cyl(3.4, 3.4, 3.6, 24), glass, 0, 1.7 + 1.8, 0);
  part(g, cyl(4, 4, 0.3, 24), dark, 0, 1.7 + 3.75, 0);
  ring(g, 4, 0.04, cyan, 0, 1.7 + 3.6, 0, 32, 3);
  // Underpass entrances: a glazed stair canopy on each corner sidewalk, and the stair up onto the island.
  const corner = w / 2 + 2;
  for (const [sx, sz] of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) {
    const ux = sx * corner, uz = sz * corner, canopy = new THREE.Group();
    part(canopy, box(2, 2.4, 3, 0), kit.glass(palette.charcoal), 0, 1.4, 0);
    part(canopy, box(2.3, 0.2, 3.3, 0), dark, 0, 2.7, 0);
    part(canopy, box(2.05, 0.1, 0.1, 0), cyan, 0, 2.55, 1.55);
    canopy.position.set(ux, 0.18, uz);
    canopy.rotation.y = Math.atan2(sx, sz) + Math.PI; // its open end faces the corner of the block
    g.add(canopy);
  }
  part(g, box(2.6, 1.6, 2, 0), dark, 0, 2.2, -5.6); // the island's stair head, in the third gap
  g.position.set(c, 0, c);
  root.add(g);
}

// A straight member from a to b ([x, y, z]), square in section: w0 wide at a, w1 at b, its faces turned by angle
// `turn` about the vertical so a leg faces the middle. Sections stay horizontal, so it suits members that rise.
function member(a, b, w0, w1, turn = 0) {
  const geo = new THREE.BoxGeometry(1, 1, 1), p = geo.attributes.position, c = Math.cos(-turn), s = Math.sin(-turn);
  for (let i = 0; i < p.count; i++) {
    const up = p.getY(i) > 0, [o, w] = up ? [b, w1] : [a, w0], [u, v] = [p.getX(i) * w, p.getZ(i) * w];
    p.setXYZ(i, o[0] + u * c - v * s, o[1], o[2] + u * s + v * c);
  }
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
