// Every sign built in code shows its whole texture: kit.sign's material sits only on quads whose UVs run 0 to 1
// (geometry.js signBoard), never on a box, whose UVs are in metres (projectUV) and show a stretched slice of the
// word. Checked on the merged city of each frozen fixture and on the builders whose signs a fixture may not reach.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildCity } from '../../web/src/city.js';
import { rng } from '../../web/src/geometry.js';
import { market } from '../../web/src/market.js';
import { powerPlant } from '../../web/src/plant.js';
import { podium } from '../../web/src/tiles.js';
import { KIT_SCENES, fixture } from './harness.mjs';

const mats = new Map();
const tag = (name) => mats.get(name) ?? mats.set(name, Object.assign(new THREE.MeshStandardMaterial(), { name, emissiveMap: new THREE.Texture() })).get(name);
const model = () => { // an empty Blender model whose named parts appear when asked for (their signs are the model's own UVs)
  const g = new THREE.Group(), find = g.getObjectByName.bind(g);
  g.getObjectByName = (n) => find(n) ?? g.add(Object.assign(new THREE.Group(), { name: n })).children.at(-1);
  return g;
};
const kit = new Proxy({}, { get: (_, k) => (k === 'model' ? model : k === 'foldDetail' ? (g) => g : (...a) => tag(`${String(k)}:${a[0]}`)) });

// The sign materials in the roots, and those drawn with any UV other than 0 or 1.
function signs(...roots) {
  const all = new Set(), wrong = new Set();
  for (const r of roots) r.traverse((m) => {
    if (!m.isMesh || !m.material.name.startsWith('sign:')) return;
    all.add(m.material.name);
    if (!m.geometry.attributes.uv.array.every((v) => v === 0 || v === 1)) wrong.add(m.material.name);
  });
  return { all, wrong: [...wrong] };
}
const quiet = (f) => {
  const info = console.info;
  console.info = () => {};
  try { return f(); } finally { console.info = info; }
};

for (const name of ['sim-v3-seed7-t288.json.gz', 'sim-v3-seed3-t288.json.gz', 'sim-v4-seed7-t4032.json.gz']) {
  test(`${name}: every sign in the merged city is on whole quads`, () => {
    const { city } = quiet(() => buildCity(kit, fixture(name)));
    const { all, wrong } = signs(city, ...city.userData.lods);
    assert.ok(all.size > 5, `${all.size} signs`);
    assert.deepEqual(wrong, []);
  });
}

test('the plant gate, the market ridge and the shop podium signs are on whole quads', () => {
  const roots = [];
  for (let s = 0; s < 12; s++) {
    roots.push(powerPlant(kit, rng(s), true), market(kit, rng(s), true, 10, s));
    const g = new THREE.Group();
    podium(kit, g, () => 0, true, '#ffaa00', 10 + (s % 3)); // rand 0: the sign is always there
    roots.push(g);
  }
  const { all, wrong } = signs(...roots);
  assert.ok(all.size >= 3, `${all.size} signs`);
  assert.deepEqual(wrong, []);
});

test('the court kiosk\'s sign (the detail kit part) is on a whole quad', () => {
  const quads = [];
  KIT_SCENES['kit-detail/kiosk'].traverse((m) => m.isMesh && m.material.name === 'sign' && quads.push(m));
  assert.equal(quads.length, 1);
  const uv = quads[0].geometry.attributes.uv.array;
  assert.equal(uv.length, 8, 'one quad');
  assert.ok(uv.every((v) => v === 0 || v === 1), [...uv].join(' '));
});
