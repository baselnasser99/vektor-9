// IKARO's hovercars (headquarters.js): a small private fleet of executive cars flying to the headquarters' docks
// along fixed corridors. Ambient, browser-only (ADR-0002). Each car runs a small state machine: away (out of sight;
// it claims a free dock before it sets off, so no two cars ever share a corridor or a pad), approach (along its
// corridor to a holding point clear of the towers), dock (slowing, lining up with the markings and settling), park
// (a long stay, its hover and headlights dimmed, nav lights on) and depart (lifting off, backing or turning out and
// climbing away). No physics: every move is an eased glide between fixed waypoints.
//
// Docks, in the site's frame: the two landing terraces (cars come down through the open air over the front street,
// glide in nose first, turn side-on over the pad and settle), a bay in the admin tower's outer face (entered nose
// first, left backing out) and a pad on the security tower's long apron (H3: come in slowly nose to the tower, let
// down vertically into the box; lift, back out, turn away). One more bay and pad each keep a car parked for good;
// two of the fleet start parked. Every dock has a status light by its door (one cool segment: free; three crimson:
// taken; a slow crimson pulse while a car is coming or going) and a line of guidance lights that runs slowly toward
// the tower while a car lands. Departures over the street turn away from the city's observation tower. With reduced
// motion the parked cars are there, the rest are away and the lights hold still.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { palette } from './palette.js';
import { box } from './geometry.js';
import { ENTRANCE, HQ, siteFrame } from './headquarters.js';

const CRUISE = 26, SLOW = 5, FINE = 1.6; // m/s: in the corridors, coming in, in the last metres

// One IKARO executive hovercar: a low, wide armoured wedge (2.4 x 5 m, about 1.2 m high) with a sloped nose, side
// skirts, a dark canopy set back and a tail wing; a cool headlight bar, a crimson tail bar and side strips; a hover
// pad at each corner and a long glow strip underneath; a small IKARO mark on each flank. One merged geometry per
// material, built once and shared by the fleet; the hover glow and headlights are each car's own, to dim once it is
// parked. Its origin is under its middle, at the bottom; +z ahead.
function carModel(kit, parts) {
  const by = new Map(); // material -> its parts, merged into one geometry each
  const add = (geo, mat, x, y, z, rx = 0, ry = 0) => {
    const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, 0)).setPosition(x, y, z);
    if (!by.has(mat)) by.set(mat, []);
    by.get(mat).push(geo.clone().applyMatrix4(m));
  };
  add(parts.hull, parts.armor, 0, 0.55, 0);
  add(parts.nose, parts.armor, 0, 0.5, 2.6, 0.32);
  add(parts.cabin, parts.canopy, 0, 0.98, -0.15);
  add(parts.wing, parts.armor, 0, 0.98, -2.25);
  add(parts.head, parts.headlight, 0, 0.62, 2.52);
  add(parts.tail, parts.nav, 0, 0.66, -2.52);
  for (const s of [-1, 1]) {
    add(parts.skirt, parts.trim, s * 1.2, 0.36, 0);
    add(parts.strip, parts.nav, s * 1.21, 0.66, 0.1);
    add(parts.mark, parts.ikaro, s * 1.215, 0.52, -1.05, 0, s * Math.PI / 2); // reads the right way round on both sides
  }
  for (const [x, z] of [[-0.8, 1.7], [0.8, 1.7], [-0.8, -1.7], [0.8, -1.7]]) add(parts.pad, parts.hover, x, 0.24, z);
  add(parts.belly, parts.hover, 0, 0.29, 0);
  const merged = [...by].map(([mat, geos]) => [mergeGeometries(geos.map((x) => x.index ? x.toNonIndexed() : x)), mat]);
  return () => { // one car: the shared geometry, with a hover glow and headlights of its own
    const g = new THREE.Group(), hover = parts.hover.clone(), head = parts.headlight.clone();
    for (const [geo, mat] of merged) g.add(new THREE.Mesh(geo, mat === parts.hover ? hover : mat === parts.headlight ? head : mat));
    Object.assign(g.userData, { hover, head });
    return g;
  };
}

