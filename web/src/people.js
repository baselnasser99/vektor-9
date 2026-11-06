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
// the way. The rest stand or sit at places that suit it: by entrances, at the kerb waiting for a ride, talking
// in small groups, on the walks' benches, on the plaza looking up at the tower.
//
// How many. The city is split by sector. Sectors near the camera are active (with a margin, so they switch on and
// off out of sight); each has a seeded list of people, and a prefix of it is live, so the same people are always
// in the same places and a lower budget simply drops the last. Everyone is drawn by figures.js: three levels of
// detail by distance, culled to the view, fading in and out by size beyond the crowd's distance.
import * as THREE from 'three';
import { css, ui } from './palette.js';
import { rng } from './geometry.js';
import { crossing } from './city.js';
import { walkLight } from './life.js';
import { BLOCK, SIDEWALK, TILE } from './world.js';
import { NAMES, TEXELS, colour, figures } from './figures.js';

// Settings (the P panel): people per sector, the most alive at once, walking-speed spread, how often people stop
// and stand about, detail (0 simplest to 2 full) and the distance they are drawn to, in metres.
export const CROWD = { density: 1, max: 1200, speed: 1, idle: 1, detail: 2, distance: 450 };
const CAPACITY = 3000;
const PER_SECTOR = 55; // people in an ordinary sector at density 1
const PLAZA = 44; // radius of the walk round the tower's roundabout (its outer kerb is at 40.8 m)
const ZEBRA = SIDEWALK + 1.8; // a crosswalk's centre line, along the street from the corner kerb (streets.js road)

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
    mods: mods.map((m) => NAMES.indexOf(m)), patrol: !!kind.patrol, fast: !!kind.fast,
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
    e0[b] = pos(b * BLOCK) - TILE / 2 - SIDEWALK;
    e1[b] = pos(b * BLOCK + BLOCK - 1) + TILE / 2 + SIDEWALK;
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
  const none = () => [];
  for (let K = 0; K < G; K++) for (let b = 0; b < S; b++) {
    for (const [a, c] of [[2 * b + K * G, 2 * b + 1 + K * G], [K + 2 * b * G, K + (2 * b + 1) * G]]) {
      link(a, c, 'side', none);
      link(c, a, 'side', none);
    }
  }
  // A crossing walking along `axis` from kerb `from` to kerb `to`, at `v` on the other axis (plus the person's own
  // place across the zebra). Points are [x, z, wait]: wait holds the light and the time needed to the next stop.
  const cross = (axis, from, to, v, light, median) => (p) => {
    const d = Math.sign(to - from), j = v + p.jit, pt = (u, w) => (axis === 'x' ? [u, j, w] : [j, u, w]);
    const stop = (a, b) => light && { light, need: Math.abs(b - a) / p.speed + 1.5 };
    const out = [pt(from - d * p.lane, null), pt(from - d * (0.45 + p.back), stop(from, median ?? to))];
    if (median !== null) out.push(pt(median - d * 0.8, stop(median, to)));
    out.push(pt(to + d * 0.45, null), pt(to + d * p.lane, null));
    return out;
  };
  for (let L = 1; L < S; L++) for (let K = 0; K < G; K++) {
    const M = (K >> 1) + (K & 1); // the street across the end of this sidewalk
    if (L === h && M === h) continue; // the roundabout: no crossings
    for (const axis of ['x', 'z']) {
      const street = axis === 'x' ? lines[L].kind.z : lines[L].kind.x, other = axis === 'x' ? lines[M].kind.x : lines[M].kind.z;
      if (street !== 'walk' && other === 'walk') continue; // no lights there, and the cars do not stop
      const a = axis === 'x' ? 2 * L - 1 + K * G : K + (2 * L - 1) * G, b = axis === 'x' ? a + 1 : a + G;
      const v = K & 1 ? e1[K >> 1] - ZEBRA : e0[K >> 1] + ZEBRA;
      const light = street !== 'walk' && (axis === 'x' ? { x: lines[L].c, z: lines[M].c, axis: 'z' } : { x: lines[M].c, z: lines[L].c, axis: 'x' });
      const median = street === 'boulevard' ? lines[L].c : null;
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
  const roadway = (v) => lines.find((l) => Math.abs(v - l.c) < l.w / 2 - SIDEWALK);
  const ground = (x, z) => {
    if (Math.hypot(x - hub, z - hub) < PLAZA - 3) return 0; // the ring road
    const lx = roadway(x), lz = roadway(z);
    if (!lx && !lz) return 0.18;
    if (lx && lz) return 0;
    const [kind, off, along] = lx ? [lx.kind.z, x - lx.c, z] : [lz.kind.x, z - lz.c, x];
    if (kind === 'walk') return 0.18;
    const nearCrossing = lines.some((m) => Math.abs(along - m.c) < m.w / 2 + SIDEWALK);
    return kind === 'boulevard' && Math.abs(off) < 3 && !nearCrossing ? 0.28 : 0;
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
function places(k, snap, layout, net, info, benches, lamps) {
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
      const near = (a2) => lamps.some(([lx, lz]) => Math.hypot(lx - place(sd, a2, 0.95)[0], lz - place(sd, a2, 0.95)[1]) < 2.5);
      while (near(a)) a += 3;
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
    for (const [x, z, ax, sign] of benches) {
      const off = ax === 'z' ? x - lines[L].c : z - lines[L].c, v = ax === 'z' ? z : x;
      if (ax !== axis || Math.abs(off) > 3 || v < lo || v > hi || rand() > 0.6) continue;
      const heading = ax === 'z' ? (sign > 0 ? Math.PI / 2 : -Math.PI / 2) : sign > 0 ? 0 : Math.PI;
      const seats = rand() < 0.35 ? [-0.45, 0.45] : [(rand() - 0.5) * 0.9];
      add(seats.map((s) => ({ x: ax === 'z' ? x : x + s, z: ax === 'z' ? z + s : z, heading, sit: true })), ['device', 'stand', 'look']);
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

export function people({ snap, layout, warp, benches, lamps, clock, camera, controls, onFrame, still }) {
  const params = new URLSearchParams(location.search);
  const net = network(layout), info = districts(snap, layout, net), { S, G, N, adj, dist, next, ground } = net;
  const fig = figures(CAPACITY), arr = fig.data.image.data;
  const sectors = info.map((d, k) => ({ ...d, k, active: false, live: [], slots: null, given: 0,
    rect: [net.e0[d.bx] - 25, net.e1[d.bx] + 25, net.e0[d.by] - 25, net.e1[d.by] + 25] }));
  const { corners } = crossing(snap), busyNodes = [];
  if (corners.length) { // the busiest crossing's four corners: walkers in its sectors often head there
    const col = corners[0] % layout.n, row = Math.floor(corners[0] / layout.n), X = 2 * Math.floor((col + 1) / BLOCK), Z = 2 * Math.floor((row + 1) / BLOCK);
    for (const x of [X - 1, X]) for (const z of [Z - 1, Z]) if (!net.removed.has(x + z * G)) busyNodes.push(x + z * G);
  }
  const live = [], free = Array.from({ length: CAPACITY }, (_, i) => CAPACITY - 1 - i);
  let time = 0, frame = 0;

  // A sector's people, in a fixed order: walkers and places interleaved so any prefix is a fair mix.
  const slotsOf = (s) => {
    if (s.slots) return s.slots;
    const rand = rng(snap.seed * 7919 + s.k * 104729 + 17), spots = places(s.k, snap, layout, net, s, benches, lamps);
    for (let i = spots.length - 1; i > 0; i--) { // shuffled, so a prefix is spread out
      const j = Math.floor(rand() * (i + 1));
      [spots[i], spots[j]] = [spots[j], spots[i]];
    }
    const most = Math.round(s.dens * PER_SECTOR * 2.5), share = Math.min(0.75, 0.3 * CROWD.idle);
    s.slots = [];
    for (let count = 0, si = 0; count < most;) {
      const spot = si < spots.length && rand() < share ? spots[si++] : null;
      s.slots.push({ spot, seed: Math.floor(rand() * 1e9), n: spot ? spot.members.length : 1 });
      count += spot ? spot.members.length : 1;
    }
    return s.slots;
  };

  // Bringing people to life and letting them go.
  const spawn = (s, slot) => {
    const rand = rng(slot.seed), weights = slot.spot?.corp ? s.weights.map((w, i) => (i === 1 ? w * 3 : w)) : s.weights;
    const made = (slot.spot ? slot.spot.members : [null]).map((m) => {
      if (!free.length) return null;
      const look = dress(rand, weights);
      const p = { id: free.pop(), look, home: s, rand, ux: 0, uz: 0, y: 0.18, heading: 0, phase: rand() * 6.28, walk: 0, v: 0,
        dev: 0, talk: 0, sit: 0, yaw: 0, pitch: 0, lean: (rand() - 0.5) * 0.04, lat: 0, dirx: 0, dirz: 1,
        fade: still ? 1 : 0, fadeTo: 1, mode: 'idle', act: 'stand', timer: 0, actTimer: 0, yawT: 0, pitchT: 0, talkT: 0,
        pts: [], k: 0, tail: -1, goal: -1, lane: 1.9 + rand() * 1.1, jit: (rand() - 0.5) * 2.4, back: rand() * 1.8,
        speed: look.speed, place: slot.spot, dist: 0, acc: 0 };
      if (m) {
        Object.assign(p, { ux: m.x, uz: m.z, heading: m.heading, mode: m.sit ? 'sit' : 'idle', sit: m.sit ? 1 : 0, static: true });
        setAct(p, pick(rand, slot.spot.acts));
        p.actTimer = rand() * 10; // out of step with the rest of the group
      } else startWalk(p, true);
      p.y = ground(p.ux, p.uz);
      live.push(p);
      return p;
    });
    return made.filter(Boolean);
  };
  const retire = (p) => {
    p.fadeTo = 0;
    p.dying = true;
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
    p.mode = 'walk';
    p.act = 'walk';
    extend(p);
  }
  function chooseGoal(p) {
    const { bx, by } = p.home, rand = p.rand, near = [];
    for (let X = 2 * bx - 1; X <= 2 * bx + 2; X++) for (let Z = 2 * by - 1; Z <= 2 * by + 2; Z++) {
      const id = X + Z * G;
      if (X >= 0 && Z >= 0 && X < G && Z < G && id !== p.tail && dist[p.tail * N + id] < Infinity) near.push(id);
    }
    const busy = p.home.busy && busyNodes.filter((id) => id !== p.tail && dist[p.tail * N + id] < Infinity);
    p.goal = busy?.length && rand() < 0.4 ? pick(rand, busy) : near.length ? pick(rand, near) : p.tail;
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
  }
  const idleActs = ['device', 'look', 'up', 'stand', 'device'];
  function standAbout(p, dt) {
    p.actTimer -= dt;
    if (p.actTimer <= 0) {
      if (p.act === 'talk') { // speakers and listeners swap now and then
        p.talkT = p.rand() < 0.45 ? 1 : 0.25;
        p.yawT = (p.rand() - 0.5) * 0.5;
        p.actTimer = 2 + p.rand() * 5;
      } else if (p.act === 'look' && p.rand() < 0.6) {
        p.yawT = (p.rand() - 0.5) * (p.look.patrol ? 2.2 : 1.8);
        p.actTimer = 1.5 + p.rand() * 2.5;
      } else setAct(p, p.place ? pick(p.rand, p.place.acts) : pick(p.rand, idleActs));
    }
  }

  // One person's step: walking the route, waiting at a kerb, or standing about.
  function step(p, dt, t) {
    if (p.mode === 'walk') walking(p, dt, t);
    else if (p.mode === 'wait') {
      standAbout(p, dt);
      if (walkLight(p.wait.light.x, p.wait.light.z, p.wait.light.axis, t) > p.wait.need) {
        p.mode = 'walk';
        p.act = 'walk';
      }
    } else {
      standAbout(p, dt);
      if (!p.static && (p.timer -= dt) <= 0) {
        if (p.resume) { // back on the way after a short stop
          p.mode = 'walk';
          p.act = 'walk';
        } else startWalk(p, false);
      }
    }
    // Smooth transitions between states.
    const k = 1 - Math.exp(-dt * 3), moving = p.mode === 'walk';
    p.dev += ((p.act === 'device' ? 1 : 0) - p.dev) * k;
    p.talk += ((p.act === 'talk' ? p.talkT : 0) - p.talk) * k;
    p.sit += ((p.mode === 'sit' ? 1 : 0) - p.sit) * k * 2;
    p.yaw += ((moving ? 0 : p.yawT) - p.yaw) * k;
    p.pitch += ((moving ? 0.02 : p.pitchT) - p.pitch) * k;
    if (!moving) p.v = Math.max(0, p.v - 3 * dt);
    const w = Math.min(1.3, p.v / 1.35);
    p.walk += (w - p.walk) * (1 - Math.exp(-dt * 8));
  }
  function walking(p, dt, t) {
    let [tx, tz, wait] = p.pts[p.k];
    if (wait && walkLight(wait.light.x, wait.light.z, wait.light.axis, t) > wait.need) wait = null; // walk now: no need to stop
    const dx = tx - p.ux, dz = tz - p.uz, d = Math.hypot(dx, dz), want = Math.atan2(dx, dz);
    const err = Math.abs(turn(p, want, dt));
    let vmax = p.speed * Math.max(0, 1 - err / 1.5); // slow into a turn; turn on the spot to go back
    if (wait) vmax = Math.min(vmax, Math.sqrt(2.4 * d) + 0.05); // ease into the kerb
    p.v += Math.max(-2.5 * dt, Math.min(1.2 * dt, vmax - p.v));
    const s = Math.min(d, p.v * dt);
    if (d > 1e-6) {
      p.ux += (dx / d) * s;
      p.uz += (dz / d) * s;
      p.dirx = dx / d;
      p.dirz = dz / d;
    }
    p.phase = (p.phase + (s / (1.5 * p.look.height * (p.look.fast ? 1.1 : 1))) * Math.PI * 2) % (Math.PI * 2);
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

  // Walkers make room: oncoming people pass on their right, standing ones are walked round.
  const grid = new Map(), cell = (x, z) => Math.floor(x / 2.5) * 73856093 ^ Math.floor(z / 2.5) * 19349663;
  function avoid(dt) {
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
      let push = 0;
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
        const near = grid.get(cell(p.rx + i * 2.5, p.rz + j * 2.5));
        if (near) for (const q of near) {
          if (q === p) continue;
          const dx = q.rx - p.rx, dz = q.rz - p.rz, ahead = dx * p.dirx + dz * p.dirz, side = -dx * p.dirz + dz * p.dirx;
          if (p.mode === 'wait') { // at the kerb: shuffle sideways off anyone too close
            if (dx * dx + dz * dz < 0.42) push += side > 0 ? -1 : 1;
            continue;
          }
          if (ahead <= 0 || ahead > 2.6 || Math.abs(side) > 0.75) continue;
          const oncoming = q.mode === 'walk' && q.dirx * p.dirx + q.dirz * p.dirz < -0.3;
          push += oncoming ? 1 : side > 0 ? -1 : 1;
          if (!oncoming && q.mode === 'walk' && ahead < 1.2) p.v = Math.min(p.v, q.v + 0.1); // no walking through
        }
      }
      const most = p.mode === 'wait' ? 1.1 : 0.7; // walkers keep clear of the lamps and the walls
      if (push) p.lat = Math.max(-most, Math.min(most, p.lat + Math.sign(push) * 0.9 * dt));
      else if (p.mode === 'walk') p.lat -= Math.sign(p.lat) * Math.min(Math.abs(p.lat), 0.25 * dt);
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
    for (const p of live) {
      const rx = p.ux - p.dirz * p.lat, rz = p.uz + p.dirx * p.lat;
      p.y += (ground(rx, rz) - p.y) * Math.min(1, dt * 12 || 1);
      warp(rx, rz, shift);
      const x = rx + shift[0], z = rz + shift[1], L = p.look;
      p.dist = Math.hypot(x - c.x, p.y + 0.9 - c.y, z - c.z);
      if (p.dist > CROWD.distance || p.fade <= 0) continue;
      let o = p.id * TEXELS * 4; // the shader's numbers (figures.js POSE), five texels a person
      arr[o++] = x; arr[o++] = p.y; arr[o++] = z; arr[o++] = p.heading;
      arr[o++] = p.phase; arr[o++] = p.walk; arr[o++] = L.height; arr[o++] = L.build;
      arr[o++] = p.yaw; arr[o++] = p.dev; arr[o++] = p.talk; arr[o++] = p.sit;
      arr[o++] = L.A; arr[o++] = L.B; arr[o++] = L.C; arr[o++] = p.fade;
      arr[o++] = L.seed; arr[o++] = p.lean; arr[o++] = p.pitch; arr[o] = L.glow;
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
