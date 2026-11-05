// The air: sky dome, stars, moon, the cloud deck lit by the city, far skylines and cloud banks on the horizon, airships and rain (the mist is in the fog, stage.js).
// All of it is decoration (ADR-0002); rain strength comes from the snapshot so every visitor sees the same weather.
import * as THREE from 'three';
import { palette } from './palette.js';
import { box, part, rng } from './geometry.js';
import { bandTexture, fadeTexture, noiseTexture, radialTexture, skylineTexture } from './textures.js';
import { BRANDS } from './world.js';

// A palette colour as a GLSL vec3 literal, in the renderer's linear working space.
export const glslColor = (c) => `vec3(${new THREE.Color(c).toArray().map((x) => x.toFixed(4)).join(', ')})`;

// The sky's colour toward world direction d (normalized), as GLSL `vec3 skyAt(vec3 d)`: the dome draws it, and the
// fog (stage.js) fades distant things into it, so nothing far stands out against the sky behind it. stops:
// [elevation 0..1, color] up to the zenith, below the horizon the first; glow: light pollution [color, strength],
// a warm haze hugging the horizon over the city, patchy round it, fading out just below the horizon.
export function skyGlsl(stops, [glow, strength]) {
  const mixes = stops.slice(1).map(([e, c], k) => `  c = mix(c, ${glslColor(c)}, smoothstep(${stops[k][0].toFixed(3)}, ${e.toFixed(3)}, e));`);
  // Below the horizon (looking down at the city, most of what the fog covers) it is the first stop and nothing
  // else, so it returns that before the costly part; the result is exactly what the full sum gives there.
  return `vec3 skyAt(vec3 d) {
  vec3 c = ${glslColor(stops[0][1])};
  if (d.y < -0.03) return c;
  float e = clamp(d.y, 0.0, 1.0);
${mixes.join('\n')}
  float a = atan(d.z, d.x), patchy = 0.75 + 0.25 * sin(a * 3.0 + 1.3) * sin(a * 7.0 + 0.4);
  return c + ${glslColor(glow)} * ${strength.toFixed(2)} * patchy * (exp(-e / 0.05) * 0.7 + exp(-e / 0.18) * 0.3) * smoothstep(-0.03, 0.0, d.y);
}`;
}

