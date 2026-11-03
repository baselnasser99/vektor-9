// The air: sky dome, stars, moon, the cloud deck lit by the city, far skylines and cloud banks on the horizon, searchlights, airships, mist and rain.
// All of it is decoration (ADR-0002); rain strength comes from the snapshot so every visitor sees the same weather.
import * as THREE from 'three';
import { palette } from './palette.js';
import { box, part, rng } from './geometry.js';
import { bandTexture, fadeTexture, noiseTexture, radialTexture, skylineTexture } from './textures.js';
import { WORDS, pick } from './world.js';

// Sky dome colored by height above the horizon from a list of [elevation 0..1, color]; below the horizon it is haze, so the ground melts into it.
export function skyDome(stops, radius = 450) {
  const geo = new THREE.SphereGeometry(radius, 64, 32);
  const pos = geo.attributes.position, colors = [], c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const e = Math.min(Math.max(pos.getY(i) / radius, 0), 1); // clamp: the pole can land a hair above 1
    const k = stops.findIndex(([at]) => at >= e);
    const [a, ca] = stops[Math.max(k - 1, 0)], [b, cb] = stops[k];
    c.set(ca).lerp(new THREE.Color(cb), b > a ? (e - a) / (b - a) : 0);
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false }));
}

// Cloud deck high above, glowing mauve where the city lights it from below; drifts slowly.
// Patchy, so stars and the moon's glow show through the gaps.
export function cloudDeck(size, onFrame) {
  const map = noiseTexture(11, 120);
  map.repeat.set(4, 4);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({
    // One-sided, facing down: seen from below only, so a camera above the deck still sees the city.
    // alphaMap has its own (unrepeated) UVs: the deck thins out toward its edge instead of ending in a hard line.
    map, alphaMap: fadeTexture(0.3), color: palette.cloudGlow, transparent: true, opacity: 0.85, depthWrite: false, fog: false }));
  mesh.rotation.x = Math.PI / 2;
  mesh.position.y = 650;
  onFrame((dt) => (map.offset.x += dt * 0.002));
  return mesh;
}

// Stars on the upper sky, drawn behind everything so clouds pass in front of them.
export function stars(radius) {
  const rand = rng(404), pos = [];
  for (let i = 0; i < 1500; i++) {
    const [a, e] = [rand() * Math.PI * 2, 0.15 + Math.asin(rand()) * 0.9];
    pos.push(Math.cos(a) * Math.cos(e) * radius, Math.sin(e) * radius, Math.sin(a) * Math.cos(e) * radius);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const points = new THREE.Points(geo, new THREE.PointsMaterial({ color: palette.glare, size: 1.6, sizeAttenuation: false,
    transparent: true, opacity: 0.7, fog: false, depthWrite: false }));
  points.renderOrder = -3;
  return points;
}

// Direction to the moon; stage.js shines the moonlight from here.
export const MOON = new THREE.Vector3(-25, 45, -30).normalize();

// The moon as a soft glow and a small bright core, in the moonlight's direction.
export function moon(radius) {
  const dir = MOON.clone().multiplyScalar(radius);
  return [[900, palette.moon, 0.45], [160, palette.glare, 0.9]].map(([size, color, opacity]) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTexture(256, size > 500 ? 0 : 60), color, transparent: true,
      opacity, fog: false, depthWrite: false }));
    s.position.copy(dir);
    s.scale.setScalar(size);
    s.renderOrder = -3;
    return s;
  });
}

// The horizon, so the band between the ground haze and the cloud deck is not empty: low cloud banks lit by the
// city, drifting slowly, and in front of them the skylines of other cities far across the desert.
// Drawn after the stars and before everything else transparent, since they are the farthest things in the scene.
export function horizon(radius, onFrame) {
  const ring = (r, h, y, material, order) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 96, 1, true), material);
    mesh.position.y = y;
    mesh.renderOrder = order;
    return mesh;
  };
  // Many thin streaks, repeated often: a few big round blobs read as one huge dome behind the city.
  const clouds = noiseTexture(13, 420, 0.12);
  clouds.repeat.set(10, 1);
  onFrame((dt) => (clouds.offset.x += dt * 0.0006));
  const skyline = skylineTexture();
  skyline.repeat.set(4, 1);
  const flat = { transparent: true, depthWrite: false, fog: false, side: THREE.BackSide };
  return [
    ring(radius * 0.95, 1000, 450, new THREE.MeshBasicMaterial({ ...flat, map: clouds, alphaMap: bandTexture(),
      color: palette.cloudGlow, opacity: 0.7 }), -2),
    ring(radius * 0.8, 400, 170, new THREE.MeshBasicMaterial({ ...flat, map: skyline }), -1),
  ];
}

// Searchlight beams from rooftops, sweeping slowly into the clouds; brightest at the lamp, fading upward.
export function searchlights(half, onFrame) {
  const rand = rng(88), beams = [];
  const geo = new THREE.CylinderGeometry(24, 0.8, 650, 20, 1, true).translate(0, 325, 0);
  const colors = [], p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) colors.push(...Array(3).fill(1 - p.getY(i) / 650));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const mat = new THREE.MeshBasicMaterial({ color: palette.glassHighlight, vertexColors: true, transparent: true, opacity: 0.09,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  for (let k = 0; k < 4; k++) {
    const pivot = new THREE.Group(), beam = new THREE.Mesh(geo, mat);
    beam.rotation.z = 0.35 + rand() * 0.25;
    pivot.add(beam);
    pivot.position.set((rand() - 0.5) * half * 1.2, 70 + rand() * 40, (rand() - 0.5) * half * 1.2);
    pivot.rotation.y = rand() * Math.PI * 2;
    beams.push([pivot, 0.04 + rand() * 0.05]);
  }
  onFrame((dt) => {
    for (const [pivot, speed] of beams) pivot.rotation.y += speed * dt;
  });
  return beams.map(([pivot]) => pivot);
}

// Two airships circling slowly above the towers, each with a lit ad on its flank and steady nav lights.
export function airships(kit, half, onFrame) {
  const rand = rng(61), ships = [];
  for (let k = 0; k < 2; k++) {
    const g = new THREE.Group(), word = pick(rand, WORDS);
    const hull = part(g, new THREE.SphereGeometry(1, 24, 12), kit.steel(palette.charcoal, 0.6));
    hull.scale.set(42, 11, 11);
    part(g, box(10, 2.5, 3, 0), kit.steel(palette.gunmetal), 0, -11.5, 0);
    for (const side of [-1, 1]) part(g, box(28, 6, 0.3, 0), kit.billboard(word, palette.neonPink, palette.neonViolet), 0, 0, side * 10.4);
    part(g, new THREE.SphereGeometry(0.6, 8, 6), kit.glow(palette.signal, 3), -42, 0, 0);
    part(g, new THREE.SphereGeometry(0.6, 8, 6), kit.glow(palette.glare, 3), 42, 0, 0);
    ships.push({ g, r: half * (0.5 + rand() * 0.5), y: 240 + rand() * 80, a: rand() * Math.PI * 2, speed: 0.008 + rand() * 0.006 });
  }
  const place = (s) => {
    s.g.position.set(Math.cos(s.a) * s.r, s.y, Math.sin(s.a) * s.r);
    s.g.rotation.y = -s.a; // nose along the circle
  };
  ships.forEach(place);
  onFrame((dt) => ships.forEach((s) => {
    s.a += s.speed * dt;
    place(s);
  }));
  return ships.map((s) => s.g);
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
