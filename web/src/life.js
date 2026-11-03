// Ambient life generated in the browser (ADR-0002): traffic on the city's streets. Never simulated or stored.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { palette } from './palette.js';
import { box, rng } from './geometry.js';
import { CAR_COLORS } from './world.js';

const MOVING = [...CAR_COLORS, palette.sodium]; // taxis are commoner on the move than parked

// Cars with head- and taillights. Each lane runs along its axis at offset `at` and height `y`, from `from` to
// `to`, carrying `cars` cars that wrap back to the start; city streets and highways use the same lanes.
export function traffic(kit, lanes, onFrame) {
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
  cars.forEach((c, i) => body.setColorAt(i, color.set(MOVING[Math.floor(rand() * MOVING.length)])));
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), p = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  const place = () => {
    cars.forEach((c, i) => {
      const { axis, at, from, to, y } = c.lane, along = from + (to - from) * (c.u % 1), fwd = to > from;
      p.set(axis === 'z' ? at : along, y, axis === 'z' ? along : at);
      q.setFromAxisAngle(up, axis === 'z' ? (fwd ? 0 : Math.PI) : (fwd ? Math.PI / 2 : -Math.PI / 2));
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
