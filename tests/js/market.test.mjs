// The market halls built in code (web/src/market.js): the same tile builds the same hall, the frozen v4 seed-7
// snapshot gets every roof and open side, neighbours differ, and a blacked-out hall has no lit material. Its
// geometry is checked in mesh_geometry.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { market } from '../../web/src/market.js';
import { rng } from '../../web/src/geometry.js';
import { fixture, kitModel } from './harness.mjs';

// A kit whose materials are named after the call that made them ("glow:…", "sign:KUROTECH"), one per name, with the
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
const hall = (t, lit = t.on) => market(kit, rng(t.s), lit, 10, t.s);

const halls = fixture('sim-v4-seed7-t4032.json.gz').tiles.filter((t) => t.k === 'market');

test('the v4 seed-7 fixture has market halls', () => {
  assert.ok(halls.length >= 10, `${halls.length} halls`);
});

test('the same market tile builds the same hall, and no two in a row are the same', () => {
  const hashes = halls.map((t) => hash(hall(t)));
  assert.deepEqual(halls.map((t) => hash(hall(t))), hashes);
  for (let k = 1; k < hashes.length; k++) assert.notEqual(hashes[k], hashes[k - 1], `halls ${k - 1} and ${k}`);
});

test('the tile generator gives the hall one draw, the shop name, as the glTF did', () => {
  for (const t of halls.slice(0, 5)) {
    const a = rng(t.s), b = rng(t.s);
    market(kit, a, true, 10, t.s);
    b();
    assert.equal(a(), b());
  }
});

test('every roof and open side appears on v4 seed 7', () => {
  const seen = new Set(halls.map((t) => { const { roof, open } = hall(t).userData; return `${roof} ${open}`; }));
  assert.equal(seen.size, 6, [...seen].join(', '));
});

test('a blacked-out hall has no lit material; a lit one has its glows and signs', () => {
  for (const t of halls.slice(0, 12)) {
    assert.deepEqual([...lights(hall(t, true))].sort(), ['glow', 'sign'], `tile ${t.s}`);
    assert.deepEqual([...lights(hall(t, false))], [], `tile ${t.s}`);
  }
});
