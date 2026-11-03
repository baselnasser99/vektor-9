// Geometry helpers shared by every builder: seeded randomness, boxes and cylinders with UVs in metres, placement.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const REPEAT = 4; // metres per texture repeat

// Small seeded generator so a texture (and a rooftop) looks the same on every load.
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Geometry with UVs in metres, so textures keep the same scale on every part.
export function metric(g, size) {
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    const [su, sv] = size(i);
    uv.setXY(i, (uv.getX(i) * su) / REPEAT, (uv.getY(i) * sv) / REPEAT);
  }
  return g;
}
// Box with rounded edges (radius scales with the thinnest side), UVs projected along each vertex's main normal axis.
const boxes = new Map();
// seg 0 is a plain box for distant filler, 1 a cheap chamfer for the city, 3 smooth for close-ups.
export function box(w, h, d, seg = 3) {
  // At city detail, thin parts (strips, beams, caps, signs) skip the chamfer: invisible from afar, 9x the triangles.
  if (seg <= 1 && Math.min(w, h, d) < 1.2) seg = 0;
  const key = `${w}:${h}:${d}:${seg}`;
  if (boxes.has(key)) return boxes.get(key);
  const g = seg ? new RoundedBoxGeometry(w, h, d, seg, Math.min(0.3, Math.min(w, h, d) * 0.3)) : new THREE.BoxGeometry(w, h, d);
  const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const [ax, ay, az] = [Math.abs(n.getX(i)), Math.abs(n.getY(i)), Math.abs(n.getZ(i))];
    const [u, v] = ax >= ay && ax >= az ? [p.getZ(i), p.getY(i)] : ay >= az ? [p.getX(i), p.getZ(i)] : [p.getX(i), p.getY(i)];
    uv.setXY(i, u / REPEAT, v / REPEAT);
  }
  boxes.set(key, g);
  return g;
}
export const cyl = (rt, rb, h, seg = 24, start = 0, len = Math.PI * 2) =>
  metric(new THREE.CylinderGeometry(rt, rb, h, seg, 1, false, start, len), () => [Math.max(rt, rb) * len, h]);

export function part(parent, geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  parent.add(m);
  return m;
}
// Flat torus; tubular segments go around the ring, radial ones around the tube.
export const ring = (parent, r, tube, mat, x, y, z, tubular = 40, radial = 8) => {
  const m = part(parent, new THREE.TorusGeometry(r, tube, radial, tubular), mat, x, y, z);
  m.rotation.x = Math.PI / 2;
  return m;
};
