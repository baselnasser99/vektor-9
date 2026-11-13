// The landmark heights the simulation's clearance rule uses (sim/rules.py TOWER_FLOORS and HQ_FLOORS, ADR-0015) are
// the renderer's: each model's top in metres, from its glTF bounds where the renderer places it, over the renderer's
// floor height F, to the nearest floor. Python never reads the models, so this test keeps the two in step.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import './harness.mjs';
import { F } from '../../web/src/world.js';
import { HQ } from '../../web/src/headquarters.js';

const root = new URL('../../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const rule = (name) => Number(read('sim/rules.py').match(new RegExp(`^${name} = (\\d+)`, 'm'))[1]);

// The highest point of a model, in its own frame: every mesh's position bounds through its node transforms.
function top(name) {
  const g = JSON.parse(read(`web/assets/models/${name}/${name}.gltf`));
  let y = -Infinity;
  const walk = (i, parent) => {
    const n = g.nodes[i], m = new THREE.Matrix4();
    if (n.matrix) m.fromArray(n.matrix);
    else m.compose(new THREE.Vector3(...(n.translation ?? [0, 0, 0])), new THREE.Quaternion(...(n.rotation ?? [0, 0, 0, 1])), new THREE.Vector3(...(n.scale ?? [1, 1, 1])));
    const world = parent.clone().multiply(m);
    for (const p of n.mesh === undefined ? [] : g.meshes[n.mesh].primitives) {
      const a = g.accessors[p.attributes.POSITION];
      y = Math.max(y, new THREE.Box3(new THREE.Vector3(...a.min), new THREE.Vector3(...a.max)).applyMatrix4(world).max.y);
    }
    for (const c of n.children ?? []) walk(c, world);
  };
  for (const r of g.scenes[g.scene ?? 0].nodes) walk(r, new THREE.Matrix4());
  return y;
}

test('the floor height is the one the landmark floors were converted with', () => {
  assert.equal(F, 3.5);
});

test("TOWER_FLOORS is the telecom tower's top, where streets.js stands it", () => {
  const base = Number(read('web/src/streets.js').match(/telecomTower\(kit, root, c, ([\d.]+), c\)/)[1]);
  assert.equal(Math.round((base + top('telecom_tower')) / F), rule('TOWER_FLOORS'));
});

test("HQ_FLOORS is the headquarters' roof, on top of its stack", () => {
  const foot = HQ.stack.find(([kind]) => kind === 'roof')[1];
  const roof = foot + Math.max(top('hq_roof_l'), top('hq_roof_r'));
  assert.equal(Math.round(roof / F), rule('HQ_FLOORS'));
});
