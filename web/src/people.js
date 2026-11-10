// People on the streets: ambient life generated in the browser, never simulated or stored (ADR-0002), but read
// from the snapshot: busier round markets, tall towers and the busiest crossing, thinner in industry, on the
// outskirts and in blacked-out sectors; more office workers near towers, more workers near industry.
//
// Where they go. Every sector is ringed by a 4 m raised sidewalk (streets.js); its four corners are the nodes of a
// walking network. Sidewalks join a sector's corners; zebra crossings join corners across a street, but only
// where the cars have lights (people wait for the walk phase, life.js walkLight) or the street is a pedestrian
// walk; boulevards are crossed in two halves with a stop in the middle. Round the tower the network follows the
// plaza outside the roundabout. Walkers pick a corner near home, take the shortest way there along sidewalks and
// crossings, stop a while (a phone, a look round, a look up at the towers), and go on; now and then one stops on
// the way, and now and then one takes a free bench or cafe seat for a while. The rest stand or sit at places that
// suit it: by entrances, at the kerb waiting for a ride, talking in small groups, on the walks' benches, eating
// at the food streets' tables and stalls (and the vendors cooking), on the plaza looking up at the tower. Walkers
// also stop at the stalls for food, eating at the counter, on its stools or standing beside them, or queue
// beside the counter and move up as it frees. Office workers near the corporate headquarters go in through its
// doors and come out again a while later, couriers through its delivery bay; guards, a receptionist and staff stay
// about its plaza and lobby.
//
// How many. The city is split by sector. Sectors near the camera are active (with a margin, so they switch on and
// off out of sight); each has a seeded list of people, and a prefix of it is live, so the same people are always
// in the same places and a lower budget simply drops the last. Everyone is drawn by figures.js: three levels of
// detail by distance, culled to the view, fading in and out by size beyond the crowd's distance.
import * as THREE from 'three';
import { css, ui } from './palette.js';
import { rng } from './geometry.js';
import { crossing } from './city.js';
import { walkLight, zebraUse } from './life.js';
import { BLOCK, CARS, STREETS, TILE, WIDE } from './world.js';
import { ZEBRA_W, hasZebra, kerbOf, zebraAt } from './streets.js';
import { NAMES, TEXELS, colour, figures } from './figures.js';
import { ENTRANCE, HQ, entranceRise, siteFrame } from './headquarters.js';

// Settings (the P panel): people per sector, the most alive at once, walking-speed spread, how often people stop
// and stand about, detail (0 simplest to 2 full) and the distance they are drawn to, in metres.
export const CROWD = { density: 1, max: 1200, speed: 1, idle: 1, detail: 2, distance: 450 };
const CAPACITY = 3000;
const PER_SECTOR = 55; // people in an ordinary sector at density 1
const PLAZA = 44; // radius of the walk round the tower's roundabout (its outer kerb is at about 39.6 m)
const ZEBRA = (l) => zebraAt(l) - kerbOf(l); // a crosswalk's centre line, along the street from street l's kerb (streets.js road)
const zebraKey = ({ x, z, axis }) => `${Math.round(x)}|${Math.round(z)}|${axis}`; // life.js zebraUse: turning cars give way while it is fresh

// Who they are. share: of the whole city before district bias. Modules (figures.js) by weight; extras by chance.
const ARCHETYPES = [
  { share: 0.5, speed: [1.22, 1.42], top: { jacket: 3, hoodie: 3, longcoat: 2, street: 0.6 },
    head: { hairShort: 4, hairLong: 3, cap: 2, hood: 1.4 }, extra: { messenger: 0.25, backpack: 0.07, mask: 0.08 },
    tops: ['clothCharcoal', 'clothGraphite', 'clothSlate', 'clothNavy', 'clothOlive', 'clothBrown', 'clothBlack', 'clothSand'],
    bottoms: ['clothBlack', 'clothCharcoal', 'clothGraphite', 'clothNavy', 'clothOlive', 'clothBrown'],
    accents: ['clothGraphite', 'clothSlate', 'clothBlack', 'clothSand', 'clothOxblood', 'clothTeal'],
    gear: ['clothBlack', 'clothCharcoal', 'clothBrown', 'clothOlive'], glows: ['coldCyan'], glow: 0 },
  { share: 0.2, speed: [1.32, 1.5], top: { corpcoat: 4, suit: 3, longcoat: 2 }, head: { hairShort: 5, hairLong: 3 },
    extra: { earpiece: 0.5, messenger: 0.08 }, tops: ['clothBlack', 'clothCharcoal', 'clothNavy', 'clothBone', 'clothGraphite'],
    bottoms: ['clothBlack', 'clothCharcoal', 'clothNavy'], accents: ['clothBlack', 'clothSlate', 'clothBone', 'clothOxblood'],
    gear: ['clothBlack', 'gearSteel'], glows: ['coldCyan', 'glare', 'agedAmber'], glow: 0.5 },
  { share: 0.15, speed: [1.62, 1.9], fast: true, top: { workwear: 3, jacket: 2, hoodie: 1 }, head: { helmet: 3, hardhat: 2, cap: 1.5 },
    extra: { backpack: 0.6, mask: 0.08 }, tops: ['workOrange', 'clothOlive', 'clothGraphite', 'clothSlate', 'workYellow', 'clothNavy'],
    bottoms: ['clothCharcoal', 'clothOlive', 'clothGraphite', 'clothNavy'], accents: ['workYellow', 'workOrange', 'clothBlack'],
    gear: ['clothBlack', 'gearSteel', 'workOrange', 'clothCharcoal'], glows: ['agedAmber', 'coreScarlet'], glow: 0.6 },
  { share: 0.1, speed: [1.08, 1.3], top: { street: 3, hoodie: 3, longcoat: 1.5, jacket: 1 }, head: { hood: 5, hairShort: 1, hairLong: 1, cap: 1 },
    extra: { mask: 0.45, visor: 0.08, cyberarm: 0.1, messenger: 0.2 },
    tops: ['clothBlack', 'clothCharcoal', 'clothBrown', 'clothOlive', 'clothRust', 'clothGraphite'],
    bottoms: ['clothBlack', 'clothCharcoal', 'clothBrown', 'clothOlive'], accents: ['clothOxblood', 'clothTeal', 'clothRust', 'clothSand'],
    gear: ['clothBlack', 'clothBrown', 'gearSteel'], glows: ['coreScarlet', 'coldCyan'], glow: 0.8 },
  // The rare ones: a security patrol, and the visibly augmented.
  { share: 0.025, speed: [1.0, 1.15], patrol: true, top: { armor: 1 }, head: { patrolHelmet: 1 }, extra: {},
    tops: ['clothBlack', 'clothNavy'], bottoms: ['clothBlack', 'clothNavy'], accents: ['clothBlack'], gear: ['gunmetal', 'gearSteel'],
    glows: ['coreScarlet', 'coldCyan'], glow: 0.9 },
  { share: 0.025, speed: [1.2, 1.4], top: { corpcoat: 2, street: 2, longcoat: 1 }, head: { hairShort: 2, hairLong: 2, hood: 1 },
    extra: { cyberarm: 0.8, visor: 0.45, earpiece: 0.3 }, tops: ['clothBlack', 'clothCharcoal', 'clothBone', 'clothTeal', 'clothOxblood'],
    bottoms: ['clothBlack', 'clothCharcoal'], accents: ['clothTeal', 'clothOxblood', 'clothBone'], gear: ['gearSteel', 'gunmetal'],
    glows: ['coldCyan', 'coreScarlet'], glow: 1 },
];
const SKINS = ['skinLight', 'skinFair', 'skinTan', 'skinBrown', 'skinDeep'];
const HAIR = { hairBlack: 5, hairBrown: 4, hairAsh: 1, hairBleach: 0.6, hairRed: 0.4 };

const pick = (rand, list) => list[Math.floor(rand() * list.length)];
const groupBy = (list, key) => [...list.reduce((m, x) => m.set(key(x), [...(m.get(key(x)) ?? []), x]), new Map()).values()];
// Whether a kerb stop's light gives enough walk time left to reach the next stop (life.js walkLight).
const canCross = ({ light, need }, t) => walkLight(light.x, light.z, light.axis, t) > need;
function weighted(rand, table) {
  const keys = Object.keys(table), total = keys.reduce((s, k) => s + table[k], 0);
  let r = rand() * total;
  for (const k of keys) if ((r -= table[k]) < 0) return k;
  return keys[0];
}

// One person's look, from their own seed and their district's archetype weights.
function dress(rand, weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rand() * total, a = 0;
  while ((r -= weights[a]) > 0 && a < weights.length - 1) a++;
  const kind = ARCHETYPES[a], mods = ['body', weighted(rand, kind.top), weighted(rand, kind.head)];
  for (const [name, chance] of Object.entries(kind.extra)) if (rand() < chance) mods.push(name);
  if (mods.includes('mask') && mods.includes('visor')) mods.splice(mods.indexOf('visor'), 1);
  const top = colour(pick(rand, kind.tops)), bottom = colour(pick(rand, kind.bottoms)), accent = colour(pick(rand, kind.accents));
  const skin = colour(pick(rand, SKINS)), hair = colour(weighted(rand, HAIR)), gear = colour(pick(rand, kind.gear));
  const glow = colour(pick(rand, kind.glows));
  const [lo, hi] = kind.speed, spread = CROWD.speed;
  return {
    mods: mods.map((m) => NAMES.indexOf(m)), kind: a, patrol: !!kind.patrol, fast: !!kind.fast,
    A: top + bottom * 64, B: accent + skin * 64, C: hair + gear * 64 + glow * 4096, glow: kind.glow * (0.6 + 0.4 * rand()),
    height: 0.91 + (rand() + rand()) * 0.085, build: 0.9 + rand() * 0.22, seed: rand(),
    speed: (lo + hi) / 2 + (rand() - 0.5) * (hi - lo) * spread,
  };
}

