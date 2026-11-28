// Facade variants (facade.js facadeVariant): each building's grid and tone come from its tile's place and the map's
// seed alone, ride in its building id on the merged facades, and only the four varied families take them. Built on
// the frozen v4 seed 7 fixture, read back from the merged city, so this checks the wiring in city.js too.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildCity, cityPlan, surroundings } from '../../web/src/city.js';
import { familyOf } from '../../web/src/families.js';
import { LOOK_STEP, STYLES, TONES, VARIANT_STEP, facadeMaterial, facadeVariant } from '../../web/src/facade.js';
import { rng } from '../../web/src/geometry.js';
import { palette } from '../../web/src/palette.js';
import { BLOCK, F, TALL } from '../../web/src/world.js';
import { fixture, kitModel } from './harness.mjs';

const mats = new Map();
const tag = (name, facade) => mats.get(name) ?? mats.set(name, Object.assign(new THREE.MeshStandardMaterial(), { name, emissiveMap: new THREE.Texture(),
  userData: facade ? { facade } : {} })).get(name);
const empty = () => {
  const g = new THREE.Group(), find = g.getObjectByName.bind(g);
  g.getObjectByName = (n) => find(n) ?? g.add(Object.assign(new THREE.Group(), { name: n })).children.at(-1);
  return g;
};
const model = kitModel(empty);
const kit = new Proxy({}, { get: (_, k) => (k === 'model' ? model : k === 'foldDetail' ? (g) => g
  : k === 'windows' ? (seed, lit, concrete, kind) => tag(`windows:${seed}:${lit}:${kind}`, kind ?? 'any') : (...a) => tag(`${String(k)}:${a[0]}`)) });

// Tile index -> { code, look } for every lot whose facade the merged city draws.
function variants(snap) {
  const out = new Map();
  buildCity(kit, snap).city.traverse((m) => {
    const a = m.geometry?.attributes?.aBuilding;
    if (!a) return;
    for (const v of new Set(a.array)) {
      if (v < 0.5) continue;
      const code = Math.floor(v / VARIANT_STEP), rest = v - code * VARIANT_STEP;
      out.set((rest % LOOK_STEP) - 1, { code, look: Math.floor(rest / LOOK_STEP) });
    }
  });
  return out;
}

// The family city.js gives each house tile: its own generator's first two draws (footprint, glass or concrete).
function families(snap) {
  const { layout } = cityPlan(snap), n = layout.n, near = surroundings(snap, layout);
  return new Map(snap.tiles.flatMap((t, i) => {
    if (t.k !== 'house') return [];
    const col = i % n, row = Math.floor(i / n), rand = rng(t.s);
    rand(); // footprint
    const sector = Math.floor(row / BLOCK) * (n / BLOCK) + Math.floor(col / BLOCK);
    const concrete = ((sector * 7 + snap.seed) % 2 === 0) !== (rand() < 0.25);
    return [[i, { family: familyOf(t, near[i], !concrete), col, row, town: layout.inTown(col, row), tall: t.f >= TALL }]];
  }));
}

const snap = fixture('sim-v4-seed7-t4032.json.gz'), built = variants(snap), fam = families(snap);
const VARIED = ['apartment', 'office', 'luxury', 'mega'];

test('every varied building draws the variant its place gives it; the old town and other families keep today\'s', () => {
  let checked = 0;
  for (const [i, { family, col, row, town }] of fam) {
    const got = built.get(i);
    if (!got) continue; // the HQ's tiles
    if (town || !VARIED.includes(family)) assert.equal(got.code, 0, `tile ${i} (${family}${town ? ', old town' : ''})`);
    else if (got.code !== 0 || facadeVariant(col, row, snap.seed, family) === 0) {
      assert.equal(got.code, facadeVariant(col, row, snap.seed, family), `tile ${i}`);
      checked++;
    }
  }
  assert.ok(checked > 1000, `${checked} varied buildings checked`);
});

test('the landmarks keep today\'s facade', () => {
  const keep = [...fam].filter(([i, f]) => VARIED.includes(f.family) && !f.town && built.get(i)?.code === 0
    && facadeVariant(f.col, f.row, snap.seed, f.family) !== 0);
  assert.ok(keep.length >= 3 && keep.length <= 10, `${keep.length} kept (3 signature, up to 5 heavy, 1 flagship)`);
  assert.ok(keep.every(([i]) => snap.tiles[i].f >= 16), 'only towers of 16+ floors');
});

test('a building\'s variant does not change when another tile does', () => {
  const other = structuredClone(snap), n = snap.size;
  const houses = [...fam.keys()].filter((i) => built.get(i)?.code > 0);
  const j = houses[Math.floor(houses.length / 2)], lot = other.tiles.findIndex((t) => t.k === 'lot');
  other.tiles[j].s += 12345; // another style seed and blacked out: a different building on the same lot
  other.tiles[j].on = !other.tiles[j].on;
  other.tiles[lot].k = 'build'; // a plaza becomes a building site
  const again = variants(other);
  let same = 0;
  for (const [i, v] of built) if (i !== j && i !== lot) {
    assert.equal(again.get(i)?.code, v.code, `tile ${i} (${i % n}, ${Math.floor(i / n)})`);
    assert.equal(again.get(i)?.look, v.look, `tile ${i}: its lighting identity`);
    same++;
  }
  assert.ok(same > 1000);
});

