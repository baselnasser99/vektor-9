// The urban metrics tool (tools/urban_metrics.mjs, ADR-0015) on a frozen fixture: its counts add up and it changes
// nothing in the snapshot it reads.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './harness.mjs';
import { metrics } from '../../tools/urban_metrics.mjs';

test('urban metrics on the seed 3 fixture', () => {
  const snap = fixture('sim-v2-seed3-t288.json.gz'), before = JSON.stringify(snap), m = metrics(snap);
  assert.equal(JSON.stringify(snap), before, 'the snapshot is not changed');
  const buildable = snap.tiles.filter((t) => !['rail', 'park', 'works', 'road'].includes(t.k)).length;
  assert.equal(m.bands.reduce((s, b) => s + b.tiles, 0), buildable, 'the rings cover every buildable tile once');
  assert.equal(Object.values(m.frontage).reduce((s, f) => s + f.tiles, 0), buildable, 'so do the frontage classes');
  assert.equal(Object.values(m.frontageTiles).reduce((s, v) => s + v, 0), snap.size ** 2);
  assert.ok(m.frontageTiles.major > 0 && m.frontageTiles.interior > 0);
  for (const b of m.bands) if (b.houses) assert.ok(b.median <= b.p90);
  assert.equal(m.sectors.length, 36);
  assert.equal(m.plan.length, 7);
  assert.deepEqual(m.landmarks.interchange.sectors, [16, 17, 22, 23], 'the interchange land is the same on every seed');
  assert.equal(m.hq?.sector, m.landmarks.hq.sector);
  if (m.hq) assert.equal(m.hq.across.tiles, m.hq.across.lots + m.hq.across.terrain + m.hq.across.built);
});
