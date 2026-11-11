// Urban structure metrics for one snapshot (ADR-0015), printed as JSON. Read-only: it writes nothing.
//   node --import ./tests/js/three-loader.mjs tools/urban_metrics.mjs <snapshot.json[.gz]>
// `plan` in the output is a coarse plan, one cell per sector: its masterplan role and the 90th percentile of its floors.
// Node, not Python, so the corridor classes, kindAt, the old town, hqSite and the masterplan come from the renderer
// itself (web/src via cityPlan) instead of a second copy of cityLayout's rules.
import { readFileSync } from 'node:fs';
import { gunzipSync, gzipSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';
import '../tests/js/harness.mjs'; // the headless shims (canvas, 'three') the renderer's modules need
import { cityPlan, crossing } from '../web/src/city.js';
import { BLOCK, HALF, TERRAIN } from '../web/src/world.js';

const MAJOR = new Set(['boulevard', 'avenue', 'street']); // the 36 m and 21 m corridors
const BANDS = 6; // rings of distance from the centre, 4 tiles each (Chebyshev, in tiles)
const BUILT = new Set(['build', 'house', 'market', 'plant']);
const ROLE = { old: 'O', corporate: 'H', centre: 'C', gateway: 'G', industry: 'I', park: 'P', frontier: 'F', residential: 'R' };

const quantile = (xs, q) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
};
const share = (a, b) => (b ? Math.round((1000 * a) / b) / 1000 : null);

// Floors, lot share and density of a set of tiles. Height counts finished buildings (houses); density counts every
// buildable tile (not terrain), a lot as zero floors, a building site at its current floors.
function stats(tiles) {
  const buildable = tiles.filter((t) => !TERRAIN.includes(t.k)), floors = tiles.filter((t) => t.k === 'house').map((t) => t.f);
  return { tiles: buildable.length, lots: share(buildable.filter((t) => t.k === 'lot').length, buildable.length),
    built: share(buildable.filter((t) => BUILT.has(t.k)).length, buildable.length),
    floorsPerTile: buildable.length ? Math.round((10 * buildable.reduce((s, t) => s + t.f, 0)) / buildable.length) / 10 : null,
    houses: floors.length, median: quantile(floors, 0.5), p90: quantile(floors, 0.9) };
}

