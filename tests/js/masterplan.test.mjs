// Regression tests for the masterplan (web/src/masterplan.js, ADR-0012), on seed 7 and two more seeds: every
// sector gets exactly one role, by fixed rules and precedence, the same on every run; the headquarters' sector is
// corporate, and with no headquarters no sector is; only corporate and frontier change between snapshots; and
// computing the plan changes nothing the city draws or drives on. The approach behind the headquarters is only
// described: a test builds it over to check that `closable` means what it says, but nothing in the city does.
// Run: node --import ./tests/js/three-loader.mjs --test "tests/js/*.test.mjs"
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { before, describe, test } from 'node:test';
import { city, series, snapshot } from './harness.mjs';
import { cityLayout, cityPlan, hqCut } from '../../web/src/city.js';
import { ROLES, masterplan } from '../../web/src/masterplan.js';
import { CARS } from '../../web/src/world.js';

const SEEDS = [7, 3, 11];
const FIXED = ['old', 'centre', 'gateway', 'industry', 'park']; // roles that never change for a seed
const S = 6, BLOCK = 8;
const tilesOf = (n, s) => Array.from({ length: BLOCK * BLOCK }, (_, k) => ((Math.floor(s / S) * BLOCK + Math.floor(k / BLOCK)) * n) + (s % S) * BLOCK + (k % BLOCK));
const planOf = (snap) => cityPlan(snap).layout.plan;
const clone = (snap) => JSON.parse(JSON.stringify(snap));

// Runs f with the renderer's self-checks collected instead of printed: [its result, the failed checks].
function checked(f) {
  const failed = [], assertion = console.assert, info = console.info;
  console.assert = (ok, ...msg) => ok || failed.push(msg.join(' '));
  console.info = () => {};
  try {
    return [f(), failed];
  } finally {
    console.assert = assertion;
    console.info = info;
  }
}

// What kindAt says along every corridor, both ways, every 7 m: the streets as streets.js, people.js and life.js see them.
const streetKinds = (layout) => layout.cross.flatMap((l) => ['x', 'z'].flatMap((axis) => {
  const out = [];
  for (let v = layout.lo; v <= layout.hi; v += 7) out.push(layout.kindAt(l, axis, v));
  return out;
}));

// A made-up headquarters' site on one side of sector s, with hqSite's geometry (headquarters.js): the 6 x 4 tiles
// straddling the sector's middle on that side. side: 0 front +z, 1 front -z, 2 front +x, 3 front -x.
function siteAt(s, side) {
  const [deep, axis, heading] = [[[4, 5, 6, 7], 'z', 0], [[0, 1, 2, 3], 'z', Math.PI], [[4, 5, 6, 7], 'x', Math.PI / 2], [[0, 1, 2, 3], 'x', -Math.PI / 2]][side];
  const [bx, by] = [s % S, Math.floor(s / S)];
  const cells = [1, 2, 3, 4, 5, 6].flatMap((a) => deep.map((d) => (axis === 'z' ? [bx * BLOCK + a, by * BLOCK + d] : [bx * BLOCK + d, by * BLOCK + a])));
  return { cells, heading, sector: s };
}

