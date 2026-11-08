// The corporate headquarters (ADR-0007): IKARO's twin monoliths near the centre, on a block of 4 x 3 tiles that
// straddles a sector's service alley, drawn in their place. Modelled in Blender (tools/blender/headquarters.py,
// ADR-0005) as modules stacked here: each tower's gateway base, armoured shafts (one with a landing terrace), the link
// level where the glass skybridge meets it, a level of vehicle hangars and an armoured roof; the plaza across both
// fronts; the skybridge over the gap. eye.js floats the holographic eye in the gap, aircars.js flies the corporation's
// hovercars to the terraces and hangars, and people.js brings people through the doors, across the bridge and onto
// the terraces.
import * as THREE from 'three';
import { palette } from './palette.js';
import { BLOCK, CORPS, HALF, HUB } from './world.js';

const KINDS = ['base', 'shaft_a', 'shaft_b', 'link', 'hangar', 'roof'];
export const HQ_MODELS = ['hq_plaza', 'hq_bridge', ...KINDS.flatMap((k) => [`hq_${k}_l`, `hq_${k}_r`])];
const CORP = CORPS.find(([name]) => name === 'IKARO');

// The layout, in the site's frame (u across its front, w out toward the street, y up; metres from its centre), as
// built in Blender: the site's half extents; the towers' centres (u = +-TOWER[0], w = TOWER[1]), their inner faces
// (the gap is |u| < GAP) and their fronts (w = front); each tower's stack of modules (kind, foot); the skybridge (its deck's height and its sides
// across w); the landing terraces (one at the front of each tower: deck height, pad centre w); the hangar bays (two in
// each tower's outer face: floor height, centres w, depth into the tower); and the eye's centre and size (it floats
// just ahead of the fronts, so it can be wider than the gap without touching either tower).
export const HQ = Object.freeze({
  half: [44.5, 28], TOWER: [24, -8], GAP: 9, front: 10, top: 150,
  stack: [['base', 0], ['shaft_a', 28], ['shaft_b', 52], ['link', 76], ['hangar', 88], ['shaft_a', 112], ['roof', 136]],
  bridge: { y: 77, w: [-9, 3] },
  terrace: { y: 52.8, w: 15.5 },
  hangar: { y: 94, w: [-16, 0], depth: 9, face: 39 },
  eye: { y: 118, w: 16.5, scale: 2.15 },
});

// The site: of every sector's four sides, the 6 x 4 block of tiles straddling its middle alley on that side (three
// tiles either side of the alley, four deep from the main street, to the cross alley), if every one is a house, an
// empty lot or a building site (nothing the city needs: no market, plant, park, rail or works), outside the old
// town, clear of the tower's plaza and of `avoid` (tile indices): nearest the centre, then with the most floors.
// Returns null if there is none, else { tiles, x, z, heading, street, floors, sector }: the 24 tile indices, the
// block's centre (unwarped), the turn that points the site's front (+w) at the street, how far out the street's
// centre line is (w), the tallest of them and the sector.
const BUILDABLE = new Set(['house', 'lot', 'build']);
export function hqSite(snap, { n, pos, inTown, lines }, avoid) {
  const { tiles } = snap, S = n / BLOCK, mid = n / 2, across = [HALF - 3, HALF - 2, HALF - 1, HALF, HALF + 1, HALF + 2];
  let best = null;
  for (let by = 0; by < S; by++) for (let bx = 0; bx < S; bx++) {
    for (const [deep, axis, heading] of [[[4, 5, 6, 7], 'z', 0], [[0, 1, 2, 3], 'z', Math.PI], [[4, 5, 6, 7], 'x', Math.PI / 2], [[0, 1, 2, 3], 'x', -Math.PI / 2]]) {
      const cells = across.flatMap((a) => deep.map((d) => (axis === 'z' ? [bx * BLOCK + a, by * BLOCK + d] : [bx * BLOCK + d, by * BLOCK + a])));
      const ids = cells.map(([c, r]) => r * n + c);
      const plaza = ([c, r]) => Math.abs(c + 0.5 - mid) < HUB && Math.abs(r + 0.5 - mid) < HUB; // the tower's plaza
      if (ids.some((i) => !BUILDABLE.has(tiles[i].k) || avoid.has(i)) || cells.some(([c, r]) => inTown(c, r) || plaza([c, r]))) continue;
      const cc = cells.reduce((s, [c]) => s + c, 0) / cells.length, rr = cells.reduce((s, [, r]) => s + r, 0) / cells.length;
      const ring = Math.max(Math.abs(cc + 0.5 - mid), Math.abs(rr + 0.5 - mid));
      const score = ids.reduce((s, i) => s + (tiles[i].f ?? 0), 0) - ring * 50; // near the centre first: it is the landmark
      if (!best || score > best.score) best = { score, ids, cells, heading, bx, by };
    }
  }
  if (!best) return null;
  const { ids, cells, heading, bx, by } = best, xs = cells.map(([c]) => pos(c)), zs = cells.map(([, r]) => pos(r));
  const x = (Math.min(...xs) + Math.max(...xs)) / 2, z = (Math.min(...zs) + Math.max(...zs)) / 2;
  // How far out (w) the front street's centre line is: the open air the hovercars come down through.
  const street = { 0: lines[by + 1].c - z, [Math.PI]: z - lines[by].c, [Math.PI / 2]: lines[bx + 1].c - x, [-Math.PI / 2]: x - lines[bx].c }[heading];
  return { tiles: new Set(ids), cells, x, z, heading, street, floors: Math.max(...ids.map((i) => tiles[i].f ?? 0)), sector: by * S + bx };
}

