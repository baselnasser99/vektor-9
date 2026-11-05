// Beyond the simulated grid: the city ends at a wasteland of packed dirt fading into sand and dunes, with boulders,
// scrub, abandoned cars, scrapyards and half-buried containers. Streets carry on as dirt tracks; four highways ramp
// up from the city edge onto causeways across the desert. Dead pylons and far mesas break up the dunes.
// Decoration only: nothing here is simulated or stored (ADR-0002).
import * as THREE from 'three';
import { palette } from './palette.js';
import { box, cyl, part, rng } from './geometry.js';
import { pick } from './world.js';
import { streetLamp } from './parts.js';
import { mergeByMaterial } from './merge.js';
import { radialTexture } from './textures.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

export const REACH = 1900; // metres from the centre to the end of the dunes; fog hides everything past ~1.5 km
const SPRAWL = 420; // depth of the flat ring of packed dirt around the city, before the dunes rise
const DECK = 6; // causeway height
const RAMP = 60; // length of the climb from street level to the causeway
const ROAD = 40; // half-width of the flat corridor kept around each highway

// edge: distance from the centre to the outer side of the city's ring road. lines: street centre lines.
export function buildDesert(kit, edge, lines, onFrame) {
  const root = new THREE.Group(), rand = rng(9001);
  const height = duneHeight(edge);
  ground(kit, root, edge, height);
  sandDrifts(root, edge, rand);
  dirtTracks(kit, root, edge, lines);
  highways(kit, root, edge);
  wastes(kit, root, edge, lines, height, rand);
  pylons(kit, root, edge, height);
  mesas(kit, root, edge, height, rand);
  return mergeByMaterial(root);
}

// The city's traffic lanes carried on out of town to the edge of the world, so cars come and go in the fog rather
// than appearing at the city edge: the boulevard's up the ramps and along the highways, every other street's along
// its dirt track, over the ground. Cars per lane grow with its length (fewer out there: nothing holds them up).
export function outOfTown(lanes, edge) {
  const height = duneHeight(edge), deck = DECK + 0.6;
  for (const lane of lanes) {
    const s = Math.sign(lane.to - lane.from), road = Math.abs(lane.c) < 1, base = lane.y;
    lane.cars = Math.round(lane.cars * (1 + (0.6 * (2 * REACH - Math.abs(lane.to - lane.from))) / Math.abs(lane.to - lane.from)));
    [lane.from, lane.to] = [-s * REACH, s * REACH];
    lane.lift = road
      ? (along) => base + deck * Math.min(1, Math.max(0, (Math.abs(along) - edge) / RAMP))
      : (along) => base + (Math.abs(along) > edge ? height(...(lane.axis === 'x' ? [along, lane.at] : [lane.at, along])) : 0);
  }
  return lanes;
}

// Dune height: flat through the sprawl, rising over 500 m beyond it, flattened along the highway corridors.
export function duneHeight(edge) {
  const ramp = (a, b, v) => Math.min(1, Math.max(0, (v - a) / (b - a)));
  return (x, z) => {
    const r = Math.max(Math.abs(x), Math.abs(z)), road = Math.min(Math.abs(x), Math.abs(z));
    const dunes = 8 + 7 * Math.sin(x * 0.0045 + 1.3) * Math.cos(z * 0.004) + 4 * Math.sin(x * 0.013 + z * 0.009) + 2 * Math.sin(z * 0.03 - x * 0.011);
    return ramp(edge + SPRAWL, edge + SPRAWL + 500, r) * ramp(ROAD, ROAD + 60, road) * dunes;
  };
}

