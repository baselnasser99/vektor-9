// Regression tests for circulation at the interchange (audit P0-1 and P0-2), on seed 7 and two more seeds:
// walkers cross the ramps' low ends only when no car is on them, and cars there give way to them; and at every
// merge, cars take turns, so no two cars' bodies ever overlap where two lanes run into one, without starving a lane.
// Run: node --import ./tests/js/three-loader.mjs --test "tests/js/*.test.mjs"
import assert from 'node:assert/strict';
import { before, describe, test } from 'node:test';
import { city, snapshot } from './harness.mjs';
import { plan, sidewalkCrossings } from '../../web/src/interchange.js';
import { rampClear, zebraUse } from '../../web/src/life.js';

const SEEDS = [7, 3, 11];
const YIELD_MAX = 25; // s: life.js YIELD (5) plus the longest crossing a walker already on it needs to finish (15 m at 1.3 m/s)
const CAR = 4.4; // life.js car length; bodies are 1.9 m wide

// The point d along a lane's polyline E, as [x, z].
function on(E, d) {
  d = Math.max(0, Math.min(E.len, d));
  let i = 1;
  while (i < E.cum.length - 1 && E.cum[i] < d) i++;
  const f = (d - E.cum[i - 1]) / Math.max(1e-9, E.cum[i] - E.cum[i - 1]), a = E.pts[i - 1], b = E.pts[i];
  return [a[0] + (b[0] - a[0]) * f, a[2] + (b[2] - a[2]) * f];
}
// A car's body on lane E at d: a 4.4 x 1.9 m rectangle along its path (axles 1.4 m either side, as life.js places it).
function body(E, d) {
  const r = on(E, d - 1.4), f = on(E, d + 1.4), l = Math.hypot(f[0] - r[0], f[1] - r[1]) || 1, u = [(f[0] - r[0]) / l, (f[1] - r[1]) / l];
  return { c: [(r[0] + f[0]) / 2, (r[1] + f[1]) / 2], u, v: [-u[1], u[0]] };
}
const overlap = (A, B) => [A.u, A.v, B.u, B.v].every((ax) => {
  const ext = (R) => (CAR / 2) * Math.abs(R.u[0] * ax[0] + R.u[1] * ax[1]) + 0.95 * Math.abs(R.v[0] * ax[0] + R.v[1] * ax[1]);
  return Math.abs((A.c[0] - B.c[0]) * ax[0] + (A.c[1] - B.c[1]) * ax[1]) < ext(A) + ext(B);
});

