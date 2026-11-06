// The air: sky dome, stars, moon, the cloud deck lit by the city, far skylines and cloud banks on the horizon, airships and rain (the mist is in the fog, stage.js).
// All of it is decoration (ADR-0002); rain strength comes from the snapshot so every visitor sees the same weather.
import * as THREE from 'three';
import { palette } from './palette.js';
import { box, part, rng } from './geometry.js';
import { bandTexture, fadeTexture, noiseTexture, radialTexture, skylineTexture, smogBankTexture } from './textures.js';
import { BRANDS } from './world.js';

// A palette colour as a GLSL vec3 literal, in the renderer's linear working space.
export const glslColor = (c) => `vec3(${new THREE.Color(c).toArray().map((x) => x.toFixed(4)).join(', ')})`;

// The sky's colour toward world direction d (normalized), as GLSL `vec3 skyAt(vec3 d)`: the dome draws it, and the
// fog (stage.js) fades distant things into it, so nothing far stands out against the sky behind it. stops:
// [elevation 0..1, color] from the horizon up; haze: what fog fades to looking down across the city; smog: the
// colour the haze turns into toward the horizon, lying over the lowest sky with a ragged top (a few incommensurate
// waves round the horizon, so it is never one flat line); crimson: a glow on the horizon, strong over some
// stretches and weak over others; glow: light pollution [color, strength], patchy round the
// horizon. A faint darker smoke layer sits over the smog. Storm clouds are added by the dome only (skyDome), so
// every material's fog keeps this cheap version.
// Also `vec3 hazeAt(vec3 d, float depth)`, what fog fades to: the sky, but below the horizon it turns from the cold
// haze to far: [color, from, to metres] with distance, so near things stay cool and far ones go red-violet. It lets
// go of that just above where the smog starts, so the horizon itself is the sky's. The dome passes a huge depth.
export function skyGlsl(stops, { haze, smog, crimson, glow: [glow, strength], far: [far, from, to] }) {
  const mixes = stops.slice(1).map(([e, c], k) => `  c = mix(c, ${glslColor(c)}, smoothstep(${stops[k][0].toFixed(3)}, ${e.toFixed(3)}, e));`);
  // Below the horizon (looking down at the city, most of what the fog covers) it is the cold haze, warming to smog
  // only in the last few degrees before the horizon, so the glow sits behind the far skyline and the city in front
  // stays blue; where that warming starts wanders with direction (two cheap waves, no atan), so it is never one
  // even line. It returns that before the costly part; the full sum gives exactly that there.
  return `vec3 skyAt(vec3 d) {
  vec3 smog = ${glslColor(smog)};
  if (d.y < -0.03) return mix(${glslColor(haze)}, smog,
    smoothstep(-0.085 + 0.012 * sin(d.x * 53.0 + 0.4) * sin(d.z * 41.0 + 1.3), -0.03, d.y));
  float e = clamp(d.y, 0.0, 1.0), a = atan(d.z, d.x);
  vec3 c = ${glslColor(stops[0][1])};
${mixes.join('\n')}
  float rag = sin(a * 5.0 + 1.0) * sin(a * 13.0 + 2.0) + 0.5 * sin(a * 29.0 + 0.3);
  c *= 1.0 - 0.15 * exp(-(e - 0.07) * (e - 0.07) / 0.0016);
  c = mix(c, smog, 1.0 - smoothstep(0.0, 0.04 + 0.014 * rag, e));
  float rust = 0.5 + 0.5 * (sin(a * 2.0 + 0.7) * 0.7 + sin(a * 5.0 + 2.1) * 0.3);
  float patchy = 0.75 + 0.25 * sin(a * 3.0 + 1.3) * sin(a * 7.0 + 0.4), low = smoothstep(-0.03, 0.0, d.y);
  return c + (${glslColor(crimson)} * 0.7 * rust * (exp(-e / 0.012) * 0.6 + exp(-e / 0.04) * 0.4)
    + ${glslColor(glow)} * ${strength.toFixed(2)} * patchy * (exp(-e / 0.05) * 0.6 + exp(-e / 0.2) * 0.4)) * low;
}
vec3 hazeAt(vec3 d, float depth) {
  return mix(skyAt(d), ${glslColor(far)}, smoothstep(${from.toFixed(1)}, ${to.toFixed(1)}, depth) * (1.0 - smoothstep(-0.1, -0.05, d.y)));
}`;
}

