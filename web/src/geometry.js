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
// Every box and slab made so far, by key (tests/js/box_cache.test.mjs checks none was changed in place: they are shared).
export const cachedBoxes = () => boxes;
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
// Indexed: three's copy has three vertices per triangle, but everything about a vertex follows from its place in
// the unit box, so corners at the same place are one vertex. Same triangles, same values, a fraction of the
// vertex work (the city is limited by vertices on integrated GPUs).
const templates = new Map();
function rounded(w, h, d, seg, radius) {
  if (!templates.has(seg)) {
    const S = seg * 2 + 1, base = new THREE.BoxGeometry(1, 1, 1, S, S, S), flat = base.toNonIndexed(), p = flat.attributes.position.array;
    const half = 0.5 / S, n = new THREE.Vector3(), sign = [], dir = [], index = new Uint16Array(p.length / 3), seen = new Map();
    for (let i = 0; i < p.length; i += 3) {
      const key = `${p[i]},${p[i + 1]},${p[i + 2]}`;
      if (seen.has(key)) {
        index[i / 3] = seen.get(key);
        continue;
      }
      seen.set(key, sign.length / 3);
      index[i / 3] = sign.length / 3;
      n.set(p[i], p[i + 1], p[i + 2]);
      n.x -= Math.sign(n.x) * half;
      n.y -= Math.sign(n.y) * half;
      n.z -= Math.sign(n.z) * half;
      n.normalize();
      for (let k = 0; k < 3; k++) {
        sign.push(Math.sign(p[i + k]));
        dir.push(n.getComponent(k));
      }
    }
    templates.set(seg, { sign, dir, normals: new Float32Array(dir), index, groups: base.groups });
  }
  const { sign, dir, normals, index, groups } = templates.get(seg), count = sign.length;
  const r = Math.min(w / 2, h / 2, d / 2, radius), half = [w / 2 - r, h / 2 - r, d / 2 - r], pos = new Float32Array(count);
  for (let i = 0; i < count; i++) pos[i] = half[i % 3] * sign[i] + dir[i] * r;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(normals.slice(), 3));
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array((count / 3) * 2), 2));
  g.setIndex(new THREE.BufferAttribute(index, 1)); // shared by every size; nothing writes to it
  for (const { start, count: n, materialIndex } of groups) g.addGroup(start, n, materialIndex);
  return g;
}
export const cyl = (rt, rb, h, seg = 24, start = 0, len = Math.PI * 2) =>
  metric(new THREE.CylinderGeometry(rt, rb, h, seg, 1, false, start, len), () => [Math.max(rt, rb) * len, h]);

// The turn about the vertical that points a model's front (+z) out along axis ('x' or 'z') toward side s (+1 or -1).
export const outward = (axis, s) => (axis === 'x' ? (s * Math.PI) / 2 : s > 0 ? 0 : Math.PI);

export function part(parent, geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  parent.add(m);
  return m;
}
// A sign w wide, h high and d deep at (x, y, z), its face to +z turned by `turn` about the vertical: a backing box in
// `back` and the sign's texture on a plane over its face (both faces if `both`). Never the sign on the box itself:
// box UVs are in metres (projectUV), so a box shows a stretched slice of the word (tests/js/signs.test.mjs).
const faces = new Map();
export function signBoard(parent, w, h, d, back, sign, x, y, z, turn = 0, both = false) {
  const s = new THREE.Group(), key = `${w}:${h}`;
  s.position.set(x, y, z);
  s.rotation.y = turn;
  parent.add(s);
  part(s, box(w, h, d, 0), back);
  if (!faces.has(key)) faces.set(key, new THREE.PlaneGeometry(w - 0.1, h - 0.1));
  for (const k of both ? [1, -1] : [1]) part(s, faces.get(key), sign, 0, 0, k * (d / 2 + 0.01)).rotation.y = k < 0 ? Math.PI : 0;
  return s;
}
// Flat torus; tubular segments go around the ring, radial ones around the tube.
export const ring = (parent, r, tube, mat, x, y, z, tubular = 40, radial = 8) => {
  const m = part(parent, new THREE.TorusGeometry(r, tube, radial, tubular), mat, x, y, z);
  m.rotation.x = Math.PI / 2;
  return m;
};

