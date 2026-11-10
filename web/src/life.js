// Ambient life generated in the browser (ADR-0002): traffic on the city's streets. Never simulated or stored.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { palette } from './palette.js';
import { box, cyl, part, rng } from './geometry.js';
import { CAR_COLORS, WIDE, pick } from './world.js';
import { ZEBRA_W, lanesMay } from './streets.js';

const MOVING = [...CAR_COLORS, palette.sodium]; // taxis are commoner on the move than parked
const CAR = 4.4; // car length
const AMBER = 3; // the last seconds of each go phase
const ALL_RED = 2; // every approach red at the end of each phase, so the crossing clears
const fract = (v) => v - Math.floor(v);

// One controller per lit crossing (streets.js roadNet nodes of type 'signal' and 'round'), shared by its cars,
// signal heads and walkers. Phases run in turn, each green, then AMBER, then ALL_RED: each street straight on and
// right with left turns permitted (they give way to oncoming cars); where the boulevard meets another street, a
// protected left phase follows each street's own; at the roundabout no left turns (the ring does that); a walk
// crossing a car street gets a phase of its own for walkers. Each crossing's offset is its own, so neighbours do
// not all change together. Opposing approaches always share a phase; crossing streets never go together.
const set = (...m) => new Set(m);
function control(N) {
  const prot = N.type === 'signal' && [N.kinds.x, N.kinds.z].some((k) => WIDE.has(k));
  N.phases = ['x', 'z'].flatMap((axis) => {
    if (!N.kinds[axis]) return [{ axis, moves: set(), green: 12 }]; // walkers cross the car street
    if (N.type === 'round') return [{ axis, moves: set('straight', 'right'), green: 32 }];
    return prot ? [{ axis, moves: set('straight', 'right'), green: 15 }, { axis, moves: set('left'), green: 7, left: true }]
      : [{ axis, moves: set('straight', 'right', 'left'), green: 15 }];
  });
  N.cycle = N.phases.reduce((sum, p) => sum + p.green + AMBER + ALL_RED, 0);
  N.offset = N.cycle * fract(Math.sin(N.x * 12.9898 + N.z * 78.233) * 43758.5453);
}
// The phase running at N at time t, and how far into it; kept on N for the rest of that frame (cars, heads and
// walkers all ask).
function phaseAt(N, t) {
  if (N.at === t) return N.now;
  let u = (t + N.offset) % N.cycle, now = { phase: N.phases[0], into: 0 };
  for (const phase of N.phases) {
    const span = phase.green + AMBER + ALL_RED;
    if (u < span) {
      now = { phase, into: u };
      break;
    }
    u -= span;
  }
  N.at = t;
  return (N.now = now);
}
// Seconds of green and amber left for `move` from the street along `axis` at N (<= 0: red).
function goLeft(N, axis, move, t) {
  const { phase, into } = phaseAt(N, t);
  return phase.axis === axis && phase.moves.has(move) ? phase.green + AMBER - into : 0;
}
const registry = new Map(); // node key -> node, for walkLight
export const zebraUse = new Map(); // `${node key}|${axis}` -> the lights' time a walker was last on that zebra (people.js)

// A city car, the everyday cousin of IKARO's executive cars (aircars.js): a low painted body, a dark glass cabin set
// back under a painted roof, four dark wheels, a white headlight bar and a red tail bar. Origin at the middle of the
// body, 0.65 m above the road; +z ahead; 1.9 x 4.4 m like the old box, so lanes and gaps are unchanged. One geometry
// per material, each instanced for every car.
function carParts() {
  const at = (geo, x, y, z) => geo.clone().translate(x, y, z);
  const flat = (geos) => mergeGeometries(geos.map((g) => (g.index ? g.toNonIndexed() : g)));
  const wheel = new THREE.CylinderGeometry(0.34, 0.34, 0.24, 12).rotateZ(Math.PI / 2);
  return {
    paint: flat([at(box(1.9, 0.55, 4.4, 1), 0, -0.12, 0), at(box(1.5, 0.08, 1.7, 0), 0, 0.62, -0.35)]),
    glass: at(box(1.6, 0.48, 2.2, 1), 0, 0.36, -0.3),
    tyres: flat([-0.86, 0.86].flatMap((x) => [-1.45, 1.45].map((z) => at(wheel, x, -0.31, z)))),
    head: at(box(1.5, 0.07, 0.06, 0), 0, 0.02, 2.21),
    tail: at(box(1.7, 0.08, 0.06, 0), 0, 0.08, -2.21),
  };
}