for (const seed of SEEDS) {
  describe(`seed ${seed}`, () => {
    let C, failed;
    before(() => {
      // The renderer's own load-time self-checks (walking network connected, no stuck lanes, no zero-length ways,
      // slip lanes found) report through console.assert, which does not throw: collect them.
      failed = [];
      const assertion = console.assert, info = console.info;
      console.assert = (ok, ...msg) => ok || failed.push(msg.join(' '));
      console.info = () => {};
      try {
        C = city(snapshot(seed));
      } finally {
        console.assert = assertion;
        console.info = info;
      }
    });

    test('the self-checks pass: walking network connected, every lane usable', () => {
      assert.deepEqual(failed, []);
    });

    test('every sidewalk walk over a ramp waits before it and is marked while on it (P0-1)', () => {
      const { layout, net } = C, decks = plan(layout).decks;
      // Low parts of decks (top under 1.2 m), with the half-width buildInterchange gives them.
      const low = decks.map((d) => {
        const along = [0];
        for (let i = 1; i < d.pts.length; i++) along.push(along[i - 1] + Math.hypot(d.pts[i][0] - d.pts[i - 1][0], d.pts[i][2] - d.pts[i - 1][2]));
        return d.pts.map((q, i) => [q, Math.min(d.half ?? 4, 1.8 + 2.2 * Math.min(1, (d.pts[0][1] < 1 ? along[i] : along.at(-1) - along[i]) / 25))]);
      });
      const onDeck = (x, z) => low.some((pts) => pts.some(([q, half]) => q[1] < 1.2 && Math.hypot(q[0] - x, q[2] - z) < half - 0.3));
      const walker = { lane: 2.4, jit: 0, back: 0, speed: 1.3 };
      let crossed = 0;
      for (let a = 0; a < net.N; a++) for (const e of net.adj[a]) {
        if (e.kind !== 'side') continue;
        const pts = [[...net.node(a, walker.lane)], ...e.path(walker), [...net.node(e.to, walker.lane)]];
        let held = false; // between a ramp wait and the point past the ramp
        for (let k = 1; k < pts.length; k++) {
          if (pts[k - 1][2]?.ramp) held = true;
          const [x0, z0] = pts[k - 1], [x1, z1] = pts[k], L = Math.hypot(x1 - x0, z1 - z0);
          for (let s = 0; s <= L; s += 0.25) {
            if (!onDeck(x0 + ((x1 - x0) * s) / L, z0 + ((z1 - z0) * s) / L)) continue;
            assert.ok(held && String(pts[k][3]).startsWith('ramp|'), `link ${a}->${e.to} walks onto a ramp near (${x0.toFixed(0)}, ${z0.toFixed(0)}) without waiting`);
            crossed++;
            break;
          }
          if (String(pts[k][3]).startsWith('ramp|')) held = false;
        }
      }
      if (layout.expressway) assert.ok(crossed > 0, 'no sidewalk crosses a ramp: the check found nothing to check');
    });

    test('every ramp crossing walkers use has cars that give way on it', () => {
      const { layout, roads } = C;
      const keys = new Set(plan(layout).decks.flatMap((d) => sidewalkCrossings(layout, d.pts)).map((w) => w.key));
      const lanes = new Set(roads.links.flatMap((L) => (L.walks ?? []).map((w) => w.key)));
      for (const k of keys) assert.ok(lanes.has(k), `${k}: walkers wait there but no car lane knows it`);
    });

    test('with a walker on each ramp crossing, no car drives onto it; once gone, cars go on (P0-1)', () => {
      const { roads, run } = C, crossings = roads.links.flatMap((L) => (L.walks ?? []).map((w) => [L, w]));
      const onIt = ([L, w]) => L.edge.cars.filter((c) => c.d + CAR / 2 > w.a - 0.5 && c.d - CAR / 2 < w.b + 0.5);
      run(30); // let traffic settle
      const there = new Set(crossings.flatMap(onIt)); // already on it when the walkers arrive: they drive off it
      let entered = 0, now = 0;
      run(60, (t) => {
        now = t;
        for (const [, w] of crossings) zebraUse.set(w.key, t);
        for (const x of crossings.flatMap(onIt)) if (!there.has(x)) entered++;
      });
      assert.equal(entered, 0, 'a car drove onto a ramp crossing with a walker on it');
      for (const k of crossings.map(([, w]) => w.key)) assert.ok(rampClear(k, now + 1), `${k}: still a car on it after a minute of giving way`);
      const passed = new Set();
      run(120, () => {
        for (const x of crossings.flatMap(onIt)) passed.add(x);
      });
      assert.ok(passed.size > 0, 'no car crossed a ramp crossing after the walkers left: the ramps are stuck');
    });

    test('at merges, no two cars overlap, and every lane in keeps moving (P0-2)', () => {
      const { roads, run } = C, merges = roads.nodes.filter((N) => N.type === 'free' && N.ins.length > 1);
      assert.ok(merges.length > 0);
      const zone = merges.map((N) => [N, [
        ...N.ins.map((I) => [I.edge, (x) => I.edge.len - x.d < 40]),
        ...N.ins.flatMap((I) => I.moves.map((m) => [m.edge, () => true])),
        ...N.outs.map((O) => [O.edge, (x) => x.d < 15]),
      ]]);
      const hits = [], through = new Map(merges.flatMap((N) => N.ins.map((I) => [I, 0]))), seen = new Set(), stood = new Map();
      let longest = 0;
      run(30); // off the clock: the test before held cars at the ramp crossings
      run(300, (t) => {
        for (const [N, parts] of zone) {
          const bodies = parts.flatMap(([E, near]) => E.cars.filter(near).map((x) => body(E, x.d)));
          for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) if (overlap(bodies[i], bodies[j])) hits.push(`${N.key} at ${t.toFixed(1)} s`);
          for (const x of N.box) if (!seen.has(x)) {
            seen.add(x);
            through.set(x.edge.from, through.get(x.edge.from) + 1);
          }
          // How long a car has stood at the front of a lane into a merge with room in the lane out and nothing
          // else going in: held by the merge's own rules, not by a queue from the crossing beyond (those are the
          // ordinary traffic's, and happen all over town).
          for (const I of N.ins) {
            const x = I.edge.cars[0], O = x?.choice?.out, last = O?.edge.cars.at(-1);
            const free = x && !x.cleared && x.v < 0.3 && (!last || last.d >= CAR + 4) && [...N.box].every((b) => b.edge.next !== O.edge);
            if (x) stood.set(x, free ? (stood.get(x) ?? 0) + 0.1 : 0);
            if (x) longest = Math.max(longest, stood.get(x));
          }
        }
      });
      assert.deepEqual(hits.slice(0, 5), [], `${hits.length} frames with two cars overlapping at a merge`);
      assert.ok(longest < 15, `a car was held ${longest.toFixed(0)} s at a merge with room to go`);
      const busy = [...through].filter(([I]) => I.ramp);
      assert.ok(busy.some(([, n]) => n > 0) && busy.filter(([, n]) => n === 0).length <= busy.length / 2, 'ramps into merges let almost no cars through');
    });
  });
}

