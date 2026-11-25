// The HQ court's security kiosk (tiles.js court, the detail kit's kiosk part): the same tile builds the same kiosk;
// only a kiosk on the kerb faces the avenue and has a barrier arm, and its door is on the side away from the arm;
// one door each; the seeds give every canopy colour and both door sides; a blacked-out kiosk has no lit material and no warm glass.
// Its geometry is checked in mesh_geometry.test.mjs, its sign in signs.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { rng } from '../../web/src/geometry.js';
import { court } from '../../web/src/tiles.js';
import { kitModel } from './harness.mjs';

const mats = new Map();
const tag = (name) => mats.get(name) ?? mats.set(name, Object.assign(new THREE.MeshStandardMaterial(), { name })).get(name);
const model = kitModel(() => new THREE.Group());
const kit = new Proxy({}, { get: (_, k) => (k === 'model' ? model : (...a) => tag([String(k), ...a].join(':'))) });
const kioskOf = (g) => g.children.find((c) => c.userData.kiosk);
const slots = (k) => {
  const out = new Map();
  k.traverse((m) => m.isMesh && out.set(m.name, m.material.name));
  return out;
};

test('court kiosks: arm only on the kerb, facing the avenue, door away from it, one door; dark in a blackout', () => {
  const canopies = new Set(), doors = new Set();
  let kiosks = 0, arms = 0;
  for (let s = 0; s < 400; s++) for (const kerb of [false, true]) {
    const k = kioskOf(court(kit, rng(s), true, kerb));
    if (!k) continue;
    kiosks++;
    const { arm, door, canopy, turn } = k.userData.kiosk, sl = slots(k);
    assert.deepEqual(kioskOf(court(kit, rng(s), true, kerb)).userData.kiosk, k.userData.kiosk, 'the same tile, the same kiosk');
    assert.equal(sl.has('boom') && sl.has('stripe'), arm);
    assert.ok(!arm || kerb, 'an arm only where the kiosk faces the avenue');
    if (kerb) assert.equal(turn, Math.PI / 2, 'a kerb kiosk faces +x, the avenue');
    assert.equal(sl.has('door_l') + sl.has('door_r'), 1, 'one door');
    assert.ok(sl.has(door));
    if (arm) assert.equal(door, 'door_l', 'the door away from the arm');
    assert.ok(/^sign:/.test(sl.get('sign')) && /^glow:/.test(sl.get('lit')) && /^glow:/.test(sl.get('lamp')));
    assert.ok(/^veil:.*:.*:.*:/.test(sl.get('glass')), 'lit glass carries the warm cast');
    const dark = slots(kioskOf(court(kit, rng(s), false, kerb)));
    assert.ok(![...dark.values()].some((m) => /^(glow|sign):/.test(m)), [...dark.values()].join(' '));
    assert.match(dark.get('glass'), /^veil:[^:]*:[^:]*$/, 'blacked-out glass has no warm cast');
    canopies.add(canopy);
    doors.add(door);
    arms += arm;
  }
  assert.ok(kiosks > 150 && arms > 30, `${kiosks} kiosks, ${arms} arms`);
  assert.equal(canopies.size, 4);
  assert.equal(doors.size, 2);
});