// The road graph as paths cars follow: every lane link a polyline (warped with the street, at its road height),
// and at each crossing a connector for every move a car in that lane may make (I.moves): straight on, a right turn
// from the outer lane into the cross street's outer lane, a left turn from the inner lane into its inner lane, both
// smooth curves through the crossing; at the roundabout, round the island on the car's own ring. Lane rules
// (streets.js lanesMay) say which lane may go where. Dead-end lanes are dropped first.
function paths(roads, warp, hub) {
  const { nodes, links } = roads, shift = [0, 0];
  const lineOf = (L, along) => (L.axis === 'x' ? [along, L.at] : [L.at, along]);
  const pt = (x, z, y) => {
    warp(x, z, shift);
    return [x + shift[0], y, z + shift[1]];
  };
  const edge = (pts, extra) => { // a polyline with its running length
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][2] - pts[i - 1][2]));
    return { pts, cum, len: cum.at(-1), cars: [], ...extra };
  };
  const heightAt = (L, along) => (L.lift ? L.lift(along) : L.y);
  for (const L of links) {
    if (L.pts) { // a ramp (interchange.js): its own points
      L.edge = edge(L.pts.map(([x, y, z]) => pt(x, z, y)), { link: L });
      continue;
    }
    const n = Math.max(1, Math.ceil(Math.abs(L.to - L.from) / 8)), pts = [];
    for (let k = 0; k <= n; k++) {
      const along = L.from + ((L.to - L.from) * k) / n;
      pts.push(pt(...lineOf(L, along), heightAt(L, along)));
    }
    L.edge = edge(pts, { link: L });
  }
  // Connectors through each crossing.
  const heading = (L) => (L.axis === 'x' ? [L.dir, 0] : [0, L.dir]);
  const moveOf = (I, O) => {
    const [ix, iz] = heading(I), [ox, oz] = heading(O), cross = ix * oz - iz * ox;
    if (cross === 0) return ix === ox && iz === oz ? 'straight' : null; // never a u-turn
    return cross > 0 ? 'right' : 'left';
  };
  // Straight on into the same lane; where a crossing has its own lane rules (I.may, interchange.js turnsAt) into the
  // lane in the same place across the road, as the number of lanes changes there.
  const fits = (I, O, m) => (m === 'straight' ? (I.may ? Math.abs(O.off - I.off) < 0.1 : O.k === I.k) : m === 'right' ? O.k === O.n - 1 : O.k === 0);
  const curve = (N, I, O, m) => {
    const a = lineOf(I, I.to), b = lineOf(O, O.from), y0 = heightAt(I, I.to), y1 = heightAt(O, O.from), pts = [];
    if (N.type === 'round') {
      // Round the island: in to the car's ring, along it the way it is heading, out on the exit's ring.
      const c = hub.c, ring = (L, along) => [lineOf(L, along)[0] - c, lineOf(L, along)[1] - c];
      const onRing = (L, sign) => { // where L's lane meets its ring, before (-1) or after (+1) the centre
        const side = L.at - c, rho = hub.r + Math.abs(side), u = sign * L.dir * Math.sqrt(Math.max(0, rho * rho - side * side));
        return { p: ring(L, c + u), rho };
      };
      const e = onRing(I, -1), x = onRing(O, 1), a0 = Math.atan2(e.p[1], e.p[0]);
      let a1 = Math.atan2(x.p[1], x.p[0]);
      const [hx, hz] = heading(I), ccw = -Math.sin(a0) * hx + Math.cos(a0) * hz > 0; // increasing angle along its heading
      if (ccw) while (a1 <= a0) a1 += 2 * Math.PI;
      else while (a1 >= a0) a1 -= 2 * Math.PI;
      pts.push(pt(...a, y0));
      const steps = Math.max(4, Math.ceil((Math.abs(a1 - a0) * e.rho) / 3));
      for (let k = 0; k <= steps; k++) {
        const f = k / steps, ang = a0 + (a1 - a0) * f, r = e.rho + (x.rho - e.rho) * f;
        pts.push(pt(c + Math.cos(ang) * r, c + Math.sin(ang) * r, y0));
      }
      pts.push(pt(...b, y1));
      return pts;
    }
    if (m === 'straight') {
      const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 4));
      for (let k = 0; k <= n; k++) pts.push(pt(a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n, y0 + ((y1 - y0) * k) / n));
      return pts;
    }
    const K = I.axis === 'x' ? [O.at, I.at] : [I.at, O.at]; // where the two lanes' lines meet: the curve's control point
    for (let k = 0; k <= 12; k++) {
      const f = k / 12, g = 1 - f;
      pts.push(pt(g * g * a[0] + 2 * g * f * K[0] + f * f * b[0], g * g * a[1] + 2 * g * f * K[1] + f * f * b[1], y0 + (y1 - y0) * f));
    }
    return pts;
  };
  // A street that stops short (at a walk, or at the headquarters' campus) is a dead end: its lanes carry no
  // traffic either way, and neither do lanes that only lead into one.
  for (let dead = [null]; dead.length;) {
    dead = links.filter((L) => L.end && !L.end.outs.some((O) => L.end.type === 'free' || moveOf(L, O)));
    const gone = new Set(dead.flatMap((L) => [L, ...links.filter((O) => O.start === L.end && O.end === L.start && O.axis === L.axis)]));
    for (const L of gone) {
      links.splice(links.indexOf(L), 1);
      L.start?.outs.splice(L.start.outs.indexOf(L), 1);
      L.end?.ins.splice(L.end.ins.indexOf(L), 1);
    }
  }
  for (const N of nodes) for (const I of N.ins) {
    if (N.type === 'free') { // the interchange: on along the road or onto a ramp, joined end to end, no stopping
      I.moves = N.outs.map((O) => ({ move: O.ramp ? 'right' : 'straight', out: O, edge: edge([I.edge.pts.at(-1), O.edge.pts[0]], { node: N, from: I, next: O.edge }) }));
      continue;
    }
    const options = N.outs.map((O) => ({ O, m: moveOf(I, O) })).filter(({ m }) => m && !(N.type === 'round' && m === 'left') && (!I.may || I.may.includes(m)));
    let ok = options.filter(({ O, m }) => (I.may ?? lanesMay(I.kind, I.k, I.n)).includes(m) && fits(I, O, m));
    if (!ok.length) ok = options.filter(({ O, m }) => m === 'straight' && O.k === Math.min(I.k, O.n - 1)); // where the boulevard narrows, its outer lane merges
    if (!ok.length) ok = options.filter(({ O, m }) => m !== 'straight' && fits(I, O, m));
    I.moves = ok.map(({ O, m }) => ({ move: m, out: O, edge: edge(curve(N, I, O, m), { node: N, from: I, next: O.edge }) }));
  }
  // Self-checks: every lane into a crossing has somewhere to go, and no way through one is zero long (a car can never
  // get past the end of one), or cars would queue there for good.
  const zero = links.flatMap((L) => (L.moves ?? []).filter((mv) => mv.edge.len < 0.5).map(() => L));
  console.assert(!zero.length, `traffic: ${zero.length} zero-length ways through crossings: ${zero.map((L) => L.end.key).join(', ')}`);
  const stuck = links.filter((L) => L.end && !L.moves.length);
  console.assert(!stuck.length, `traffic: ${stuck.length} lanes end with nowhere to go: ${stuck.map((L) => `${L.kind} along ${L.axis} at ${L.at.toFixed(1)} into ${L.end.key} (${L.end.type})`).join('; ')}`);
}