// The headquarters, in a group whose origin is the site's centre on the paving and whose +z is its front: both
// towers' stacks, the plaza and the skybridge. Nearly all of it is near-black armour and titanium; light is embedded:
// crimson channels and divisions, the eye over the right gateway, cool white where people are, red warning lights,
// and windows only in the glass. The skybridge's glass is a pale, faintly cyan-grey veil, the only clear glass on it.
// lit false: a blackout, every light dark.
export function buildHQ(kit, site, lit) {
  const dark = kit.steel(palette.charcoal, 0.6), on = (m) => (lit ? m : dark), [name, line, mark] = CORP;
  const roles = {
    hull: kit.steel(palette.deepNavy, 0.32), fin: kit.steel(palette.wornGunmetal, 0.38), panel: kit.steel(palette.charcoal, 0.55),
    graphite: kit.steel(palette.graphite, 0.5), stone: kit.concrete(palette.charcoal), olive: kit.steel(palette.oliveGrey, 0.6), dark,
    glass: kit.veil(palette.deepNavy, 0.45), skyglass: kit.veil(palette.glassHighlight, 0.16), facade: kit.windows(7, lit, false, 'office'),
    crimson: on(kit.glow(palette.coreCrimson, 1.7)), eye: on(kit.glow(palette.coreCrimson, 2.4)), pupil: on(kit.glow(palette.coreScarlet, 3.2)),
    white: on(kit.glow(palette.coldWhite, 1.1)), red: on(kit.warning()), face: lit ? kit.corp(name, line, mark, 256, 256) : dark,
    lobby: on(kit.glow(palette.coldWhite, 0.45)), // a lobby's softly lit back wall, seen through its glass
  };
  const g = new THREE.Group();
  const put = (model, x, y, z, own = {}) => {
    const m = kit.foldDetail(kit.model(model, { ...roles, ...own }), [dark]);
    m.position.set(x, y, z);
    g.add(m);
  };
  for (const [kind, y] of HQ.stack) {
    put(`hq_${kind}_l`, -HQ.TOWER[0], y, HQ.TOWER[1]);
    put(`hq_${kind}_r`, HQ.TOWER[0], y, HQ.TOWER[1]);
  }
  put('hq_plaza', 0, 0, 0);
  // The skybridge's floor softly lit from above, so the people crossing it read as silhouettes through the glass.
  put('hq_bridge', 0, 0, 0, { stone: lit ? kit.glow(palette.coldWhite, 0.35) : roles.stone });
  return g;
}

// The site's frame: at(u, w) is a point of it in the world as [x, z] (unwarped: the site is never in the old town);
// local(x, z) is the inverse, a world point as [u, w].
export function siteFrame(site) {
  const c = Math.cos(site.heading), s = Math.sin(site.heading);
  return {
    at: (u, w) => [site.x + c * u + s * w, site.z - s * u + c * w],
    local: (x, z) => [(x - site.x) * c - (z - site.z) * s, (x - site.x) * s + (z - site.z) * c],
  };
}

// The ground entrances, in the site's frame: each tower's three security doors (u), a point at the doors (DOOR_IN,
// where people fade into the lobby) and one in the gateway in front of them (DOOR_OUT); the security gates before them
// (GATES, at w); the delivery bay for couriers (u, in, out); the forecourt's paving over the site (FLOOR, m); and the
// raised entrance before each tower (RAISE m up): its terrace (|u - centre| < half, from the fronts to w = edge, then
// steps down to w = foot) and the gateway and lobby behind it (|u - TOWER| < 9, w > lobby).
export const ENTRANCE = {
  doors: [-HQ.TOWER[0], HQ.TOWER[0]].flatMap((c) => [c - 4, c, c + 4]), DOOR_IN: 2.6, DOOR_OUT: 7, GATES: 14,
  delivery: { u: -12, in: 10.4, out: 11.8 }, FLOOR: 0.06,
  RAISE: 1.2, terrace: { centre: HQ.TOWER[0] + 1, half: 11, edge: 17, foot: 18.35 }, lobby: -4,
};
// How far above the paving the ground is at (u, w) in the site's frame: up on an entrance terrace, its gateway or
// lobby, part way down its steps, or 0.
export function entranceRise(u, w) {
  const { RAISE, terrace: T, lobby } = ENTRANCE, a = Math.abs(u);
  if (Math.abs(a - HQ.TOWER[0]) < 9 && w > lobby && w <= HQ.front) return RAISE;
  if (Math.abs(a - T.centre) > T.half || w < HQ.front || w > T.foot) return 0;
  return w <= T.edge ? RAISE : RAISE * (T.foot - w) / (T.foot - T.edge);
}