// The walking network: corner nodes X + Z * G (X = 2 * sector column + 0 west / 1 east, Z the same for rows), the
// sidewalk and crossing links between them, shortest routes between every pair, and ground heights.
function network(layout) {
  const { n, pos, lines } = layout, S = n / BLOCK, G = 2 * S, N = G * G, h = S / 2, hub = lines[h].c;
  const e0 = [], e1 = []; // each sector's kerb lines, the same along both axes
  for (let b = 0; b < S; b++) {
    e0[b] = pos(b * BLOCK) - TILE / 2 - lines[b].side; // each street's own sidewalk (STREETS side)
    e1[b] = pos(b * BLOCK + BLOCK - 1) + TILE / 2 + lines[b + 1].side;
  }
  const at = (X, i) => (X & 1 ? e1[X >> 1] - i : e0[X >> 1] + i); // a corner's coordinate, `i` in from the kerb
  const node = (id, i) => [at(id % G, i), at(Math.floor(id / G), i)];
  // The four corners at the tower's plaza are inside the roundabout: gone, bridged by the plaza walk below.
  const removed = new Set();
  for (const X of [2 * h - 1, 2 * h]) for (const Z of [2 * h - 1, 2 * h]) removed.add(X + Z * G);
  const adj = Array.from({ length: N }, () => []);
  const link = (a, b, kind, path) => {
    if (!removed.has(a) && !removed.has(b)) adj[a].push({ to: b, kind, path });
  };
  // A sidewalk along `axis` from sector corner to sector corner, on the side of main street M, crosses its
  // sector's mid street (layout.mids) on the zebra in line with it: waiting at the kerb for the walkers' light where
  // the mid street carries cars and the crossing has lights (walkLight; at crossings without lights cars give way),
  // straight over an alley, a market lane or the headquarters' campus. Points as in cross below.
  const side = (axis, b, M, from, to) => (p) => {
    const m = layout.mids[b], [f, g] = [node(from.id, p.lane), node(to.id, p.lane)], [u0, u1] = axis === 'x' ? [f[0], g[0]] : [f[1], g[1]];
    const d = Math.sign(u1 - u0), lateral = axis === 'x' ? f[1] : f[0], pt = (u, wait, tag) => (axis === 'x' ? [u, lateral, wait, tag] : [lateral, u, wait, tag]);
    const cars = CARS.has(layout.kindAt(m, axis === 'x' ? 'z' : 'x', M.c)), near = m.c - d * (kerbOf(m) + 0.45), far = m.c + d * (kerbOf(m) + 0.45);
    const light = cars && (axis === 'x' ? { x: m.c, z: M.c, axis: 'z' } : { x: M.c, z: m.c, axis: 'x' });
    return [pt(near, light && { light, need: Math.abs(far - near) / p.speed + 1.5 }), pt(far, null, light && zebraKey(light))];
  };
  for (let K = 0; K < G; K++) for (let b = 0; b < S; b++) {
    const M = lines[(K >> 1) + (K & 1)];
    for (const [axis, a, c] of [['x', 2 * b + K * G, 2 * b + 1 + K * G], ['z', K + 2 * b * G, K + (2 * b + 1) * G]]) {
      link(a, c, 'side', side(axis, b, M, { id: a }, { id: c }));
      link(c, a, 'side', side(axis, b, M, { id: c }, { id: a }));
    }
  }
  // A crossing walking along `axis` from kerb `from` to kerb `to`, at `v` on the other axis (plus the person's own
  // place across the zebra). Points are [x, z, wait]: wait holds the light and the time needed to the next stop.
  const cross = (axis, from, to, v, light, median) => (p) => {
    const d = Math.sign(to - from), j = v + p.jit, pt = (u, w, tag) => (axis === 'x' ? [u, j, w, tag] : [j, u, w, tag]);
    const stop = (a, b) => light && { light, need: Math.abs(b - a) / p.speed + 1.5 }, on = light && zebraKey(light);
    const out = [pt(from - d * p.lane, null), pt(from - d * (0.45 + p.back), stop(from, median ?? to))];
    if (median !== null) out.push(pt(median - d * 0.8, stop(median, to), on));
    out.push(pt(to + d * 0.45, null, on), pt(to + d * p.lane, null));
    return out;
  };
  for (let L = 1; L < S; L++) for (let K = 0; K < G; K++) {
    const M = (K >> 1) + (K & 1); // the street across the end of this sidewalk
    if (L === h && M === h) continue; // the roundabout: no crossings
    for (const axis of ['x', 'z']) {
      const street = axis === 'x' ? lines[L].kind.z : lines[L].kind.x; // a walk crossing it gets lights too (walkLight)
      const a = axis === 'x' ? 2 * L - 1 + K * G : K + (2 * L - 1) * G, b = axis === 'x' ? a + 1 : a + G;
      const v = K & 1 ? e1[K >> 1] - ZEBRA(lines[M]) : e0[K >> 1] + ZEBRA(lines[M]);
      const light = street !== 'walk' && (axis === 'x' ? { x: lines[L].c, z: lines[M].c, axis: 'z' } : { x: lines[M].c, z: lines[L].c, axis: 'x' });
      const median = street === 'boulevard' ? lines[L].c : null;
      if (CARS.has(street) && !hasZebra(layout, axis === 'x' ? 'z' : 'x', lines[L], lines[M], K & 1 ? -1 : 1)) continue; // no zebra on this arm: walkers go round
      link(a, b, 'cross', cross(axis, e1[L - 1], e0[L], v, light, median));
      link(b, a, 'cross', cross(axis, e0[L], e1[L - 1], v, light, median));
    }
  }
  // Round the tower: from a plaza sector's sidewalk along x, out along the plaza's arc, to its sidewalk along z.
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const Xh = sx > 0 ? 2 * h : 2 * h - 1, Zh = sz > 0 ? 2 * h : 2 * h - 1, a = Xh + sx + Zh * G, b = Xh + (Zh + sz) * G;
    const arc = (forward) => (p) => {
      const r0 = Math.abs(at(Zh, p.lane) - hub), c0 = Math.abs(at(Xh, p.lane) - hub);
      const t0 = Math.asin(r0 / PLAZA), t1 = Math.acos(c0 / PLAZA), pts = [];
      for (let k = 0; k <= 6; k++) {
        const t = t0 + ((t1 - t0) * k) / 6;
        pts.push([hub + sx * PLAZA * Math.cos(t), hub + sz * PLAZA * Math.sin(t), null]);
      }
      return forward ? pts : pts.reverse();
    };
    adj[a].push({ to: b, kind: 'plaza', path: arc(true) });
    adj[b].push({ to: a, kind: 'plaza', path: arc(false) });
  }
  // Shortest routes (Floyd-Warshall over a few hundred nodes, once): next[a * N + b] is the first hop.
  const mid = { lane: 2.4, jit: 0, back: 0, speed: 1.3 }, dist = new Float32Array(N * N).fill(Infinity), next = new Int32Array(N * N).fill(-1);
  for (let a = 0; a < N; a++) {
    dist[a * N + a] = 0;
    next[a * N + a] = a;
    for (const e of adj[a]) {
      let len = 0, prev = node(a, mid.lane);
      for (const q of [...e.path(mid), node(e.to, mid.lane)]) {
        len += Math.hypot(q[0] - prev[0], q[1] - prev[1]);
        prev = q;
      }
      e.len = len;
      dist[a * N + e.to] = len;
      next[a * N + e.to] = e.to;
    }
  }
  for (let k = 0; k < N; k++) for (let a = 0; a < N; a++) {
    const ak = dist[a * N + k];
    if (ak === Infinity) continue;
    for (let b = 0; b < N; b++) {
      const via = ak + dist[k * N + b];
      if (via < dist[a * N + b]) {
        dist[a * N + b] = via;
        next[a * N + b] = next[a * N + k];
      }
    }
  }
  // Self-check: every corner left can reach every other (a gap would strand walkers on one side).
  const nodes = [...Array(N).keys()].filter((id) => !removed.has(id));
  console.assert(nodes.every((a) => nodes.every((b) => dist[a * N + b] < Infinity)), 'people: the walking network is not connected');
  // Ground under a point: raised paving (sidewalks, plaza, walks) 0.18 m, roadway 0, a boulevard median 0.28 m.
  const roadway = (v) => layout.cross.find((l) => Math.abs(v - l.c) < kerbOf(l)); // every corridor: streets, mid streets, alleys
  const ground = (x, z) => {
    if (Math.hypot(x - hub, z - hub) < PLAZA - 3) return 0; // the ring road
    const lx = roadway(x), lz = roadway(z);
    if (!lx && !lz) return 0.18;
    if (lx && lz) return 0;
    const [kind, off, along] = lx ? [layout.kindAt(lx, 'z', z), x - lx.c, z] : [layout.kindAt(lz, 'x', x), z - lz.c, x];
    if (kind === 'walk' || kind === 'none') return 0.18; // paved: a walk, a market lane, the headquarters' campus
    const nearCrossing = layout.cross.some((m) => Math.abs(along - m.c) < zebraAt(m) + ZEBRA_W / 2 + 0.3); // the median stops short of each zebra
    return WIDE.has(kind) && Math.abs(off) < STREETS[kind].median / 2 && !nearCrossing ? 0.28 : 0;
  };
  return { S, G, N, h, hub, e0, e1, at, node, removed, adj, dist, next, ground };
}