// Cars with head- and taillights on the road graph (streets.js roadNet, carried out of town by desert.js
// outOfTown), along its paths (paths above). Each car follows the one ahead on its path, chooses its next move as it
// enters a link, and at the stop
// line waits for its phase (with left turns giving way to oncoming cars), for room beyond the crossing, and for
// walkers on the zebra it turns across. At crossings without lights (local streets) a car stops, then goes when
// the crossing is clear, one at a time. Cars leaving town drive on into the haze and come back in on another road.
// Physics is none: speed eases toward a target set by the gap ahead.
export function traffic(kit, roads, onFrame, warp, hub, parked = []) {
  const { nodes, links } = roads, rand = rng(77);
  registry.clear();
  for (const N of nodes) {
    registry.set(N.key, N);
    N.box = new Set(); // cars on its connectors now
    N.holder = null; // at a crossing without lights: the one car allowed in
    if (!['yield', 'free', 'priority'].includes(N.type)) control(N);
  }
  paths(roads, warp, hub);
  const sources = links.filter((L) => L.out === 'source' || L.through);
  const choose = (L) => {
    if (!L.moves?.length) return null;
    const w = L.moves.map((mv) => mv.out.share ?? (mv.move === 'straight' ? 3 : 1)), total = w.reduce((a, b) => a + b, 0);
    let r = rand() * total;
    return L.moves.find((mv, i) => (r -= w[i]) < 0) ?? L.moves[0];
  };
  // Cars: about one every so many metres of lane, by street kind, thinner out of town.
  const EVERY = { boulevard: 90, avenue: 100, street: 115, ring: 150, lane: 170, local: 170, oneway: 150 };
  const cars = [];
  for (const L of links) {
    const n = Math.floor(L.edge.len / (EVERY[L.kind] * (L.out ? 1.6 : 1)) + rand());
    for (let k = 0; k < n; k++) {
      const d = L.edge.len * (1 - (k + 0.5 + rand() * 0.3) / Math.max(n, 1)); // front first, spread back along it
      const car = { edge: L.edge, link: L, d, v: 0, speed: 9 + rand() * 7, choice: choose(L), cleared: false, stopped: 0, placed: -1 };
      L.edge.cars.push(car);
      cars.push(car);
    }
  }
  console.info(`traffic: ${cars.length} cars on ${links.length} lanes, ${nodes.filter((N) => N.type === 'signal').length} lit crossings, ${nodes.filter((N) => N.type === 'yield').length} without lights`);
  const count = Math.max(1, cars.length), geo = carParts(), make = (g, mat) => new THREE.InstancedMesh(g, mat, count);
  const body = make(geo.paint, new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.2 }));
  const meshes = [body, make(geo.glass, kit.glass(palette.charcoal)), make(geo.tyres, kit.steel(palette.graphite, 0.8)),
    make(geo.head, kit.glow(palette.glare, 4)), make(geo.tail, kit.glow(palette.neonRed, 4))];
  const color = new THREE.Color();
  cars.forEach((c, i) => body.setColorAt(i, color.set(pick(rand, MOVING))));
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), p = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  const here = [0, 0, 0], ahead = [0, 0, 0];
  const sample = (E, d, out, nxt) => { // the point d along polyline E (past its end: on along nxt, or held at the end)
    if (d > E.len && nxt) return sample(nxt, d - E.len, out, nxt.next);
    d = Math.max(0, Math.min(E.len, d));
    let lo = 0, i = E.cum.length - 1; // binary search: lanes out of town have hundreds of points
    while (i - lo > 1) {
      const m = (lo + i) >> 1;
      if (E.cum[m] < d) lo = m;
      else i = m;
    }
    const f = (d - E.cum[i - 1]) / Math.max(1e-6, E.cum[i] - E.cum[i - 1]), a = E.pts[i - 1], b = E.pts[i];
    out[0] = a[0] + (b[0] - a[0]) * f;
    out[1] = a[1] + (b[1] - a[1]) * f;
    out[2] = a[2] + (b[2] - a[2]) * f;
    return out;
  };
  const place = () => {
    cars.forEach((c, i) => {
      const key = c.d + c.edge.len * 1e3;
      if (c.placed === key) return; // waiting: its matrices still hold
      c.placed = key;
      // Rear and front axles both on the path, so the car turns with the street and through the curves; a link runs
      // on into the car's chosen connector.
      const nxt = c.edge.link ? c.choice?.edge : c.edge.next;
      sample(c.edge, c.d - 1.4, here, nxt);
      sample(c.edge, c.d + 1.4, ahead, nxt);
      p.set((here[0] + ahead[0]) / 2, (here[1] + ahead[1]) / 2, (here[2] + ahead[2]) / 2);
      q.setFromAxisAngle(up, Math.atan2(ahead[0] - here[0], ahead[2] - here[2]));
      m.compose(p, q, one);
      for (const mesh of meshes) mesh.setMatrixAt(i, m);
    });
    for (const mesh of meshes) mesh.instanceMatrix.needsUpdate = true;
  };
  // Whether car c, at the stop line of link L, may go into the crossing now on its chosen move.
  const mayGo = (c, L, dist, t) => {
    const mv = c.choice, N = L.end;
    if (!mv) return false;
    const last = mv.out.edge.cars.at(-1), inBox = mv.edge.cars.at(-1);
    if ((last && last.d < CAR + 4) || (inBox && inBox.d < CAR + 3)) return false; // no room beyond: never block the crossing
    if (N.type === 'free') return true; // a split or merge on the highway
    if (mv.move !== 'straight' && t - (zebraUse.get(`${N.key}|${mv.out.axis}`) ?? -1e9) < 0.6) return false; // walkers on the zebra it turns across
    if (N.type === 'priority') { // under the median ramps: the avenue goes on; the side street waits for a gap in it
      if (WIDE.has(L.kind)) return true;
      // Only the lanes it turns into matter, and only cars still coming: a queue standing there lets it in.
      return [...N.box].every((b) => b.edge.next.link.dir !== mv.out.dir) && N.ins.every((O) => O.dir !== mv.out.dir || O.axis === L.axis || O.edge.cars.every((f) => f.v < 1 || O.edge.len - f.d > 30));
    }
    if (N.type === 'yield') {
      if (c.stopped < 0.8 || N.holder || N.box.size) return false; // stop, look, one at a time
      N.holder = c;
      return true;
    }
    const left = goLeft(N, L.axis, mv.move, t), need = (mv.edge.len + Math.max(0, dist) + 2) / 7; // timed at a slow car's pace
    if (mv.move !== 'left' || phaseAt(N, t).phase.left) return left > need; // enough phase left to clear it
    // A permitted left gives way to oncoming cars, and clears at the end of the phase once they stop coming (with
    // AMBER left they no longer commit), finishing in the all-red, as drivers do.
    if (left <= 0 || left + ALL_RED < need) return false;
    for (const O of N.ins) {
      if (O.axis !== L.axis || O.dir === L.dir) continue;
      const f = O.edge.cars[0];
      if (f && (f.cleared || (left > AMBER && O.edge.len - f.d < 30))) return false;
    }
    for (const b of N.box) if (b.edge.from.axis === L.axis && b.edge.from.dir !== L.dir) return false;
    return true;
  };
  let t = 0;
  const moved = [], edges = [...links.map((L) => L.edge), ...links.flatMap((L) => (L.moves ?? []).map((mv) => mv.edge))];
  const tick = (dt) => {
    dt = Math.min(dt, 0.1); // a stalled tab must not jump cars through each other
    t += dt;
    for (const E of edges) {
      if (!E.cars.length) continue; // most connectors are empty most of the time
      E.cars.forEach((c, i) => {
        let room;
        const lead = E.cars[i - 1];
        if (lead) room = lead.d - c.d - CAR - 2;
        else {
          const nextE = E.link ? c.choice?.edge : E.next, lastNext = nextE?.cars.at(-1);
          room = E.len - c.d + (nextE ? (lastNext ? lastNext.d - CAR - 2 : nextE.len) : Infinity);
          const L = E.link;
          if (L?.end && !c.cleared) {
            const dist = E.len - c.d - CAR / 2 - 0.3; // to where its nose meets the stop line
            if (dist < 4 && mayGo(c, L, dist, t)) c.cleared = true;
            else room = Math.min(room, Math.max(0, dist));
          }
        }
        c.v = Math.min(c.speed, Math.max(0, room) * 1.2, c.v + 5 * dt); // ease into the gap; pick up speed gently
        c.stopped = c.v < 0.3 ? c.stopped + dt : 0;
        c.d += c.v * dt;
        if (c.d > E.len) moved.push(c);
      });
    }
    for (const c of moved) {
      const E = c.edge, over = c.d - E.len;
      let next;
      if (E.link) {
        if (E.link.out === 'sink') { // gone into the haze: back in on another road
          const S = pick(rand, sources), last = S?.edge.cars.at(-1);
          if (!S || (last && last.d < CAR + 6)) {
            c.d = E.len;
            continue;
          }
          next = S.edge;
        } else next = c.choice.edge;
      } else next = E.next;
      E.cars.splice(E.cars.indexOf(c), 1);
      if (!E.link) { // out of the crossing
        E.node.box.delete(c);
        if (E.node.holder === c) E.node.holder = null;
      }
      next.cars.push(c);
      c.edge = next;
      c.d = E.link?.out === 'sink' ? 0 : over;
      if (next.link) {
        c.link = next.link;
        c.choice = choose(next.link);
        c.cleared = false;
      } else next.node.box.add(c);
    }
    moved.length = 0;
    place();
  };
  place();
  onFrame(tick);
  for (const mesh of meshes) mesh.frustumCulled = false; // cars move far from where the meshes were created
  const g = new THREE.Group();
  g.add(...meshes, signals(kit, roads, warp, onFrame, () => t), parkedCars(kit, geo, parked));
  g.userData.clock = () => t; // the lights' time, for the pedestrian signals (walkLight)
  return g;
}