for (const seed of SEEDS) {
  describe(`seed ${seed}`, () => {
    let snap, layout, hq, plan;
    before(() => {
      snap = snapshot(seed);
      ({ layout, hq } = cityPlan(snap));
      plan = layout.plan;
    });

    test('every sector has exactly one role: the first rule it meets, in precedence order', () => {
      assert.equal(plan.roles.length, S * S);
      plan.matches.forEach((m, s) => {
        assert.ok(ROLES.includes(plan.roles[s]), `sector ${s}: unknown role ${plan.roles[s]}`);
        assert.equal(plan.roles[s], m[0]);
        assert.deepEqual(m, ROLES.filter((r) => m.includes(r)), `sector ${s}: matches out of order`);
        assert.equal(m.at(-1), 'residential');
      });
      assert.ok(plan.matches.some((m) => m.length > 2), 'no sector meets two rules: precedence is untested on this seed');
    });

    test('the fixed roles follow the terrain and the street plan', () => {
      const has = (role) => plan.matches.flatMap((m, s) => (m.includes(role) ? [s] : []));
      const town = [0, 1].flatMap((dy) => [0, 1].map((dx) => (layout.town[1] + dy) * S + layout.town[0] + dx)).sort((a, b) => a - b);
      assert.deepEqual(has('old'), town);
      assert.deepEqual(plan.roles.flatMap((r, s) => (r === 'old' ? [s] : [])), town);
      assert.deepEqual(has('centre'), [14, 15, 20, 21]); // the tower's plaza, round the middle crossing
      assert.deepEqual(has('gateway'), [16, 17, 22, 23]); // the interchange's land, the same on every seed
      assert.ok(has('industry').length >= 1, 'the railway always gives one sector 8 rail tiles');
      const n = snap.size, plaza = (i) => [i % n, Math.floor(i / n)].every((v) => Math.abs(v + 0.5 - n / 2) < 2);
      for (let s = 0; s < S * S; s++) {
        const park = tilesOf(n, s).filter((i) => snap.tiles[i].k === 'park' && !plaza(i)).length;
        assert.equal(has('park').includes(s), park >= 16, `sector ${s}: ${park} park tiles off the plaza`);
      }
    });

    test('the headquarters\' sector is corporate; with no headquarters no sector is', () => {
      assert.ok(hq, 'this seed has a headquarters');
      assert.deepEqual(plan.roles.flatMap((r, s) => (r === 'corporate' ? [s] : [])), [hq.sector]);
      const [none, failed] = checked(() => masterplan(snap, cityLayout(snap), null));
      assert.deepEqual(failed, []);
      assert.ok(!none.matches.flat().includes('corporate'));
      assert.equal(none.approach, null);
      assert.equal(none.roles[hq.sector], plan.matches[hq.sector][1], 'the sector falls back to its next rule');
      none.roles.forEach((r, s) => s === hq.sector || assert.equal(r, plan.roles[s], `sector ${s} changed without the headquarters`));
    });

    test('the same plan on every run, with no randomness', () => {
      const random = Math.random;
      Math.random = () => { throw new Error('Math.random called'); };
      try {
        const [a, b] = [planOf(clone(snap)), planOf(clone(snap))];
        assert.deepEqual({ ...a, hq: null }, { ...b, hq: null });
        assert.deepEqual({ ...a, hq: null }, { ...plan, hq: null });
      } finally {
        Math.random = random;
      }
    });

    test('computing the plan changes nothing it reads: the snapshot and every street stay as they were', () => {
      const before = JSON.stringify(snap), bare = cityLayout(snap), kinds = streetKinds(bare);
      masterplan(snap, bare, null);
      assert.equal(JSON.stringify(snap), before);
      assert.deepEqual(streetKinds(bare), kinds);
      const withHq = streetKinds(layout), { cut, kindAt } = layout;
      masterplan(snap, layout, hq);
      assert.equal(layout.cut, cut, 'layout.cut replaced');
      assert.equal(layout.kindAt, kindAt, 'layout.kindAt replaced');
      assert.deepEqual(streetKinds(layout), withHq);
    });

    test('the approach is data only: changing it changes no street', () => {
      const own = cityPlan(clone(snap)).layout, kinds = streetKinds(own);
      Object.assign(own.plan.approach, { kind: 'none', closable: true, v0: own.lo, v1: own.hi });
      assert.deepEqual(streetKinds(own), kinds);
    });

    test('the approach is the other half of the cut mid street, described and not applied', () => {
      const a = plan.approach, l = layout.cross[a.j], mid = (a.v0 + a.v1) / 2;
      assert.ok(l.mid, 'the approach runs along a mid street');
      assert.equal(a.v1 - a.v0, 4 * 14, 'four tiles long');
      assert.equal(a.kind, layout.kindAt(l, a.axis, mid), 'its kind is what the city draws there today');
      for (let v = a.v0 + 1; v < a.v1; v += 2) assert.ok(!layout.cut(l, a.axis, v), 'the campus does not reach the approach');
      assert.ok(layout.cut(l, a.axis, a.axis === 'z' ? hq.z : hq.x), 'the campus cuts the same street');
    });
  });
}