// Sky dome drawing skyAt (sky: skyGlsl's source) per pixel, so a thin band at the horizon stays smooth. It is
// centred on the camera every time it is drawn, so its horizon is always at eye level: from high up, a dome
// centred on the city put its bright haze band behind the far ground. A faint dither keeps the dark gradient from
// banding.
export function skyDome(sky, radius = 450) {
  const dome = new THREE.Mesh(new THREE.SphereGeometry(radius, 64, 32), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: `varying vec3 vDir;
      void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `varying vec3 vDir;
      ${sky}
      void main() {
        float n = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
        gl_FragColor = vec4(skyAt(normalize(vDir)) + (n - 0.5) / 255.0, 1.0);
      }`,
  }));
  dome.frustumCulled = false;
  dome.onBeforeRender = (renderer, scene, camera) => dome.matrixWorld.copyPosition(camera.matrixWorld);
  return dome;
}

// Two thin, streaky cloud decks high above, drifting slowly opposite ways: the lower one warm grey where the city's
// light catches it from below, the higher one blue-grey haze. Patchy, so a few stars and the moon's glow show
// through the gaps. Returns both meshes.
export function cloudDeck(size, onFrame) {
  return [[650, palette.cityGlow, 0.45, 11, 4, 0.002], [950, palette.smogHaze, 0.35, 12, 2.5, -0.0013]].map(([y, color, opacity, seed, repeat, drift]) => {
    const map = noiseTexture(seed, 160, 0.3); // flattened blobs: layered streaks, not puffs
    map.repeat.set(repeat, repeat * 1.6);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({
      // One-sided, facing down: seen from below only, so a camera above the decks still sees the city.
      // alphaMap has its own (unrepeated) UVs: a deck thins out toward its edge instead of ending in a hard line.
      map, alphaMap: fadeTexture(0.3), color, transparent: true, opacity, depthWrite: false, fog: false }));
    mesh.rotation.x = Math.PI / 2;
    mesh.position.y = y;
    onFrame((dt) => (map.offset.x += dt * drift));
    return mesh;
  });
}

// A few stars through the smog, drawn behind everything so clouds pass in front of them: sparse, of uneven
// brightness, and gone toward the bright, polluted horizon (they fade in from about 20 degrees up).
export function stars(radius) {
  const rand = rng(404), pos = [], colors = [], c = new THREE.Color();
  for (let i = 0; i < 500; i++) {
    const [a, e] = [rand() * Math.PI * 2, 0.25 + Math.asin(rand()) * 1.2];
    pos.push(Math.cos(a) * Math.cos(e) * radius, Math.sin(e) * radius, Math.sin(a) * Math.cos(e) * radius);
    const fade = Math.min(1, Math.max(0, (e - 0.3) / 0.6)) * (0.25 + 0.75 * rand() ** 2);
    c.set(palette.glare).multiplyScalar(fade);
    colors.push(c.r, c.g, c.b);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const points = new THREE.Points(geo, new THREE.PointsMaterial({ vertexColors: true, size: 1.4, sizeAttenuation: false,
    transparent: true, opacity: 0.6, fog: false, depthWrite: false }));
  points.renderOrder = -3;
  return points;
}

// Direction to the moon; stage.js shines the moonlight from here.
export const MOON = new THREE.Vector3(-25, 45, -30).normalize();

// The moon as a soft glow and a small bright core, in the moonlight's direction.
export function moon(radius) {
  const dir = MOON.clone().multiplyScalar(radius);
  return [[900, palette.moon, 0.3], [160, palette.glare, 0.85]].map(([size, color, opacity]) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTexture(256, size > 500 ? 0 : 60), color, transparent: true,
      opacity, fog: false, depthWrite: false }));
    s.position.copy(dir);
    s.scale.setScalar(size);
    s.renderOrder = -3;
    return s;
  });
}

// The horizon, so the band between the ground haze and the cloud deck is not empty: low grey smog banks lit by the
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
      color: palette.smogCloud, opacity: 0.6 }), -2),
    ring(radius * 0.8, 400, 170, new THREE.MeshBasicMaterial({ ...flat, map: skyline }), -1),
  ];
}

// Two airships circling slowly above the towers, each with an ad on both flanks (one of the billboards' brands,
// world.js BRANDS) and steady nav lights. The hull is weathered light metal, rough, with two darker bands, so seen
// nose-on against the bright haze it reads as a vessel, not a dark disc with the sky reflected in it.
export function airships(kit, half, onFrame) {
  const rand = rng(61), ships = [], skin = kit.steel(palette.weatheredTitanium, 0.85), band = kit.steel(palette.gunmetal, 0.8);
  for (let k = 0; k < 2; k++) {
    const g = new THREE.Group(), brand = BRANDS[Math.floor(rand() * BRANDS.length)]; // one draw, as the old ad word: same flight paths
    part(g, new THREE.SphereGeometry(1, 24, 12), skin).scale.set(42, 11, 11);
    for (const x of [-16, 16]) { // bands round the hull, a hair proud of it
      const r = 11.15 * Math.sqrt(1 - (x / 42) ** 2);
      part(g, new THREE.SphereGeometry(1, 24, 12), band, x, 0, 0).scale.set(2, r, r);
    }
    part(g, box(10, 2.5, 3, 0), kit.steel(palette.gunmetal), 0, -11.5, 0);
    part(g, box(7, 0.5, 3.05, 0), kit.glow(palette.agedAmber, 0.8), 0, -11.3, 0); // the gondola's windows
    for (const side of [-1, 1]) part(g, box(28, 6, 0.3, 0), kit.poster(...brand, 512, 110), 0, 0, side * 10.4);
    part(g, new THREE.SphereGeometry(0.6, 8, 6), kit.warning(), -42, 0, 0);
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
