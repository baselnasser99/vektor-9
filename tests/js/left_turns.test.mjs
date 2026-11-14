// Left turns at lit crossings (ADR-0016 roadmap 1), on the frozen v3 fixtures of seeds 7 and 3 (ADR-0016's baseline):
// main corners run a protected left phase that leads each street's green; a permitted left pulls into the crossing
// and clears when the oncoming cars stop, before the crossing street goes; and the long stops behind waiting left
// turns are gone, without losing throughput or locking a junction.
// Run: node --import ./tests/js/three-loader.mjs --test "tests/js/*.test.mjs"
import assert from 'node:assert/strict';
import { before, describe, test } from 'node:test';
import { body, city, fixture, overlap } from './harness.mjs';
import { measure } from './traffic_metrics.mjs';
import { phaseAt } from '../../web/src/life.js';

// Measured with traffic_metrics.mjs on main at 355fff5, before this change (10 simulated minutes).
const BEFORE = {
  'sim-v3-seed7-t288.json.gz': { long: 56, leftLong: 46, throughput: 138.0 },
  'sim-v3-seed3-t288.json.gz': { long: 127, leftLong: 86, throughput: 129.0 },
};

for (const [name, base] of Object.entries(BEFORE)) {
  describe(name, () => {
    let C, failed, m, leads;
    const committed = [], conflicts = [], overlaps = [];
    before(() => {
      failed = [];
      const assertion = console.assert, info = console.info;
      console.assert = (ok, ...msg) => ok || failed.push(msg.join(' '));
      console.info = () => {};
      try {
        C = city(fixture(name));
      } finally {
        console.assert = assertion;
        console.info = info;
      }
      const lit = C.roads.nodes.filter((N) => N.type === 'signal');
      leads = lit.filter((N) => N.lead);
      const seen = new Set(), inside = new Map(lit.map((N) => [N, new Set()]));
      m = measure(C, 600, (t) => {
        for (const N of lit) {
          const { phase } = phaseAt(N, t);
          for (const I of N.ins) { // cars committing to the crossing while a protected left phase runs
            const f = I.edge.cars[0];
            if (!f?.cleared || seen.has(f)) continue;
            seen.add(f);
            if (phase.left && f.choice.move !== 'left') committed.push(`${N.key} ${f.choice.move} at ${t.toFixed(1)} s`);
          }
          const was = inside.get(N);
          for (const c of N.box) {
            if (was.has(c)) continue; // entering now: no left turn from the other street may still be in it
            const across = [...N.box].filter((b) => b !== c && b.choice.move === 'left' && b.edge.from.axis !== c.edge.from.axis);
            if (across.length) conflicts.push(`${N.key} at ${t.toFixed(1)} s`);
          }
          inside.set(N, new Set(N.box));
          const box = [...N.box];
          for (let i = 0; i < box.length; i++) for (let j = i + 1; j < box.length; j++) {
            const [a, b] = [box[i], box[j]];
            if ((a.choice.move === 'left' || b.choice.move === 'left') && overlap(body(a.edge, a.d), body(b.edge, b.d))) overlaps.push(`${N.key} at ${t.toFixed(1)} s`);
          }
        }
      });
    });

    test('the self-checks pass: every lane usable', () => assert.deepEqual(failed, []));

    test('main corners lead with a protected left phase; during it no straight or right turn has green or goes', () => {
      assert.ok(leads.length >= 8, `only ${leads.length} main corners with a leading left phase`);
      for (const N of C.roads.nodes.filter((n) => n.phases?.some((p) => p.left))) {
        for (const p of N.phases.filter((q) => q.left)) assert.deepEqual([...p.moves], ['left'], `${N.key}: a protected left phase lets other moves go`);
      }
      assert.deepEqual(committed.slice(0, 5), [], `${committed.length} cars went straight or right during a protected left phase`);
    });

    test('a car clearing a left turn never meets the crossing street in the crossing', () => {
      assert.deepEqual(conflicts.slice(0, 5), [], `${conflicts.length} cars entered a crossing with a left turn from the other street in it`);
      assert.deepEqual(overlaps.slice(0, 5), [], `${overlaps.length} frames with a turning car's body overlapping another in a crossing`);
    });

    test('no junction locks up in 10 minutes', () => assert.deepEqual(m.stuck, []));

    test('long stops behind left turns down at least 75%, all long stops at least halved, throughput within 5%', () => {
      console.log(`${name}: ${JSON.stringify({ ...m, longest: +m.longest.toFixed(1), throughput: +m.throughput.toFixed(1) })}`);
      assert.ok(m.leftLong <= base.leftLong * 0.25, `${m.leftLong} long stops behind left turns (before: ${base.leftLong})`);
      assert.ok(m.long <= base.long * 0.5, `${m.long} long stops (before: ${base.long})`);
      assert.ok(m.throughput >= base.throughput * 0.95, `throughput ${m.throughput.toFixed(1)} cars/h a lane (before: ${base.throughput})`);
    });
  });
}
