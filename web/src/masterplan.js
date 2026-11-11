// The masterplan (ADR-0012): what each of the 36 sectors is for, derived once per load from the snapshot, the
// street layout and the headquarters' site, with no randomness. Nothing is stored and no tile is hidden or changed:
// builders may later dress a sector by its role, but none reads this yet.
import { BLOCK, HUB, TILE } from './world.js';

// The roles, in precedence order: a sector takes the first whose rule it meets (residential always does).
// The fixed ones (old, centre, gateway, industry, park) come from the seed's terrain and street plan and never
// change while the city runs; corporate follows the headquarters' site and frontier the share of empty lots, so
// those two can change from one snapshot to the next.
export const ROLES = ['old', 'corporate', 'centre', 'gateway', 'industry', 'park', 'frontier', 'residential'];
const INDUSTRY = 8; // rail and works tiles in the sector
const PARK = 16; // park tiles off the tower's plaza: a quarter of the sector

// Returns { roles, matches, approach, hq }:
// - roles[s]: sector s's role (s = row * 6 + col, as hq.sector and the sim's events count them);
// - matches[s]: every role whose rule sector s meets, in precedence order (roles[s] is the first);
// - approach: a description of the stretch of mid street between the headquarters' back and the next main
//   corridor (approachOf below), or null with no headquarters;
// - hq: the site it was given, or null.
// layout: cityLayout's, with layout.cut already set from hq (buildCity's order; cityPlan in city.js).
export function masterplan(snap, layout, hq) {
  const { size: n, tiles } = snap, S = n / BLOCK, mid = n / 2, matches = [];
  for (let s = 0; s < S * S; s++) {
    const sx = s % S, sy = Math.floor(s / S), c = { lot: 0, rail: 0, works: 0, park: 0, road: 0, hub: 0 };
    for (let row = sy * BLOCK; row < (sy + 1) * BLOCK; row++) for (let col = sx * BLOCK; col < (sx + 1) * BLOCK; col++) {
      const k = tiles[row * n + col].k;
      if (Math.abs(col + 0.5 - mid) < HUB && Math.abs(row + 0.5 - mid) < HUB) c.hub++; // the tower's plaza (headquarters.js does the same)
      else if (k in c) c[k]++;
    }
    const buildable = BLOCK * BLOCK - c.hub - c.rail - c.works - c.park - c.road; // building sites count as built on
    const meets = { old: layout.inTown(sx * BLOCK, sy * BLOCK), corporate: hq?.sector === s, centre: c.hub > 0, gateway: c.road > 0,
      industry: c.rail + c.works >= INDUSTRY, park: c.park >= PARK, frontier: 2 * c.lot > buildable, residential: true };
    matches.push(ROLES.filter((r) => meets[r]));
  }
  const roles = matches.map((m) => m[0]);
  console.assert(roles.length === S * S && roles.every((r) => ROLES.includes(r)), 'masterplan: a sector without a role');
  console.assert(!hq || roles[hq.sector] === 'corporate', 'masterplan: the headquarters\' sector is not corporate');
  return { roles, matches, approach: hq ? approachOf(layout, hq, S) : null, hq: hq ?? null };
}

// The other half of the mid street the headquarters' campus cuts (hqCut in city.js), in the campus's sector: from
// its back to the next main corridor. Descriptive only: nothing applies it, and a stretch that is built over is not
// a promenade or an entrance (ADR-0012). { j, axis, v0, v1, kind, closable }: corridor j along axis between v0 and
// v1 m; kind is what kindAt draws there today; closable says whether building it over would still leave the
// sector's middle crossing a straight run on the crossing mid street (that street a two-way or one-way street with
// both its halves open), not a dead end.
function approachOf(layout, hq, S) {
  const { pos, mids, kindAt } = layout, along = hq.heading === 0 || hq.heading === Math.PI ? 'z' : 'x', across = along === 'z' ? 'x' : 'z';
  const [sx, sy] = [hq.sector % S, Math.floor(hq.sector / S)], [a, b] = along === 'z' ? [sx, sy] : [sy, sx];
  const l = mids[a], other = mids[b]; // the cut mid street (runs along `along`) and the one crossing it
  const deep = hq.cells.map(([c, r]) => (along === 'z' ? r : c));
  const first = Math.min(...deep) % BLOCK === 0 ? b * BLOCK + BLOCK / 2 : b * BLOCK; // the half the campus leaves
  const [v0, v1] = [pos(first) - TILE / 2, pos(first + BLOCK / 2 - 1) + TILE / 2]; // its four tiles, edge to edge
  const halves = [1, 5].map((t) => kindAt(other, across, (pos(a * BLOCK + t) + pos(a * BLOCK + t + 1)) / 2)); // the middle of each half
  const street = (k) => k === 'local' || k === 'oneway';
  return { j: l.j, axis: along, v0, v1, kind: kindAt(l, along, (v0 + v1) / 2), closable: street(l.kind[along]) && halves.every(street) };
}