// Ground colored per vertex: packed dark dirt by the city, fading over a ragged line into moonlit sand, with warm
// city light spilling onto it. Distances are square (like the city), so the glow hugs the edge evenly.
function ground(kit, root, edge, height) {
  const geo = new THREE.PlaneGeometry(REACH * 2, REACH * 2, 240, 240).rotateX(-Math.PI / 2);
  const p = geo.attributes.position, uv = geo.attributes.uv, colors = [];
  const [dirt, sand, c] = [new THREE.Color(palette.gunmetal).lerp(new THREE.Color(palette.nightSand), 0.35), new THREE.Color(palette.nightSand), new THREE.Color()];
  const glow = new THREE.Color(palette.sodium);
  for (let i = 0; i < p.count; i++) {
    const [x, z] = [p.getX(i), p.getZ(i)], r = Math.max(Math.abs(x), Math.abs(z));
    const ragged = 60 * Math.sin(x * 0.011) * Math.cos(z * 0.013) + 30 * Math.sin((x + z) * 0.031);
    const t = Math.min(1, Math.max(0, (r - edge - 120 + ragged) / 260));
    c.copy(dirt).lerp(sand, t).lerp(glow, 0.35 * Math.max(0, 1 - (r - edge) / 500) ** 2);
    colors.push(c.r, c.g, c.b);
    p.setY(i, height(x, z) - 0.12);
    uv.setXY(i, x / 20, z / 20);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mat = kit.concrete(palette.glare).clone();
  mat.vertexColors = true;
  part(root, geo, mat);
  // Flat sand on out past the horizon, just under the dunes: from high up the eye sees beyond the dunes' edge, and
  // without it the sky dome's underside showed through as a dark patch. Fully fogged out there, so no seam.
  part(root, new THREE.PlaneGeometry(12000, 12000).rotateX(-Math.PI / 2), kit.concrete(palette.nightSand), 0, -3, 0);
}

// Sand blown onto the outer edge of the asphalt, so the city's road surface has no clean border.
function sandDrifts(root, edge, rand) {
  const drift = new THREE.MeshStandardMaterial({ map: radialTexture(128), color: palette.nightSand, transparent: true, opacity: 0.55,
    roughness: 1, depthWrite: false });
  for (let k = 0; k < 160; k++) {
    const side = Math.floor(rand() * 4), along = (rand() - 0.5) * 2 * edge, out = edge + 20 - rand() * 50, r = 8 + rand() * 22;
    const [x, z] = [[out, along], [-out, along], [along, out], [along, -out]][side];
    const m = part(root, new THREE.CircleGeometry(r, 16), drift, x, 0.03 + k * 0.0005, z);
    m.rotation.x = -Math.PI / 2;
    m.scale.set(1, 0.5 + rand(), 1);
    m.receiveShadow = true;
  }
}

// Every city street carries on out of town as a dirt track (the centre ones become highways instead), narrowing
// and breaking up as it goes, so it wears out into the sand rather than stopping at a line.
function dirtTracks(kit, root, edge, lines) {
  const track = kit.concrete(palette.gunmetal), len = SPRAWL + 80, PIECE = 20, rand = rng(4242);
  for (const c of lines) {
    if (Math.abs(c) < 1) continue;
    for (const s of [-1, 1]) {
      for (let v = 0; v < len; v += PIECE) {
        const t = v / len;
        if (rand() < t * t) continue; // gaps, more of them further out
        const w = 10 - 6 * t + (rand() - 0.5) * 1.5, mid = s * (edge + v + PIECE / 2), wobble = (rand() - 0.5) * 2 * t;
        part(root, box(w, 0.04, PIECE + 0.5, 0), track, c + wobble, -0.08, mid);
        part(root, box(PIECE + 0.5, 0.04, w, 0), track, mid, -0.08, c + wobble);
      }
    }
  }
}

// Highways climb from the city's ring road onto causeways and run to the horizon, with lamps every 150 m. They
// carry the boulevard's three lanes each way (outOfTown).
const WIDE = 30;
function highways(kit, root, edge) {
  const concrete = kit.concrete(palette.gunmetal), slope = Math.atan2(DECK, RAMP);
  for (const [ax, sign] of [['z', 1], ['z', -1], ['x', 1], ['x', -1]]) {
    const start = edge + RAMP, len = REACH - start, mid = sign * (start + len / 2);
    const along = (v) => (ax === 'z' ? [0, v] : [v, 0]);
    const [rx, rz] = along(sign * (edge + RAMP / 2));
    const ramp = part(root, box(ax === 'z' ? WIDE : RAMP + 1, 1.2, ax === 'z' ? RAMP + 1 : WIDE, 0), concrete, rx, DECK / 2 - 0.3, rz);
    if (ax === 'z') ramp.rotation.x = -sign * slope;
    else ramp.rotation.z = sign * slope;
    const [x, z] = along(mid);
    part(root, box(ax === 'z' ? WIDE : len, 1.2, ax === 'z' ? len : WIDE, 0), concrete, x, DECK, z);
    const deck = new THREE.Group();
    deck.position.y = DECK + 0.6;
    root.add(deck);
    for (let t = 25; t < len; t += 50) {
      const [px, pz] = along(sign * (start + t));
      part(root, box(3, DECK, 3, 0), kit.concrete(palette.slate), px, DECK / 2, pz);
      if (t % 150 !== 25) continue;
      for (const off of [-WIDE / 2, WIDE / 2]) {
        const [lx, lz] = ax === 'z' ? [off, pz] : [px, off];
        streetLamp(kit, deck, lx, lz, ax === 'z' ? (off < 0 ? 0 : Math.PI) : (off < 0 ? -Math.PI / 2 : Math.PI / 2));
      }
    }
  }
}

// The wasteland, densest by the city and thinning outward: boulders and dry scrub everywhere, abandoned cars and
// trucks along the tracks and in a few scrapyards, tyre piles, drums, half-buried containers, and the odd barrel fire.
// Everything sits low and a little sunk into the ground, so nothing floats on a dune.
function wastes(kit, root, edge, lines, height, rand) {
  const rock = kit.concrete(palette.charcoal), dust = kit.concrete(palette.nightSand), rust = kit.mat('rusty_painted_metal', palette.slate);
  const hulls = [palette.gunmetal, palette.brick, palette.slate, palette.roseGrey].map((c) => kit.mat('rusty_painted_metal', c));
  const tyre = kit.steel(palette.charcoal, 0.9), container = kit.mat('rusty_corrugated_iron', palette.brick);
  // The stone with its corners shared (61 vertices, not 108): the same stone for less vertex work, thousands of times.
  const stone = mergeVertices(new THREE.DodecahedronGeometry(1, 0), 1e-6), drum = cyl(0.3, 0.3, 0.9, 8), ring = new THREE.TorusGeometry(0.45, 0.2, 5, 10);
  const tracks = lines.filter((c) => Math.abs(c) > 1); // the centre lines are highways, not tracks
  const fire = new THREE.SpriteMaterial({ map: radialTexture(64), color: palette.sodium, transparent: true, opacity: 0.6,
    blending: THREE.AdditiveBlending, depthWrite: false });
  // A spot `out` metres beyond the city edge, off the highway corridors; with its ground height.
  const spot = (out) => {
    for (;;) {
      const [a, r] = [rand() * Math.PI * 2, edge + 15 + out];
      const k = Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a))); // square city: push the ring out to its corners
      const [x, z] = [(Math.cos(a) / k) * r, (Math.sin(a) / k) * r];
      const onTrack = tracks.some((c) => Math.abs(x - c) < 9 || Math.abs(z - c) < 9); // cars drive these (outOfTown)
      if (Math.min(Math.abs(x), Math.abs(z)) > ROAD && !onTrack) return [x, height(x, z), z];
    }
  };
  const near = () => spot(rand() ** 2 * 1100); // most things close in

  const wreck = (g, long) => {
    const [l, h, w] = long ? [8 + rand() * 3, 2.4, 2.5] : [4.2, 0.9, 1.9], hull = pick(rand, hulls);
    part(g, box(l, h, w, 1), hull, 0, h / 2 + 0.3, 0);
    part(g, box(long ? 2.2 : l * 0.5, long ? 1 : 0.7, w * 0.9, 1), hull, long ? l / 2 - 1.1 : -0.2, h + 0.3 + (long ? 0.5 : 0.35), 0);
    for (const [x, z] of [[l * 0.32, w / 2], [-l * 0.32, w / 2], [l * 0.32, -w / 2]]) if (rand() < 0.6) part(g, ring, tyre, x, 0.35, z);
  };
  const place = (g, [x, y, z], sink = 0.3) => {
    g.position.set(x, y - sink, z);
    g.rotation.set((rand() - 0.5) * 0.12, rand() * Math.PI * 2, (rand() - 0.5) * 0.12);
    root.add(g);
    return g;
  };

  for (let k = 0; k < 1100; k++) { // boulders, often in clusters of two or three
    const [x, y, z] = spot(rand() ** 1.6 * 1250);
    for (let j = 0; j < 1 + Math.floor(rand() * 3); j++) {
      const r = 0.6 + rand() ** 3 * 5, m = part(root, stone, rand() < 0.6 ? rock : dust, x + j * r * 1.4, y + r * 0.25, z + (rand() - 0.5) * r * 2);
      m.scale.set(r, r * (0.45 + rand() * 0.4), r * (0.7 + rand() * 0.6));
      m.rotation.set(rand(), rand() * Math.PI, rand());
    }
  }
  for (let k = 0; k < 1600; k++) { // dry scrub, low and flat
    const [x, y, z] = spot(rand() ** 1.5 * 700), m = part(root, stone, rock, x, y + 0.15, z);
    m.scale.set(0.8 + rand(), 0.35, 0.8 + rand());
    m.castShadow = false;
  }
  for (let k = 0; k < 220; k++) { // abandoned cars along the dirt tracks
    const c = pick(rand, tracks), s = rand() < 0.5 ? -1 : 1, along = s * (edge + 20 + rand() ** 1.5 * 480), side = (rand() < 0.5 ? -1 : 1) * (8 + rand() * 4); // clear of the lanes
    const at = rand() < 0.5 ? [c + side, 0, along] : [along, 0, c + side];
    at[1] = height(at[0], at[2]);
    const g = new THREE.Group();
    wreck(g, rand() < 0.15);
    place(g, at);
    if (rand() < 0.15) g.rotation.z = Math.PI; // flipped on its roof
  }
  for (let k = 0; k < 10; k++) { // scrapyards: a few dozen wrecks, tyre piles and drums in a loose heap
    const [x, y, z] = spot(30 + rand() * 250);
    for (let j = 0; j < 30; j++) {
      const g = new THREE.Group(), [dx, dz] = [(rand() - 0.5) * 70, (rand() - 0.5) * 50];
      const kind = rand();
      if (kind < 0.55) wreck(g, rand() < 0.2);
      else if (kind < 0.8) for (let t = 0; t < 3 + rand() * 6; t++) part(g, ring, tyre, (rand() - 0.5), 0.2 + t * 0.35, (rand() - 0.5)).rotation.x = Math.PI / 2;
      else for (let t = 0; t < 4; t++) part(g, drum, rust, (t % 2) * 0.7, 0.45, Math.floor(t / 2) * 0.7);
      place(g, [x + dx, y, z + dz], 0.1);
    }
  }
  for (let k = 0; k < 40; k++) { // containers half swallowed by the sand
    const m = part(root, box(2.4, 2.6, 12, 0), container, ...near());
    m.position.y -= 1;
    m.rotation.set((rand() - 0.5) * 0.3, rand() * Math.PI, (rand() - 0.5) * 0.3);
  }
  for (let k = 0; k < 10; k++) { // barrel fires: steady warm points out in the dark, never flickering (no flashing)
    const [x, y, z] = spot(20 + rand() * 300);
    part(root, drum, rust, x, y + 0.45, z);
    const glow = new THREE.Sprite(fire);
    glow.position.set(x, y + 1.3, z);
    glow.scale.setScalar(5);
    root.add(glow);
  }
}

