// Reusable parts in metres: girders, railings, pipes, cables, LED edges, lamps, drone pads, antennas, tanks.
import * as THREE from 'three';
import { palette } from './palette.js';
import { box, cyl, part, ring } from './geometry.js';

// Steel lattice girder along x: four chords, verticals and X bracing in each bay.
// seg: box detail (see geometry.js box); the city passes 1.
export function truss(kit, length, height, width, seg = 3) {
  const g = new THREE.Group(), steel = kit.steel(palette.gunmetal, 0.6);
  const bays = Math.max(1, Math.round(length / height));
  const bay = length / bays, diag = Math.hypot(bay, height), angle = Math.atan2(height, bay);
  for (const y of [0, height]) for (const z of [-width / 2, width / 2]) part(g, box(length, 0.22, 0.22, seg), steel, 0, y, z);
  for (let b = 0; b <= bays; b++) {
    const x = -length / 2 + b * bay;
    for (const z of [-width / 2, width / 2]) part(g, box(0.18, height, 0.18, seg), steel, x, height / 2, z);
    if (b === bays) continue;
    for (const z of [-width / 2, width / 2]) for (const s of [1, -1]) {
      part(g, box(diag, 0.12, 0.12, seg), steel, x + bay / 2, height / 2, z).rotation.z = s * angle;
    }
  }
  return g;
}

export function railing(kit, length, seg = 3) {
  const g = new THREE.Group(), steel = kit.steel(palette.charcoal);
  part(g, box(length, 0.06, 0.06, seg), steel, 0, 1.05, 0);
  part(g, box(length, 0.05, 0.05, seg), steel, 0, 0.55, 0);
  for (let x = -length / 2; x <= length / 2 + 0.01; x += 1.5) part(g, box(0.06, 1.1, 0.06, seg), steel, x, 0.55, 0);
  return g;
}

// Pipe through a list of points, with a flange and joint at every bend; seg is segments around.
export function pipe(kit, parent, points, r, mat, seg = 12) {
  const flange = kit.steel(palette.charcoal, 0.4), up = new THREE.Vector3(0, 1, 0);
  points = points.map((p) => new THREE.Vector3(...p));
  points.forEach((p, i) => {
    part(parent, new THREE.SphereGeometry(r * 1.05, seg, Math.ceil((seg * 2) / 3)), mat, p.x, p.y, p.z);
    if (i === 0) return;
    const a = points[i - 1], dir = p.clone().sub(a), len = dir.length();
    const tube = part(parent, cyl(r, r, len, seg), mat, ...a.clone().add(p).multiplyScalar(0.5).toArray());
    tube.quaternion.setFromUnitVectors(up, dir.normalize());
    for (const t of [0.12, 0.88]) {
      const f = part(parent, cyl(r * 1.35, r * 1.35, 0.12, seg), flange, ...a.clone().lerp(p, t).toArray());
      f.quaternion.copy(tube.quaternion);
    }
  });
}

// Sagging cable between two points.
export function cable(kit, parent, a, b, sag = 1.5) {
  const [pa, pb] = [new THREE.Vector3(...a), new THREE.Vector3(...b)];
  const mid = pa.clone().lerp(pb, 0.5);
  mid.y -= sag;
  const curve = new THREE.QuadraticBezierCurve3(pa, mid, pb);
  part(parent, new THREE.TubeGeometry(curve, 16, 0.04, 4), kit.steel(palette.deepNavy, 0.8));
}

// LED strips on the four vertical edges of a w x d volume, and around its top.
export function edgeLights(kit, parent, w, h, d, x, y0, z, color = palette.sodium) {
  const led = kit.glow(color, 1.1);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) part(parent, box(0.1, h, 0.1, 1), led, x + (sx * w) / 2, y0 + h / 2, z + (sz * d) / 2);
  for (const sz of [-1, 1]) part(parent, box(w, 0.1, 0.1, 1), led, x, y0 + h, z + (sz * d) / 2);
  for (const sx of [-1, 1]) part(parent, box(0.1, 0.1, d, 1), led, x + (sx * w) / 2, y0 + h, z);
}

