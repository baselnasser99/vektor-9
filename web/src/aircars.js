// IKARO's hovercars (headquarters.js): a small private fleet flying to the headquarters' docks along fixed corridors.
// Ambient, browser-only (ADR-0002). Each car runs a small state machine: away (out of sight), approach (along its
// corridor to a holding point clear of the towers), queue (hovering there while its dock is taken), dock (slowing,
// lining up and settling onto the dock), park (still, its hover dimmed) and depart (lifting off, backing or turning
// out and climbing away along the corridor). No physics: every move is an eased glide between fixed waypoints.
//
// Docks, in the site's frame: the two landing terraces (cars come down through the open air over the front street,
// glide in nose first, turn side-on over the pad and settle) and two of the hangar bays in the towers' outer faces
// (approached head-on from outside, above the neighbours' roofs, and entered nose first; they back out to leave).
// The other two hangars each keep a car parked for good. Departures over the street turn away from the city's
// observation tower. With reduced motion the parked cars are there and the rest are away.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { palette } from './palette.js';
import { box } from './geometry.js';
import { HQ, siteAt } from './headquarters.js';

const CRUISE = 26, SLOW = 5, FINE = 1.6; // m/s: in the corridors, coming in, in the last metres

// One hovercar: a low armoured wedge with a dark canopy, cool headlights, crimson nav lights and side strips, and
// four hover pads underneath whose glow follows its state; one mesh per material. Its origin is under its middle, at
// the bottom; +z ahead.
function car(kit, parts) {
  const by = new Map(); // material -> its parts, merged into one mesh each
  const add = (geo, mat, x, y, z, rx = 0) => {
    const m = new THREE.Matrix4().makeRotationX(rx).setPosition(x, y, z);
    if (!by.has(mat)) by.set(mat, []);
    by.get(mat).push(geo.clone().applyMatrix4(m));
  };
  add(parts.hull, parts.armor, 0, 0.55, 0);
  add(parts.nose, parts.armor, 0, 0.5, 2.55, 0.35);
  add(parts.cabin, parts.canopy, 0, 1.05, -0.2);
  add(parts.fin, parts.armor, 0, 1.15, -2.2);
  for (const s of [-1, 1]) {
    add(parts.lamp, parts.head, s * 0.75, 0.6, 2.62);
    add(parts.lamp, parts.nav, s * 0.95, 0.75, -2.62);
    add(parts.strip, parts.nav, s * 1.06, 0.62, 0);
  }
  const hover = kit.glow(palette.coldCyan, 1.2).clone(); // its own, to dim when parked
  for (const [x, z] of [[-0.75, 1.6], [0.75, 1.6], [-0.75, -1.6], [0.75, -1.6]]) add(parts.pad, hover, x, 0.2, z);
  const g = new THREE.Group();
  for (const [mat, geos] of by) g.add(new THREE.Mesh(mergeGeometries(geos.map((x) => x.index ? x.toNonIndexed() : x)), mat));
  g.userData.hover = hover;
  return g;
}