// Parked cars: in the ring road's bays (streets.js block) and on the plazas (tiles.js plaza). The moving cars'
// model, unlit, one instanced mesh per material in each CHUNK-metre cell, each with its own bounds, so cells out of
// view are culled (one city-wide mesh was never culled). parked: [x, z, heading, y, colour] in the world (city.js);
// y defaults to the road's, colour to one of CAR_COLORS.
const CHUNK = 300;
function parkedCars(kit, geo, parked) {
  const rand = rng(91), g = new THREE.Group(), m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  const mats = [new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.2 }), kit.glass(palette.charcoal), kit.steel(palette.graphite, 0.8)];
  const color = new THREE.Color(), p = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  const paints = parked.map((car) => { // drawn either way, so the bays keep their colours
    const c = pick(rand, CAR_COLORS);
    return car[4] ?? c;
  });
  const cells = Map.groupBy(parked.map((car, i) => i), (i) => `${Math.floor(parked[i][0] / CHUNK)},${Math.floor(parked[i][1] / CHUNK)}`);
  for (const ids of cells.values()) {
    const parts = [geo.paint, geo.glass, geo.tyres].map((geom, k) => new THREE.InstancedMesh(geom, mats[k], ids.length));
    ids.forEach((i, j) => {
      const [x, z, heading, y = 0.65] = parked[i];
      m.compose(p.set(x, y, z), q.setFromAxisAngle(up, heading), one);
      for (const part of parts) part.setMatrixAt(j, m);
      parts[0].setColorAt(j, color.set(paints[i]));
    });
    for (const part of parts) part.computeBoundingSphere();
    g.add(...parts);
  }
  return g;
}