// Districts: per sector, how busy it is and who is about, from the tiles that never move.
function districts(snap, layout, net) {
  const { n, inTown } = layout, { tiles } = snap, { S, h } = net, busy = crossing(snap).corners;
  return Array.from({ length: S * S }, (_, k) => {
    const bx = k % S, by = Math.floor(k / S);
    let houses = 0, floors = 0, tall = 0, market = 0, industry = 0, lit = 0;
    for (let r = by * BLOCK; r < (by + 1) * BLOCK; r++) for (let c = bx * BLOCK; c < (bx + 1) * BLOCK; c++) {
      const t = tiles[r * n + c];
      if (t.on !== false) lit++;
      if (t.k === 'house') {
        houses++;
        floors += t.f;
        if (t.f >= 16) tall++;
      }
      if (t.k === 'market') market++;
      if (['works', 'plant', 'rail', 'build'].includes(t.k)) industry++;
    }
    const area = BLOCK * BLOCK, ind = industry / area, light = lit / area;
    const isBusy = busy.some((i) => Math.floor((i % n) / BLOCK) === bx && Math.floor(Math.floor(i / n) / BLOCK) === by);
    const plaza = (bx === h || bx === h - 1) && (by === h || by === h - 1), edge = bx === 0 || by === 0 || bx === S - 1 || by === S - 1;
    const commerce = Math.min(1, market * 0.1 + tall * 0.02 + (isBusy ? 0.5 : 0) + (plaza ? 0.35 : 0));
    const avg = houses ? floors / houses : 0;
    let dens = (0.45 + commerce + 0.2 * Math.min(1, avg / 12) - 0.8 * ind) * (edge ? 0.5 : 1) * (0.3 + 0.7 * light);
    dens = Math.min(1.7, Math.max(0.1, dens));
    const corp = 0.5 + Math.min(2.5, tall * 0.15 + commerce);
    const under = (inTown(bx * BLOCK, by * BLOCK) ? 2 : 1) * (light < 0.75 ? 1.6 : 1) * (edge ? 1.3 : 1);
    const weights = ARCHETYPES.map((a, i) => a.share * [1, corp, 1 + 5 * ind, under, 1, 1][i]);
    return { bx, by, dens, weights, busy: isBusy, plaza };
  });
}

// Places in sector k where people stand or sit, each { members: [{ x, z, heading, sit }], acts, corp }.
function places(k, snap, layout, net, info, seats, food, lamps) {
  const { n, pos, lines } = layout, { tiles } = snap, { S, e0, e1, hub } = net, { bx, by } = info;
  const rand = rng(snap.seed * 977 + k * 131 + 3), list = [];
  const sides = [
    { along: 'x', kerb: e0[by], in: 1, kind: lines[by].kind.x, tile: (j) => by * BLOCK * n + bx * BLOCK + j, at: (j) => pos(bx * BLOCK + j) },
    { along: 'x', kerb: e1[by], in: -1, kind: lines[by + 1].kind.x, tile: (j) => (by * BLOCK + 7) * n + bx * BLOCK + j, at: (j) => pos(bx * BLOCK + j) },
    { along: 'z', kerb: e0[bx], in: 1, kind: lines[bx].kind.z, tile: (j) => (by * BLOCK + j) * n + bx * BLOCK, at: (j) => pos(by * BLOCK + j) },
    { along: 'z', kerb: e1[bx], in: -1, kind: lines[bx + 1].kind.z, tile: (j) => (by * BLOCK + j) * n + bx * BLOCK + 7, at: (j) => pos(by * BLOCK + j) },
  ];
  const place = (sd, a, inset) => (sd.along === 'x' ? [a, sd.kerb + sd.in * inset] : [sd.kerb + sd.in * inset, a]);
  const outward = (sd) => (sd.along === 'x' ? (sd.in > 0 ? Math.PI : 0) : sd.in > 0 ? -Math.PI / 2 : Math.PI / 2);
  const add = (members, acts, corp = false) => {
    members = members.filter((m) => Math.hypot(m.x - hub, m.z - hub) > PLAZA - 2); // never on the roundabout
    if (members.length) list.push({ members, acts, corp });
  };
  const ring = (cx, cz, count, r) => { // a small group facing its middle
    const turn = rand() * Math.PI * 2;
    return Array.from({ length: count }, (_, i) => {
      const a = turn + (i * Math.PI * 2) / count + (rand() - 0.5) * 0.5, rr = r * (0.85 + rand() * 0.3);
      const x = cx + Math.sin(a) * rr, z = cz + Math.cos(a) * rr;
      return { x, z, heading: Math.atan2(cx - x, cz - z) };
    });
  };
  const busyTiles = new Set(crossing(snap).corners);
  for (const sd of sides) {
    for (let j = 0; j < BLOCK; j++) { // by entrances: shops and markets most, towers' doors now and then
      const i = sd.tile(j), t = tiles[i], shop = t.k === 'market' || busyTiles.has(i);
      if (!(t.k === 'house' || t.k === 'market') || rand() > (shop ? 0.5 : 0.14)) continue;
      const [x, z] = place(sd, sd.at(j) + (rand() - 0.5) * 6, 3.3), face = outward(sd) + (rand() - 0.5) * 1.4;
      const two = rand() < (shop ? 0.6 : 0.25), members = [{ x, z, heading: face }];
      if (two) { // a pair talking, half turned to each other
        const [dx, dz] = sd.along === 'x' ? [0.75, 0] : [0, 0.75];
        members[0].heading = Math.atan2(dx, dz) + (rand() - 0.5) * 0.6;
        members.push({ x: x + dx, z: z + dz, heading: Math.atan2(-dx, -dz) + (rand() - 0.5) * 0.6 });
      }
      add(members, two ? ['talk'] : ['device', 'stand', 'look', 'up'], t.k === 'house' && t.f >= 16);
    }
    if ((sd.kind === 'street' || sd.kind === 'boulevard') && rand() < 0.55) { // waiting at the kerb for a ride
      let a = sd.at(3) + 7 + (rand() - 0.5) * 20;
      const byLamp = (v) => {
        const [x, z] = place(sd, v, 0.95);
        return lamps.some(([lx, lz]) => Math.hypot(lx - x, lz - z) < 2.5);
      };
      while (byLamp(a)) a += 3;
      const count = 1 + Math.floor(rand() * 3);
      add(Array.from({ length: count }, (_, m) => {
        const [x, z] = place(sd, a + m * 0.95 + (rand() - 0.5) * 0.3, 0.95 + rand() * 0.5);
        return { x, z, heading: outward(sd) + (rand() - 0.5) * 0.5 };
      }), ['device', 'look', 'stand', 'look']);
    }
  }
  for (let g = Math.round(info.dens * 1.5 + rand()); g > 0; g--) { // small groups on the sidewalks
    const sd = pick(rand, sides), [x, z] = place(sd, sd.at(1 + Math.floor(rand() * 6)) + (rand() - 0.5) * 8, 2.5);
    add(ring(x, z, 2 + Math.floor(rand() * 3), 0.6), ['talk']);
  }
  // The pedestrian walks this sector owns (east and north of it): groups in the middle, people on the benches.
  for (const [L, axis] of [[bx + 1, 'z'], [by + 1, 'x']]) {
    if (L >= S || lines[L].kind[axis] !== 'walk') continue;
    const [lo, hi] = axis === 'z' ? [e0[by], e1[by]] : [e0[bx], e1[bx]];
    for (let g = 1 + Math.floor(rand() * 2); g > 0; g--) {
      const v = lo + 14 + rand() * (hi - lo - 28), [x, z] = axis === 'z' ? [lines[L].c, v] : [v, lines[L].c];
      add(ring(x, z, 2 + Math.floor(rand() * 3), 0.65), ['talk']);
    }
    const here = (st) => st.along === axis && st.L === L && st.v >= lo && st.v <= hi;
    const sat = (st) => ({ x: st.x, z: st.z, heading: st.heading, sit: true, seat: st });
    // Benches: some taken by one or two people from the start (walkers take the free places later).
    for (const pair of groupBy(seats.filter((st) => here(st) && st.bench !== undefined), (st) => st.bench)) {
      if (rand() > 0.6) continue;
      const both = rand() < 0.35, one = pair[rand() < 0.5 ? 0 : 1];
      add((both ? pair : [one]).map(sat), both ? ['talk', 'talk', 'device', 'look', 'rest'] : ['device', 'device', 'look', 'rest', 'doze']);
    }
    // Cafe tables: most have someone eating, often a few, talking between mouthfuls.
    for (const table of groupBy(seats.filter((st) => here(st) && st.table), (st) => st.table.join())) {
      if (rand() > 0.75) continue;
      add(table.slice(0, 1 + Math.floor(rand() * table.length)).map(sat), ['eat', 'eat', 'talk', 'talk', 'device', 'look']);
    }
    // Stalls: a vendor cooking behind the counter; a customer or two eating at it, standing or on the stools.
    for (const f of food) {
      const v = axis === 'z' ? f.z : f.x;
      if (f.kind !== 'stall' || f.along !== axis || f.line !== lines[L].c || v < lo || v > hi) continue;
      const [x, z] = f.place?.(f.x - Math.sin(f.heading) * 0.6, f.z - Math.cos(f.heading) * 0.6) ?? [f.x - Math.sin(f.heading) * 0.6, f.z - Math.cos(f.heading) * 0.6];
      add([{ x, z, heading: f.heading + (f.turn ?? 0) }], ['work', 'work', 'work', 'talk']);
      const guests = seats.filter((st) => st.stall === f && st.rank === 1 && rand() < 0.4); // the rest are left for walkers
      if (guests.length) add(guests.map((st) => ({ ...sat(st), sit: !st.stand })), ['eat', 'eat', 'device', 'talk']);
    }
  }
  if (info.plaza) { // the tower's plaza: a group or two, and people looking up at the tower
    const sx = bx >= net.h ? 1 : -1, sz = by >= net.h ? 1 : -1, P = (u, v) => [hub + sx * u, hub + sz * v];
    add(ring(...P(34, 34), 3 + Math.floor(rand() * 3), 0.75), ['talk']);
    for (const [u, v] of [[42, 22], [22, 42], [30, 44]]) {
      const [x, z] = P(u + (rand() - 0.5) * 2, v + (rand() - 0.5) * 2);
      add([{ x, z, heading: Math.atan2(hub - x, hub - z) }], ['up', 'up', 'device', 'look']);
    }
  }
  return list;
}

