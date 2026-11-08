// Ambient life generated in the browser (ADR-0002): traffic on the city's streets. Never simulated or stored.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { palette } from './palette.js';
import { box, cyl, part, rng } from './geometry.js';
import { CAR_COLORS, pick } from './world.js';
import { ZEBRA_W } from './streets.js';

const MOVING = [...CAR_COLORS, palette.sodium]; // taxis are commoner on the move than parked
const CAR = 4.4; // car length
const CYCLE = 40; // seconds for a full traffic-light cycle at a crossing: x's half first, then z's
const AMBER = 3; // the last seconds of each street's go phase
const ALL_RED = 2; // both streets red at the end of each half, so the crossing clears

// One controller per crossing, shared by its cars, its signal heads and its walkers: where a street along `axis`
// is in its own cycle, 0..cycle. It may go (green, then amber) up to cycle / 2 - ALL_RED and is red after that,
// so the two streets never both go. Each crossing's offset is its own (lights below), so neighbours don't all
// change together.
const own = (axis, { cycle, offset }, t) => {
  const phase = (t + offset) % cycle;
  return axis === 'x' ? phase : (phase + cycle / 2) % cycle;
};
const goLeft = (axis, light, t) => light.cycle / 2 - ALL_RED - own(axis, light, t); // seconds of green + amber left (<= 0: red)

// Traffic lights, so cars on crossing streets never meet. A car may cross a stop line only while its street may
// go long enough to clear the crossing (the roundabout takes longest) and has room to get out the far side
// (gap: free road to the car ahead), and once it commits it keeps going.
// Returns how far the car may still go before the next stop line it has to wait at (Infinity if none).
function stopLine(c, lane, t, gap) {
  const along = lane.from + (lane.to - lane.from) * c.u, s = lane.s;
  let room = Infinity;
  for (const light of lane.lights) {
    const { centre, reach, clear } = light, d = (centre - s * reach - along) * s - CAR / 2 - 0.5; // to where the car's nose meets the line
    // Already in it (a car wrapping round to the lane's start still waits), or a nearer line matters more.
    if (d < -3 || d > room || c.cleared === centre) continue;
    // Timed at the slowest car's pace (and slower, for pulling away), since a car may be stuck behind one.
    const open = goLeft(lane.axis, light, t) > (clear + Math.max(0, d) + 2) / 7 && gap > Math.max(0, d) + 2 * reach + CAR + 1;
    if (open && d < 4) c.cleared = centre; // committed: it goes now, even if the light changes
    else if (!open) room = Math.max(0, d);
  }
  return room;
}

// The fixed part of every light on a lane, worked out once: where its stop line is (reach from the crossing's
// centre, streets.js trafficLanes: the car's nose stops just behind it), the zebra beyond it (zebra from the
// centre, null at the roundabout), its cycle and offset, and the distance to clear it, straight over or round the
// roundabout's arc and out (spot in traffic).
function lights(lane, hub) {
  const ring = Math.abs(lane.at - hub.c) < hub.w, side = Math.abs(lane.at - hub.c), rho = hub.r + side;
  return (lane.stops ?? []).map(([centre, reach, zebra]) => {
    const round = ring && Math.abs(centre - hub.c) < 1;
    const [x, z] = lane.axis === 'x' ? [centre, lane.c] : [lane.c, centre], cycle = round ? 2 * CYCLE : CYCLE;
    const inner = round ? Math.sqrt(rho * rho - side * side) : 0;
    const clear = (round ? rho * (Math.PI - 2 * Math.asin(side / rho)) + 2 * (reach - inner) : 2 * reach) + CAR;
    return { centre, reach, zebra, cycle, offset: cycle * fract(Math.sin(x * 12.9898 + z * 78.233) * 43758.5453), clear };
  });
}
const fract = (v) => v - Math.floor(v);

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

