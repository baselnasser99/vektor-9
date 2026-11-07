// Ambient life generated in the browser (ADR-0002): traffic on the city's streets. Never simulated or stored.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { palette } from './palette.js';
import { box, part, rng } from './geometry.js';
import { CAR_COLORS, pick } from './world.js';

const MOVING = [...CAR_COLORS, palette.sodium]; // taxis are commoner on the move than parked
const CAR = 4.4; // car length
const CYCLE = 40; // seconds for a full traffic-light cycle: half green along x, half along z

// Traffic lights, so cars on crossing streets never meet. A car may cross a stop line only while its street has
// green long enough left to clear the crossing (the roundabout takes longest) and room to get out the far side
// (gap: free road to the car ahead), and once it commits it keeps going.
// Returns how far the car may still go before the next stop line it has to wait at (Infinity if none).
function stopLine(c, lane, t, gap) {
  const along = lane.from + (lane.to - lane.from) * c.u, s = lane.s;
  let room = Infinity;
  for (const { centre, reach, cycle, offset, clear } of lane.lights) {
    const d = (centre - s * reach - along) * s - CAR / 2 - 0.5; // to where the car's nose meets the line
    // Already in it (a car wrapping round to the lane's start still waits), or a nearer line matters more.
    if (d < -3 || d > room || c.cleared === centre) continue;
    const phase = (t + offset) % cycle, green = lane.axis === 'x' ? cycle / 2 - phase : cycle - phase; // seconds of green left
    // Timed at the slowest car's pace (and slower, for pulling away), since a car may be stuck behind one.
    const open = (lane.axis === 'x') === phase < cycle / 2 && green > (clear + Math.max(0, d) + 2) / 7 && gap > Math.max(0, d) + 2 * reach + CAR + 1;
    if (open && d < 4) c.cleared = centre; // committed: it goes now, even if the light changes
    else if (!open) room = Math.max(0, d);
  }
  return room;
}

// The fixed part of every light on a lane, worked out once: where its stop line is (reach from the crossing's
// centre), its cycle and offset (each crossing its own), and the distance to clear it, straight over or round
// the roundabout's arc and out (spot in traffic).
function lights(lane, hub) {
  const ring = Math.abs(lane.at - hub.c) < hub.w, side = Math.abs(lane.at - hub.c), rho = hub.r + side;
  return (lane.stops ?? []).map(([centre, half]) => {
    // Ring lanes wait outside the outermost ring; the rest just short of the zebra (streets.js road), which lies
    // 0.3 to 3.3 m past the crossing street's sidewalks, so people (people.js) cross in front of the cars.
    const round = ring && Math.abs(centre - hub.c) < 1, reach = round ? hub.r + hub.w - 4 : half + 3.6;
    const [x, z] = lane.axis === 'x' ? [centre, lane.c] : [lane.c, centre], cycle = round ? 2 * CYCLE : CYCLE;
    const inner = round ? Math.sqrt(rho * rho - side * side) : 0;
    const clear = (round ? rho * (Math.PI - 2 * Math.asin(side / rho)) + 2 * (reach - inner) : 2 * reach) + CAR;
    return { centre, reach, cycle, offset: cycle * fract(Math.sin(x * 12.9898 + z * 78.233) * 43758.5453), clear };
  });
}
const fract = (v) => v - Math.floor(v);