test('the same seed gives the same variant, and the map seed moves them', () => {
  for (const [col, row] of [[0, 0], [5, 9], [36, 30], [47, 47]]) {
    assert.equal(facadeVariant(col, row, 7, 'office'), facadeVariant(col, row, 7, 'office'));
  }
  const all = (seed) => [...fam.values()].map((f) => facadeVariant(f.col, f.row, seed, 'office')).join();
  assert.notEqual(all(7), all(3));
  assert.equal(facadeVariant(3, 4, 7, 'old'), 0);
  assert.equal(facadeVariant(3, 4, 7, 'office', true), 0);
});

test('each varied family shows all four grids and tones; neighbours share a grid only by chance', () => {
  const report = {};
  for (const family of VARIED) {
    const codes = [...fam].filter(([i, f]) => f.family === family && !f.town).map(([i]) => built.get(i)?.code).filter((c) => c !== undefined);
    const grids = new Set(codes.map((c) => c % 4)), tones = new Set(codes.map((c) => Math.floor(c / 4)));
    assert.ok(grids.size === 4 && tones.size === 4, `${family}: ${grids.size} grids, ${tones.size} tones`);
    report[family] = `${codes.length} buildings, ${new Set(codes).size} facades`;
  }
  // Neighbour pairs (side by side, either axis) of one family outside the old town: about one in four shares a grid
  // (a hash, no lattice), and far fewer share grid and tone.
  const n = snap.size, share = {};
  for (const family of ['luxury', 'office']) {
    let pairs = 0, grid = 0, facade = 0;
    for (const [i, f] of fam) for (const j of [i + 1, i + n]) {
      const g = fam.get(j);
      if (!g || f.family !== family || g.family !== family || f.town || g.town || (j === i + 1 && g.col !== f.col + 1)) continue;
      const [a, b] = [built.get(i)?.code, built.get(j)?.code];
      pairs++;
      if (a % 4 === b % 4) grid++;
      if (a === b) facade++;
    }
    share[family] = `same grid ${grid} of ${pairs} (${((100 * grid) / pairs).toFixed(1)} %), same facade ${facade} (${((100 * facade) / pairs).toFixed(1)} %)`;
    assert.ok(grid / pairs > 0.15 && grid / pairs < 0.4, `${family}: ${share[family]}`);
    assert.ok(facade / pairs < 0.15, `${family}: ${share[family]}`);
  }
  console.log('facade variants on v4 seed 7:', JSON.stringify({ ...report, neighbours: share }));
});

test('every variant colour is a palette entry', () => {
  const named = new Set(Object.values(palette));
  for (const t of TONES.slice(1)) for (const k of ['wall', 'glass', 'frame']) assert.ok(t[k] in palette, `${k} ${t[k]}`);
  for (const style of ['office', 'residential', 'luxury', 'old', 'shop', 'industrial']) {
    const shader = { uniforms: {}, vertexShader: '', fragmentShader: '' };
    facadeMaterial(style, { color: palette.slate }).onBeforeCompile(shader);
    for (const u of ['fWall', 'fGlass', 'fFrame']) for (const c of shader.uniforms[u].value) assert.ok(named.has(c.getHex()), `${style} ${u} #${c.getHexString()}`);
  }
});

// The share of a wall that is pane, as the shader cuts it (opening minus slab, band and column), per grid.
function paneShare(g) {
  const N = 120;
  let open = 0, all = 0;
  const floors = g.band[0] || 1;
  for (let fl = 0; fl < floors; fl++) for (let a = 0; a < N; a++) for (let b = 0; b < N; b++) {
    const bays = Math.max(1, g.column), mx = ((a + 0.5) / N) * g.bay * bays, my = ((b + 0.5) / N) * F, cell = Math.floor(mx / g.bay), x = mx - cell * g.bay;
    const slab = my < (g.band[0] && fl === 0 ? Math.max(g.slab, g.band[1] * F) : g.slab), column = g.column > 0 && cell % g.column === 0 && x < 0.28;
    const ox = ((1 - g.win[0]) / 2) * g.bay, oy = g.win[2] * F;
    all++;
    if (!slab && !column && x > ox && x < ox + g.win[0] * g.bay && my > oy && my < oy + g.win[1] * F) open++;
  }
  return open / all;
}

test('every grid lights within 10 % of today\'s window area', () => {
  const out = {};
  for (const style of ['office', 'residential', 'luxury']) {
    const s = STYLES[style], base = paneShare({ ...s, band: [0, 0] });
    out[style] = s.variants.map((v) => {
      const r = paneShare({ ...s, band: [0, 0], ...v }) / base;
      assert.ok(Math.abs(r - 1) <= 0.1, `${style} ${JSON.stringify(v)}: ${r.toFixed(3)}`);
      return r.toFixed(3);
    }).join(' ');
  }
  console.log('pane area against grid 0:', JSON.stringify(out));
});
