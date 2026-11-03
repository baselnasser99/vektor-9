// Beyond the simulated grid: a night desert. Dunes rise from the city wall; four highways leave through gates on
// low causeways with lamps and light streams; ruins, half-buried containers, dead pylons and far mesas break it up.
// Decoration only: nothing here is simulated or stored (ADR-0002).
import * as THREE from 'three';
import { palette } from './palette.js';
import { box, cyl, part, rng } from './geometry.js';
import { streetLamp } from './parts.js';
import { mergeByMaterial } from './merge.js';
import { dashTexture, radialTexture } from './textures.js';

export const REACH = 1900; // metres from the centre to the end of the dunes; fog hides everything past ~1.5 km
const DECK = 6; // causeway height
const ROAD = 40; // half-width of the flat corridor kept around each highway
const SIDES = [['x', 1], ['x', -1], ['z', 1], ['z', -1]];

export function buildDesert(kit, half, onFrame) {
  const root = new THREE.Group(), rand = rng(9001), wall = half + 25;
  const height = duneHeight(wall);
  // A random spot in a ring around the centre, off the highway corridors and clear of the wall.
  const scatter = (rMin, rMax) => {
    for (;;) {
      const [a, r] = [rand() * Math.PI * 2, rMin + rand() * (rMax - rMin)];
      const [x, z] = [Math.cos(a) * r, Math.sin(a) * r];
      if (Math.min(Math.abs(x), Math.abs(z)) > ROAD + 20 && Math.max(Math.abs(x), Math.abs(z)) > wall + 60) return [x, z];
    }
  };
  dunes(kit, root, height);
  cityWall(kit, root, wall);
  highways(kit, root, wall, onFrame);
  ruins(kit, root, half, height, scatter, rand);
  pylons(kit, root, wall, height);
  mesas(kit, root, height, scatter, rand);
  const merged = mergeByMaterial(root);
  merged.add(cityGlow(half));
  return merged;
}

// Dune height: flat at the wall, rising over 500 m, flattened along the highway corridors.
function duneHeight(wall) {
  const ramp = (a, b, v) => Math.min(1, Math.max(0, (v - a) / (b - a)));
  return (x, z) => {
    const r = Math.max(Math.abs(x), Math.abs(z)), road = Math.min(Math.abs(x), Math.abs(z));
    const dunes = 8 + 7 * Math.sin(x * 0.0045 + 1.3) * Math.cos(z * 0.004) + 4 * Math.sin(x * 0.013 + z * 0.009) + 2 * Math.sin(z * 0.03 - x * 0.011);
    return ramp(wall + 20, wall + 520, r) * ramp(ROAD, ROAD + 60, road) * dunes;
  };
}

function dunes(kit, root, height) {
  const ground = new THREE.PlaneGeometry(REACH * 2, REACH * 2, 220, 220).rotateX(-Math.PI / 2);
  const p = ground.attributes.position, uv = ground.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const [x, z] = [p.getX(i), p.getZ(i)];
    p.setY(i, height(x, z) - 0.6);
    uv.setXY(i, x / 20, z / 20);
  }
  ground.computeVertexNormals();
  part(root, ground, kit.concrete(palette.nightSand));
}

// City wall with a lit parapet, broken by a gate with two towers where each highway leaves.
function cityWall(kit, root, wall) {
  const concrete = kit.concrete(palette.gunmetal), lamp = kit.glow(palette.sodium, 3), red = kit.glow(palette.signal, 3);
  for (const [ax, s] of SIDES) {
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
}

// Highways on causeways from each gate to the horizon, with lamps every 150 m and sliding light streams.
function highways(kit, root, wall, onFrame) {
  const concrete = kit.concrete(palette.gunmetal), streams = [];
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
      if (t % 150 !== 25) continue;
      for (const off of [-11, 11]) {
        const [lx, lz] = ax === 'z' ? [off, at] : [at, off];
        streetLamp(kit, deck, lx, lz, ax === 'z' ? (off < 0 ? 0 : Math.PI) : (off < 0 ? -Math.PI / 2 : Math.PI / 2));
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
}

// Light dashes along a lane; one texture repeat covers 64 m of road.
function streamMaterial(color, ax) {
  const along = ax === 'z', tex = dashTexture(along);
  tex.repeat.set(along ? 1 : 1 / 16, along ? 1 / 16 : 1);
  return new THREE.MeshStandardMaterial({ color: 0x000000, emissive: color, emissiveMap: tex, emissiveIntensity: 1.6 });
}

// Broken slabs and half-buried containers scattered in the sand.
function ruins(kit, root, half, height, scatter, rand) {
  const concrete = kit.concrete(palette.gunmetal), metal = kit.mat('rusty_corrugated_iron', palette.slate);
  for (let k = 0; k < 140; k++) {
    const [x, z] = scatter(half + 120, 1300), y = height(x, z);
    const m = rand() < 0.5
      ? part(root, box(6 + rand() * 14, 1 + rand() * 3, 4 + rand() * 8, 0), concrete, x, y, z)
      : part(root, box(2.4, 2.6, 12, 0), metal, x, y + 0.2, z);
    m.rotation.set((rand() - 0.5) * 0.5, rand() * Math.PI, (rand() - 0.5) * 0.4);
  }
}

// A line of dead power pylons walking off into the dunes, cables sagging between them.
function pylons(kit, root, wall, height) {
  const steel = kit.steel(palette.charcoal, 0.7);
  let prev;
  for (let k = 0; k < 12; k++) {
    const r = wall + 120 + k * 110, [x, z] = [r * 0.71, -r * 0.71], y = height(x, z);
    part(root, cyl(0.3, 1.6, 30, 4), steel, x, y + 15, z);
    part(root, box(14, 0.6, 0.6, 0), steel, x, y + 28, z).rotation.y = Math.PI / 4;
    const tip = new THREE.Vector3(x, y + 28, z);
    if (prev) {
      const mid = prev.clone().lerp(tip, 0.5);
      mid.y -= 8;
      part(root, new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(prev, mid, tip), 12, 0.08, 4), steel);
    }
    prev = tip;
  }
}

// Mesas far out, read as silhouettes through the haze.
function mesas(kit, root, height, scatter, rand) {
  for (let k = 0; k < 10; k++) {
    const [x, z] = scatter(1100, 1600), r = 90 + rand() * 160, h = 60 + rand() * 120;
    part(root, cyl(r, r + 40, h, 9), kit.concrete(palette.charcoal), x, height(x, z) + h / 2 - 5, z).rotation.y = rand();
  }
}

// Warm light from the city spilling onto the sand around it, fading out over a few hundred metres.
function cityGlow(half) {
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(half * 2.6, 64), new THREE.MeshBasicMaterial({
    map: radialTexture(256, 40), color: palette.sodium, transparent: true, opacity: 0.16,
    blending: THREE.AdditiveBlending, depthWrite: false }));
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 1;
  return mesh;
}