// Cars with head- and taillights. Each lane runs along its axis at offset `at` and height `y`, from `from` to
// `to`, carrying `cars` cars that wrap back to the start; lift(along), if set, is its height there (desert.js outOfTown).
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
    lane.queue = []; // its cars in order along it, each following the one ahead, so none ever pass through another
    lane.len = Math.abs(lane.to - lane.from);
    lane.s = Math.sign(lane.to - lane.from);
    lane.lights = lights(lane, hub);
    for (let k = 0; k < lane.cars; k++) {
      const car = { lane, u: (k + rand() * 0.5) / lane.cars, speed: 9 + rand() * 7, v: 0, cleared: null, placed: -1 };
      lane.queue.push(car);
      cars.push(car);
    }
  }
  const color = new THREE.Color();
  cars.forEach((c, i) => body.setColorAt(i, color.set(pick(rand, MOVING))));
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), p = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  const shift = [0, 0], here = [0, 0], ahead = [0, 0], meshes = [body, head, tail]; // reused: no garbage per frame
  // Where a car `along` its lane is, written into out as [x, z].
  const spot = ({ axis, at }, along, out) => {
    let side = at - hub.c;
    const u = along - hub.c, rho = hub.r + Math.abs(side);
    if (Math.abs(side) < hub.w && u * u < rho * rho - side * side) side = Math.sign(side) * Math.sqrt(rho * rho - u * u);
    const x = axis === 'z' ? hub.c + side : along, z = axis === 'z' ? along : hub.c + side;
    warp(x, z, shift);
    out[0] = x + shift[0];
    out[1] = z + shift[1];
    return out;
  };
  const place = () => {
    cars.forEach((c, i) => {
      if (c.placed === c.u) return; // a car waiting at a light has not moved: its matrices still hold
      c.placed = c.u;
      const { from, to, y, lift } = c.lane, along = from + (to - from) * (c.u % 1), s = to > from ? 1 : -1;
      // Rear and front axles both on the lane's path, so the car turns with the bend of the street and its body
      // never swings out across the next lane (the roundabout's entry is a sharp turn).
      spot(c.lane, along - s * 1.4, here);
      spot(c.lane, along + s * 1.4, ahead);
      p.set((here[0] + ahead[0]) / 2, lift ? lift(along) : y, (here[1] + ahead[1]) / 2);
      q.setFromAxisAngle(up, Math.atan2(ahead[0] - here[0], ahead[1] - here[1]));
      m.compose(p, q, one);
      for (const mesh of meshes) mesh.setMatrixAt(i, m);
    });
    for (const mesh of meshes) mesh.instanceMatrix.needsUpdate = true;
  };
  place();
  let t = 0;
  const tick = (dt) => {
    dt = Math.min(dt, 0.1); // a stalled tab must not jump cars through each other
    t += dt;
    for (const lane of lanes) {
      lane.queue.forEach((c, k) => {
        const next = lane.queue[(k + 1) % lane.queue.length];
        let room = next === c ? Infinity : (((next.u - c.u) % 1) + 1) % 1 * lane.len - CAR - 2;
        room = Math.min(room, stopLine(c, lane, t, room));
        // Slow smoothly into the gap; pick up speed gently when it opens.
        c.v = Math.min(c.speed, Math.max(0, room) * 1.2, c.v + 5 * dt);
        c.u += (c.v * dt) / lane.len;
        if (c.u >= 1) c.u = 0; // round to the start exactly, where the first crossing's light still holds it
      });
    }
    place();
  };
  onFrame(tick);
  // Cars move far from where the meshes were created, so never cull them by their starting bounds.
  for (const mesh of [body, head, tail]) mesh.frustumCulled = false;
  const g = new THREE.Group();
  g.add(body, head, tail);
  g.userData.clock = () => t; // the lights' time, for the pedestrian signals (walkLight)
  return g;
}

// The pedestrian signal where streets meet at (x, z), for people crossing the street that runs along `axis`:
// seconds of walk left (they walk while that street's cars have red), or 0. The same cycle and offset as the
// cars' lights (lights above); the first 2 s of each walk phase are held back so the last cars are clear.
export function walkLight(x, z, axis, t) {
  const phase = (t + CYCLE * fract(Math.sin(x * 12.9898 + z * 78.233) * 43758.5453)) % CYCLE, half = CYCLE / 2;
  const walk = axis === 'x' ? phase >= half : phase < half, into = axis === 'x' ? phase - half : phase;
  return walk && into > 2 ? half - into : 0;
}

// Two trains on the railway viaduct (terrain.js railway), one per track, each shuttling between the terminus and
// the far end of the line out in the haze, slowing into the station and waiting there a moment.
// rail: { at(t, out) -> [x, y, z] on the deck centre line, side: [x, z] across it, angle, end, out }.
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
  const point = [0, 0, 0];
  const place = () => {
    for (const { cars, off, u } of trainsets) {
      // Back and forth; the smoothstep slows it at both ends, and clamping holds it at the station a while.
      const there = Math.min(1, Math.max(0, (1 - Math.abs(2 * u - 1)) * 1.15 - 0.15));
      const head = 4 + room * there * there * (3 - 2 * there);
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
