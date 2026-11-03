// Ambient life generated in the browser (ADR-0002): traffic on the city's streets. Never simulated or stored.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { palette } from './palette.js';
import { box, rng } from './geometry.js';
import { CAR_COLORS } from './world.js';

const CARS_PER_LANE = 18;
const MOVING = [...CAR_COLORS, palette.sodium]; // taxis are commoner on the move than parked

// Cars with head- and taillights driving both ways down every street, wrapping at the city edge.
export function traffic(kit, { lines, length }, onFrame) {
  const count = lines.length * CARS_PER_LANE, rand = rng(77);
  const lamps = (z, y) => mergeGeometries([-0.6, 0.6].map((x) => new THREE.BoxGeometry(0.4, 0.2, 0.1).translate(x, y, z)));
  const body = new THREE.InstancedMesh(box(1.9, 1.3, 4.4, 1), new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.2 }), count);
  const head = new THREE.InstancedMesh(lamps(2.21, 0.75), kit.glow(palette.glare, 4), count);
  const tail = new THREE.InstancedMesh(lamps(-2.21, 0.85), kit.glow(palette.neonRed, 4), count);
  const cars = [];
  lines.forEach((lane) => {
    for (let k = 0; k < CARS_PER_LANE; k++) cars.push({ lane, s: rand() * length, speed: 9 + rand() * 7 });
  });
  const color = new THREE.Color();
  cars.forEach((c, i) => body.setColorAt(i, color.set(MOVING[Math.floor(rand() * MOVING.length)])));
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), p = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  const place = () => {
    cars.forEach((c, i) => {
      const { axis, at, dir } = c.lane, d = (c.s % length) - length / 2;
      p.set(axis === 'z' ? at : d * dir, 0.95, axis === 'z' ? d * dir : at);
      q.setFromAxisAngle(up, axis === 'z' ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2));
      m.compose(p, q, one);
      for (const mesh of [body, head, tail]) mesh.setMatrixAt(i, m);
    });
    for (const mesh of [body, head, tail]) mesh.instanceMatrix.needsUpdate = true;
  };
  place();
  onFrame((dt) => {
    for (const c of cars) c.s += c.speed * dt;
    place();
  });
  const g = new THREE.Group();
  g.add(body, head, tail);
  return g;
}
