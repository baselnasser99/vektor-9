// Beyond the simulated grid: a night desert. Dunes rise from the city wall; four highways leave through gates on
// low causeways with lamps and light streams; ruins, half-buried containers, dead pylons and far mesas break it up.
// Decoration only: nothing here is simulated or stored (ADR-0002).
import * as THREE from 'three';
import { palette } from './palette.js';
import { box, cyl, part, rng } from './geometry.js';
import { streetLamp } from './parts.js';
import { mergeByMaterial } from './merge.js';

const REACH = 1900; // metres from the centre to the end of the dunes; fog hides everything past ~1.5 km
const DECK = 6; // causeway height
const ROAD = 40; // half-width of the flat corridor kept around each highway

export function buildDesert(kit, half, onFrame) {
  const root = new THREE.Group(), rand = rng(9001), wall = half + 25;
  // Dune height: flat at the wall, rising over 500 m, flattened along the highway corridors.
  const ramp = (a, b, v) => Math.min(1, Math.max(0, (v - a) / (b - a)));
  const height = (x, z) => {
    const r = Math.max(Math.abs(x), Math.abs(z)), road = Math.min(Math.abs(x), Math.abs(z));
    const dunes = 8 + 7 * Math.sin(x * 0.0045 + 1.3) * Math.cos(z * 0.004) + 4 * Math.sin(x * 0.013 + z * 0.009) + 2 * Math.sin(z * 0.03 - x * 0.011);
    return ramp(wall + 20, wall + 520, r) * ramp(ROAD, ROAD + 60, road) * dunes;
  };

  const ground = new THREE.PlaneGeometry(REACH * 2, REACH * 2, 220, 220).rotateX(-Math.PI / 2);
  const p = ground.attributes.position, uv = ground.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const [x, z] = [p.getX(i), p.getZ(i)];
    p.setY(i, height(x, z) - 0.6);
    uv.setXY(i, x / 20, z / 20);
  }
  ground.computeVertexNormals();
  part(root, ground, kit.concrete(palette.nightSand));

  // City wall with a lit parapet, broken by a gate with two towers where each highway leaves.
  const concrete = kit.concrete(palette.gunmetal), lamp = kit.glow(palette.sodium, 3), red = kit.glow(palette.signal, 3);
  for (const [ax, s] of [['x', 1], ['x', -1], ['z', 1], ['z', -1]]) {
    for (const side of [-1, 1]) {
      const len = wall - 20, mid = side * (20 + len / 2);
      const [x, z, w, d] = ax === 'x' ? [mid, s * wall, len, 2] : [s * wall, mid, 2, len];
      part(root, box(w, 9, d, 0), concrete, x, 4.5, z);
      part(root, box(ax === 'x' ? w : 0.3, 0.3, ax === 'x' ? 0.3 : d, 0), lamp, x, 9.2, z);
      const [gx, gz] = ax === 'x' ? [side * 23, s * wall] : [s * wall, side * 23];
      part(root, box(6, 18, 6, 1), concrete, gx, 9, gz);
      part(root, new THREE.SphereGeometry(0.5, 8, 6), red, gx, 18.6, gz);
    }
  }

  // Highways on causeways from each gate to the horizon, with lamps and light streams.
  const streams = [];
  for (const [ax, sign] of [['z', 1], ['z', -1], ['x', 1], ['x', -1]]) {
    const len = REACH - wall, mid = sign * (wall + len / 2);
    const [x, z, w, d] = ax === 'z' ? [0, mid, 22, len] : [mid, 0, len, 22];
    part(root, box(w, 1.2, d, 0), concrete, x, DECK, z);
    const deck = new THREE.Group();
    deck.position.y = DECK + 0.6;
    root.add(deck);
    for (let t = 25; t < len; t += 50) {
      const at = sign * (wall + t), [px, pz] = ax === 'z' ? [0, at] : [at, 0];
      part(root, box(3, DECK, 3, 0), kit.concrete(palette.slate), px, DECK / 2, pz);
      if (t % 150 === 25) {
        for (const off of [-11, 11]) {
          const [lx, lz] = ax === 'z' ? [off, at] : [at, off];
          streetLamp(kit, deck, lx, lz, ax === 'z' ? (off < 0 ? 0 : Math.PI) : (off < 0 ? -Math.PI / 2 : Math.PI / 2));
        }
      }
    }
    for (const [color, off, dir] of [[palette.glare, -4, 1], [palette.neonRed, 4, -1]]) {
      const mat = streamMaterial(color, ax);
      streams.push([mat.emissiveMap, dir * (ax === 'z' ? 1 : -1), ax]);
      part(root, box(ax === 'z' ? 6 : len, 0.1, ax === 'z' ? len : 6, 0), mat, ax === 'z' ? off : x, DECK + 0.7, ax === 'z' ? z : off);
    }
  }
  // Headlight streams slide along the decks: the texture moves, no geometry does.
  onFrame((dt) => {
    for (const [tex, dir, ax] of streams) tex.offset[ax === 'z' ? 'y' : 'x'] += dir * dt * 0.35;
  });

  // Ruins and wrecks scattered in the sand, kept off the highway corridors.
  const scatter = (rMin, rMax) => {
    for (;;) {
      const [a, r] = [rand() * Math.PI * 2, rMin + rand() * (rMax - rMin)];
      const [x, z] = [Math.cos(a) * r, Math.sin(a) * r];
      if (Math.min(Math.abs(x), Math.abs(z)) > ROAD + 20 && Math.max(Math.abs(x), Math.abs(z)) > wall + 60) return [x, z];
    }
  };
  const metal = kit.mat('rusty_corrugated_iron', palette.slate);
  for (let k = 0; k < 140; k++) {
    const [x, z] = scatter(half + 120, 1300), y = height(x, z);
    const m = rand() < 0.5
      ? part(root, box(6 + rand() * 14, 1 + rand() * 3, 4 + rand() * 8, 0), concrete, x, y, z) // broken slab
      : part(root, box(2.4, 2.6, 12, 0), metal, x, y + 0.2, z); // container, half buried
    m.rotation.set((rand() - 0.5) * 0.5, rand() * Math.PI, (rand() - 0.5) * 0.4);
  }
  // A line of dead power pylons walking off into the dunes, cables sagging between them.
  const steel = kit.steel(palette.charcoal, 0.7);
  let prev;
  for (let k = 0; k < 12; k++) {
    const r = wall + 120 + k * 110, [x, z] = [r * 0.71, -r * 0.71], y = height(x, z);
    part(root, cyl(0.3, 1.6, 30, 4), steel, x, y + 15, z);
    const arm = part(root, box(14, 0.6, 0.6, 0), steel, x, y + 28, z);
    arm.rotation.y = Math.PI / 4;
    const tip = new THREE.Vector3(x, y + 28, z);
    if (prev) {
      const mid = prev.clone().lerp(tip, 0.5);
      mid.y -= 8;
      part(root, new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(prev, mid, tip), 12, 0.08, 4), steel);
    }
    prev = tip;
  }
  // Mesas far out, read as silhouettes through the haze.
  for (let k = 0; k < 10; k++) {
    const [x, z] = scatter(1100, 1600), r = 90 + rand() * 160, h = 60 + rand() * 120;
    part(root, cyl(r, r + 40, h, 9), kit.concrete(palette.charcoal), x, height(x, z) + h / 2 - 5, z).rotation.y = rand();
  }

  const merged = mergeByMaterial(root);
  merged.add(cityGlow(half), cloudDeck(onFrame), ...mist(half, onFrame));
  return merged;
}