// The headquarters' doors, as places walkers go to: through the plaza and the gateway (fx, fz) to the door itself
// (x, z), where they fade into the lobby, from the sidewalk in front (lane) and that sidewalk's nearest corner (node).
// The delivery bay is one more, for couriers only.
function doorsOf(hq, hqAt, net) {
  const { S, G, e0, e1 } = net, bx = hq.sector % S, by = Math.floor(hq.sector / S);
  const fx = Math.round(Math.sin(hq.heading)), fz = Math.round(Math.cos(hq.heading)), { delivery: bay } = ENTRANCE;
  return [...ENTRANCE.doors.map((u) => [u, ENTRANCE.DOOR_IN, ENTRANCE.DOOR_OUT, false]), [bay.u, bay.in, bay.out, true]].map(([u, w0, w1, courier]) => {
    const [x, z] = hqAt(u, w0), [ox, oz] = hqAt(u, w1), [sx, sz] = hqAt(u, HQ.half[1] + 2);
    const near = (v, b) => (v - e0[b] < e1[b] - v ? 0 : 1);
    const X = fx ? 2 * bx + (fx > 0 ? 1 : 0) : 2 * bx + near(sx, bx), Z = fz ? 2 * by + (fz > 0 ? 1 : 0) : 2 * by + near(sz, by);
    return { door: true, courier, x, z, fx: ox, fz: oz, node: X + Z * G, lane: (lane) => hqAt(u, HQ.half[1] + lane), taken: null };
  });
}

// Who the headquarters keeps about, all out first among its sector's people (site frame: u across, w out to the
// street). On the ground, for each tower: guards beside its security gates and in its gateway, a receptionist,
// staff in its lobby; a pair talking on the plaza, a guard by the booth at the alley's mouth, someone on a bench now
// and then. Up the towers, on their own floors (y): staff and a guard on each landing terrace, a technician at the
// back of a hangar, a deck officer on each of the security tower's aprons. On the skybridge: office workers and a patrol crossing (bridge, below), a guard at each end. Nobody stands on the
// approaches between the gates, the pads or the walkers' lanes.
function hqPlaces(hq, hqAt, rand) {
  const one = (u, w, turn, acts, only, extra = {}) => {
    const [x, z] = hqAt(u, w);
    return { members: [{ x, z, heading: hq.heading + turn, ...extra }], acts, only, first: true };
  };
  const pair = (u, w, y) => {
    const [ax, az] = hqAt(u - 0.4, w), [bx, bz] = hqAt(u + 0.4, w);
    return { members: [{ x: ax, z: az, heading: hq.heading + Math.PI / 2, y }, { x: bx, z: bz, heading: hq.heading - Math.PI / 2, y }],
      acts: ['talk'], only: 1, first: true };
  };
  const guard = ['look', 'look', 'stand'], staff = ['device', 'talk', 'look'], out = [];
  const terrace = HQ.terrace.y + 0.22, bay = HQ.hangar.y + 0.18;
  for (const s of [-1, 1]) {
    const tc = s * HQ.TOWER[0];
    // Up on the entrance terrace: a guard beyond each end of the gates, one in the gateway; staff in the lobby.
    out.push(one(tc - 6.4, ENTRANCE.GATES + 0.6, 0, guard, 4), one(tc + 6.4, ENTRANCE.GATES + 0.6, 0, guard, 4), one(tc + s * 6.8, 8.0, -s * 0.3, guard, 4));
    out.push(one(tc, -1.5, 0, staff, 1), pair(tc - 3.5, -2.8));
    out.push(one(tc + 5.6, 11.6, 0.4, ['device', 'look'], 1, { y: terrace }), one(tc - 6.2, 11.8, -0.3, guard, 4, { y: terrace }));
    out.push(one(s * (HQ.hangar.face - HQ.hangar.depth + 1), HQ.hangar.w[0], s > 0 ? Math.PI / 2 : -Math.PI / 2, ['look', 'device'], 2, { y: bay }));
  }
  // On the security tower's long aprons (H3, H4): a deck officer beside each pad, well clear of the car's box.
  for (const w of HQ.hangar.w) out.push(one(HQ.hangar.face + 1.5, w + 4.5, Math.PI / 2, ['look', 'device', 'stand'], 4, { y: bay }));
  // On the forecourt: a pair talking between the left terrace and the drop-off, a guard by the booth at the gap's
  // mouth and one at the drop-off; someone on a bench at the side now and then, looking across the approach.
  out.push(pair(-16.5, 21.5), one(2.0, 12.6, 0, guard, 4), one(-9.5, 20.6, 0.3, guard, 4));
  if (rand() < 0.6) {
    const s = rand() < 0.5 ? -1 : 1;
    out.push(one(s * 37.4, 22, s > 0 ? -Math.PI / 2 : Math.PI / 2, ['device', 'look', 'rest'], 1, { sit: true }));
  }
  for (let k = 0; k < 14; k++) out.push({ members: [{ x: hq.x, z: hq.z, heading: 0, bridge: true }], acts: ['look', 'device'], only: k === 13 ? 4 : 1, first: true });
  // A guard just inside each end of the skybridge, by the wall, clear of the walkers' lanes, looking across it.
  const deck = HQ.bridge.y + 0.22, end = HQ.GAP + 1.6;
  out.push(one(-end, HQ.bridge.w[1] - 1, Math.PI / 2, guard, 4, { y: deck }), one(end, HQ.bridge.w[0] + 1, -Math.PI / 2, guard, 4, { y: deck }));
  return out;
}

// Every seat people can take: both places on each bench and every cafe stool (streets.js). Each knows the way it
// faces, where to stand before sitting (in front of a bench, behind a stool), the walk it is on and which side, the
// sidewalk point across from it (lane: a walker's own distance in from the kerb), and the nearest corner of that
// sidewalk (node). walkUp: reachable straight from that sidewalk without passing its own table. taken: who sits there.
function seatsOf(benches, food, layout, net) {
  const { lines } = layout, { S, G, e0, e1 } = net;
  const facing = (axis, sign) => (axis === 'z' ? (sign > 0 ? Math.PI / 2 : -Math.PI / 2) : sign > 0 ? 0 : Math.PI);
  const seat = (x, z, heading, step, along, extra) => {
    const across = along === 'z' ? x : z, v = along === 'z' ? z : x, lv = extra.via ? extra.via[along === 'z' ? 1 : 0] : v;
    const L = lines.reduce((best, l, i) => (Math.abs(across - l.c) < Math.abs(across - lines[best].c) ? i : best), 0);
    const sign = Math.sign(across - lines[L].c) || 1, kerb = lines[L].c + sign * kerbOf(lines[L]);
    let r = 0;
    while (r < S - 1 && lv > e1[r]) r++;
    const corner = 2 * (sign > 0 ? L : L - 1) + (sign > 0 ? 0 : 1), alongNode = 2 * r + (lv - e0[r] < e1[r] - lv ? 0 : 1);
    const fx = x + Math.sin(heading) * step, fz = z + Math.cos(heading) * step;
    return { x, z, heading, fx, fz, along, L, v, sign, node: along === 'z' ? corner + alongNode * G : alongNode + corner * G,
      lane: (lane) => (along === 'z' ? [kerb + sign * lane, lv] : [lv, kerb + sign * lane]), taken: null, walkUp: true, ...extra };
  };
  const out = benches.flatMap(([x, z, axis, sign], bench) => [-0.45, 0.45].map((d) => {
    const at = [axis === 'z' ? x : x + d, axis === 'z' ? z + d : z]; // then where the settled bench puts it (city.js settleProps)
    return seat(...(benches[bench].place?.(...at) ?? at), facing(axis, sign) + (benches[bench].turn ?? 0), 0.5, axis, { bench });
  }));
  for (const f of food) if (f.kind === 'stool') {
    const st = seat(f.x, f.z, f.heading, -0.55, f.along, { table: f.table });
    const off = (u, w) => Math.abs(f.along === 'z' ? u - f.line : w - f.line); // distance from the walk's middle
    st.walkUp = off(st.fx, st.fz) > off(...f.table); // the stand-behind point is on the sidewalk's side of the table
    out.push(st);
  }
  // Each stall: two stools at the counter and a place to stand either side of them (rank 1), and a short queue
  // beside the counter each way (ranks 2 and 3, facing it), all reached round the stall's end (via) from the
  // sidewalk behind it. f.seats: the stall's own, for moving up the queue.
  for (const f of food) if (f.kind === 'stall') {
    // In the stall's frame, then where its settled model puts that (city.js settleProps).
    const dx = Math.sin(f.heading), dz = Math.cos(f.heading), put = f.place ?? ((x, z) => [x, z]), at = (u, w) => put(f.x + dz * u + dx * w, f.z - dx * u + dz * w);
    const [cx, cz] = at(0, 0.6);
    f.seats = [[-1.05, 1.35, 1], [-0.55, 0.95, 1], [0.55, 0.95, 1], [1.05, 1.35, 1], [-1.75, 1.55, 2], [1.75, 1.55, 2],
      [-2.35, 1.8, 3], [2.35, 1.8, 3]].map(([u, w, rank]) => {
      const [x, z] = at(u, w), sits = rank === 1 && Math.abs(u) < 1, heading = rank > 1 ? Math.atan2(cx - x, cz - z) : f.heading + Math.PI + (f.turn ?? 0);
      return seat(x, z, heading, sits ? -0.5 : 0, f.along, { stall: f, stand: !sits, rank, via: at(Math.sign(u) * 2.2, 1.45) });
    });
    out.push(...f.seats);
  }
  return out;
}

