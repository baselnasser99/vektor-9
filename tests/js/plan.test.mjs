// The simulation's static plan (schema 6, ADR-0015) as the renderer reads it, on the frozen v3 fixtures: the
// backbone the plan names is the one cityLayout draws (Python never copies cityLayout's widths), the headquarters
// stands on the plan's site facing the avenue with nothing hidden under it, and the streets round it pass their
// self-checks. Schema 5 fixtures keep the per-snapshot site (hqSite) they had.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { city, fixture } from './harness.mjs';
import { cityPlan } from '../../web/src/city.js';
import { BLOCK, STREETS } from '../../web/src/world.js';

const V3 = ['sim-v3-seed7-t288.json.gz', 'sim-v3-seed3-t288.json.gz'];
const ROLE_KIND = { boulevard: 'boulevard', arterial: 'street' };

for (const name of V3) {
  test(`${name}: the plan's backbone is cityLayout's widest corridors`, () => {
    const snap = fixture(name), { layout } = cityPlan(snap), { lines, cross } = layout;
    const named = new Map(snap.plan.backbone.map((b) => [`${b.along === 'x' ? 'x' : 'z'}:${b.at}`, b.role]));
    assert.equal(named.size, 6);
    for (const axis of ['x', 'z']) {
      for (const l of cross) {
        const role = !l.mid && named.get(`${axis}:${l.k * BLOCK}`), kind = l.kind[axis];
        if (!role) {
          assert.ok(!['boulevard', 'street'].includes(kind), `corridor ${l.j} along ${axis} is a ${kind} the plan does not name`);
          continue;
        }
        assert.equal(kind, ROLE_KIND[role], `${role} at ${l.k * BLOCK} along ${axis}`);
        assert.equal(l.w, STREETS[kind].w);
        for (let v = layout.lo + 5; v < layout.hi; v += 7) { // what kindAt draws along it: the class, or its avenue stretch
          const k = layout.kindAt(l, axis, v);
          assert.ok(k === kind || (role === 'boulevard' && k === 'avenue'), `${role} along ${axis} draws ${k}`);
        }
      }
    }
    const widths = lines.map((l) => l.w), arterial = lines.find((l) => l.kind.x === 'street').w;
    assert.equal(Math.max(...widths), STREETS.boulevard.w); // the boulevard is the widest corridor
    assert.equal(Math.max(...widths.filter((w) => w !== STREETS.boulevard.w)), arterial); // the arterials the next
  });

  test(`${name}: the headquarters stands on the plan's site, faces the avenue and hides nothing`, () => {
    const snap = fixture(name), { layout, hq } = cityPlan(snap), n = snap.size;
    const site = snap.plan.sites.find((s) => s.use === 'hq'), court = snap.plan.sites.find((s) => s.use === 'court');
    const cols = hq.cells.map(([c]) => c), rows = hq.cells.map(([, r]) => r);
    assert.deepEqual([Math.min(...cols), Math.min(...rows), Math.max(...cols), Math.max(...rows)], [site.x0, site.y0, site.x1, site.y1]);
    assert.equal(hq.tiles.size, 24);
    for (const i of hq.tiles) assert.equal(snap.tiles[i].k, 'site', 'a building under the campus');
    assert.equal(hq.heading, -Math.PI / 2); // face -x
    const front = layout.lines[Math.floor(site.x0 / BLOCK)];
    assert.equal(layout.kindAt(front, 'z', hq.z), 'avenue');
    assert.ok(hq.street > 0 && hq.x - hq.street === front.c, 'the street hovercars come down to is the avenue');
    assert.equal(court.x1 + 1, site.x0, 'the court is directly across the avenue');
    assert.deepEqual([court.y0, court.y1], [site.y0, site.y1]);
    for (let r = court.y0; r <= court.y1; r++) for (let c = court.x0; c <= court.x1; c++) assert.equal(snap.tiles[r * n + c].k, 'site');
    assert.ok(!layout.inTown(court.x0, court.y0), 'the old town keeps off the court');
    assert.equal(layout.plan.roles[hq.sector], 'corporate');
  });

  test(`${name}: the streets round the campus pass the self-checks`, () => {
    const failed = [], assertion = console.assert, info = console.info;
    console.assert = (ok, ...msg) => ok || failed.push(msg.join(' '));
    console.info = () => {};
    try {
      city(fixture(name));
    } finally {
      console.assert = assertion;
      console.info = info;
    }
    assert.deepEqual(failed, []);
  });
}

test('schema 5 fixtures keep the headquarters hqSite picks per snapshot', () => {
  // Seed 7 and 3 at tick 288 under version 2 (ADR-0015's measured table): sector 21 facing +x, sector 14 facing -x.
  for (const [name, sector, heading] of [['sim-v2-seed7-t288.json.gz', 21, Math.PI / 2], ['sim-v2-seed3-t288.json.gz', 14, -Math.PI / 2]]) {
    const snap = fixture(name), { hq } = cityPlan(snap);
    assert.equal(snap.schema, 5);
    assert.deepEqual([hq.sector, hq.heading], [sector, heading], name);
  }
});