// Sky dome drawing skyAt (sky: skyGlsl's source) per pixel, so a thin band at the horizon stays smooth. It is
// centred on the camera every time it is drawn, so its horizon is always at eye level: from high up, a dome
// centred on the city put its bright haze band behind the far ground. A faint dither keeps the dark gradient from
// banding. Over the sky, two cloud layers from one noise texture:
// - massive storm clouds projected onto a flat layer (so they crowd toward the horizon in perspective), the field
//   bent by a large slow noise so the formations sweep instead of sitting in blobs, their opacity varied by another
//   large noise (thin veils beside solid banks); dense cores near-black violet, thin edges lit blood red, more so
//   toward the horizon, and patches of crimson glowing inside them;
// - low streaks across the horizon, stretched sideways (azimuth and elevation, not the flat layer), blood red,
//   thinning out by about 8 degrees up.
// Both stay clear of the smog band so the skyline keeps its glow, and drift slowly.
export function skyDome(sky, radius = 450) {
  const noise = noiseTexture(21, 160, 0.8), start = performance.now();
  const uniforms = { uNoise: { value: noise }, uTime: { value: 0 } };
  const dome = new THREE.Mesh(new THREE.SphereGeometry(radius, 64, 32), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms,
    vertexShader: `varying vec3 vDir;
      void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `varying vec3 vDir;
      uniform sampler2D uNoise;
      uniform float uTime;
      ${sky}
      void main() {
        vec3 d = normalize(vDir), c = hazeAt(d, 1e6);
        if (d.y > 0.015) {
          // The noise's alpha runs about 0.3 to 0.75 (median 0.55); cuts near the median give about half cover.
          vec2 p = d.xz / (d.y + 0.08), drift = vec2(uTime * 0.004, 0.0);
          vec2 bend = vec2(texture2D(uNoise, p * 0.08 + drift * 0.2).a, texture2D(uNoise, p * 0.08 + vec2(0.37, 0.61)).a);
          vec2 q = p + (bend - 0.55) * 4.0;
          float n = texture2D(uNoise, q * 0.35 + drift).a * 0.7
            + texture2D(uNoise, q * 1.2 - drift * 1.7).a * 0.3;
          float body = texture2D(uNoise, p * 0.05 + vec2(0.71, 0.13) + drift * 0.1).a;
          float ember = texture2D(uNoise, q * 0.18 + vec2(0.29, 0.83) - drift * 0.5).a;
          float fade = smoothstep(0.015, 0.07, d.y), low = exp(-d.y / 0.08), core = smoothstep(0.58, 0.7, n);
          vec3 edge = mix(${glslColor(palette.stormCloud)}, ${glslColor(palette.stormLit)}, 0.3 + 0.7 * low);
          vec3 cloud = mix(edge, ${glslColor(palette.stormCloud)} * 0.45, core)
            + ${glslColor(palette.cloudEmber)} * smoothstep(0.56, 0.7, ember) * (1.0 - core * 0.6) * (0.5 + 0.5 * low);
          c = mix(c, cloud, smoothstep(0.5, 0.6, n) * fade * mix(0.5, 0.95, smoothstep(0.45, 0.65, body)));
          float a = atan(d.z, d.x);
          float s = texture2D(uNoise, vec2(a * 0.8 + uTime * 0.0008, d.y * 14.0)).a;
          float band = smoothstep(0.015, 0.03, d.y) * (1.0 - smoothstep(0.06, 0.14, d.y));
          c = mix(c, ${glslColor(palette.bloodCloud)}, smoothstep(0.55, 0.68, s) * band * 0.7);
        }
        float n = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
        gl_FragColor = vec4(c + (n - 0.5) / 255.0, 1.0);
      }`,
  }));
  dome.frustumCulled = false;
  dome.onBeforeRender = (renderer, scene, camera) => {
    dome.matrixWorld.copyPosition(camera.matrixWorld);
    uniforms.uTime.value = (performance.now() - start) / 1000;
  };
  return dome;
}

// Two thin, streaky cloud decks high above, drifting slowly opposite ways: the lower one dirty brown-grey smog, the
// higher one blue-grey haze. Patchy, so a few stars and the moon's glow show
// through the gaps. Returns both meshes.
export function cloudDeck(size, onFrame) {
  return [[650, palette.smogCloud, 0.45, 11, 4, 0.002], [950, palette.smogHaze, 0.35, 12, 2.5, -0.0013]].map(([y, color, opacity, seed, repeat, drift]) => {
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
  // Low lumpy smog in front of the skylines, drifting the other way: its ragged top breaks the line where the far
  // ground meets the sky and buries the feet of the far cities.
  const smog = smogBankTexture();
  smog.repeat.set(6, 1);
  onFrame((dt) => (smog.offset.x -= dt * 0.0004));
  const flat = { transparent: true, depthWrite: false, fog: false, side: THREE.BackSide };
  return [
    ring(radius * 0.95, 1000, 450, new THREE.MeshBasicMaterial({ ...flat, map: clouds, alphaMap: bandTexture(),
      color: palette.smogCloud, opacity: 0.6 }), -2),
    // Partly see-through, so the far cities sit in the haze instead of standing sharp against the smog.
    ring(radius * 0.8, 400, 170, new THREE.MeshBasicMaterial({ ...flat, map: skyline, opacity: 0.65 }), -1),
    ring(radius * 0.78, 300, 70, new THREE.MeshBasicMaterial({ ...flat, map: smog, color: palette.burntSmog }), -0.5), // after the skylines, which it sits in front of
  ];
}

// Light pollution over the densest districts: a faint, broad glow in the low smog above the two most industrial
// sectors (power plants, old works) and the two most commercial (markets, tall floors), rusty red and dirty amber
// over industry, cold off-white and amber over commerce. Additive and dim, so it brightens the smog without beams
// or bloom; one sprite each. Positions ignore the district warp, which moves blocks far less than a glow's size.
// A glow fades out as the camera comes within a few hundred metres, since from inside it would only wash the view.
export function districtGlows(snap, { n, pos }, camera, onFrame) {
  const S = n / 8, sectors = [];
  for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) {
    let industry = 0, commerce = 0;
    for (let y = sy * 8; y < sy * 8 + 8; y++) for (let x = sx * 8; x < sx * 8 + 8; x++) {
      const t = snap.tiles[y * n + x];
      industry += t.k === 'plant' ? 4 : t.k === 'works' ? 1 : 0;
      commerce += t.k === 'market' ? 3 : t.f / 20;
    }
    sectors.push({ x: (pos(sx * 8) + pos(sx * 8 + 7)) / 2, z: (pos(sy * 8) + pos(sy * 8 + 7)) / 2, industry, commerce });
  }
  const top = (key) => [...sectors].sort((p, q) => q[key] - p[key]);
  const ind = top('industry').slice(0, 2), com = top('commerce').filter((s) => !ind.includes(s)).slice(0, 2);
  const map = radialTexture(128);
  const glows = [[ind[0], palette.glowRust], [ind[1], palette.glowAmber], [com[0], palette.glowOffWhite], [com[1], palette.glowAmber]]
    .filter(([s]) => s).map(([s, color]) => {
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map, color, transparent: true, opacity: 0.14,
        blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      glow.position.set(s.x, 150, s.z);
      glow.scale.set(700, 260, 1);
      return glow;
    });
  onFrame(() => glows.forEach((g) => {
    const near = THREE.MathUtils.smoothstep(g.position.distanceTo(camera.position), 350, 800);
    g.material.opacity = 0.14 * near;
    g.visible = near > 0;
  }));
  return glows;
}

// Two airships circling slowly above the towers, each with an ad on both flanks (one of the billboards' brands,
// world.js BRANDS), steady nav lights and two faint cyan rings. The hull is weathered light metal, rough, with two darker bands, so seen
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
    for (const x of [-30, 30]) { // faint cyan light rings toward nose and tail
      const r = 11.2 * Math.sqrt(1 - (x / 42) ** 2);
      part(g, new THREE.SphereGeometry(1, 24, 12), kit.glow(palette.neonCyan, 1.6), x, 0, 0).scale.set(0.3, r, r);
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