export function people({ snap, layout, warp, benches, lamps, food, hq, clock, camera, controls, onFrame, still }) {
  const params = new URLSearchParams(location.search);
  const net = network(layout), info = districts(snap, layout, net), { S, G, N, adj, dist, next } = net;
  // The headquarters (headquarters.js), if there is one: its frame (u across its front, w out from it), its paved
  // plaza and gateway, the people it keeps there, its three doors and its delivery bay.
  const { at: hqAt, local: hqLocal } = hq ? siteFrame(hq) : {};
  const ground = !hq ? net.ground : (x, z) => { // the forecourt's paving covers the whole site; the entrances stand higher
    const [u, w] = hqLocal(x, z);
    return Math.abs(u) > HQ.half[0] || Math.abs(w) > HQ.half[1] ? net.ground(x, z) : 0.18 + ENTRANCE.FLOOR + entranceRise(u, w);
  };
  const doors = hq ? doorsOf(hq, hqAt, net) : [];
  const fig = figures(CAPACITY), arr = fig.data.image.data;
  const sectors = info.map((d, k) => ({ ...d, k, active: false, live: [], slots: null,
    rect: [net.e0[d.bx] - 25, net.e1[d.bx] + 25, net.e0[d.by] - 25, net.e1[d.by] + 25] }));
  const { corners } = crossing(snap), busyNodes = [];
  if (corners.length) { // the busiest crossing's four corners: walkers in its sectors often head there
    const col = corners[0] % layout.n, row = Math.floor(corners[0] / layout.n), X = 2 * Math.floor((col + 1) / BLOCK), Z = 2 * Math.floor((row + 1) / BLOCK);
    for (const x of [X - 1, X]) for (const z of [Z - 1, Z]) if (!net.removed.has(x + z * G)) busyNodes.push(x + z * G);
  }
  const live = [], free = Array.from({ length: CAPACITY }, (_, i) => CAPACITY - 1 - i);
  const seats = seatsOf(benches, food, layout, net);
  let time = 0, frame = 0;

  // A sector's people, in a fixed order: walkers and places interleaved so any prefix is a fair mix.
  const slotsOf = (s) => {
    if (s.slots) return s.slots;
    const rand = rng(snap.seed * 7919 + s.k * 104729 + 17), spots = places(s.k, snap, layout, net, s, seats, food, lamps);
    for (let i = spots.length - 1; i > 0; i--) { // shuffled, so a prefix is spread out
      const j = Math.floor(rand() * (i + 1));
      [spots[i], spots[j]] = [spots[j], spots[i]];
    }
    if (hq && s.k === hq.sector) spots.unshift(...hqPlaces(hq, hqAt, rand)); // always among the first out
    const most = Math.round(s.dens * PER_SECTOR * 2.5), share = Math.min(0.75, 0.3 * CROWD.idle);
    s.slots = [];
    for (let count = 0, si = 0; count < most;) {
      const spot = si < spots.length && (spots[si].first || rand() < share) ? spots[si++] : null;
      s.slots.push({ spot, seed: Math.floor(rand() * 1e9), n: spot ? spot.members.length : 1 });
      count += spot ? spot.members.length : 1;
    }
    return s.slots;
  };

  // Bringing people to life and letting them go.
  const spawn = (s, slot) => {
    const rand = rng(slot.seed), only = slot.spot?.only;
    const weights = only !== undefined ? s.weights.map((w, i) => (i === only ? 1 : 0)) : slot.spot?.corp ? s.weights.map((w, i) => (i === 1 ? w * 3 : w)) : s.weights;
    const made = (slot.spot ? slot.spot.members : [null]).map((m) => {
      if (!free.length || m?.seat?.taken) return null; // out of room, or a walker sat there first
      const look = dress(rand, weights);
      const p = { id: free.pop(), look, home: s, rand, ux: 0, uz: 0, y: 0.18, heading: 0, phase: rand() * 6.28, walk: 0, v: 0,
        dev: 0, talk: 0, sit: 0, yaw: 0, pitch: 0, fwd: 0, recline: 0, cross: 0, tap: 0, pose: [0, 0, 0, 0], eat: 0, work: 0, lean: (rand() - 0.5) * 0.04, lat: 0, latV: 0, dirx: 0, dirz: 1,
        fade: still ? 1 : 0, fadeTo: 1, mode: 'idle', act: 'stand', timer: 0, actTimer: 0, yawT: 0, pitchT: 0, talkT: 0,
        pts: [], k: 0, tail: -1, goal: -1, lane: 1.9 + rand() * 1.1, jit: (rand() - 0.5) * 2.4, back: rand() * 1.8,
        speed: look.speed, place: slot.spot, dist: 0, acc: 0 };
      if (m) {
        Object.assign(p, { ux: m.x, uz: m.z, heading: m.heading, mode: m.sit ? 'sit' : 'idle', sit: m.sit ? 1 : 0, static: true });
        if (m.y !== undefined) p.floor = m.y; // up the headquarters' towers
        if (m.bridge) startBridge(p, true);
        if (m.seat) {
          p.seat = m.seat;
          m.seat.taken = p;
        }
      } else startWalk(p, true);
      p.y = p.floor ?? ground(p.ux, p.uz);
      live.push(p);
      return p;
    }).filter(Boolean);
    if (made.length > 1 && made[0].mode === 'sit') made.forEach((p, i) => (p.partner = made[(i + 1) % made.length])); // a bench or table shared
    for (const p of made) if (p.static) {
      setAct(p, pick(p.rand, slot.spot.acts));
      p.actTimer = p.rand() * 10; // out of step with the rest of the group
      [p.fwd, p.recline, p.cross, p.tap] = p.pose; // already settled when they come into view
    }
    return made;
  };
  const retire = (p) => {
    p.fadeTo = 0;
    p.dying = true;
    if (p.seat?.taken === p) p.seat.taken = null;
  };

  // A walker starts somewhere on its home sector's sidewalks, heading to a corner nearby.
  function startWalk(p, fresh) {
    const { bx, by } = p.home, rand = p.rand;
    if (fresh) {
      const nodes = [0, 1].flatMap((cx) => [0, 1].map((cz) => 2 * bx + cx + (2 * by + cz) * G)).filter((id) => adj[id].length);
      const a = pick(rand, nodes), e = pick(rand, adj[a].filter((x) => x.kind !== 'cross'));
      const [x0, z0] = net.node(a, p.lane), [x1, z1] = e.path(p)[0] ?? net.node(e.to, p.lane), f = rand();
      p.ux = x0 + (x1 - x0) * f;
      p.uz = z0 + (z1 - z0) * f;
      p.pts = [...e.path(p), [...net.node(e.to, p.lane), null]];
      p.k = 0;
      p.tail = e.to;
      p.heading = Math.atan2(x1 - x0, z1 - z0);
      p.v = p.speed;
    } else {
      p.pts = [];
      p.k = 0;
    }
    chooseGoal(p);
    go(p);
    extend(p);
    if (!p.pts.length) p.pts.push([p.ux, p.uz, null]); // already at its goal's corner: arrive there at once
  }
  const go = (p) => {
    p.mode = 'walk';
    p.act = 'walk';
  };
  function chooseGoal(p) {
    const { bx, by } = p.home, rand = p.rand, near = [];
    for (let X = 2 * bx - 1; X <= 2 * bx + 2; X++) for (let Z = 2 * by - 1; Z <= 2 * by + 2; Z++) {
      const id = X + Z * G;
      if (X >= 0 && Z >= 0 && X < G && Z < G && id !== p.tail && dist[p.tail * N + id] < Infinity) near.push(id);
    }
    const busy = p.home.busy && busyNodes.filter((id) => id !== p.tail && dist[p.tail * N + id] < Infinity);
    p.goal = busy?.length && rand() < 0.4 ? pick(rand, busy) : near.length ? pick(rand, near) : p.tail;
    // Office workers near the headquarters often go in (doors are never full).
    const byHq = hq && Math.abs((hq.sector % S) - bx) <= 1 && Math.abs(Math.floor(hq.sector / S) - by) <= 1;
    if (byHq && (p.look.kind === 1 ? rand() < 0.35 : p.look.kind === 2 && rand() < 0.3)) { // couriers: the bay
      p.seat = pick(rand, doors.filter((d) => d.courier === (p.look.kind === 2)));
      p.goal = p.seat.node;
      return;
    }
    // Now and then a free bench, cafe seat or place at a stall near home instead: walk to the corner of its
    // sidewalk, then over to it. Stalls draw people more, and they join a queue at its back.
    if (rand() < 0.1 * CROWD.idle) {
      const back = (st) => !st.stall || st.rank === Math.min(...st.stall.seats.filter((x) => !x.taken).map((x) => x.rank));
      let free = seats.filter((st) => !st.taken && st.walkUp && near.includes(st.node) && back(st));
      if (rand() < 0.5 && free.some((st) => st.stall)) free = free.filter((st) => st.stall);
      if (free.length) {
        p.seat = pick(rand, free);
        p.seat.taken = p;
        p.goal = p.seat.node;
      }
    }
  }
  // Plans the next link of the route when fewer than two points are left; never doubles back along a sidewalk
  // (a crossing starts a few metres along from the corner, so the corner itself is skipped).
  function extend(p) {
    while (p.pts.length - p.k < 2 && p.tail !== p.goal) {
      const hop = next[p.tail * N + p.goal], e = hop >= 0 && adj[p.tail].find((x) => x.to === hop);
      if (!e) {
        p.goal = p.tail;
        break;
      }
      const add = [...e.path(p), [...net.node(hop, p.lane), null]], L = p.pts.length;
      if (L - p.k >= 1 && !p.pts[L - 1][2]) {
        const a = L >= 2 && L - 2 >= p.k - 1 ? p.pts[L - 2] : [p.ux, p.uz], c = p.pts[L - 1], d = add[0];
        const v1x = c[0] - a[0], v1z = c[1] - a[1], v2x = d[0] - c[0], v2z = d[1] - c[1];
        const dot = v1x * v2x + v1z * v2z, cr = Math.abs(v1x * v2z - v1z * v2x);
        if (dot < 0 && cr < 0.3 * Math.hypot(v1x, v1z) * Math.hypot(v2x, v2z)) p.pts.pop();
      }
      p.pts.push(...add);
      p.tail = hop;
    }
  }

  // What someone standing does: their phone, looking about, looking up at the towers, standing, or talking.
  function setAct(p, act) {
    p.act = act;
    p.actTimer = 6 + p.rand() * 14;
    p.yawT = act === 'look' ? (p.rand() - 0.5) * 1.8 : (p.rand() - 0.5) * 0.3;
    p.pitchT = act === 'up' ? -0.45 - p.rand() * 0.2 : 0.02;
    p.talkT = act === 'talk' ? (p.rand() < 0.5 ? 1 : 0.25) : 0;
    if (p.mode === 'sit') sitAs(p, act);
  }
  // How someone sits for what they are doing: [forward, leaning back, legs crossed, tapping] (figures.js POSE). A phone is
  // read upright or hunched over the knees; talking turns the head to the one beside them; resting leans back on
  // the hands; dozing slumps with the head down. Legs cross and a foot taps now and then, whatever they are doing.
  function sitAs(p, act) {
    const r = p.rand, pose = p.pose;
    pose[0] = act === 'device' ? (r() < 0.55 ? 0.7 + r() * 0.3 : 0) : act === 'doze' ? 0.35 : act === 'look' ? r() * 0.4 : 0;
    pose[1] = act === 'rest' ? 0.8 + r() * 0.2 : act === 'doze' && r() < 0.5 ? 0.6 : 0;
    pose[2] = pose[0] < 0.5 && r() < 0.4 ? 1 : 0;
    pose[3] = (act === 'device' || act === 'look') && r() < 0.3 ? 1 : 0;
    if (act === 'talk' && p.partner) { // face the other, as far as a head turns
      const q = p.partner, a = Math.atan2(q.ux - p.ux, q.uz - p.uz) - p.heading;
      p.yawT = Math.max(-1.1, Math.min(1.1, Math.atan2(Math.sin(a), Math.cos(a)))) * (0.7 + r() * 0.3);
    } else if (act === 'talk') setAct(p, 'look'); // nobody to talk to
    if (act === 'doze') p.pitchT = 0.5 + r() * 0.15;
    if (act === 'rest') p.pitchT = -0.12 - r() * 0.15;
  }
  const idleActs = ['device', 'look', 'up', 'stand', 'device'];
  function standAbout(p, dt) {
    p.actTimer -= dt;
    if (p.actTimer <= 0) {
      if (p.act === 'talk') { // speakers and listeners swap now and then
        p.talkT = p.rand() < 0.45 ? 1 : 0.25;
        if (!p.partner) p.yawT = (p.rand() - 0.5) * 0.5;
        p.actTimer = 2 + p.rand() * 5;
      } else if (p.act === 'look' && p.rand() < 0.6) {
        p.yawT = (p.rand() - 0.5) * (p.look.patrol ? 2.2 : 1.8);
        p.actTimer = 1.5 + p.rand() * 2.5;
      } else {
        const own = p.seat && !p.static && (p.seat.table || p.seat.stall ? ['eat', 'eat', 'device', 'look'] : ['device', 'look', 'rest', 'doze']);
        setAct(p, pick(p.rand, own || (p.place ? p.place.acts : idleActs)));
      }
    }
  }

  // One person's step: walking the route, waiting at a kerb, or standing about.
  function step(p, dt, t) {
    if (p.bridge) {
      bridging(p, dt);
      smooth(p, dt);
      return;
    }
    if (p.mode === 'walk') walking(p, dt, t);
    else if (p.mode === 'wait') {
      standAbout(p, dt);
      if (canCross(p.wait, t)) go(p);
    } else if (p.seat && !p.static && (p.mode === 'sit' || p.mode === 'standup')) seated(p, dt);
    else if (p.mode === 'inside') { // back out of the same door after a while, and on
      if ((p.timer -= dt) > 0) return;
      const d = p.seat;
      p.fadeTo = 1;
      p.heading = hq.heading;
      p.seat = null;
      p.pts = [[d.fx, d.fz, null], [...d.lane(p.lane), null]];
      p.k = 0;
      p.tail = d.node;
      chooseGoal(p);
      go(p);
      extend(p);
    }
    else {
      standAbout(p, dt);
      if (!p.static && (p.timer -= dt) <= 0) {
        if (p.resume) go(p); // back on the way after a short stop
        else startWalk(p, false);
      }
    }
    smooth(p, dt);
  }
  // Smooth transitions between states.
  function smooth(p, dt) {
    const k = 1 - Math.exp(-dt * 3), moving = p.mode === 'walk' || p.mode === 'bridge';
    p.dev += ((p.act === 'device' ? 1 : 0) - p.dev) * k;
    p.talk += ((p.act === 'talk' ? p.talkT : 0) - p.talk) * k;
    p.sit += ((p.mode === 'sit' && !p.seat?.stand && (p.static || p.settled) ? 1 : 0) - p.sit) * k * 2;
    p.eat += ((p.act === 'eat' ? 1 : 0) - p.eat) * k;
    p.work += ((p.act === 'work' ? 1 : 0) - p.work) * k;
    const slow = k * 0.5; // settling into another way of sitting takes a couple of seconds
    p.fwd += (p.pose[0] - p.fwd) * slow;
    p.recline += (p.pose[1] - p.recline) * slow;
    p.cross += (p.pose[2] - p.cross) * slow;
    p.tap += (p.pose[3] - p.tap) * k;
    p.yaw += ((moving ? 0 : p.yawT) - p.yaw) * k;
    p.pitch += ((moving ? 0.02 : p.pitchT) - p.pitch) * k;
    if (!moving) p.v = Math.max(0, p.v - 3 * dt);
    const w = Math.min(1.3, p.v / 1.35);
    p.walk += (w - p.walk) * (1 - Math.exp(-dt * 8));
  }
  // The skybridge's walkers: each crosses from a door inside one tower's corridor to the other's, keeping to the lane
  // for its direction, now and then stopping at the glass to look out; at the far door it fades into the tower and,
  // a while later, comes out of one of the doors again. Positions in the site's frame (bu across, bw), on the deck.
  // Where they stop at the glass: the middles of the bridge's four glass panels, never in front of a frame.
  const LANE = { 1: HQ.bridge.w[0] + 2.4, '-1': HQ.bridge.w[1] - 2.4 }, DOOR = HQ.GAP + 5.6, PANES = [-6.45, -2.15, 2.15, 6.45];
  function startBridge(p, fresh) {
    p.static = false;
    p.bridge = true;
    p.floor = HQ.bridge.y + 0.22;
    p.dirU = p.rand() < 0.5 ? 1 : -1;
    p.bu = fresh ? (p.rand() - 0.5) * 2 * HQ.GAP : -p.dirU * DOOR;
    p.bw = LANE[p.dirU];
    p.pauseAt = p.rand() < 0.4 ? PANES[Math.floor(p.rand() * PANES.length)] : null;
    [p.ux, p.uz] = hqAt(p.bu, p.bw);
    p.heading = hq.heading + (p.dirU > 0 ? Math.PI / 2 : -Math.PI / 2);
    p.mode = 'bridge';
    p.act = 'walk';
    p.fadeTo = 1;
  }
  function bridging(p, dt) {
    if (p.mode === 'inside') { // in the tower, out of sight
      if ((p.timer -= dt) <= 0) startBridge(p, false);
      return;
    }
    if (p.mode === 'idle') { // stopped at the glass
      standAbout(p, dt);
      if ((p.timer -= dt) <= 0) {
        p.pauseAt = null;
        p.mode = 'bridge';
        p.act = 'walk';
      }
      return;
    }
    const glass = p.dirU > 0 ? HQ.bridge.w[0] + 0.7 : HQ.bridge.w[1] - 0.7;
    const stopping = p.pauseAt !== null && Math.abs(p.bu - p.pauseAt) < 0.8;
    const [tx, tz] = stopping ? hqAt(p.pauseAt, glass) : hqAt(p.bu + p.dirU * 2, LANE[p.dirU]);
    const [ex, ez] = hqAt(p.dirU * DOOR, LANE[p.dirU]);
    const dx = tx - p.ux, dz = tz - p.uz, d = Math.sqrt(dx * dx + dz * dz);
    turn(p, Math.atan2(dx, dz), dt);
    advance(p, dx, dz, d, stopping ? Math.min(p.speed * 0.6, Math.sqrt(2 * d)) : p.speed * 0.9, dt);
    [p.bu, p.bw] = hqLocal(p.ux, p.uz);
    if (stopping && d < 0.1) { // at the glass: face out over the city a while
      p.mode = 'idle';
      p.v = 0;
      p.timer = 4 + p.rand() * 6;
      setAct(p, p.rand() < 0.7 ? 'look' : 'device');
      p.yawT = (p.rand() - 0.5) * 0.8;
      p.heading = hq.heading + (p.dirU > 0 ? Math.PI : 0);
    } else if (Math.hypot(ex - p.ux, ez - p.uz) < 0.5) { // through the far door
      p.mode = 'inside';
      p.fadeTo = 0;
      p.timer = 3 + p.rand() * 7; // back out soon: the bridge is never empty for long
    }
  }
  // A walker on a seat: turns to face the way it faces, lowers onto it (sliding from where it stood), sits a while,
  // then gets up, steps back and walks on from the seat's corner.
  function seated(p, dt) {
    const st = p.seat, err = Math.abs(turn(p, st.heading, dt));
    p.ux = st.fx + (st.x - st.fx) * p.sit;
    p.uz = st.fz + (st.z - st.fz) * p.sit;
    if (p.mode === 'sit') {
      p.settled = err < 0.25;
      standAbout(p, dt);
      const ahead = st.rank > 1 && st.stall.seats.filter((x) => !x.taken && x.rank < st.rank).sort((a, b) => a.rank - b.rank)[0];
      if (ahead) { // the queue moves up: step into the place ahead
        st.taken = null;
        ahead.taken = p;
        p.seat = ahead;
        p.pts = [[ahead.fx, ahead.fz, null]];
        p.k = 0;
        p.approach = true;
        p.settled = false;
        go(p);
      } else if ((p.timer -= dt) <= 0) p.mode = 'standup';
    } else if (p.sit < 0.04) { // up: back to the sidewalk and on
      st.taken = null;
      p.seat = null;
      p.pts = [...(st.via ? [[...st.via, null]] : []), [...st.lane(p.lane), null]];
      p.k = 0;
      p.tail = st.node;
      chooseGoal(p);
      go(p);
      extend(p);
    }
  }
  // One step along (dx, dz), d away: speed eased toward vmax, legs swung to match. Returns the distance moved.
  function advance(p, dx, dz, d, vmax, dt) {
    p.v += Math.max(-2.5 * dt, Math.min(1.2 * dt, vmax - p.v));
    const s = Math.min(d, p.v * dt);
    if (d > 1e-6) {
      p.ux += (dx / d) * s;
      p.uz += (dz / d) * s;
    }
    p.phase = (p.phase + (s / (1.5 * p.look.height * (p.look.fast ? 1.1 : 1))) * Math.PI * 2) % (Math.PI * 2);
    return s;
  }
  function walking(p, dt, t) {
    let [tx, tz, wait] = p.pts[p.k];
    if (p.pts[p.k][3]) zebraUse.set(p.pts[p.k][3], t); // on a zebra (its far kerb is the point it walks to): turning cars wait
    if (wait && canCross(wait, t)) wait = null; // walk now: no need to stop
    const dx = tx - p.ux, dz = tz - p.uz, d = Math.sqrt(dx * dx + dz * dz), want = Math.atan2(dx, dz);
    const err = Math.abs(turn(p, want, dt));
    let vmax = p.speed * Math.max(0, 1 - err / 1.5); // slow into a turn; turn on the spot to go back
    if (wait) vmax = Math.min(vmax, Math.sqrt(2.4 * d) + 0.05); // ease into the kerb
    const s = advance(p, dx, dz, d, vmax, dt);
    if (d > 1e-6) {
      p.dirx = dx / d;
      p.dirz = dz / d;
    }
    if (d - s > (wait ? 0.04 : 0.4)) return;
    p.k++;
    if (wait) {
      p.mode = 'wait';
      p.wait = wait;
      setAct(p, p.rand() < 0.45 ? 'device' : 'look');
      p.yawT = (p.rand() - 0.5) * 1.2;
    } else if (p.k < p.pts.length - 1 && p.rand() < 0.012 * CROWD.idle) { // a short stop on the way
      p.mode = 'idle';
      p.resume = true;
      p.timer = 2 + p.rand() * 5;
      setAct(p, pick(p.rand, ['device', 'look', 'up']));
    }
    if (p.k >= p.pts.length && p.seat?.door && p.mode === 'walk') { // at the corner, then the forecourt, then inside
      const d = p.seat;
      if (!p.approach) {
        p.approach = true;
        p.pts = [[...d.lane(p.lane), null], [d.fx, d.fz, null]];
      } else if (!p.entering) {
        p.entering = true;
        p.pts = [[d.x, d.z, null]];
      } else { // through the door: gone from the street for a while (fading out inside the lobby)
        p.approach = p.entering = false;
        p.mode = 'inside';
        p.fadeTo = 0;
        p.timer = 20 + p.rand() * 70;
      }
      p.k = 0;
      return;
    }
    if (p.k >= p.pts.length && p.seat && p.mode === 'walk') { // at the seat's corner: over to it; there: sit down
      if (!p.approach) {
        p.approach = true;
        p.pts = [[...p.seat.lane(p.lane), null], ...(p.seat.via ? [[...p.seat.via, null]] : []), [p.seat.fx, p.seat.fz, null]];
        p.k = 0;
        return;
      }
      p.approach = false;
      p.mode = 'sit';
      const eats = p.seat.table || p.seat.stall, queuing = p.seat.rank > 1;
      p.timer = queuing ? 120 : (p.seat.stall ? 10 + p.rand() * 20 : 15 + p.rand() * 45) * CROWD.idle;
      setAct(p, pick(p.rand, queuing ? ['look', 'device'] : eats ? ['eat', 'eat', 'device', 'look'] : ['device', 'look', 'rest', 'doze']));
      return;
    }
    if (p.k >= p.pts.length) { // there: stay a while
      p.mode = 'idle';
      p.resume = false;
      p.timer = (3 + p.rand() * 14) * CROWD.idle;
      setAct(p, pick(p.rand, idleActs));
      p.pts = [];
      p.k = 0;
      return;
    }
    extend(p);
  }
  // Turns smoothly toward `want`; the stepping feet while turning on the spot come from the phase.
  function turn(p, want, dt) {
    const err = Math.atan2(Math.sin(want - p.heading), Math.cos(want - p.heading)), turnBy = Math.sign(err) * Math.min(Math.abs(err), dt * 3.2);
    p.heading += turnBy;
    if (p.v < 0.3) p.phase = (p.phase + Math.abs(turnBy) * 1.6) % (Math.PI * 2);
    return err;
  }

  // Walkers make room: oncoming people pass on their right, standing ones are walked round. Each walker has a sideways
  // offset it wants (lat's target: aside as someone comes near ahead, held while level with them, back to 0 once
  // past) and eases toward it on a damped spring, quicker going aside than coming back, so nobody jumps.
  const grid = new Map(), cell = (x, z) => Math.floor(x / 2.5) * 73856093 ^ Math.floor(z / 2.5) * 19349663;
  const AWAY = 0.6; // how far aside, m
  const spring = (p, want, k, dt) => { // critically damped: no overshoot
    p.latV += ((want - p.lat) * k - p.latV * 2 * Math.sqrt(k)) * dt;
    p.lat += p.latV * dt;
  };
  function avoid(dt) {
    dt = Math.min(dt, 0.1); // the spring stays stable after a stall
    for (const list of grid.values()) list.length = 0; // the cells' lists are kept and refilled
    for (const p of live) {
      if (p.dist > 160) continue;
      p.rx = p.ux - p.dirz * p.lat;
      p.rz = p.uz + p.dirx * p.lat;
      const key = cell(p.rx, p.rz);
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key).push(p);
    }
    if (grid.size > 4000) grid.clear(); // after a long flight, forget empty cells
    for (const p of live) {
      if (p.dist > 160 || (p.mode !== 'walk' && p.mode !== 'wait')) continue;
      if (p.approach) { // into a seat or a door: back onto the line
        spring(p, 0, 6, dt);
        continue;
      }
      let push = 0, near = 0;
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
        const list = grid.get(cell(p.rx + i * 2.5, p.rz + j * 2.5));
        if (list) for (const q of list) {
          if (q === p) continue;
          const dx = q.rx - p.rx, dz = q.rz - p.rz;
          if (p.mode === 'wait') { // at the kerb: shuffle sideways off anyone too close
            if (dx * dx + dz * dz < 0.42) push += -dx * p.dirz + dz * p.dirx > 0 ? -1 : 1;
            continue;
          }
          // Against the walker's own line, not where it stands now, so stepping aside does not lose sight of them.
          const ux = q.rx - p.ux, uz = q.rz - p.uz, ahead = ux * p.dirx + uz * p.dirz, side = -ux * p.dirz + uz * p.dirx;
          if (ahead <= -0.8 || ahead > 3 || Math.abs(side) > 0.9) continue;
          const oncoming = q.mode === 'walk' && q.dirx * p.dirx + q.dirz * p.dirz < -0.3;
          const w = Math.min(1, (3 - ahead) / 1.6); // 0 at 3 m ahead, full from 1.4 m to level
          push += (oncoming || side - p.lat < 0.1 ? 1 : -1) * w; // round them on the side it is already on (none yet: right)
          near = Math.max(near, w);
          if (!oncoming && q.mode === 'walk' && ahead > 0 && ahead < 1.2) p.v = Math.min(p.v, q.v + 0.1); // no walking through
        }
      }
      if (p.mode === 'wait') {
        p.latV = 0;
        if (push) p.lat = Math.max(-1.1, Math.min(1.1, p.lat + Math.sign(push) * 0.9 * dt));
        continue;
      }
      spring(p, push ? Math.sign(push) * AWAY * near : 0, push ? 7 : 1.5, dt); // never past AWAY: clear of lamps and walls
    }
  }

  // Which sectors are live, and how many of each one's people, within the budget, nearest first.
  let lastAt = new THREE.Vector3(Infinity, 0, 0), lastStream = -1;
  function stream(force) {
    const c = camera.position;
    if (!force && c.distanceToSquared(lastAt) < 16 && time - lastStream < 0.5) return;
    lastAt.copy(c);
    lastStream = time;
    const far = CROWD.distance;
    for (const s of sectors) {
      const [x0, x1, z0, z1] = s.rect;
      s.d = Math.hypot(Math.max(0, x0 - c.x, c.x - x1), c.y, Math.max(0, z0 - c.z, c.z - z1));
      if (!s.active && s.d < far + 40) s.active = true;
      else if (s.active && s.d > far + 110) s.active = false;
    }
    let budget = Math.min(CROWD.max, CAPACITY);
    for (const s of [...sectors].sort((a, b) => a.d - b.d)) {
      let want = s.active ? Math.round(s.dens * PER_SECTOR * CROWD.density) : 0, count = 0, people = 0;
      want = Math.min(want, budget);
      if (want > 0) {
        const slots = slotsOf(s);
        while (count < slots.length && people + slots[count].n <= want) people += slots[count++].n;
      }
      budget -= people;
      while (s.live.length > count) s.live.pop().forEach(retire);
      while (s.live.length < count) s.live.push(spawn(s, s.slots[s.live.length]));
    }
  }
  // Drops everyone (after a settings change) so the next stream starts afresh.
  function reset() {
    for (const s of sectors) {
      s.live.forEach((g) => g.forEach(retire));
      s.live = [];
      s.slots = null;
    }
    stream(true);
  }

  // Each frame: stream, step everyone (those far away less often), make room, then write the data texture and
  // the draw lists, culled to the view and split by distance into the three levels of detail.
  const frustum = new THREE.Frustum(), m4 = new THREE.Matrix4(), sphere = new THREE.Sphere(new THREE.Vector3(), 1.3), shift = [0, 0];
  const counts = { live: 0, drawn: 0 };
  function update(dt) {
    time += dt;
    frame++;
    fig.time.value = time;
    fig.far.value = CROWD.distance;
    stream(false);
    const t = clock();
    for (let i = live.length - 1; i >= 0; i--) {
      const p = live[i];
      p.fade = Math.max(0, Math.min(1, p.fade + Math.sign(p.fadeTo - p.fade) * dt * 0.8));
      if (p.dying && p.fade <= 0) {
        free.push(p.id);
        live[i] = live[live.length - 1];
        live.pop();
        continue;
      }
      p.acc += dt;
      const every = p.dist > 160 ? 3 : p.dist > 60 ? 2 : 1; // animation LOD: far people step less often
      if ((frame + p.id) % every === 0 && p.acc > 0) {
        step(p, Math.min(p.acc, 0.25), t);
        p.acc = 0;
      }
    }
    avoid(dt);
    camera.updateMatrixWorld();
    frustum.setFromProjectionMatrix(m4.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    const [near, mid] = [[0, 0], [0, 140], [70, 200]][CROWD.detail], c = camera.position;
    let drawn = 0;
    const cut = (CROWD.distance + 15) ** 2;
    for (const p of live) {
      const rx = p.ux - p.dirz * p.lat, rz = p.uz + p.dirx * p.lat;
      // Well past the crowd's distance (the old town's warp moves things 10 m at most): not drawn, no more work.
      // (Squared sums, not Math.hypot: this runs for everyone every frame.)
      if ((rx - c.x) ** 2 + c.y ** 2 + (rz - c.z) ** 2 > cut) {
        p.dist = CROWD.distance + 15;
        continue;
      }
      if (rx !== p.gx || rz !== p.gz) { // the ground under them, worked out again only once they move
        p.gx = rx;
        p.gz = rz;
        p.gy = p.floor ?? ground(rx, rz);
      }
      p.y += (p.gy - p.y) * Math.min(1, dt * 12 || 1);
      warp(rx, rz, shift);
      const x = rx + shift[0], z = rz + shift[1], L = p.look;
      p.dist = Math.sqrt((x - c.x) ** 2 + (p.y + 0.9 - c.y) ** 2 + (z - c.z) ** 2);
      if (p.dist > CROWD.distance || p.fade <= 0) continue;
      let o = p.id * TEXELS * 4; // the shader's numbers (figures.js POSE), seven texels a person
      arr[o++] = x; arr[o++] = p.y; arr[o++] = z; arr[o++] = p.heading - (p.v > 0.3 ? 0.6 * Math.atan(p.latV / p.v) : 0); // turned a little into a step aside
      arr[o++] = p.phase; arr[o++] = p.walk; arr[o++] = L.height; arr[o++] = L.build;
      arr[o++] = p.yaw; arr[o++] = p.dev; arr[o++] = p.talk; arr[o++] = p.sit;
      arr[o++] = L.A; arr[o++] = L.B; arr[o++] = L.C; arr[o++] = p.fade;
      arr[o++] = L.seed; arr[o++] = p.lean; arr[o++] = p.pitch; arr[o++] = L.glow;
      arr[o++] = p.fwd; arr[o++] = p.recline; arr[o++] = p.cross; arr[o++] = p.tap;
      arr[o++] = p.eat; arr[o] = p.work;
      sphere.center.set(x, p.y + 0.9, z);
      if (!frustum.intersectsSphere(sphere)) continue;
      const lod = p.dist < near ? 0 : p.dist < mid ? 1 : 2;
      for (const m of L.mods) {
        const e = fig.meshes[m][lod];
        if (e) e.ids.array[e.count++] = p.id;
      }
      drawn++;
    }
    for (const lods of fig.meshes) for (const e of lods) if (e) {
      e.mesh.geometry.instanceCount = e.count;
      e.mesh.visible = e.count > 0;
      e.ids.clearUpdateRanges();
      e.ids.addUpdateRange(0, e.count);
      e.ids.needsUpdate = true;
      e.count = 0;
    }
    fig.data.needsUpdate = true;
    counts.live = live.length;
    counts.drawn = drawn;
  }

  if (params.get('crowd') === 'off') return fig.group;
  if (still) { // no frame loop: place everyone once, and again when the camera moves
    controls.addEventListener('change', () => update(0));
    update(0);
  } else onFrame((dt) => update(dt));
  settings(reset, counts, params.has('crowd'));
  return fig.group;
}

