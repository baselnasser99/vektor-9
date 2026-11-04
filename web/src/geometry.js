// Geometry helpers shared by every builder: seeded randomness, boxes and cylinders with UVs in metres, placement.
import * as THREE from 'three';

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
  const g = seg ? rounded(w, h, d, seg, Math.min(0.3, Math.min(w, h, d) * 0.3)) : new THREE.BoxGeometry(w, h, d);
  boxes.set(key, projectUV(g));
  return boxes.get(key);
}
// Plain box cut into pieces about `step` metres long, so the city's warp can bend it: long flat street parts.
export function slab(w, h, d, step = 6) {
  const key = `slab:${w}:${h}:${d}:${step}`;
  if (!boxes.has(key)) boxes.set(key, projectUV(new THREE.BoxGeometry(w, h, d, Math.ceil(w / step), 1, Math.ceil(d / step))));
  return boxes.get(key);
}
function projectUV(g) {
  const p = g.attributes.position.array, n = g.attributes.normal.array, uv = g.attributes.uv.array;
  for (let i = 0, j = 0; i < p.length; i += 3, j += 2) {
    const ax = Math.abs(n[i]), ay = Math.abs(n[i + 1]), az = Math.abs(n[i + 2]), sideways = ax >= ay && ax >= az;
    uv[j] = (sideways ? p[i + 2] : p[i]) / REPEAT;
    uv[j + 1] = (sideways ? p[i + 1] : ay >= az ? p[i + 2] : p[i + 1]) / REPEAT;
  }
  return g;
}

// three's RoundedBoxGeometry, without its work the city does not need: each vertex's rounding direction depends only
// on the detail level, so it is worked out once (template), and each size is the same two terms three computes,
// in the same order, so the vertices and normals match it to the bit. Its UVs are skipped (projectUV replaces them).
const templates = new Map();
function rounded(w, h, d, seg, radius) {
  if (!templates.has(seg)) {
    const S = seg * 2 + 1, base = new THREE.BoxGeometry(1, 1, 1, S, S, S), flat = base.toNonIndexed(), p = flat.attributes.position.array;
    const half = 0.5 / S, n = new THREE.Vector3(), sign = new Float64Array(p.length), dir = new Float64Array(p.length);
    for (let i = 0; i < p.length; i += 3) {
      n.set(p[i], p[i + 1], p[i + 2]);
      n.x -= Math.sign(n.x) * half;
      n.y -= Math.sign(n.y) * half;
      n.z -= Math.sign(n.z) * half;
      n.normalize();
      for (let k = 0; k < 3; k++) {
        sign[i + k] = Math.sign(p[i + k]);
        dir[i + k] = n.getComponent(k);
      }
    }
    templates.set(seg, { sign, dir, normals: new Float32Array(dir), groups: base.groups });
  }
  const { sign, dir, normals, groups } = templates.get(seg), count = sign.length;
  const r = Math.min(w / 2, h / 2, d / 2, radius), half = [w / 2 - r, h / 2 - r, d / 2 - r], pos = new Float32Array(count);
  for (let i = 0; i < count; i++) pos[i] = half[i % 3] * sign[i] + dir[i] * r;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(normals.slice(), 3));
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array((count / 3) * 2), 2));
  for (const { start, count: n, materialIndex } of groups) g.addGroup(start, n, materialIndex);
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