// Sodium street lamp: curved pole with a warm head; returns the head position for an optional real light.
export function streetLamp(kit, parent, x, z, facing = 0) {
  const g = new THREE.Group(), pole = kit.steel(palette.charcoal, 0.6);
  part(g, cyl(0.09, 0.12, 6, 6), pole, 0, 3, 0);
  part(g, new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 6, 0), new THREE.Vector3(0, 6.9, 0),
    new THREE.Vector3(1.6, 6.7, 0)), 6, 0.07, 4), pole);
  part(g, box(0.7, 0.18, 0.35, 1), pole, 1.7, 6.65, 0);
  part(g, box(0.55, 0.06, 0.25, 1), kit.glow(palette.sodium, 8), 1.7, 6.54, 0).castShadow = false;
  g.position.set(x, 0, z);
  g.rotation.y = facing;
  parent.add(g);
  return new THREE.Vector3(1.7, 6.4, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), facing).add(g.position);
}

// Tree: a slim trunk and a low-poly crown, `h` metres tall.
export function tree(kit, parent, x, z, h = 6) {
  part(parent, cyl(0.12, 0.18, h * 0.55, 6), kit.steel(palette.charcoal, 0.8), x, h * 0.275, z);
  const crown = part(parent, new THREE.IcosahedronGeometry(h * 0.28, 0), kit.concrete(palette.teal), x, h * 0.7, z);
  crown.scale.set(1, 0.8, 1);
}

// close: false is city detail (cheap chamfers, fewer segments), as in plant.js.
export function dronePad(kit, parent, r, x, y, z, close = true) {
  const b = close ? 3 : 1, n = close ? 1 : 0.5;
  part(parent, cyl(r, r, 0.25, 32 * n), kit.steel(palette.charcoal, 0.7), x, y + 0.12, z);
  ring(parent, r * 0.8, 0.07, kit.glow(palette.neonCyan, 3), x, y + 0.27, z, 40 * n, 8 * n);
  for (const s of [-1, 1]) part(parent, box(0.18, 0.04, r * 0.9, b), kit.glow(palette.neonOrange, 2), x + s * r * 0.25, y + 0.27, z);
  part(parent, box(r * 0.5, 0.04, 0.18, b), kit.glow(palette.neonOrange, 2), x, y + 0.27, z);
}

export function antennaArray(kit, parent, x, y, z, close = true) {
  const steel = kit.steel(palette.gunmetal, 0.35), b = close ? 3 : 1, n = close ? 1 : 0.5;
  part(parent, box(0.15, 7, 0.15, b), steel, x, y + 3.5, z);
  for (const [h, w] of [[3, 2.2], [4.6, 1.6], [6, 1]]) part(parent, box(w, 0.08, 0.08, b), steel, x, y + h, z);
  const dish = part(parent, new THREE.SphereGeometry(1, 20 * n, 10 * n, 0, Math.PI * 2, 0, Math.PI / 4), kit.steel(palette.slate, 0.35), x + 1.4, y + 1.2, z);
  dish.rotation.z = -0.9;
  part(parent, new THREE.SphereGeometry(0.15, 8, 6), kit.glow(palette.signal, 2), x, y + 7.1, z);
}

export function waterTank(kit) {
  const g = new THREE.Group(), legs = kit.steel(palette.gunmetal, 0.6);
  for (const [x, z] of [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]]) part(g, box(0.15, 1.6, 0.15), legs, x, 0.8, z);
  part(g, cyl(1.3, 1.3, 2.2), kit.mat('box_profile_metal_sheet', palette.gunmetal), 0, 2.7, 0);
  part(g, cyl(0.2, 1.4, 0.6), kit.steel(palette.charcoal), 0, 4.1, 0);
  return g;
}