export function hqFleet(kit, site, onFrame, still) {
  const parts = {
    hull: box(2.1, 0.6, 5.0, 1), nose: box(1.7, 0.35, 0.9, 1), cabin: box(1.6, 0.5, 2.6, 1), fin: box(0.12, 0.5, 0.8, 0),
    lamp: box(0.36, 0.1, 0.06, 0), strip: box(0.04, 0.05, 3.4, 0), pad: new THREE.CylinderGeometry(0.34, 0.34, 0.06, 16),
    armor: kit.steel(palette.deepNavy, 0.3), canopy: kit.glass(palette.charcoal), head: kit.glow(palette.coldWhite, 2.2),
    nav: kit.glow(palette.coreCrimson, 2.5),
  };
  const group = new THREE.Group();
  // Site frame -> world, and a heading in the site frame (radians, 0: toward +w) -> world.
  const P = (u, y, w) => { const [x, z] = siteAt(site, u, w); return new THREE.Vector3(x, y + 0.18, z); };
  const H = (a) => site.heading + a;
  const away = (siteAt(site, 1, 0)[0] - site.x) * -site.x + (siteAt(site, 1, 0)[1] - site.z) * -site.z > 0 ? -1 : 1; // +u points to the hub? go the other way
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
  const bay = (s, w) => { // a hangar bay in the outer face of tower s, at w: entered nose first, left backing out
    const floor = B.y + 0.06, inside = s * (B.face - B.depth / 2 - 0.5), mouth = s * (B.face + 12), face = H(s > 0 ? -Math.PI / 2 : Math.PI / 2);
    return { park: [P(inside, floor, w), face], hold: P(s * (B.face + 55), floor + 14, w + 8),
      in: [[P(s * (B.face + 240), floor + 30, w + 20), CRUISE], [P(s * (B.face + 55), floor + 14, w + 8), CRUISE],
        [P(mouth, floor + 1.6, w), SLOW, face], [P(inside, floor + 1.6, w), FINE, face], [P(inside, floor, w), FINE, face]],
      out: [[P(inside, floor + 1.6, w), FINE, face], [P(mouth, floor + 1.6, w), FINE, face], [P(s * (B.face + 60), floor + 20, w - 6), SLOW],
        [P(s * (B.face + 260), floor + 36, w - 30), CRUISE]] };
  };
  docks.push(bay(-1, B.w[0]), bay(1, B.w[0]));
  const parked = [bay(-1, B.w[1]), bay(1, B.w[1])]; // two cars kept in for good

  // The fleet: four cars sharing the four docks (so now and then one queues), and the two parked ones.
  const fleet = [];
  for (let k = 0; k < 6; k++) {
    const g = car(kit, parts);
    group.add(g);
    if (k >= 4) {
      const [p, h] = parked[k - 4].park;
      g.position.copy(p);
      g.rotation.y = h;
      g.userData.hover.emissiveIntensity *= 0.25;
      continue;
    }
    fleet.push({ g, state: 'away', timer: 5 + k * 9, dock: null, path: null, seg: 0, t: 0, heading: 0, home: k, base: g.userData.hover.emissiveIntensity });
    g.visible = false;
  }
  const taken = new Set();

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
    for (const c of fleet) {
      const bob = Math.sin(time * 1.3 + c.home) * (c.state === 'park' ? 0.01 : 0.12);
      if (c.state === 'away' && (c.timer -= dt) <= 0) { // its turn: pick a dock, come in from the far end of its corridor
        c.dock = docks[(c.home + Math.floor(time / 97)) % docks.length];
        c.g.position.copy(c.dock.in[0][0]);
        c.heading = c.g.rotation.y;
        c.g.visible = true;
        follow(c, c.dock.in.slice(1, 2));
        c.state = 'approach';
      } else if (c.state === 'approach' && glide(c, dt)) {
        c.state = 'queue';
      } else if (c.state === 'queue') {
        if (!taken.has(c.dock)) {
          taken.add(c.dock);
          follow(c, c.dock.in.slice(2));
          c.state = 'dock';
        } else c.g.position.y = c.dock.hold.y + bob;
      } else if (c.state === 'dock' && glide(c, dt)) {
        c.state = 'park';
        c.timer = 25 + ((c.home * 37) % 30);
      } else if (c.state === 'park' && (c.timer -= dt) <= 0) {
        follow(c, c.dock.out);
        c.state = 'depart';
      } else if (c.state === 'depart') {
        if (c.seg >= 2) taken.delete(c.dock); // clear of the dock: the next may come in
        if (glide(c, dt)) {
          taken.delete(c.dock);
          c.g.visible = false;
          c.state = 'away';
          c.timer = 15 + ((c.home * 53 + Math.floor(time)) % 25);
        }
      }
      if (c.state !== 'park' && c.state !== 'away' && c.state !== 'queue') c.g.position.y += bob * 0.3;
      c.g.userData.hover.emissiveIntensity = c.state === 'park' ? c.base * 0.25 : c.base; // the pads dim once it is down
    }
  }
  if (!still) onFrame(tick);
  return group;
}