test('traffic is deterministic: the same seed gives the same cars after a minute', () => {
  const where = () => {
    const C = city(snapshot(7)), info = console.info;
    console.info = () => {};
    C.run(60);
    console.info = info;
    return C.roads.links.flatMap((L) => L.edge.cars.map((c) => `${L.at ?? ''}|${c.d.toFixed(3)}`)).join(',');
  };
  assert.equal(where(), where());
});

// Overlapping car bodies around merge N now: its lanes in (last 40 m), its connectors and its lanes out (first 15 m).
function overlapsAt(N) {
  const parts = [
    ...N.ins.map((I) => [I.edge, (x) => I.edge.len - x.d < 40]),
    ...N.ins.flatMap((I) => I.moves.map((m) => [m.edge, () => true])),
    ...N.outs.map((O) => [O.edge, (x) => x.d < 15]),
  ];
  const bodies = parts.flatMap(([E, near]) => E.cars.filter(near).map((x) => body(E, x.d)));
  let n = 0;
  for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) if (overlap(bodies[i], bodies[j])) n++;
  return n;
}
// A car put on lane I at d (centre, m along it), heading into lane O, at speed v (0 and speed 0: parked there).
function put(I, O, d, v, speed = 12) {
  const choice = I.moves?.find((m) => m.out === O) ?? null, car = { edge: I.edge, link: I, d, v, speed, choice, cleared: false, stopped: 0, placed: -1 };
  I.edge.cars.push(car);
  I.edge.cars.sort((a, b) => b.d - a.d); // front first, as life.js keeps them
  return car;
}
// Every car off merge N's lanes in, its connectors and its lanes out, so a scenario starts from an empty merge.
function empty(N) {
  for (const E of [...N.ins.map((I) => I.edge), ...N.ins.flatMap((I) => I.moves.map((m) => m.edge)), ...N.outs.map((O) => O.edge)]) E.cars.length = 0;
  N.box.clear();
}
const quiet = (f) => {
  const info = console.info;
  console.info = () => {};
  try {
    return f();
  } finally {
    console.info = info;
  }
};
const lineOf = (I) => I.edge.len - CAR / 2 - 0.3 - (I.hold ?? 0); // where a car's centre stands at lane I's wait line