// Cars with head- and taillights. Each lane runs along its axis at offset `at` and height `y`, from `from` to
// `to`, carrying `cars` cars that wrap back to the start; lift(along), if set, is its height there (desert.js outOfTown).
// warp: the city's bend (city.js), so cars follow the curved streets; it is zero out on the highways.
// hub: the roundabout { c, r, w } (streets.js): lanes through it swing out onto a circle round the island, each at
// the island radius plus its own offset, so they nest and keep circling the same way.
export function traffic(kit, lanes, onFrame, warp, hub, parked = []) {
  const count = lanes.reduce((sum, l) => sum + l.cars, 0), rand = rng(77);
  const geo = carParts(), make = (g, mat) => new THREE.InstancedMesh(g, mat, count);
  const body = make(geo.paint, new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.2 }));
  const meshes = [body, make(geo.glass, kit.glass(palette.charcoal)), make(geo.tyres, kit.steel(palette.graphite, 0.8)),
    make(geo.head, kit.glow(palette.glare, 4)), make(geo.tail, kit.glow(palette.neonRed, 4))];
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
  const shift = [0, 0], here = [0, 0], ahead = [0, 0]; // reused: no garbage per frame
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
  for (const mesh of meshes) mesh.frustumCulled = false;
  const g = new THREE.Group();
  g.add(...meshes, signals(kit, lanes, spot, onFrame, () => t), parkedCars(kit, geo, parked, warp));
  g.userData.clock = () => t; // the lights' time, for the pedestrian signals (walkLight)
  return g;
}

// Cars parked in the local streets' bays (streets.js block): the moving cars' model, unlit, one instanced mesh
// per material. parked: [x, z, heading]; warp moves them with the street.
function parkedCars(kit, geo, parked, warp) {
  const rand = rng(91), g = new THREE.Group(), m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  const body = new THREE.InstancedMesh(geo.paint, new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.2 }), Math.max(1, parked.length));
  const parts = [body, new THREE.InstancedMesh(geo.glass, kit.glass(palette.charcoal), body.count), new THREE.InstancedMesh(geo.tyres, kit.steel(palette.graphite, 0.8), body.count)];
  const color = new THREE.Color(), shift = [0, 0], one = new THREE.Vector3(1, 1, 1);
  parked.forEach(([x, z, heading], i) => {
    warp(x, z, shift);
    m.compose(new THREE.Vector3(x + shift[0], 0.65, z + shift[1]), q.setFromAxisAngle(up, heading), one);
    for (const p of parts) p.setMatrixAt(i, m);
    body.setColorAt(i, color.set(pick(rand, CAR_COLORS)));
  });
  for (const p of parts) p.count = parked.length;
  g.add(...parts);
  return g;
}