export function metrics(snap) {
  const { layout, hq } = cityPlan(snap), { n, pos, cross, kindAt, tileAt } = layout, S = n / BLOCK, c = n / 2;
  const ring = (col, row) => Math.max(Math.abs(col + 0.5 - c), Math.abs(row + 0.5 - c)) - 0.5; // 0 at the four centre tiles
  // What each face of a tile looks onto: the corridor before or after its run of HALF tiles, along each axis.
  const faces = (col, row) => {
    const out = [];
    for (const [a, v, axis] of [[col, pos(row), 'z'], [row, pos(col), 'x']]) {
      const r = Math.floor(a / HALF);
      if (a % HALF === 0) out.push(kindAt(cross[r], axis, v));
      if (a % HALF === HALF - 1) out.push(kindAt(cross[r + 1], axis, v));
    }
    return out.filter(Boolean);
  };
  const cls = snap.tiles.map((t, i) => {
    const f = faces(i % n, Math.floor(i / n));
    return f.some((k) => MAJOR.has(k)) ? 'major' : f.length ? 'minor' : 'interior';
  });
  const at = (i) => [i % n, Math.floor(i / n)], sectorOf = (col, row) => Math.floor(row / BLOCK) * S + Math.floor(col / BLOCK);
  const pick = (test) => snap.tiles.filter((t, i) => test(i));

  const bands = Array.from({ length: BANDS }, (_, b) => ({ band: `${4 * b}-${4 * b + 3}`, ...stats(pick((i) => Math.floor(ring(...at(i)) / 4) === b)) }));
  const frontage = Object.fromEntries(['major', 'minor', 'interior'].map((k) => [k, stats(pick((i) => cls[i] === k))]));
  // Frontage within each ring, so the corridor effect is not just the centre's.
  const frontageByBand = bands.map((b, k) => ({ band: b.band, major: stats(pick((i) => cls[i] === 'major' && Math.floor(ring(...at(i)) / 4) === k)),
    other: stats(pick((i) => cls[i] !== 'major' && Math.floor(ring(...at(i)) / 4) === k)) }));
  const corridors = layout.lines.map((l) => ({ k: l.k, w: l.w, x: l.kind.x, z: l.kind.z }));
  const mids = layout.mids.map((l) => ({ k: l.k, w: l.w, x: l.kind.x, z: l.kind.z }));

  // The headquarters: its site, the corridor in front of it, and the 6 x 4 tiles across that corridor.
  let hqOut = null;
  if (hq) {
    const [bx, by] = [hq.sector % S, Math.floor(hq.sector / S)], cols = hq.cells.map(([cc]) => cc), rows = hq.cells.map(([, r]) => r);
    const front = { 0: ['x', by + 1, 1], [Math.PI]: ['x', by, -1], [Math.PI / 2]: ['z', bx + 1, 1], [-Math.PI / 2]: ['z', bx, -1] }[hq.heading];
    const [axis, k, dir] = front, line = layout.lines[k];
    const centre = axis === 'x' ? hq.x : hq.z, kind = kindAt(line, axis, centre);
    const across = [];
    for (let d = 0; d < HALF; d++) {
      const v = dir > 0 ? k * BLOCK + d : k * BLOCK - 1 - d;
      if (v < 0 || v >= n) continue;
      for (const u of axis === 'x' ? [...new Set(cols)] : [...new Set(rows)]) across.push(axis === 'x' ? v * n + u : u * n + v);
    }
    const kinds = across.map((i) => snap.tiles[i].k);
    hqOut = { sector: hq.sector, cells: [Math.min(...cols), Math.min(...rows), Math.max(...cols), Math.max(...rows)], x: hq.x, z: hq.z,
      heading: ['+z', '-z', '+x', '-x'][[0, Math.PI, Math.PI / 2, -Math.PI / 2].indexOf(hq.heading)], ring: Math.min(...hq.cells.map(([cc, r]) => ring(cc, r))),
      front: { line: k, kind, major: MAJOR.has(kind) }, floorsOnSite: [...hq.tiles].reduce((s, i) => s + snap.tiles[i].f, 0),
      across: { tiles: across.length, lots: kinds.filter((x) => x === 'lot').length, terrain: kinds.filter((x) => TERRAIN.includes(x)).length,
        built: kinds.filter((x) => BUILT.has(x)).length } };
  }

  // Landmarks: where each lands, and whether the seed's fixed plan or the running city decides it.
  const where = (i) => ({ col: at(i)[0], row: at(i)[1], sector: sectorOf(...at(i)), ring: ring(...at(i)) });
  const rails = snap.tiles.flatMap((t, i) => (t.k === 'rail' ? [i] : []));
  const terminus = rails.length ? rails.reduce((a, b) => (ring(...at(b)) < ring(...at(a)) ? b : a)) : null;
  const of = (k) => snap.tiles.flatMap((t, i) => (t.k === k ? [where(i)] : []));
  const sectorsOf = (k) => [...new Set(of(k).map((w) => w.sector))].sort((a, b) => a - b);
  const landmarks = {
    tower: { decided: 'fixed (layout centre)', at: [layout.lines[layout.lines.length >> 1].c, layout.lines[layout.lines.length >> 1].c] },
    interchange: { decided: 'fixed (sim terrain road, same on every seed)', sectors: sectorsOf('road') },
    station: { decided: 'seed (sim terrain rail; the renderer puts it at the end nearer the centre)', terminus: terminus === null ? null : where(terminus) },
    works: { decided: 'seed (sim terrain)', sectors: sectorsOf('works') },
    parks: { decided: 'seed (sim terrain)', sectors: sectorsOf('park') },
    oldTown: { decided: 'seed (renderer: the inner quarter with least terrain)', quarter: layout.town },
    hq: { decided: 'emergent (renderer hqSite: best-scoring site of this snapshot)', sector: hq?.sector ?? null },
    plants: { decided: 'first fixed beside the plaza, the rest emergent (sim)', at: of('plant') },
    markets: { decided: 'emergent (sim)', count: of('market').length, rings: of('market').map((w) => w.ring) },
    busiestCrossing: { decided: 'emergent (renderer crossing(): needs 3 corner buildings)', corners: crossing(snap).corners.map(where) },
  };

  const sectors = Array.from({ length: S * S }, (_, s) => {
    const st = stats(pick((i) => sectorOf(...at(i)) === s));
    return { role: layout.plan.roles[s], lots: st.lots, p90: st.p90 };
  });
  const raw = JSON.stringify(snap);
  return { seed: snap.seed, tick: snap.tick, schema: snap.schema, sim: snap.sim ?? null,
    bytes: { raw: Buffer.byteLength(raw), gzip: gzipSync(raw).length },
    corridors, mids, frontageTiles: Object.fromEntries(['major', 'minor', 'interior'].map((k) => [k, cls.filter((x) => x === k).length])),
    bands, frontage, frontageByBand, hq: hqOut, landmarks, sectors, plan: plan(sectors) };
}

// The coarse plan: a row of cells per sector row, each the role's letter and the sector's 90th percentile floors.
function plan(sectors) {
  const S = Math.sqrt(sectors.length), rows = [];
  for (let r = 0; r < S; r++) rows.push(sectors.slice(r * S, (r + 1) * S).map((s) => `${ROLE[s.role]}${String(s.p90 ?? '--').padStart(2, ' ')}`).join(' '));
  return [...rows, `${Object.entries(ROLE).map(([k, v]) => `${v} ${k}`).join(', ')}; number: 90th percentile floors of houses`];
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const file = process.argv[2];
  if (!file) throw new Error('usage: node --import ./tests/js/three-loader.mjs tools/urban_metrics.mjs <snapshot.json[.gz]>');
  const buf = readFileSync(file);
  console.log(JSON.stringify(metrics(JSON.parse(file.endsWith('.gz') ? gunzipSync(buf) : buf)), null, 1));
}
