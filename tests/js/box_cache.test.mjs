// box() and slab() (geometry.js) hand out one shared geometry per size, so a caller that translates, rotates or
// scales one in place moves every other use of that size too. Builds the whole city (city.js buildCity, with the
// interchange) and the traffic with its signals (life.js, via the harness) on the frozen v3 seed-7 fixture, then
// checks that every cached geometry still spans exactly its size, centred on its origin. No exceptions.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildCity } from '../../web/src/city.js';
import { cachedBoxes } from '../../web/src/geometry.js';
import { city, fixture } from './harness.mjs';

const mat = new THREE.MeshStandardMaterial();
mat.emissiveMap = new THREE.Texture();
const model = () => { // an empty Blender model whose named parts appear when asked for
  const g = new THREE.Group(), find = g.getObjectByName.bind(g);
  g.getObjectByName = (n) => find(n) ?? g.add(Object.assign(new THREE.Group(), { name: n })).children.at(-1);
  return g;
};
const kit = new Proxy({}, { get: (_, k) => (k === 'model' ? model : k === 'foldDetail' ? (g) => g : () => mat) });

test('no shared box or slab geometry is changed in place while the city is built', () => {
  const snap = fixture('sim-v3-seed7-t288.json.gz');
  const info = console.info;
  console.info = () => {};
  try {
    buildCity(kit, snap);
    city(snap);
  } finally {
    console.info = info;
  }
  const moved = [], b = new THREE.Box3();
  for (const [key, g] of cachedBoxes()) {
    const [w, h, d] = key.replace(/^slab:/, '').split(':').map(Number);
    g.computeBoundingBox();
    b.copy(g.boundingBox);
    const want = [[-w / 2, -h / 2, -d / 2], [w / 2, h / 2, d / 2]], got = [b.min.toArray(), b.max.toArray()];
    if (want.some((p, i) => p.some((v, j) => Math.abs(v - got[i][j]) > 1e-4))) moved.push(key);
  }
  assert.ok(cachedBoxes().size > 100, `${cachedBoxes().size} cached geometries`);
  assert.deepEqual(moved, [], 'changed in place');
});