// The settings panel: P shows and hides it (?crowd opens with it shown). Changing who is out restarts the crowd.
function settings(reset, counts, open) {
  const box = document.createElement('div');
  box.setAttribute('role', 'region');
  box.setAttribute('aria-label', 'Crowd settings');
  Object.assign(box.style, { position: 'fixed', right: '12px', bottom: '12px', padding: '10px 12px', width: '220px',
    background: css(ui.panel), border: `1px solid ${css(ui.border)}`, color: css(ui.text), font: '12px/1.4 system-ui, sans-serif',
    borderRadius: '6px', display: open ? 'block' : 'none', opacity: '0.94' });
  const rows = [['density', 'Density', 0, 2.5, 0.1, true], ['max', 'Most people', 100, 3000, 50, true], ['speed', 'Speed spread', 0, 2, 0.1, true],
    ['idle', 'Standing about', 0, 2.5, 0.1, true], ['detail', 'Detail', 0, 2, 1, false], ['distance', 'Distance (m)', 150, 900, 10, false]];
  box.innerHTML = '<strong>Crowd</strong> <span style="color:' + css(ui.muted) + '">(P to hide)</span>';
  for (const [key, label, min, max, stepBy, restart] of rows) {
    const row = document.createElement('label'), input = document.createElement('input'), out = document.createElement('span');
    Object.assign(row.style, { display: 'grid', gridTemplateColumns: '1fr auto', marginTop: '6px', color: css(ui.muted) });
    Object.assign(input, { type: 'range', min, max, step: stepBy, value: CROWD[key] });
    input.style.gridColumn = '1 / 3';
    input.style.accentColor = css(ui.accent);
    out.textContent = CROWD[key];
    out.style.color = css(ui.text);
    input.addEventListener('input', () => {
      CROWD[key] = Number(input.value);
      out.textContent = input.value;
      if (restart) reset();
    });
    row.append(label, out, input);
    box.append(row);
  }
  const stats = document.createElement('div');
  stats.style.marginTop = '8px';
  stats.style.color = css(ui.muted);
  box.append(stats);
  setInterval(() => { if (box.style.display !== 'none') stats.textContent = `${counts.live} out, ${counts.drawn} in view`; }, 500);
  addEventListener('keydown', (e) => {
    if (e.key === 'p' || e.key === 'P') box.style.display = box.style.display === 'none' ? 'block' : 'none';
  });
  document.body.append(box);
}
