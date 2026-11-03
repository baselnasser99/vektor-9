// The air: sky dome, the cloud deck lit by the city, mist between the towers, and rain.
// All of it is decoration (ADR-0002); rain strength comes from the snapshot so every visitor sees the same weather.
import * as THREE from 'three';
import { palette } from './palette.js';
import { rng } from './geometry.js';
import { noiseTexture } from './textures.js';

// Sky dome colored by height above the horizon from a list of [elevation 0..1, color]; below the horizon it is haze, so the ground melts into it.
export function skyDome(stops, radius = 450) {
  const geo = new THREE.SphereGeometry(radius, 64, 32);
  const pos = geo.attributes.position, colors = [], c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const e = Math.max(pos.getY(i) / radius, 0);
    const k = stops.findIndex(([at]) => at >= e);
    const [a, ca] = stops[Math.max(k - 1, 0)], [b, cb] = stops[k];
    c.set(ca).lerp(new THREE.Color(cb), b > a ? (e - a) / (b - a) : 0);
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false }));
}

// Cloud deck high above, glowing mauve where the city lights it from below; drifts slowly.
export function cloudDeck(size, onFrame) {
  const map = noiseTexture(11, 220);
  map.repeat.set(4, 4);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({
    // One-sided, facing down: seen from below only, so a camera above the deck still sees the city.
    map, color: palette.cloudGlow, transparent: true, opacity: 0.9, depthWrite: false, fog: false }));
  mesh.rotation.x = Math.PI / 2;
  mesh.position.y = 650;
  onFrame((dt) => (map.offset.x += dt * 0.002));
  return mesh;
}

// Two thin layers of mist drifting between the towers.
export function mist(half, onFrame) {
  return [28, 55].map((y, k) => {
    const map = noiseTexture(20 + k, 160);
    map.repeat.set(3, 3);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(half * 5, half * 5), new THREE.MeshBasicMaterial({
      map, color: palette.nightHorizon, transparent: true, opacity: 0.15, depthWrite: false }));
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = y;
    onFrame((dt) => (map.offset.x += dt * 0.004 * (k ? -1 : 1)));
    return mesh;
  });
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
