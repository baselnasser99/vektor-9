// The power plants built in code (web/src/plant.js, ADR-0018): the same tile builds the same plant, the frozen v4
// seed-7 snapshot gets every layout, and a blacked-out plant has no lit material. Its geometry is checked in
// mesh_geometry.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { plantOn, powerPlant } from '../../web/src/plant.js';
import { rng } from '../../web/src/geometry.js';
import { fixture, kitModel } from './harness.mjs';

// A kit whose materials are named after the call that made them ("glow:…", "sign:KALDRA GRID"), one per name, with the
// real detail kit parts (their lit slots count as lights below).
const mats = new Map();
const tag = (name) => mats.get(name) ?? mats.set(name, Object.assign(new THREE.MeshStandardMaterial(), { name })).get(name);
const model = kitModel(() => new THREE.Group());
const kit = new Proxy({}, { get: (_, k) => (k === 'model' ? model : (...a) => tag(`${String(k)}:${a[0]}`)) });

// Every mesh's material name and world-space positions, in build order.
function hash(g) {
  const h = createHash('sha256');
  g.updateMatrixWorld(true);
  g.traverse((m) => {
    if (!m.isMesh) return;
    const p = m.geometry.attributes.position.clone().applyMatrix4(m.matrixWorld);
    h.update(m.material.name).update(new Uint8Array(new Float32Array(p.array).buffer));
  });
  return h.digest('hex');
}
const lights = (g) => {
  const out = new Set();
  g.traverse((m) => m.isMesh && /^(glow|sign|warning):/.test(m.material.name) && out.add(m.material.name.split(':')[0]));
  return out;
};

const plants = fixture('sim-v4-seed7-t4032.json.gz').tiles.filter((t) => t.k === 'plant');

test('the v4 seed-7 fixture has plants', () => {
  assert.ok(plants.length >= 10, `${plants.length} plants`);
});

test('the same plant tile builds the same plant geometry', () => {
  const hashes = plants.map((t) => hash(plantOn(kit, t)));
  assert.deepEqual(plants.map((t) => hash(plantOn(kit, t))), hashes);
  assert.ok(new Set(hashes).size > 1, 'every plant came out the same');
});

test('all three layouts appear on v4 seed 7', () => {
  const seen = new Set(plants.map((t) => plantOn(kit, t).userData.layout));
  assert.deepEqual([...seen].sort(), ['reactor', 'tower', 'twin']);
});

// The first seeds giving each layout and mirror: six plants.
const variants = () => {
  const found = new Map();
  for (let s = 0; found.size < 6; s++) {
    const { layout, mirrored } = powerPlant(kit, rng(s), true).userData;
    if (!found.has(`${layout} ${mirrored}`)) found.set(`${layout} ${mirrored}`, s);
  }
  return found;
};

test('a blacked-out plant has no lit material; a lit one has its glows, sign and red lamps', () => {
  for (const [name, s] of variants()) {
    assert.deepEqual([...lights(powerPlant(kit, rng(s), true))].sort(), ['glow', 'sign', 'warning'], name);
    assert.deepEqual([...lights(powerPlant(kit, rng(s), false))], [], name);
  }
});

test('no lamp or glow on any plant touches the operator\'s sign, at every hall height', () => {
  for (let s = 0; s < 300; s++) {
    const g = powerPlant(kit, rng(s), true), glows = [], signs = [];
    g.updateMatrixWorld(true);
    g.traverse((m) => m.isMesh && (m.material.name.startsWith('sign:') ? signs : m.material.name.startsWith('glow:') ? glows : []).push(new THREE.Box3().setFromObject(m)));
    const board = signs[0].clone().expandByVector(new THREE.Vector3(0, 0, 0.25)); // the backing box behind the face, and a hand's width in front
    for (const b of glows) assert.ok(!b.intersectsBox(board), `seed ${s}: a glow at y ${b.min.y.toFixed(2)} to ${b.max.y.toFixed(2)} touches the sign`);
  }
});
