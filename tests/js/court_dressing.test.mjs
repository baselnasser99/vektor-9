// The HQ court's dressing (tiles.js courtPlan and dressCourt) on the frozen v4 seed-7 fixture: nothing within 1.5 m of
// a kiosk, on a walker path, within 1 m of a kerb or on a view axis; every item, and every mesh of the dressing, inside
// its own tile; nothing lit in a blackout; the same seed gives the same placement; and a campus not facing -x or +x
// gets no dressing at all (the guard). There is no v4 seed-3 fixture, so seed 3 is checked by hand only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { cityPlan } from '../../web/src/city.js';
import { rng } from '../../web/src/geometry.js';
import { network } from '../../web/src/people.js';
import { kerbOf } from '../../web/src/streets.js';
import { AXIS, court, courtPlan } from '../../web/src/tiles.js';
import { HALF, TILE } from '../../web/src/world.js';
import { fixture, kitModel } from './harness.mjs';

const mats = new Map();
const tag = (name) => mats.get(name) ?? mats.set(name, Object.assign(new THREE.MeshStandardMaterial(), { name })).get(name);
const model = kitModel(() => new THREE.Group());
const kit = new Proxy({}, { get: (_, k) => (k === 'model' ? model : (...a) => tag([String(k), ...a].join(':'))) });

const snap = fixture('sim-v4-seed7-t4032.json.gz'), { layout, hq } = cityPlan(snap), { n, pos } = layout;
const plan = courtPlan(snap, layout, hq);
// Each court tile as buildCity makes it: one draw for the sector's glass-or-concrete lean, then court().
const build = (i, lit = snap.tiles[i].on) => {
  const rand = rng(snap.tiles[i].s);
  rand();
  return court(kit, rand, lit, (i % n + 1) % HALF === 0, plan.get(i));
};
const tiles = [...plan.keys()].map((i) => ({ i, cx: pos(i % n), cz: pos(Math.floor(i / n)), g: build(i) }));

test('court dressing (v4 seed 7): what the court holds', () => {
  const kinds = {};
  for (const { g } of tiles) for (const [, , , k] of g.userData.court) kinds[k] = (kinds[k] ?? 0) + 1;
  assert.equal(plan.size, 12);
  assert.equal(kinds.feature, 1, 'one central feature');
  assert.ok(kinds.pillar >= 2 && kinds.pillar <= 3, `${kinds.pillar} pillars`);
  assert.ok(kinds.planter > 20 && kinds.lamp >= 10, JSON.stringify(kinds));
  assert.ok(tiles.some(({ g }) => g.userData.standing.length), 'people stand about');
});

test('court dressing (v4 seed 7): nothing near a kiosk, on a walker path, near a kerb or on a view axis', () => {
  const net = network(layout), paths = [];
  for (const lane of [1.9, 2.45, 3.0]) for (const jit of [-1.2, 0, 1.2]) for (let a = 0; a < net.N; a++) for (const e of net.adj[a]) {
    paths.push([net.node(a, lane), ...e.path({ lane, jit, back: 0.9, speed: 1.3 }).map((q) => [q[0], q[1]]), net.node(e.to, lane)]);
  }
  const seg = ([ax, az], [bx, bz], x, z) => {
    const dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz, f = L ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L)) : 0;
    return Math.hypot(ax + f * dx - x, az + f * dz - z);
  };
  const kerbs = layout.cross.flatMap((l) => [l.c - kerbOf(l), l.c + kerbOf(l)]), axes = [-243.5, -219.5, -195.5], bad = [];
  const kiosks = tiles.flatMap(({ g, cx, cz }) => {
    const k = g.children.find((c) => c.userData.kiosk);
    if (!k) return [];
    g.updateMatrixWorld(true);
    return [new THREE.Box3().setFromObject(k).translate(new THREE.Vector3(cx, 0, cz))];
  });
  assert.equal(kiosks.length, 5);
  for (const { g, cx, cz } of tiles) for (const [lx, lz, r, kind] of g.userData.court) { // groups' r covers their people (people.js courtGroup)
    const x = cx + lx, z = cz + lz, at = `${kind} at (${x.toFixed(1)}, ${z.toFixed(1)})`;
    for (const b of kiosks) if (Math.hypot(Math.max(b.min.x - x, 0, x - b.max.x), Math.max(b.min.z - z, 0, z - b.max.z)) - r < 1.5) bad.push(`${at}: by a kiosk`);
    if (paths.some((P) => P.some((p, s) => s && seg(P[s - 1], p, x, z) - r < 0.5))) bad.push(`${at}: on a walker path`);
    if (kerbs.some((c) => Math.abs(c - x) - r < 1 || Math.abs(c - z) - r < 1)) bad.push(`${at}: by a kerb`);
    if (axes.some((a) => Math.abs(z - a) < AXIS + r - 1e-9)) bad.push(`${at}: on a view axis`);
  }
  assert.deepEqual(bad, []);
});

test('court dressing (v4 seed 7): every item and every mesh inside its own tile', () => {
  const h = TILE / 2, bad = [];
  for (const { g, i } of tiles) {
    for (const [x, z, r, kind] of g.userData.court) if (Math.abs(x) + r > h || Math.abs(z) + r > h) bad.push(`${i} ${kind}`);
    const d = g.getObjectByName('dressing');
    g.updateMatrixWorld(true);
    d.traverse((m) => {
      if (!m.isMesh) return;
      const b = new THREE.Box3().setFromObject(m);
      if (b.min.x < -h - 1e-6 || b.max.x > h + 1e-6 || b.min.z < -h - 1e-6 || b.max.z > h + 1e-6) bad.push(`${i} mesh ${m.material.name || m.material.type}`);
    });
  }
  assert.deepEqual(bad, []);
});

test('court dressing (v4 seed 7): nothing lit in a blackout', () => {
  const litMats = (lit) => {
    const out = new Set();
    for (const { i } of tiles) build(i, lit).getObjectByName('dressing').traverse((m) => {
      if (m.isMesh && (m.material.type === 'MeshBasicMaterial' || /^(glow|sign):/.test(m.material.name))) out.add(m.material.name || m.material.type);
    });
    return [...out];
  };
  assert.ok(litMats(true).length >= 3, 'lamps, pools, pillars and the emblem light up');
  assert.deepEqual(litMats(false), []);
});

test('court dressing (v4 seed 7): the same seed gives the same placement', () => {
  const again = courtPlan(snap, layout, hq);
  assert.deepEqual([...again], [...plan]);
  for (const { i, g } of tiles) {
    const h = build(i);
    assert.deepEqual(h.userData.court, g.userData.court);
    assert.deepEqual(h.userData.standing, g.userData.standing);
  }
});

test('court dressing: a campus not facing -x or +x gets none (the guard)', () => {
  for (const heading of [0, Math.PI, 0.3]) assert.equal(courtPlan(snap, layout, { ...hq, heading }).size, 0, `heading ${heading}`);
  for (const { i } of tiles) {
    const rand = rng(snap.tiles[i].s);
    rand();
    const g = court(kit, rand, true, (i % n + 1) % HALF === 0, undefined); // what buildCity passes for a tile with no plan
    assert.equal(g.getObjectByName('dressing'), undefined);
    assert.equal(g.userData.court, undefined);
  }
});
