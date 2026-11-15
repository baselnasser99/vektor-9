// Road arrows against the moves cars really make: on the frozen v3 fixtures, every lane into a crossing either has an
// arrow showing exactly its moves (streets.js paintArrow, from laneMoves) or is left bare by one of the rules below.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STREETS } from '../../web/src/world.js';
import { city, fixture } from './harness.mjs';

// Why a lane with moves has no arrow (streets.js block): one-lane streets are not painted; nor are the roundabout's
// approaches, the interchange's split and merge points ('free' nodes), its ramps, lanes coming in from out of town (no
// block behind them) or blocks of 16 m or less.
const bare = (L) => {
  if (STREETS[L.kind].lanes.length === 1) return 'one lane';
  if (L.end.type === 'round') return 'roundabout';
  if (L.end.type === 'free') return 'interchange split or merge';
  if (L.pts) return 'ramp';
  if (!L.start) return 'from out of town';
  if (Math.abs(L.axis === 'x' ? L.end.x - L.start.x : L.end.z - L.start.z) <= 16) return 'short block';
  return null;
};
const same = (a, b) => [...a].sort().join() === [...b].sort().join();
const lanesOf = (C) => C.roads.links.filter((L) => L.end && L.moves.length);
const arrowOf = (C, L) => C.streets.arrows.find((A) => A.key === L.end.key && A.axis === L.axis && A.dir === L.dir && Math.abs(A.at - L.at) < 0.05);

for (const name of ['sim-v3-seed7-t288.json.gz', 'sim-v3-seed3-t288.json.gz']) {
  const C = city(fixture(name));

  test(`${name}: every painted arrow shows exactly its lane's moves`, () => {
    const wrong = [];
    for (const L of lanesOf(C)) {
      const A = arrowOf(C, L), moves = new Set(L.moves.map((m) => m.move));
      if (A ? !same(A.moves, moves) : !bare(L)) wrong.push(`${L.kind} ${L.axis} dir ${L.dir} at ${L.at} into ${L.end.key}: painted ${A?.moves ?? 'nothing'}, cars ${[...moves]}`);
    }
    assert.deepEqual(wrong, []);
    const lanes = new Set(lanesOf(C));
    assert.ok(C.streets.arrows.every((A) => [...lanes].some((L) => arrowOf(C, L) === A)), 'an arrow on no lane with moves');
  });

  test(`${name}: the two lanes that used to disagree`, () => {
    const at = (key, off) => C.streets.arrows.find((A) => A.key === key && A.axis === 'x' && A.dir === 1 && Math.abs(A.at - off) < 0.05)?.moves;
    assert.ok(same(at('150|0', 9.875), ['straight', 'right'])); // the boulevard's outer lane goes on into the avenue's (ADR-0011)
    assert.ok(same(at('429|0', 6.625), ['left', 'right'])); // no road straight on: any turn that fits (ADR-0016 addendum)
  });

  test(`${name}: the 22 straight arrows out of town at the ring road stay`, () => {
    const out = lanesOf(C).filter((L) => arrowOf(C, L)?.moves.includes('straight') && L.moves.some((m) => m.move === 'straight' && m.out.out === 'sink'));
    assert.equal(out.length, 22);
  });
}
