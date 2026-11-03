import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Bake every mesh's transform into its geometry and merge everything that shares a material, so the
// city draws in a few hundred calls instead of tens of thousands. (Merging per grid cell for culling was
// tried and measured: it multiplied draw calls and cost more than it saved.)
export function mergeByMaterial(root) {
  root.updateMatrixWorld(true);
  const buckets = new Map();
  root.traverse((o) => {
    if (!o.isMesh) return;
    const geo = new THREE.BufferGeometry();
    // Only the attributes every part has, so any two geometries can merge.
    for (const name of ['position', 'normal', 'uv']) geo.setAttribute(name, o.geometry.attributes[name]);
    if (o.geometry.index) geo.setIndex(o.geometry.index);
    const baked = geo.clone().applyMatrix4(o.matrixWorld);
    if (!buckets.has(o.material)) buckets.set(o.material, []);
    buckets.get(o.material).push(baked);
  });
  const out = new THREE.Group();
  for (const [material, geos] of buckets) {
    // mergeGeometries needs all-indexed or all-unindexed input.
    const list = geos.some((g) => !g.index) ? geos.map((g) => (g.index ? g.toNonIndexed() : g)) : geos;
    const mesh = new THREE.Mesh(mergeGeometries(list), material);
    mesh.castShadow = !material.transparent;
    mesh.receiveShadow = true;
    out.add(mesh);
  }
  return out;
}