// The traffic lights of the lit crossings, drawn, sized by the street. Every approach gets a pole on its right-hand
// kerb just behind its zebra, with a head at 3 m facing the cars coming; main streets add a mast arm with one head
// over their lanes; the boulevard two on the arm (the one over the left-turn lane shows the protected left phase)
// and one on the median's nose for the left-turn lane. Every zebra at a lit crossing has a walk signal at each end,
// facing across the street at the people waiting on the other side. Heads are red on top, amber, green below, so
// position carries the meaning as well as colour; walk signals a red hand over a cold white walker. Nothing blinks.
// Crossings of local streets have no lights. Instanced: a lamp moves only when its state changes.
const HEAD = { y: 3.2, arm: 5.9 };
function signals(kit, roads, warp, onFrame, clock) {
  const heads = [], walks = [], posts = [], arms = [], shift = [0, 0];
  const at = (axis, off, along, y) => { // world position: `off` across (absolute), `along` the street
    const [x, z] = axis === 'x' ? [along, off] : [off, along];
    warp(x, z, shift);
    return [x + shift[0], y, z + shift[1]];
  };
  for (const N of roads.nodes) {
    if (['yield', 'free', 'priority'].includes(N.type)) continue;
    const groups = new Map();
    for (const I of N.ins) {
      const key = `${I.axis}${I.dir}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(I);
    }
    for (const ls of groups.values()) {
      const L = ls[0], { axis, c, dir, kind } = L, right = Math.sign(L.at - c), kerb = L.w / 2 - L.side, centre = axis === 'x' ? N.x : N.z;
      const wide = WIDE.has(kind), big = wide || kind === 'street', offs = ls.map((l) => l.off), inner = Math.min(...offs), outer = Math.max(...offs);
      const along = centre - dir * (L.zebra ? L.zebra + ZEBRA_W / 2 + 0.5 : L.reach); // just behind the zebra (the roundabout: by the stop line)
      const ground = (L.lift ? L.lift(along) : L.y) - 0.65;
      if (ground > 0.5) continue; // out on a highway ramp: no kerb to stand on
      const face = axis === 'z' ? (dir > 0 ? Math.PI : 0) : (-dir * Math.PI) / 2; // toward the cars coming
      const top = big ? HEAD.arm + 0.7 : HEAD.y + 0.8, protectedLeft = N.phases.some((p) => p.left);
      posts.push([...at(axis, c + right * (kerb + 0.6), along, ground + top / 2), top]);
      heads.push({ p: at(axis, c + right * (kerb + 0.35), along, ground + HEAD.y), face, N, axis, move: 'straight' });
      if (big) {
        const span = kerb + 0.6 - (inner - 1.6); // from the pole out over the innermost lane
        arms.push({ p: at(axis, c + right * (kerb + 0.6 - span / 2), along, ground + top - 0.1), axis, span });
        const over = wide ? [[inner, protectedLeft ? 'left' : 'straight'], [(inner + outer) / 2 + 1.6, 'straight']] : [[(inner + outer) / 2, 'straight']];
        for (const [o, move] of over) heads.push({ p: at(axis, c + right * o, along, ground + HEAD.arm), face, N, axis, move });
      }
      if (wide && L.zebra) { // on the median's nose, for the left-turn lane
        const nose = c + right * (inner - 1.625 - 0.85); // half a lane in from the inner lane's centre: the median's edge
        posts.push([...at(axis, nose, along, ground + 0.12 + (HEAD.y + 0.8) / 2), HEAD.y + 0.8]);
        heads.push({ p: at(axis, nose - right * 0.25, along, ground + HEAD.y + 0.12), face, N, axis, move: protectedLeft ? 'left' : 'straight' });
      }
      if (L.zebra && N.type === 'signal') { // walk signals at both ends of this approach's zebra, on the crossing's side of it
        const mid = centre - dir * (L.zebra - ZEBRA_W / 2 - 0.3);
        for (const end of [1, -1]) {
          const o = c + end * right * (kerb + 0.5), look = end * right; // looks toward -look across the street
          const toward = axis === 'z' ? (look > 0 ? -Math.PI / 2 : Math.PI / 2) : look > 0 ? Math.PI : 0;
          posts.push([...at(axis, o, mid, ground + 1.6), 3.2]);
          walks.push({ p: at(axis, o, mid, ground + 2.6), face: toward, N, cross: axis });
        }
      }
    }
  }
  const steel = kit.steel(palette.charcoal, 0.6), dark = kit.steel(palette.deepNavy, 0.3), n = heads.length, w = walks.length;
  const mesh = (geo, mat, count) => {
    const m = new THREE.InstancedMesh(geo, mat, Math.max(1, count));
    m.count = count;
    m.frustumCulled = false;
    return m;
  };
  const housing = mesh(box(0.4, 1.15, 0.34, 1), steel, n);
  const lenses = mesh(mergeGeometries([0.35, 0, -0.35].map((y) => box(0.26, 0.26, 0.04, 0).translate(0, y, 0.18))), dark, n);
  const lamps = [[palette.crimson, 6], [palette.amber, 3], [palette.signalGreen, 3]].map(([c, k]) => mesh(box(0.27, 0.27, 0.2, 0), kit.glow(c, k), n)); // deep enough that its top shows from above
  const walkBox = mesh(box(0.34, 0.66, 0.24, 1), steel, w);
  const walkLens = mesh(mergeGeometries([0.15, -0.15].map((y) => box(0.24, 0.24, 0.04, 0).translate(0, y, 0.13))), dark, w);
  const walkLamps = [[palette.crimson, 5], [palette.coldWhite, 2]].map(([c, k]) => mesh(box(0.25, 0.25, 0.08, 0), kit.glow(c, k), w));
  const post = mesh(cyl(0.09, 0.12, 1, 8), steel, posts.length), arm = mesh(box(1, 0.16, 0.16, 0), steel, arms.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const one = new THREE.Vector3(1, 1, 1), hidden = new THREE.Matrix4().makeScale(0, 0, 0), local = new THREE.Vector3();
  const put = (target, i, [x, y, z], face, dy = 0, dz = 0) => { // at [x, y, z] facing `face`, moved dy up and dz forward
    q.setFromAxisAngle(up, face);
    local.set(0, dy, dz).applyQuaternion(q);
    target.setMatrixAt(i, m.compose(p.set(x + local.x, y + local.y, z + local.z), q, one));
  };
  posts.forEach(([x, y, z, h], i) => post.setMatrixAt(i, m.compose(p.set(x, y, z), q.identity(), sc.set(1, h, 1))));
  arms.forEach((a, i) => {
    q.setFromAxisAngle(up, a.axis === 'x' ? Math.PI / 2 : 0); // the arm runs across the street
    arm.setMatrixAt(i, m.compose(p.set(...a.p), q, sc.set(a.span, 1, 1)));
  });
  for (const [list, body, lens, lit] of [[heads, housing, lenses, lamps], [walks, walkBox, walkLens, walkLamps]]) {
    list.forEach((h, i) => {
      put(body, i, h.p, h.face);
      put(lens, i, h.p, h.face);
      for (const l of lit) l.setMatrixAt(i, hidden);
      h.state = -1;
    });
  }
  const update = () => {
    const t = clock();
    let changed = false;
    const show = (h, i, s, lit, dy, dz) => {
      if (s === h.state) return;
      if (h.state >= 0) lit[h.state].setMatrixAt(i, hidden);
      put(lit[s], i, h.p, h.face, dy[s], dz);
      h.state = s;
      changed = true;
    };
    heads.forEach((h, i) => {
      const g = goLeft(h.N, h.axis, h.move, t);
      show(h, i, g <= 0 ? 0 : g < AMBER ? 1 : 2, lamps, [0.35, 0, -0.35], 0.24);
    });
    walks.forEach((h, i) => show(h, i, walkAt(h.N, h.cross, t) > 0 ? 1 : 0, walkLamps, [0.15, -0.15], 0.15));
    if (changed) for (const l of [...lamps, ...walkLamps]) l.instanceMatrix.needsUpdate = true;
  };
  update();
  onFrame(update);
  const g = new THREE.Group();
  g.add(post, arm, housing, lenses, ...lamps, walkBox, walkLens, ...walkLamps);
  return g;
}

// The pedestrian signal where streets meet at (x, z) (unwarped), for people crossing the street that runs along
// `axis`: seconds of walk left, or 0. At a lit crossing they walk while the other street's straight-on phase (or
// its walkers' phase) runs, and stop a second before it ends; at a crossing without lights they may always go
// (turning cars give way to them, traffic).
export function walkLight(x, z, axis, t) {
  return walkAt(registry.get(`${Math.round(x)}|${Math.round(z)}`), axis, t);
}
function walkAt(N, axis, t) {
  if (!N || N.type === 'yield' || N.type === 'priority') return 99;
  if (N.type === 'round') return 0;
  const { phase, into } = phaseAt(N, t);
  return phase.axis !== axis && !phase.left ? phase.green + AMBER - into - 1 : 0;
}

// Two trains on the railway viaduct (terrain.js railway), one per track, each shuttling between the terminus and
// the far end of the line out in the haze, slowing into the station and waiting there a moment.
// rail: { at(t, out) -> [x, y, z] on the deck centre line, side: [x, z] across it, angle, end, out, stop: metres from
// the end to the buffers }.
export function trains(kit, rail, onFrame) {
  const g = new THREE.Group(), trainsets = [], CAR = 20, CARS = 4, body = kit.windows(2, true); // four cars fit the shed
  const shell = kit.steel(palette.cream, 0.4), stripe = kit.glow(palette.neonCyan, 2);
  const dir = Math.sign(rail.out - rail.end), room = Math.abs(rail.out - rail.end) - CARS * CAR - rail.stop;
  for (const [off, phase] of [[1.85, 0], [-1.85, 0.5]]) {
    const cars = Array.from({ length: CARS }, () => {
      const car = new THREE.Group();
      part(car, box(CAR - 1, 2.6, 2.9, 1), shell, 0, 1.9, 0);
      part(car, box(CAR - 3, 1, 2.95, 0), body, 0, 2.1, 0);
      part(car, box(CAR - 1, 0.12, 2.98, 0), stripe, 0, 1, 0);
      g.add(car);
      return car;
    });
    trainsets.push({ cars, off, u: phase });
  }
  const point = [0, 0, 0];
  const place = () => {
    for (const { cars, off, u } of trainsets) {
      // Back and forth; the smoothstep slows it at both ends, and clamping holds it at the station a while.
      const there = Math.min(1, Math.max(0, (1 - Math.abs(2 * u - 1)) * 1.15 - 0.15));
      const head = rail.stop + room * there * there * (3 - 2 * there);
      cars.forEach((car, k) => {
        const [x, y, z] = rail.at(rail.end + dir * (head + k * CAR + CAR / 2), point);
        car.position.set(x + rail.side[0] * off, y + 0.6, z + rail.side[1] * off);
        car.rotation.y = -rail.angle;
      });
    }
  };
  const period = (2 * room) / 18; // seconds there and back
  onFrame((dt) => {
    for (const t of trainsets) t.u = (t.u + dt / period) % 1;
    place();
  });
  place();
  return g;
}

// Steam from the food stalls' pots (streets.js food): soft puffs that rise, drift, swell and fade, about one every
// half second a pot, out of step with each other. One point cloud for every stall; with reduced motion it holds still.
export function steam(food, warp, onFrame) {
  const vents = food.filter((f) => f.steam).map((f) => f.steam), PER = 10, shift = [0, 0];
  const pos = new Float32Array(vents.length * PER * 3), seed = new Float32Array(vents.length * PER);
  vents.forEach(([x, y, z], i) => {
    warp(x, z, shift);
    for (let k = 0; k < PER; k++) {
      pos.set([x + shift[0], y, z + shift[1]], (i * PER + k) * 3);
      seed[i * PER + k] = k / PER + fract(i * 0.618);
    }
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const time = { value: 0 };
  const mat = new THREE.ShaderMaterial({
    uniforms: { time, tint: { value: new THREE.Color(palette.coldWhite) } }, transparent: true, depthWrite: false,
    vertexShader: `uniform float time; attribute float aSeed; varying float vAlpha;
      void main() {
        float life = fract(time * 0.2 + aSeed);
        vec3 p = position + vec3(sin(aSeed * 40.0 + time * 0.7) * 0.18 * life, life * 1.7, cos(aSeed * 23.0 + time * 0.6) * 0.18 * life);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = (0.3 + life * 0.9) * 900.0 / -mv.z;
        vAlpha = smoothstep(0.0, 0.15, life) * (1.0 - life) * smoothstep(120.0, 40.0, -mv.z);
      }`,
    fragmentShader: `uniform vec3 tint; varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        gl_FragColor = vec4(tint, smoothstep(0.5, 0.1, d) * vAlpha * 0.2);
      }`,
  });
  const cloud = new THREE.Points(geo, mat);
  cloud.frustumCulled = false; // the puffs rise out of the cloud's bounds
  onFrame((dt) => { time.value += dt; });
  return cloud;
}
