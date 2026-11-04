// Ambient life generated in the browser (ADR-0002): traffic on the city's streets. Never simulated or stored.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { palette } from './palette.js';
import { box, part, rng } from './geometry.js';
import { CAR_COLORS, pick } from './world.js';

const MOVING = [...CAR_COLORS, palette.sodium]; // taxis are commoner on the move than parked

// Cars with head- and taillights. Each lane runs along its axis at offset `at` and height `y`, from `from` to
// `to`, carrying `cars` cars that wrap back to the start; city streets and highways use the same lanes.
// warp: the city's bend (city.js), so cars follow the curved streets; it is zero out on the highways.
// hub: the roundabout { c, r, w } (streets.js): lanes through it swing out onto a circle round the island, each at
// the island radius plus its own offset, so they nest and keep circling the same way.
export function traffic(kit, lanes, onFrame, warp, hub) {
  const count = lanes.reduce((sum, l) => sum + l.cars, 0), rand = rng(77);
  const lamps = (z, y) => mergeGeometries([-0.6, 0.6].map((x) => new THREE.BoxGeometry(0.4, 0.2, 0.1).translate(x, y, z)));
  const body = new THREE.InstancedMesh(box(1.9, 1.3, 4.4, 1), new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.2 }), count);
  const head = new THREE.InstancedMesh(lamps(2.21, 0.05), kit.glow(palette.glare, 4), count);
  const tail = new THREE.InstancedMesh(lamps(-2.21, 0.15), kit.glow(palette.neonRed, 4), count);
  const cars = [];
  for (const lane of lanes) {
    for (let k = 0; k < lane.cars; k++) cars.push({ lane, u: rand(), speed: 9 + rand() * 7 });
  }
  const color = new THREE.Color();
  cars.forEach((c, i) => body.setColorAt(i, color.set(pick(rand, MOVING))));
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), p = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  const shift = [0, 0];
  const spot = ({ axis, at }, along) => {
    let side = at - hub.c;
    const u = along - hub.c, rho = hub.r + Math.abs(side);
    if (Math.abs(side) < hub.w && u * u < rho * rho - side * side) side = Math.sign(side) * Math.sqrt(rho * rho - u * u);
    const [x, z] = axis === 'z' ? [hub.c + side, along] : [along, hub.c + side];
    warp(x, z, shift);
    return [x + shift[0], z + shift[1]];
  };
  const place = () => {
    cars.forEach((c, i) => {
      const { from, to, y } = c.lane, along = from + (to - from) * (c.u % 1), s = to > from ? 1 : -1;
      // Heading from where the car will be a metre on, so it turns with the bend of the street.
      const [x1, z1] = spot(c.lane, along), [x2, z2] = spot(c.lane, along + s);
      p.set(x1, y, z1);
      q.setFromAxisAngle(up, Math.atan2(x2 - x1, z2 - z1));
      m.compose(p, q, one);
      for (const mesh of [body, head, tail]) mesh.setMatrixAt(i, m);
    });
    for (const mesh of [body, head, tail]) mesh.instanceMatrix.needsUpdate = true;
  };
  place();
  onFrame((dt) => {
    for (const c of cars) c.u += (c.speed * dt) / Math.abs(c.lane.to - c.lane.from);
    place();
  });
  // Cars move far from where the meshes were created, so never cull them by their starting bounds.
  for (const mesh of [body, head, tail]) mesh.frustumCulled = false;
  const g = new THREE.Group();
  g.add(body, head, tail);
  return g;
}

// Two trains on the railway viaduct (terrain.js railway), one per track, each shuttling between the terminus and
// the far end of the line out in the haze, slowing into the station and waiting there a moment.
// rail: { at(t) -> [x, y, z] on the deck centre line, side: [x, z] across it, angle, end, out }.
export function trains(kit, rail, onFrame) {
  const g = new THREE.Group(), trainsets = [], CAR = 20, CARS = 6, body = kit.windows(2, true);
  const shell = kit.steel(palette.cream, 0.4), stripe = kit.glow(palette.neonCyan, 2);
  const dir = Math.sign(rail.out - rail.end), room = Math.abs(rail.out - rail.end) - CARS * CAR - 4;
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
  const place = () => {
    for (const { cars, off, u } of trainsets) {
      // Back and forth; the smoothstep slows it at both ends, and clamping holds it at the station a while.
      const there = Math.min(1, Math.max(0, (1 - Math.abs(2 * u - 1)) * 1.15 - 0.15));
      const head = 4 + room * there * there * (3 - 2 * there);
      cars.forEach((car, k) => {
        const [x, y, z] = rail.at(rail.end + dir * (head + k * CAR + CAR / 2));
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