// Whether [x, z] lies inside polygon P ([x, z] corners).
export function insideRing(P, x, z) {
  let inside = false;
  for (let a = 0, b = P.length - 1; a < P.length; b = a++) {
    const [xa, za] = P[a], [xb, zb] = P[b];
    if (za > z !== zb > z && x < ((xb - xa) * (z - za)) / (zb - za) + xa) inside = !inside;
  }
  return inside;
}
// The distance from [x, z] to polygon P's outline.
export function toRing(P, x, z) {
  let d = Infinity;
  P.forEach((a, i) => {
    const b = P[(i + 1) % P.length], dx = b[0] - a[0], dz = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)));
    d = Math.min(d, Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz));
  });
  return d;
}
// Ring A less polygon B ([x, z] corners, any winding): the rings left, each wound as A (where their edges cross: A's
// edges outside B, then B's inside A, backward). A itself where they do not cross (B wholly inside A is not cut).
export function cutRing(A, B) {
  const area = (P) => P.reduce((s, p, i) => s + p[0] * P[(i + 1) % P.length][1] - P[(i + 1) % P.length][0] * p[1], 0);
  if (Math.sign(area(A)) !== Math.sign(area(B))) B = [...B].reverse();
  const hits = []; // { a: [edge, t], b: [edge, t], p }
  A.forEach((p, i) => {
    const q = A[(i + 1) % A.length];
    B.forEach((r, j) => {
      const s = B[(j + 1) % B.length], dx = q[0] - p[0], dz = q[1] - p[1], ex = s[0] - r[0], ez = s[1] - r[1], den = dx * ez - dz * ex;
      if (Math.abs(den) < 1e-12) return;
      const t = ((r[0] - p[0]) * ez - (r[1] - p[1]) * ex) / den, u = ((r[0] - p[0]) * dz - (r[1] - p[1]) * dx) / den;
      if (t >= 0 && t < 1 && u >= 0 && u < 1) hits.push({ a: i + t, b: j + u, p: [p[0] + dx * t, p[1] + dz * t] });
    });
  });
  if (hits.length < 2) return [A];
  // Each ring as a cycle of its corners and the crossings, in order along it.
  const walk = (P, key) => [...P.map((p, i) => ({ at: i, p })), ...hits.map((h) => ({ at: h[key], p: h.p, h }))].sort((m, n) => m.at - n.at);
  const ca = walk(A, 'a'), cb = walk(B, 'b');
  ca.forEach((n, i) => { if (n.h) n.h.ia = i; });
  cb.forEach((n, i) => { if (n.h) n.h.ib = i; });
  for (const h of hits) { // leaving B along A from here?
    const n = ca[(h.ia + 1) % ca.length], m = [(h.p[0] + n.p[0]) / 2, (h.p[1] + n.p[1]) / 2];
    h.out = !insideRing(B, m[0], m[1]);
  }
  const out = [];
  for (const start of hits) {
    if (!start.out || start.done) continue;
    const ring = [];
    let h = start;
    do {
      h.done = true;
      let i = h.ia; // along A, outside B, to the next crossing
      do { ring.push(ca[i].p); i = (i + 1) % ca.length; } while (!ca[i].h);
      const k = ca[i].h;
      let j = k.ib; // then back along B, inside A, to the next crossing
      do { ring.push(cb[j].p); j = (j - 1 + cb.length) % cb.length; } while (!cb[j].h);
      h = cb[j].h;
    } while (h !== start && !h.done);
    out.push(ring);
  }
  return out;
}