export function hqFleet(kit, site, onFrame, still) {
  const parts = {
    hull: box(2.4, 0.45, 5.0, 1), nose: box(2.2, 0.3, 1.0, 1), cabin: box(1.5, 0.42, 2.2, 1), wing: box(2.5, 0.1, 0.6, 0),
    skirt: box(0.15, 0.25, 4.2, 0), head: box(1.8, 0.06, 0.05, 0), tail: box(2.2, 0.06, 0.05, 0), strip: box(0.04, 0.04, 3.6, 0),
    mark: new THREE.PlaneGeometry(0.9, 0.16), pad: new THREE.CylinderGeometry(0.3, 0.3, 0.05, 12), belly: box(1.4, 0.03, 3.2, 0),
    armor: kit.steel(palette.deepNavy, 0.3), trim: kit.steel(palette.graphite, 0.45), canopy: kit.glass(palette.charcoal),
    headlight: kit.glow(palette.coldWhite, 2.2), nav: kit.glow(palette.coreCrimson, 2.5), hover: kit.glow(palette.coldCyan, 1.2),
    ikaro: kit.sign('IKARO', palette.coldWhite),
  };
  const group = new THREE.Group(), car = carModel(kit, parts);
  // Site frame -> world, and a heading in the site frame (radians, 0: toward +w) -> world.
  const frame = siteFrame(site), [ux, uz] = frame.at(1, 0);
  const P = (u, y, w) => { const [x, z] = frame.at(u, w); return new THREE.Vector3(x, y + 0.18, z); };
  const H = (a) => site.heading + a;
  const away = (ux - site.x) * -site.x + (uz - site.z) * -site.z > 0 ? -1 : 1; // +u points to the hub? go the other way
  const T = HQ.terrace, B = HQ.hangar, street = site.street ?? HQ.half[1] + 12;
  // Docks: where a car sits parked (and its heading), and the corridors in and out, as waypoints [point, speed,
  // heading or null to face along its motion]. hold: where it waits its turn.
  const docks = [];
  for (const s of [-1, 1]) {
    const u = s * HQ.TOWER[0], deck = T.y + 0.06, side = Math.PI / 2 * away; // parked side-on, nose away from the hub
    docks.push({ park: [P(u, deck, T.w), H(side)], hold: P(u + away * 40, 165, street),
      in: [[P(u + away * 230, 175, street), CRUISE], [P(u + away * 40, 165, street), CRUISE], [P(u, 70, street), SLOW],
        [P(u, deck + 3, street), SLOW], [P(u, deck + 3, T.w), SLOW, H(Math.PI)], [P(u, deck + 3, T.w), FINE, H(side)], [P(u, deck, T.w), FINE, H(side)]],
      out: [[P(u, deck + 3, T.w), FINE, H(side)], [P(u, deck + 3, T.w), FINE, H(0)], [P(u, deck + 3, street), SLOW],
        [P(u, 80, street), SLOW], [P(u + away * 60, 170, street), CRUISE], [P(u + away * 260, 180, street), CRUISE]] });
  }
  // A hangar bay in the outer face of tower s, at w: entered nose first, left backing out. front: parked near the
  // mouth, in view, rather than deep inside.
  const bay = (s, w, front = false) => {
    const floor = B.y + 0.06, inside = s * (front ? B.face - 3 : B.face - B.depth / 2 - 0.5), mouth = s * (B.face + 12), face = H(s > 0 ? -Math.PI / 2 : Math.PI / 2);
    return { park: [P(inside, floor, w), face], hold: P(s * (B.face + 55), floor + 14, w + 8),
      in: [[P(s * (B.face + 240), floor + 30, w + 20), CRUISE], [P(s * (B.face + 55), floor + 14, w + 8), CRUISE],
        [P(mouth, floor + 1.6, w), SLOW, face], [P(inside, floor + 1.6, w), FINE, face], [P(inside, floor, w), FINE, face]],
      out: [[P(inside, floor + 1.6, w), FINE, face], [P(mouth, floor + 1.6, w), FINE, face], [P(s * (B.face + 60), floor + 20, w - 6), SLOW],
        [P(s * (B.face + 260), floor + 36, w - 30), CRUISE]] };
  };
  // A landing pad on one of the security tower's long aprons (H3, H4), at w: the car comes in slowly over the apron,
  // nose to the tower, lined up with its box, and lets down vertically; it leaves by lifting, backing out clear of
  // the face and turning away, climbing.
  const pad = (s, w) => {
    const floor = B.y + 0.06, spot = s * (B.face + 3.3), face = H(s > 0 ? -Math.PI / 2 : Math.PI / 2);
    return { park: [P(spot, floor, w), face], hold: P(s * (B.face + 55), floor + 14, w + 8),
      in: [[P(s * (B.face + 240), floor + 30, w + 20), CRUISE], [P(s * (B.face + 55), floor + 14, w + 8), CRUISE],
        [P(spot, floor + 9, w), SLOW, face], [P(spot, floor + 2, w), FINE, face], [P(spot, floor, w), FINE, face]],
      out: [[P(spot, floor + 2.5, w), FINE, face], [P(s * (B.face + 18), floor + 6, w), FINE, face], [P(s * (B.face + 60), floor + 20, w - 6), SLOW],
        [P(s * (B.face + 260), floor + 36, w - 30), CRUISE]] };
  };
  docks.push(bay(-1, B.w[0]), pad(1, B.w[0]));
  const parked = [bay(-1, B.w[1], true), pad(1, B.w[1])]; // two cars kept for good: one at a bay's mouth, one on its pad

  // The fleet: four cars sharing the four docks (so now and then one queues), and the two parked ones.
  const fleet = [];
  for (let k = 0; k < 6; k++) {
    const g = car();
    group.add(g);
    if (k >= 4) {
      const [p, h] = parked[k - 4].park;
      g.position.copy(p);
      g.rotation.y = h;
      g.userData.hover.emissiveIntensity *= 0.25;
      g.userData.head.emissiveIntensity *= 0.1; // parked: headlights down, nav lights on
      continue;
    }
    fleet.push({ g, state: 'away', timer: 5 + k * 9, dock: null, path: null, seg: 0, t: 0, heading: 0, home: k, base: g.userData.hover.emissiveIntensity, beam: g.userData.head.emissiveIntensity });
    g.visible = false;
  }
  // One more waits for good in the forecourt's drop-off lane, low over the paving, side-on to the entrance.
  const waiting = car();
  waiting.position.copy(P(5, ENTRANCE.FLOOR, 23.6));
  waiting.rotation.y = H(-Math.PI / 2);
  waiting.userData.hover.emissiveIntensity *= 0.4;
  waiting.userData.head.emissiveIntensity *= 0.3;
  group.add(waiting);
  const taken = new Set();
  // Two start already down (the left terrace and the right tower's open hangar), so the docks never look unused.
  for (const [c, dock, wait] of [[fleet[2], docks[0], 20], [fleet[3], docks[3], 45]]) {
    const [p, h] = dock.park;
    Object.assign(c, { state: 'park', dock, timer: wait, heading: h });
    c.g.position.copy(p);
    c.g.rotation.y = h;
    c.g.visible = true;
    taken.add(dock);
  }

  // Each dock's lights, one instanced mesh of small lit blocks: three status segments stacked by its door, then its
  // guidance lights, outermost first. Colours change per frame; nothing here is a real light.
  const cube = box(0.2, 0.2, 0.2, 0), lampMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const tint = { cool: new THREE.Color(palette.coldWhite), red: new THREE.Color(palette.coreCrimson),
    guide: new THREE.Color(palette.coldCyan), off: new THREE.Color(palette.graphite) };
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), flat = new THREE.Vector3(0.8, 0.25, 0.8), tall = new THREE.Vector3(1.1, 1.6, 0.4);
  function lamps(dock, status, guide) {
    const mesh = new THREE.InstancedMesh(cube, lampMat, status.length + guide.length);
    q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, site.heading);
    [...status, ...guide].forEach((p, i) => {
      mesh.setMatrixAt(i, m4.compose(p, q, i < status.length ? tall : flat));
      mesh.setColorAt(i, tint.off);
    });
    dock.lamps = { mesh, n: status.length };
    group.add(mesh);
  }
  for (const s of [-1, 1]) { // the terraces: status by the door's right-hand side, guidance either side of the pad
    const dock = docks[s < 0 ? 0 : 1], tc = s * HQ.TOWER[0], deck = T.y + 0.06, front = HQ.front + 0.5;
    lamps(dock, [1.7, 2.15, 2.6].map((y) => P(tc + 3.9, deck + y, front)),
      [-4.6, 4.6].flatMap((du) => [0, 1, 2, 3, 4, 5].map((i) => P(tc + du, deck + 0.06, T.w + 4.8 - i * 1.5))));
  }
  for (const [dock, s, w, reach] of [[docks[2], -1, B.w[0], 4], [docks[3], 1, B.w[0], 7.5], [parked[0], -1, B.w[1], 4], [parked[1], 1, B.w[1], 7.5]]) {
    const floor = B.y + 0.06; // hangars and pads: status on the face beside the mouth, guidance down the apron
    lamps(dock, [1.7, 2.15, 2.6].map((y) => P(s * (B.face + 0.45), floor + y, w + 6.9)),
      [-1.8, 1.8].flatMap((dw) => [0, 1, 2, 3, 4, 5].map((i) => P(s * (B.face + reach - 0.6 - i * 1.1), floor + 0.06, w + dw))));
  }
  const glowAt = new THREE.Color();
  function light(dock, t) {
    const { mesh, n } = dock.lamps, c = fleet.find((x) => x.dock === dock && x.state !== 'away');
    const moving = c && c.state !== 'park', landing = c?.state === 'dock', busy = taken.has(dock) || parked.includes(dock);
    for (let i = 0; i < n; i++) { // status: free, taken, or a slow pulse while a car comes or goes (never a flash)
      if (moving) glowAt.copy(tint.red).multiplyScalar(1 + 0.6 * Math.sin(t * 2));
      else if (busy) glowAt.copy(tint.red).multiplyScalar(1.5);
      else glowAt.copy(i === 0 ? tint.cool : tint.off).multiplyScalar(i === 0 ? 1.5 : 1);
      mesh.setColorAt(i, glowAt);
    }
    const g = (mesh.count - n) / 2; // guidance: dim, or a soft wave running in toward the tower while a car lands
    for (let i = n; i < mesh.count; i++) {
      const k = (i - n) % g, wave = landing ? Math.max(0, Math.cos(t * 2.2 - k * 0.9)) ** 4 : 0;
      mesh.setColorAt(i, glowAt.copy(tint.guide).multiplyScalar(0.3 + 1.7 * wave));
    }
    mesh.instanceColor.needsUpdate = true;
  }
  const lit = [...docks, ...parked];
  lit.forEach((d) => light(d, 0));

  // Gliding along a path: each leg eases out of its start and into its end; its heading is the leg's own, or the way
  // it moves.
  const from = new THREE.Vector3(), to = new THREE.Vector3(), at = new THREE.Vector3();
  function glide(c, dt) {
    const leg = c.path[c.seg], start = c.seg ? c.path[c.seg - 1][0] : c.start;
    const len = Math.max(0.01, start.distanceTo(leg[0])), time = len / leg[1] + 0.6;
    c.t = Math.min(1, c.t + dt / time);
    const e = c.t * c.t * (3 - 2 * c.t);
    from.copy(start);
    to.copy(leg[0]);
    at.lerpVectors(from, to, e);
    c.g.position.copy(at);
    const want = leg[2] ?? (Math.hypot(to.x - from.x, to.z - from.z) > 0.5 ? Math.atan2(to.x - from.x, to.z - from.z) : c.heading);
    c.heading += Math.atan2(Math.sin(want - c.heading), Math.cos(want - c.heading)) * Math.min(1, dt * 1.5);
    c.g.rotation.set(0, c.heading, 0);
    if (c.t >= 1) {
      c.seg++;
      c.t = 0;
    }
    return c.seg >= c.path.length;
  }
  function follow(c, path) {
    c.start = c.g.position.clone();
    c.path = path;
    c.seg = 0;
    c.t = 0;
  }
  function tick(dt) {
    const time = performance.now() / 1000;
    for (const d of lit) light(d, time);
    for (const c of fleet) {
      const bob = Math.sin(time * 1.3 + c.home) * (c.state === 'park' ? 0.01 : 0.12);
      if (c.state === 'away' && (c.timer -= dt) <= 0) { // its turn: claim a free dock, come in from the far end of its corridor
        const first = (c.home + Math.floor(time / 97)) % docks.length;
        const dock = [0, 1, 2, 3].map((k) => docks[(first + k) % docks.length]).find((d) => !taken.has(d));
        if (!dock) { c.timer = 20; continue; } // every dock busy: try again later rather than queue in the air
        c.dock = dock;
        taken.add(dock); // claimed from the start, so no two cars ever head for the same dock
        c.g.position.copy(c.dock.in[0][0]);
        c.heading = c.g.rotation.y;
        c.g.visible = true;
        follow(c, c.dock.in.slice(1, 2));
        c.state = 'approach';
      } else if (c.state === 'approach' && glide(c, dt)) {
        c.state = 'queue';
      } else if (c.state === 'queue') { // at the holding point, its dock already claimed: straight in
        follow(c, c.dock.in.slice(2));
        c.state = 'dock';
      } else if (c.state === 'dock' && glide(c, dt)) {
        c.state = 'park';
        c.timer = 60 + ((c.home * 37) % 60); // a long stay: most docks look settled most of the time
      } else if (c.state === 'park' && (c.timer -= dt) <= 0) {
        follow(c, c.dock.out);
        c.state = 'depart';
      } else if (c.state === 'depart') {
        if (glide(c, dt)) { // gone: the dock is free once it is well clear
          taken.delete(c.dock);
          c.g.visible = false;
          c.state = 'away';
          c.timer = 30 + ((c.home * 53 + Math.floor(time)) % 40);
        }
      }
      if (c.state !== 'park' && c.state !== 'away' && c.state !== 'queue') c.g.position.y += bob * 0.3;
      c.g.userData.hover.emissiveIntensity = c.state === 'park' ? c.base * 0.25 : c.base; // the pads dim once it is down
      c.g.userData.head.emissiveIntensity = c.state === 'park' ? c.beam * 0.1 : c.beam;
    }
  }
  if (!still) onFrame(tick);
  return group;
}