// Warm light from the city spilling onto the sand around it, fading out over a few hundred metres.
function cityGlow(half) {
  const canvas = Object.assign(document.createElement('canvas'), { width: 256, height: 256 });
  const g = canvas.getContext('2d'), grad = g.createRadialGradient(128, 128, 40, 128, 128, 128);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(half * 2.6, 64), new THREE.MeshBasicMaterial({
    map: new THREE.CanvasTexture(canvas), color: palette.sodium, transparent: true, opacity: 0.16,
    blending: THREE.AdditiveBlending, depthWrite: false }));
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 1;
  return mesh;
}

// Dashes of light along a lane; one texture repeat covers 64 m of road.
function streamMaterial(color, ax) {
  const along = ax === 'z';
  const canvas = Object.assign(document.createElement('canvas'), { width: along ? 16 : 256, height: along ? 256 : 16 });
  const g = canvas.getContext('2d'), rand = rng(along ? 3 : 4);
  g.fillStyle = '#000';
  g.fillRect(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < 18; i++) {
    const at = rand() * 256, len = 3 + rand() * 5;
    for (const lane of [2, 10]) {
      g.fillStyle = `rgba(255,255,255,${0.5 + rand() * 0.5})`;
      if (along) g.fillRect(lane, at, 4, len);
      else g.fillRect(at, lane, len, 4);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(along ? 1 : 1 / 16, along ? 1 / 16 : 1);
  return new THREE.MeshStandardMaterial({ color: 0x000000, emissive: color, emissiveMap: tex, emissiveIntensity: 1.6 });
}

// Soft blotchy noise in the alpha channel, for clouds and mist.
function noiseTexture(seed, blobs) {
  const S = 512, canvas = Object.assign(document.createElement('canvas'), { width: S, height: S });
  const g = canvas.getContext('2d'), rand = rng(seed);
  for (let i = 0; i < blobs; i++) {
    const [x, y, r, a] = [rand() * S, rand() * S, 40 + rand() * 140, 0.05 + rand() * 0.12];
    for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) {
      const grad = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
      grad.addColorStop(0, `rgba(255,255,255,${a})`);
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.fillRect(x + dx - r, y + dy - r, 2 * r, 2 * r);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// Cloud deck high above, glowing mauve where the city lights it from below; drifts slowly.
function cloudDeck(onFrame) {
  const map = noiseTexture(11, 220);
  map.repeat.set(4, 4);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(REACH * 6, REACH * 6), new THREE.MeshBasicMaterial({
    // One-sided, facing down: seen from below only, so a camera above the deck still sees the city.
    map, color: palette.cloudGlow, transparent: true, opacity: 0.9, depthWrite: false, fog: false }));
  mesh.rotation.x = Math.PI / 2;
  mesh.position.y = 650;
  onFrame((dt) => (map.offset.x += dt * 0.002));
  return mesh;
}

// Two thin layers of mist drifting between the towers.
function mist(half, onFrame) {
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