describe('merge scenarios (seed 7, every merge)', () => {
  const merges = () => {
    const C = quiet(() => city(snapshot(7)));
    return { C, list: C.roads.nodes.filter((N) => N.type === 'free' && N.ins.length > 1) };
  };

  test('simultaneous arrival: two cars reach their wait lines together; one goes first, no overlap, both get through', () => {
    const { C, list } = merges();
    const cars = list.map((N) => {
      empty(N);
      const O = N.outs[0];
      return [N, N.ins.map((I) => put(I, O, Math.max(1, lineOf(I) - 12), 8))];
    });
    let worst = 0;
    C.run(40, () => {
      for (const [N] of cars) worst = Math.max(worst, overlapsAt(N));
    });
    assert.equal(worst, 0, 'two cars overlapped at a merge');
    for (const [N, pair] of cars) for (const x of pair) assert.ok(!N.ins.some((I) => I.edge.cars.includes(x)), `${N.key}: a car never got through`);
  });

  test('downstream blockage: with the lane out blocked nobody enters; released, both queues drain, no overlap', () => {
    const { C, list } = merges();
    // Merges that share no lane with another (one merge's lane out can be the next one's lane in), so emptying and
    // blocking one does not disturb another.
    const lanes = (N) => [...N.ins, ...N.outs];
    const apart = list.filter((N) => !list.some((M) => M !== N && lanes(M).some((L) => lanes(N).includes(L))));
    assert.ok(apart.length >= 4, `only ${apart.length} merges stand apart`);
    const setup = apart.map((N) => {
      empty(N);
      const O = N.outs[0], blocker = put(O, O.moves?.[0]?.out, CAR + 1, 0, 0); // parked just past the merge
      const queued = N.ins.flatMap((I) => [0, 1, 2].map((k) => put(I, O, Math.max(1, lineOf(I) - 2 - k * (CAR + 2.5)), 0)));
      return { N, O, blocker, queued };
    });
    let worst = 0, entered = 0;
    C.run(40, () => {
      for (const { N, O } of setup) {
        worst = Math.max(worst, overlapsAt(N));
        entered += [...N.box].filter((x) => x.edge.next === O.edge).length;
      }
    });
    assert.equal(worst, 0, 'cars overlapped while queued at a blocked merge');
    assert.equal(entered, 0, 'a car went into a merge whose lane out was blocked');
    for (const { O, blocker } of setup) O.edge.cars.splice(O.edge.cars.indexOf(blocker), 1);
    C.run(120, () => {
      for (const { N } of setup) worst = Math.max(worst, overlapsAt(N));
    });
    assert.equal(worst, 0, 'cars overlapped while the queues drained');
    for (const { N, queued } of setup) {
      const left = queued.filter((x) => N.ins.some((I) => I.edge.cars.includes(x)));
      assert.equal(left.length, 0, `${N.key}: ${left.length} of ${queued.length} queued cars still waiting two minutes after the release`);
    }
  });

  test('sustained congestion: an unbroken stream on one lane; the ramp still zips in, without overlap or hard braking', () => {
    const { C, list } = merges();
    const runs = list.filter((N) => N.ins.some((I) => I.ramp) && N.ins.some((I) => !I.ramp)).map((N) => {
      empty(N);
      const O = N.outs[0], main = N.ins.find((I) => !I.ramp), ramp = N.ins.find((I) => I.ramp);
      return { N, O, main, rampCar: put(ramp, O, Math.max(1, lineOf(ramp) - 1), 0) };
    });
    assert.ok(runs.length > 0);
    let worst = 0, hardest = 0;
    const speed = new Map();
    C.run(60, () => {
      for (const { N, O, main } of runs) {
        const last = main.edge.cars.at(-1);
        if (!last || last.d > CAR + 2.5) put(main, O, 0, last ? last.v : 10); // feed the stream at its start, at the speed of the car ahead
        worst = Math.max(worst, overlapsAt(N));
        const front = main.edge.cars[0]; // the stream's car at the merge: how hard it brakes as the ramp car zips in, in m/s2
        if (front && speed.get(main)?.[0] === front) hardest = Math.max(hardest, (speed.get(main)[1] - front.v) / 0.1);
        if (front) speed.set(main, [front, front.v]);
      }
    });
    assert.equal(worst, 0, 'cars overlapped in congestion');
    for (const { N, rampCar } of runs) assert.ok(!N.ins.some((I) => I.edge.cars.includes(rampCar)), `${N.key}: the ramp car never got in`);
    assert.ok(hardest < 15, `a car in the stream braked at ${hardest.toFixed(0)} m/s2`);
  });

  test('a heavy stream of walkers at every ramp crossing: cars still get through, walkers still get across', () => {
    const { C } = merges(), { roads } = C;
    const crossings = [...new Map(roads.links.flatMap((L) => (L.walks ?? []).map((w) => [w.key, w]))).values()];
    assert.ok(crossings.length > 0);
    // At each crossing a walker arrives every 2 s, waits until it is clear (rampClear), and crosses at 1.3 m/s: the
    // ramps meet the sidewalk at a shallow angle, so that is 10-15 s on the ramp (as the browser shows: busy 66-90%).
    const state = crossings.map((w) => ({ w, queue: [], on: [], waitedMost: 0 }));
    const passed = new Map(crossings.map((w) => [w.key, new Set()]));
    const carWait = new Map();
    let carWaitMost = 0, frame = 0;
    C.run(180, (t) => {
      frame++;
      for (const s of state) {
        if (frame % 20 === 0) s.queue.push(t);
        s.on = s.on.filter((end) => end > t);
        if (s.queue.length && rampClear(s.w.key, t)) s.on.push(t + (s.w.u1 - s.w.u0) / 1.3), s.queue.shift();
        if (s.queue.length) s.waitedMost = Math.max(s.waitedMost, t - s.queue[0]);
        if (s.on.length) zebraUse.set(s.w.key, t);
      }
      for (const L of roads.links) for (const w of L.walks ?? []) for (const x of L.edge.cars) {
        if (x.d - CAR / 2 > w.b) passed.get(w.key).add(x); // past the crossing
        // Held by walkers alone: stopped short of the crossing while a walker is on it, and free to go otherwise
        // (let into its merge, or with no wait line of its own ahead). A car at its merge's line waits for the merge.
        const short = w.a - (x.d + CAR / 2), walkers = t - (zebraUse.get(w.key) ?? -1e9) < 0.6, free = x.cleared || !L.hold;
        carWait.set(x, short > 0 && short < 3 && x.v < 0.3 && walkers && free ? (carWait.get(x) ?? 0) + 0.1 : 0);
        carWaitMost = Math.max(carWaitMost, carWait.get(x));
      }
    });
    console.log(`walker stream: longest car hold ${carWaitMost.toFixed(1)} s, longest walker wait ${Math.max(...state.map((s) => s.waitedMost)).toFixed(1)} s, cars across per crossing ${[...passed.values()].map((c) => c.size).join("/")}`);
    for (const [key, cars] of passed) assert.ok(cars.size > 0, `${key}: no car crossed in three minutes of walkers`);
    assert.ok(carWaitMost < YIELD_MAX, `walkers held a car ${carWaitMost.toFixed(0)} s at a ramp crossing`);
    for (const s of state) assert.ok(s.waitedMost < 60, `${s.w.key}: a walker waited ${s.waitedMost.toFixed(0)} s`);
  });
});