// Crossings with exactly one arm cars can use: dead ends. The lane graph's self-checks don't catch these (a stub
// just carries no cars), so the tests look for them directly. Each as 'j,j' (the corridors along x and z).
function deadEnds(layout) {
  const out = [];
  for (const a of layout.cross) for (const b of layout.cross) {
    const arms = [-1, 1].flatMap((d) => [layout.kindAt(a, 'x', b.c + d * (b.w / 2 + 1)), layout.kindAt(b, 'z', a.c + d * (a.w / 2 + 1))]);
    if (arms.filter((k) => CARS.has(k)).length === 1) out.push(`${a.j},${b.j}`);
  }
  return out;
}

// The layout with the approach built over too (what a later step might do), and the streets built from it:
// [the approach, failed self-checks, dead ends that weren't there before]. force: build it over even if not closable.
function overBuilt(snap, fake, force = false) {
  let approach = null, fresh = [];
  const [, failed] = checked(() => city(snap, (layout, real) => {
    if (fake) layout.cut = hqCut(layout, fake);
    approach = masterplan(snap, layout, fake ?? real).approach;
    if (!approach.closable && !force) return;
    const { cut } = layout, { j, axis, v0, v1 } = approach, before = deadEnds(layout);
    layout.cut = (l, ax, v) => cut(l, ax, v) || (l.j === j && ax === axis && v > v0 && v < v1);
    fresh = deadEnds(layout).filter((e) => !before.includes(e));
  }));
  return [approach, failed, fresh];
}

// What `closable` promises: building the approach over too leaves no new dead end, every lane usable and the
// walking network connected. Tried on each seed's real site and on made-up sites facing all four ways on seed 7.
describe('closable approaches keep the streets working when built over', () => {
  let built = 0;
  const check = ([approach, failed, fresh]) => {
    assert.deepEqual(failed, [], `closable ${approach.closable}`);
    assert.deepEqual(fresh, [], 'a new dead end');
    built += approach.closable;
  };
  for (const seed of SEEDS) test(`seed ${seed}: the real headquarters`, () => check(overBuilt(snapshot(seed))));
  for (const [s, side] of [[15, 0], [15, 1], [15, 2], [15, 3], [21, 0], [21, 3]]) {
    test(`seed 7: a site in sector ${s} facing ${['+z', '-z', '+x', '-x'][side]}`, () => check(overBuilt(snapshot(7), siteAt(s, side))));
  }
  test('most of them were closable, so were built over', () => assert.ok(built >= 5, `${built} of 9`));
  test('seed 3: its approach is not closable, and building it over anyway leaves a dead end', () => {
    const [approach, , fresh] = overBuilt(snapshot(3), null, true);
    assert.equal(approach.closable, false);
    assert.ok(fresh.length > 0, 'the guard should be needed here');
  });
});

// Between snapshots of one run, the fixed roles never change; a sector's role changes only where its corporate or
// frontier rule did. Seed 7 uses the local snapshots when they are there (every day of two weeks), else a fresh
// three-day run like the other seeds (every 6 hours).
describe('roles across ticks', () => {
  let changed = 0;
  const local = (k) => `snapshots/${String(k).padStart(6, '0')}.json`;
  for (const seed of SEEDS) {
    test(`seed ${seed}`, () => {
      const snaps = seed === 7 && existsSync(local(4032)) && JSON.parse(readFileSync(local(4032))).seed === 7
        ? Array.from({ length: 15 }, (_, d) => JSON.parse(readFileSync(local(d * 288))))
        : series(seed, 864, 72);
      const plans = snaps.map(planOf), first = plans[0];
      const fixed = (p, s) => p.matches[s].filter((r) => FIXED.includes(r));
      const moving = (p, s) => p.matches[s].filter((r) => r === 'corporate' || r === 'frontier');
      for (const p of plans) for (let s = 0; s < S * S; s++) {
        assert.deepEqual(fixed(p, s), fixed(first, s), `sector ${s}: a fixed role changed`);
        if (p.roles[s] === first.roles[s]) continue;
        changed++;
        assert.notDeepEqual(moving(p, s), moving(first, s), `sector ${s}: role changed with no rule changing`);
      }
    });
  }
  test('some role changed over the runs, so the rule above was exercised', () => assert.ok(changed > 0));
});
