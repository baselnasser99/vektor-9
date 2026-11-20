// Sound geometry in every merged mesh the interchange builds, on the frozen v3 fixtures: every position finite, every
// normal finite and of unit length, and no zero-area triangle. A zero normal is NaN in the shader once normalized, and
// bloom spreads one NaN pixel into a black frame: a parapet's landing end, where its section collapses to the road,
// drew a triangle with zero normals and blacked out the screen from (194, 22, -2) (docs/visual/VIEWS.md, view 31).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildInterchange } from '../../web/src/interchange.js';
import { mergeByMaterial } from '../../web/src/merge.js';
import { city, fixture } from './harness.mjs';

const mats = new Map();
const tag = (name) => mats.get(name) ?? mats.set(name, Object.assign(new THREE.MeshStandardMaterial(), { name, emissiveMap: new THREE.Texture() })).get(name);
const model = () => { const g = new THREE.Group(), d = new THREE.Group(); d.name = 'detail'; g.add(d); return g; };
const kit = new Proxy({}, { get: (_, k) => (k === 'model' ? model : k === 'foldDetail' ? (g) => g : (...a) => tag(`${String(k)}:${a[0]}`)) });
const AREA = 1e-8; // m²: below this a triangle has no real extent

for (const name of ['sim-v3-seed7-t288.json.gz', 'sim-v3-seed3-t288.json.gz']) {
  test(`${name}: every merged interchange mesh has finite positions, unit normals and no zero-area triangle`, () => {
    const snap = fixture(name), { layout } = city(snap), root = new THREE.Group();
    buildInterchange(kit, root, layout, snap);
    const merged = mergeByMaterial(root), wrong = [];
    merged.traverse((m) => {
      if (!m.isMesh) return;
      const g = m.geometry, P = g.attributes.position.array, N = g.attributes.normal.array, I = g.index?.array, what = m.material.name;
      const at = (v) => [P[v * 3], P[v * 3 + 1], P[v * 3 + 2]].map((c) => +c.toFixed(3)).join(', ');
      for (let v = 0; v < P.length / 3; v++) {
        const l = Math.hypot(N[v * 3], N[v * 3 + 1], N[v * 3 + 2]);
        if (![P[v * 3], P[v * 3 + 1], P[v * 3 + 2]].every(Number.isFinite)) wrong.push(`${what}: vertex ${v} not finite`);
        else if (!(Math.abs(l - 1) < 1e-3)) wrong.push(`${what}: normal of length ${l.toFixed(3)} at (${at(v)})`);
      }
      const n = I ? I.length : P.length / 3;
      for (let t = 0; t < n; t += 3) {
        const [a, b, c] = [0, 1, 2].map((k) => (I ? I[t + k] : t + k) * 3);
        const u = [0, 1, 2].map((k) => P[b + k] - P[a + k]), w = [0, 1, 2].map((k) => P[c + k] - P[a + k]);
        const area = Math.hypot(u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]) / 2;
        if (!(area >= AREA)) wrong.push(`${what}: zero-area triangle at (${at(a / 3)})`);
      }
    });
    assert.deepEqual(wrong.slice(0, 20), [], `${wrong.length} problems`);
  });
}
