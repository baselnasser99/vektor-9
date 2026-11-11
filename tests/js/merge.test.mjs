// The merge's self-check (web/src/merge.js): a part scaled flat on an axis bakes to zero normals, NaN in the shader,
// which bloom spreads into screen-sized black blocks; the merge flags it, and passes sound parts in silence.
// Run: node --import ./tests/js/three-loader.mjs --test "tests/js/*.test.mjs"
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { mergeByMaterial } from '../../web/src/merge.js';

function failedChecks(scale) {
  const root = new THREE.Group(), part = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
  part.scale.set(...scale);
  root.add(part);
  const failed = [], assertion = console.assert;
  console.assert = (ok, ...msg) => ok || failed.push(msg.join(' '));
  try {
    mergeByMaterial(root);
  } finally {
    console.assert = assertion;
  }
  return failed;
}

test('a part scaled flat is flagged', () => assert.match(failedChecks([1, 0, 1]).join(), /scaled flat/));
test('sound parts pass, mirrored ones too', () => {
  assert.deepEqual(failedChecks([2, 0.01, 3]), []);
  assert.deepEqual(failedChecks([-1, 1, 1]), []);
});
