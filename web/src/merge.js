import * as THREE from 'three';

// Bake every mesh's transform into its geometry and merge everything that shares a material, so the
// city draws in a few hundred calls instead of tens of thousands. (Merging per grid cell for culling was
// tried and measured: it multiplied draw calls and cost more than it saved.)
// Writes straight into one buffer per material: cloning each part first made this most of the city's build time.
export function mergeByMaterial(root) {
  root.updateMatrixWorld(true);
  const buckets = new Map();
  root.traverse((o) => {
    if (!o.isMesh) return;
    if (!buckets.has(o.material)) buckets.set(o.material, []);
    buckets.get(o.material).push(o);
  });
  const out = new THREE.Group(), normalMatrix = new THREE.Matrix3();
  for (const [material, meshes] of buckets) {
    let verts = 0, count = 0;
    for (const { geometry: g } of meshes) {
      verts += g.attributes.position.count;
      count += g.index ? g.index.count : g.attributes.position.count;
    }
    // Only the attributes every part has, so any two geometries can merge; vertex colors only where the
    // material uses them (the desert ground).
    const pos = new Float32Array(verts * 3), nor = new Float32Array(verts * 3), uvs = new Float32Array(verts * 2);
    const colors = material.vertexColors && new Float32Array(verts * 3);
    const index = new (verts > 65535 ? Uint32Array : Uint16Array)(count);
    let base = 0, at = 0;
    for (const { geometry: g, matrixWorld } of meshes) {
      // Raw arrays with the matrix math inlined: every part is built in code, so no attribute is interleaved.
      const [p, n, t] = ['position', 'normal', 'uv'].map((name) => g.attributes[name].array), count = p.length / 3;
      const m = matrixWorld.elements, q = normalMatrix.getNormalMatrix(matrixWorld).elements;
      for (let i = 0, o = base * 3; i < count * 3; i += 3, o += 3) {
        // Same arithmetic as Vector3.applyMatrix4, applyMatrix3 and normalize, so the result matches to the bit.
        const x = p[i], y = p[i + 1], z = p[i + 2], a = n[i], b = n[i + 1], c = n[i + 2];
        const w = 1 / (m[3] * x + m[7] * y + m[11] * z + m[15]);
        pos[o] = (m[0] * x + m[4] * y + m[8] * z + m[12]) * w;
        pos[o + 1] = (m[1] * x + m[5] * y + m[9] * z + m[13]) * w;
        pos[o + 2] = (m[2] * x + m[6] * y + m[10] * z + m[14]) * w;
        const nx = q[0] * a + q[3] * b + q[6] * c, ny = q[1] * a + q[4] * b + q[7] * c, nz = q[2] * a + q[5] * b + q[8] * c;
        const s = 1 / (Math.sqrt(nx * nx + ny * ny + nz * nz) || 1);
        nor[o] = nx * s;
        nor[o + 1] = ny * s;
        nor[o + 2] = nz * s;
      }
      uvs.set(t, base * 2);
      if (colors) colors.set(g.attributes.color.array, base * 3);
      if (g.index) for (const k of g.index.array) index[at++] = base + k;
      else for (let i = 0; i < count; i++) index[at++] = base + i;
      base += count;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    if (colors) geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setIndex(new THREE.BufferAttribute(index, 1));
    const mesh = new THREE.Mesh(geo, material);
    mesh.castShadow = !material.transparent;
    mesh.receiveShadow = true;
    out.add(mesh);
  }
  return out;
}