// A line of dead power pylons walking off into the dunes, cables sagging between them.
function pylons(kit, root, edge, height) {
  const steel = kit.steel(palette.charcoal, 0.7);
  let prev;
  for (let k = 0; k < 10; k++) {
    const r = edge + SPRAWL + k * 110, [x, z] = [r * 0.71, -r * 0.71], y = height(x, z);
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

// Mesas far out, read as silhouettes through the haze, off the bands where the city's streets run out of town.
function mesas(kit, root, edge, height, rand) {
  // A random spot 1100–1600 m from the centre, past the sprawl and off the streets' lanes (outOfTown), for a mesa this wide.
  const spot = (size) => {
    for (;;) {
      const [a, r] = [rand() * Math.PI * 2, 1100 + rand() * 500];
      const [x, z] = [Math.cos(a) * r, Math.sin(a) * r];
      if (Math.min(Math.abs(x), Math.abs(z)) > edge + size * 1.5 + 20) return [x, z];
    }
  };
  for (let k = 0; k < 10; k++) {
    const r = 90 + rand() * 160, [x, z] = spot(r), h = 60 + rand() * 120;
    // Wide sloped flanks and a small top, so they read as eroded buttes rather than slabs.
    part(root, cyl(r * 0.6, r * 1.5, h, 18), kit.concrete(palette.charcoal), x, height(x, z) + h / 2 - 5, z).rotation.y = rand();
  }
}
