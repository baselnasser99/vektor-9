// Ambient life generated in the browser (ADR-0002): traffic on the city's streets and rain.
// Neither is simulated or stored; rain strength is derived from the snapshot so every visitor sees the same weather.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { palette } from './palette.js';
import { box, rng } from './geometry.js';

const CARS_PER_LANE = 18;
const CAR_COLORS = [palette.charcoal, palette.slate, palette.sodium, palette.gunmetal, palette.cream, palette.sodium];

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
  cars.forEach((c, i) => body.setColorAt(i, color.set(CAR_COLORS[Math.floor(rand() * CAR_COLORS.length)])));
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

// Rain from the snapshot: three-hour spells, dry about three times in four, otherwise a light shower.
export function rainAmount(snap) {
  const r = rng(snap.seed * 7919 + Math.floor(snap.tick / 36))();
  return r < 0.75 ? 0 : 0.2 + 0.8 * ((r - 0.75) / 0.25);
}

// Rain streaks in a box that follows the camera's focus point.
export function rain(amount, target, onFrame) {
  const count = Math.round(5000 * amount), size = [500, 260, 500], rand = rng(5);
  const pos = new Float32Array(count * 6);
  for (let i = 0; i < count; i++) {
    const [x, y, z] = [(rand() - 0.5) * size[0], rand() * size[1], (rand() - 0.5) * size[2]];
    pos.set([x, y, z, x + 0.25, y - 2.5, z + 0.1], i * 6);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({
    color: palette.glassHighlight, transparent: true, opacity: 0.05 + 0.1 * amount, depthWrite: false }));
  lines.frustumCulled = false;
  onFrame((dt) => {
    const fall = 70 * dt;
    for (let i = 0; i < count; i++) {
      let y = pos[i * 6 + 1] - fall;
      if (y < 0) y += size[1];
      pos[i * 6 + 1] = y;
      pos[i * 6 + 4] = y - 2.5;
    }
    geo.attributes.position.needsUpdate = true;
    lines.position.set(target.x, 0, target.z);
  });
  lines.position.set(target.x, 0, target.z);
  return lines;
}