// The traffic lights the cars obey (stopLine), drawn, sized by the street (STREETS kind). Every approach gets a
// pole on its right-hand kerb just behind its zebra, with a head at 3 m facing the cars coming; main streets add a
// mast arm with one head over their lanes; the boulevard (and the roundabout's entries) two heads on the arm and a
// head on the median's nose. Local streets keep the single pole head. Every controlled zebra has a walk signal at
// each end, facing across the street at the people waiting on the other side. Heads are red on top, amber, green
// below, so position carries the meaning as well as colour; walk signals a red hand over a cold white walker.
// Nothing blinks. Instanced: a lamp moves only when its state changes.
// spot: traffic's lane placement (roundabout and warp); clock: the lights' time.
const HEAD = { y: 3.2, arm: 5.9 };
function signals(kit, lanes, spot, onFrame, clock) {
  const approaches = new Map(), xz = [0, 0];
  for (const lane of lanes) {
    for (const light of lane.lights) {
      const key = `${lane.axis}${lane.c}${lane.s}${light.centre}`, off = Math.abs(lane.at - lane.c);
      const a = approaches.get(key) ?? { lane, light, offs: [] };
      a.offs.push(off);
      approaches.set(key, a);
    }
  }
  const heads = [], walks = [], posts = [], arms = [];
  const at = (axis, off, along, y) => { // world position: `off` across (from the street's centre line), `along` it
    spot({ axis, at: off }, along, xz);
    return [xz[0], y, xz[1]];
  };
  for (const { lane, light, offs } of approaches.values()) {
    const { axis, c, s, kind } = lane, right = Math.sign(lane.at - c), kerb = lane.w / 2 - lane.side;
    const big = kind === 'boulevard' || kind === 'street', inner = Math.min(...offs), outer = Math.max(...offs);
    // Along: just behind the zebra (at the roundabout, beside the stop line).
    const along = light.centre - s * (light.zebra ? light.zebra + ZEBRA_W / 2 + 0.5 : light.reach);
    const ground = (lane.lift ? lane.lift(along) : lane.y) - 0.65;
    if (ground > 0.5) continue; // out on a highway ramp: no kerb to stand on
    const face = axis === 'z' ? (s > 0 ? Math.PI : 0) : (-s * Math.PI) / 2; // toward the cars coming
    const top = big ? HEAD.arm + 0.7 : HEAD.y + 0.8;
    posts.push([...at(axis, c + right * (kerb + 0.6), along, ground + top / 2), top]);
    heads.push({ p: at(axis, c + right * (kerb + 0.35), along, ground + HEAD.y), face, axis, light });
    if (big) {
      const span = kerb + 0.6 - (inner - 1.6); // from the pole out over the innermost lane
      arms.push({ p: at(axis, c + right * (kerb + 0.6 - span / 2), along, ground + top - 0.1), axis, span });
      const over = kind === 'boulevard' ? [inner, (inner + outer) / 2 + 1.6] : [(inner + outer) / 2];
      for (const o of over) heads.push({ p: at(axis, c + right * o, along, ground + HEAD.arm), face, axis, light });
    }
    if (kind === 'boulevard' && light.zebra) { // on the median's nose, for the cars in the inner lane
      const nose = c + right * 0.9;
      posts.push([...at(axis, nose, along, ground + 0.12 + (HEAD.y + 0.8) / 2), HEAD.y + 0.8]);
      heads.push({ p: at(axis, nose - right * 0.25, along, ground + HEAD.y + 0.12), face, axis, light });
    }
    if (light.zebra) { // walk signals at both ends of this approach's zebra, on the crossing's side of it
      const mid = light.centre - s * (light.zebra - ZEBRA_W / 2 - 0.3);
      const [x, z] = axis === 'x' ? [light.centre, c] : [c, light.centre];
      for (const end of [1, -1]) {
        const o = c + end * right * (kerb + 0.5), look = end * right; // looks toward -look across the street
        const toward = axis === 'z' ? (look > 0 ? -Math.PI / 2 : Math.PI / 2) : look > 0 ? Math.PI : 0;
        posts.push([...at(axis, o, mid, ground + 1.6), 3.2]);
        walks.push({ p: at(axis, o, mid, ground + 2.6), face: toward, cross: axis, x, z });
      }
    }
  }
  const steel = kit.steel(palette.charcoal, 0.6), dark = kit.steel(palette.deepNavy, 0.3), n = heads.length, w = walks.length;
  const mesh = (geo, mat, count) => {
    const m = new THREE.InstancedMesh(geo, mat, count);
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
      const g = goLeft(h.axis, h.light, t);
      show(h, i, g <= 0 ? 0 : g < AMBER ? 1 : 2, lamps, [0.35, 0, -0.35], 0.24);
    });
    walks.forEach((h, i) => show(h, i, walkLight(h.x, h.z, h.cross, t) > 0 ? 1 : 0, walkLamps, [0.15, -0.15], 0.15));
    if (changed) for (const l of [...lamps, ...walkLamps]) l.instanceMatrix.needsUpdate = true;
  };
  update();
  onFrame(update);
  const g = new THREE.Group();
  g.add(post, arm, housing, lenses, ...lamps, walkBox, walkLens, ...walkLamps);
  return g;
}

// The pedestrian signal where streets meet at (x, z), for people crossing the street that runs along `axis`:
// seconds of walk left, or 0. They walk while the cross street goes (its whole half, which starts ALL_RED after
// this street turns red) and stop ALL_RED before this street may go again. The same controller as the cars'
// lights (own, lights above).
export function walkLight(x, z, axis, t) {
  const u = own(axis, { cycle: CYCLE, offset: CYCLE * fract(Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) }, t);
  return u >= CYCLE / 2 ? CYCLE - ALL_RED - u : 0;
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
