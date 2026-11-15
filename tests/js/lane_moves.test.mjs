// Golden lane moves: every lane into a crossing on the frozen v3 seed-7 fixture, with the moves cars may make from it
// (streets.js laneMoves) and the lane each move leads into, against tests/fixtures/lane-moves-seed7.json. A traffic
// change that is meant to change moves updates the table on purpose:
//   node --import ./tests/js/three-loader.mjs tests/js/lane_moves.test.mjs --write
// Also: building the streets twice over one road graph adds nothing (desert.js outOfTown runs once per graph).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { outOfTown } from '../../web/src/desert.js';
import { laneMoves } from '../../web/src/streets.js';
import { city, fixture } from './harness.mjs';

const GOLDEN = join('tests', 'fixtures', 'lane-moves-seed7.json');
const id = (L) => `${L.axis}|${L.dir}|${L.c}|${L.off}|${L.k}|${L.kind}|${L.pts ? 'ramp' : L.out ?? 'block'}|${L.start?.key ?? '-'}|${L.end?.key ?? '-'}`;
const table = (roads) => Object.fromEntries(roads.links.filter((L) => L.end).map((L) => [id(L), L.moves.map((m) => `${m.move}>${id(m.out)}`).sort()]).sort(([a], [b]) => (a < b ? -1 : 1)));
const C = city(fixture('sim-v3-seed7-t288.json.gz'));

test('lane moves on the v3 seed-7 fixture match the golden table', () => {
  const now = table(C.roads);
  assert.equal(new Set(C.roads.links.filter((L) => L.end).map(id)).size, Object.keys(now).length, 'two lanes share an id');
  if (process.argv.includes('--write')) writeFileSync(GOLDEN, `{\n${Object.entries(now).map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(',\n')}\n}\n`);
  assert.deepEqual(now, JSON.parse(readFileSync(GOLDEN)));
});

test('carrying the road graph out of town a second time adds nothing', () => {
  const before = [C.roads.nodes.length, C.roads.links.length, JSON.stringify(table(C.roads))];
  assert.equal(outOfTown(C.roads, C.streets.hi, C.layout), C.roads);
  laneMoves(C.roads);
  assert.deepEqual([C.roads.nodes.length, C.roads.links.length, JSON.stringify(table(C.roads))], before);
});
