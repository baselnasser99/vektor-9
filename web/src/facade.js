// Facades drawn in the shader: a window grid per building type, frames, mullions, floor slabs and columns, glass
// set back in its opening, and a fake room behind every pane (interior mapping: a ray into a box the size of the
// bay, shaded wall, floor and lit ceiling). Room lights come from a hash of the room's place, so nothing flickers
// as the camera moves. It rides on MeshStandardMaterial, so lighting, shadows, fog, reflections and the merged
// batches all still work; no extra meshes, lights or textures. Far away, detail fades to the cell's average.
import * as THREE from 'three';
import { palette } from './palette.js';
import { REPEAT, rng } from './geometry.js';
import { F } from './world.js';

// Tuning for every facade at once.
export const FACADE = {
  brightness: 1.8, // interior light
  lit: 1, // multiplies every type's chance that a room is lit
  depth: 1, // multiplies every recess and room depth
  interior: 1, // 0: plain rooms; 1: furniture and blinds
};

// Per building type. bay and floor: cell size in metres. win: opening as fractions of the cell [width, height,
// sill]. glass: a curtain wall (dark spandrels, metal bands) rather than windows in a wall. recess: glass set back
// this far (m). room: depth of the fake room (m). mullions: panes per opening. column: a structural column every
// n bays (0: none). frame and slab: frame and floor-band thickness (m). lit: chance a room (homes, shops) or a
// floor (offices) is lit in the evening. kind picks the lighting pattern (0 homes, 1 offices, 2 shops). look: the
// lighting identity of windows outside any lot (trains, the tower's glass), which have no building to take one from.
export const STYLES = {
  office: { kind: 1, glass: true, bay: 1.5, floor: F, win: [0.96, 0.7, 0.2], recess: 0.12, room: 5, mullions: 1,
    column: 4, frame: 0.05, slab: 0.35, lit: 0.6, look: 1 },
  residential: { kind: 0, bay: 2.8, floor: F, win: [0.56, 0.54, 0.24], recess: 0.3, room: 3.6, mullions: 2, column: 0,
    frame: 0.06, slab: 0.22, lit: 0.7, look: 0 },
  shop: { kind: 2, bay: 3.5, floor: 4.6, win: [0.86, 0.66, 0.1], recess: 0.2, room: 4, mullions: 2, column: 1,
    frame: 0.07, slab: 0, lit: 0.85, look: 2 },
  old: { kind: 0, bay: 2.4, floor: F, win: [0.42, 0.46, 0.28], recess: 0.3, room: 3.2, mullions: 2, column: 0,
    frame: 0.07, slab: 0.18, lit: 0.6, look: 2 },
  luxury: { kind: 0, glass: true, bay: 3, floor: F, win: [0.92, 0.82, 0.08], recess: 0.15, room: 5.5, mullions: 3,
    column: 3, frame: 0.05, slab: 0.3, lit: 0.55, look: 0 },
  panorama: { kind: 0, glass: true, bay: 2.2, floor: 5.5, win: [0.97, 0.9, 0.05], recess: 0.06, room: 9, mullions: 1,
    column: 0, frame: 0.04, slab: 0, lit: 0.35, look: 1 }, // the tower's observation glass: one tall smoked band
  industrial: { kind: 1, bay: 4, floor: F, win: [0.86, 0.28, 0.6], recess: 0.1, room: 8, mullions: 4, column: 1,
    frame: 0.06, slab: 0, lit: 0.5, look: 3 },
};

// Facade variants: grids 1 to 3 per type, overriding its own grid (grid 0). band: a solid band every n floors, this
// fraction of a storey tall (0: none). Each keeps its pane area within 10% of grid 0 (tests/js/facade_variants), so a
// building lights as much of its wall as before and far away averages the same. Homes keep their 2.8 m bay: the
// balconies (2.6 m) and bay windows (2.4 m) on apartment walls are sized to it.
// Types without variants (shops, old, industrial, the tower's glass) always draw grid 0.
STYLES.office.variants = [
  { bay: 3, win: [0.98, 0.68, 0.2], mullions: 4, column: 0, slab: 0.45, band: [4, 0.32] }, // horizontal ribbons
  { bay: 1.2, win: [0.72, 0.92, 0.04], mullions: 1, column: 0, slab: 0.25 }, // tall narrow panes, vertical lines
  { bay: 2.4, win: [0.9, 0.74, 0.16], mullions: 2, column: 2, band: [3, 0.3] }, // paired panes, a band every 3 floors
];
STYLES.residential.variants = [
  { win: [0.8, 0.38, 0.36], mullions: 3 }, // wide low windows
  { win: [0.36, 0.84, 0.06], mullions: 1, band: [4, 0.3] }, // tall narrow windows, a band every 4 floors
  { win: [0.5, 0.6, 0.22], mullions: 2, column: 3, slab: 0.4, band: [3, 0.3] }, // pilasters, heavy slabs
];
STYLES.luxury.variants = [
  { bay: 2, win: [0.82, 0.92, 0.04], mullions: 1, column: 0 }, // tall narrow glass
  { bay: 4.2, win: [0.96, 0.78, 0.12], mullions: 4, column: 2, band: [5, 0.3] }, // wide panels
  { bay: 3, win: [0.92, 0.8, 0.12], mullions: 2, column: 0, slab: 0.4, band: [3, 0.3] }, // bold floor bands
];
// Wall, glass and frame per tone; tone 0 is the material's own (slate concrete, deep navy glass, charcoal frames).
export const TONES = [null,
  { wall: 'facadeRust', glass: 'glassRust', frame: 'graphite' },
  { wall: 'facadeTeal', glass: 'glassTeal', frame: 'gunmetal' },
  { wall: 'facadeBlue', glass: 'glassBlue', frame: 'charcoal' },
];
// The families that take variants; every other building (and the old town, landmarks, the HQ) keeps grid 0, tone 0.
export const VARIED = new Set(['apartment', 'office', 'luxury', 'mega']);

// A building's facade variant from its tile position and the map's seed alone, so it never changes when another
// tile does: grid + 4 x tone, 0..15 (0: today's facade). Both are a hash of the place, so about one neighbour in
// four shares a grid by chance and nothing lines up in stripes (a lattice stepping by column and row repeated along
// the diagonals across the whole city).
export function facadeVariant(col, row, mapSeed, family, keep = false) {
  if (keep || !VARIED.has(family)) return 0;
  const r = rng(Math.imul(col + 1, 73856093) ^ Math.imul(row + 1, 19349663) ^ Math.imul(mapSeed + 7, 83492791));
  const grid = Math.floor(r() * 4);
  return grid + 4 * Math.floor(r() * 4);
}

// Lighting identities (fPick in the shader). A lot's identity rides in its building id (city.js), id + LOOK_STEP x look.
export const LOOKS = { crimson: 0, blue: 1, warm: 2, dark: 3, landmark: 4 };
export const LOOK_STEP = 65536; // above any tile index; ids stay whole numbers in a float (exact up to 2^24)
export const VARIANT_STEP = 8 * LOOK_STEP; // the facade variant rides above the identity: 15 x 8 x 65536 stays under 2^24

// Smooth value noise over the tile grid, about one bump every `cell` tiles: districts, not salt and pepper.
function field(col, row, cell, salt) {
  const x = col / cell, y = row / cell, ix = Math.floor(x), iy = Math.floor(y);
  const at = (i, j) => rng(Math.imul(i, 73856093) ^ Math.imul(j, 19349663) ^ Math.imul(salt, 83492791))();
  const s = (t) => t * t * (3 - 2 * t), fx = s(x - ix), fy = s(y - iy);
  const a = at(ix, iy) + (at(ix + 1, iy) - at(ix, iy)) * fx, b = at(ix, iy + 1) + (at(ix + 1, iy + 1) - at(ix, iy + 1)) * fx;
  return a + (b - a) * fy;
}
const ramp = (a, b, x) => Math.min(Math.max((x - a) / (b - a), 0), 1);

// A lot's lighting identity, picked once so every facade of the building (tower, podium, sections) shares it.
// Crimson is the city's colour; blue is a few corporate pockets of tall glass (a coarse field plus a finer one, so
// the pockets have ragged edges), dark gathers round industry, warm in the old town and among shops. Each building
// still draws its own, so a district leans one way without being uniform.
// t: the snapshot tile; family: its building family (families.js) or false; mapSeed: the snapshot's seed.
export function lightingIdentity(t, family, col, row, mapSeed, landmark = false) {
  if (landmark) return LOOKS.landmark;
  const corp = 0.75 * field(col, row, 11, mapSeed * 3 + 1) + 0.25 * field(col, row, 4, mapSeed * 3 + 2);
  const grime = field(col, row, 9, mapSeed * 3 + 3), r = rng(t.s * 31 + 7)();
  const glass = { office: 1, mega: 1, luxury: 0.7 }[family] ?? 0.08;
  const w = [
    1, // crimson
    7 * ramp(0.56, 0.72, corp) * glass * (0.25 + 0.75 * ramp(8, 18, t.f)), // blue: corporate pockets, tall glass
    family === 'old' ? 1.5 : t.k === 'market' || t.k === 'lot' ? 0.7 : 0.13, // warm
    family === 'industrial' ? 3 : 0.2 + 0.9 * ramp(0.55, 0.8, grime) * (1 - ramp(10, 20, t.f)), // dark
  ];
  let x = r * (w[0] + w[1] + w[2] + w[3]);
  for (let i = 0; i < 3; i++) { if (x < w[i]) return i; x -= w[i]; }
  return 3;
}

// Shared by every facade: seconds for slow light changes, how lit homes and offices are at this hour.
const clock = { time: { value: 0 }, homes: { value: 1 }, offices: { value: 1 } };
export const facadeTime = clock.time; // also drives the animated corporate signs (materials.js liveSign)
export function facadeClock(hour, onFrame) {
  // Evening is the busiest for homes; offices empty out after seven. Smooth through the day.
  const homes = [0.55, 0.4, 0.3, 0.25, 0.25, 0.35, 0.6, 0.7, 0.45, 0.35, 0.35, 0.4, 0.45, 0.45, 0.45, 0.5, 0.6, 0.8,
    1, 1.1, 1.15, 1.05, 0.9, 0.7];
  const offices = [0.12, 0.1, 0.08, 0.08, 0.08, 0.1, 0.25, 0.6, 1, 1.2, 1.2, 1.2, 1.1, 1.2, 1.2, 1.2, 1.1, 0.9, 0.6,
    0.4, 0.3, 0.22, 0.18, 0.15];
  const at = (list) => list[Math.floor(hour) % 24] + (list[Math.ceil(hour) % 24] - list[Math.floor(hour) % 24]) * (hour % 1);
  clock.homes.value = at(homes);
  clock.offices.value = at(offices);
  onFrame((dt) => { clock.time.value += dt; });
}

// The facade material for a type; color and map are the wall between the windows. lit: false is a blackout.
// glass: the panes' tint (the telecom tower's smoked observation glass passes its own).
export function facadeMaterial(style, { lit = true, seed = 1, color = palette.slate, map = null, glass = palette.deepNavy } = {}) {
  const s = STYLES[style], c = (v) => new THREE.Color(v);
  // The wall's colour is a uniform (fWall) so a building's tone can replace it; the material itself stays white.
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, map, roughness: 0.85, metalness: 0.1 });
  m.userData.facade = style; // merge.js gives its vertices their building's id (aBuilding)
  const grids = [{}, ...(s.variants ?? [{}, {}, {}])].map((v) => ({ ...s, band: [0, 0], ...v }));
  const tones = TONES.map((t) => (t ? [palette[t.wall], palette[t.glass], palette[t.frame]] : [color, glass, palette.charcoal]));
  const uniforms = {
    fGrid: { value: grids.map((g) => new THREE.Vector4(g.bay, g.floor, 0.18, g.room * FACADE.depth)) },
    fWin: { value: grids.map((g) => new THREE.Vector4(...g.win, g.recess * FACADE.depth)) },
    fBars: { value: grids.map((g) => new THREE.Vector4(g.mullions, g.column, g.frame, g.slab)) },
    fBand: { value: grids.map((g) => new THREE.Vector2(...g.band)) },
    fWall: { value: tones.map((t) => c(t[0])) }, fGlass: { value: tones.map((t) => c(t[1])) }, fFrame: { value: tones.map((t) => c(t[2])) },
    fLight: { value: new THREE.Vector4(s.lit * FACADE.lit, lit ? FACADE.brightness : 0, s.kind, seed) },
    fInterior: { value: FACADE.interior }, fSkin: { value: s.glass ? 1 : 0 },
    fBlood: { value: c(palette.winBlood) }, fCrimson: { value: c(palette.winCrimson) }, fScarlet: { value: c(palette.winScarlet) },
    fHigh: { value: c(palette.winHighlight) }, fIce: { value: c(palette.winIce) }, fWhite: { value: c(palette.windowWhite) },
    fAmber: { value: c(palette.winAmber) }, fCool: { value: c(palette.glare) },
    fLookDef: { value: s.look }, fTime: clock.time, fHomes: clock.homes, fOffices: clock.offices,
  };
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VARYINGS}\nattribute float aBuilding;`)
      .replace('#include <project_vertex>', `#include <project_vertex>
        vec4 fWorld = modelMatrix * vec4(transformed, 1.0);
        vFPos = fWorld.xyz;
        vFN = normalize(mat3(modelMatrix) * objectNormal);
        vFU = uv.x * ${REPEAT.toFixed(1)};
        vFB = aBuilding;
        vFId = floor(dot(vFPos.xz, normalize(vFN.xz + 1e-4)) * 0.5);`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${VARYINGS}\n${FRAGMENT}`)
      .replace('#include <color_fragment>', '#include <color_fragment>\nfacade(diffuseColor.rgb);')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, fRough, fShine);')
      // Glass is not metal: part-metal panes lost their diffuse and reflected less head-on, so they went black.
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = mix(metalnessFactor, 0.0, fShine);')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = normalize(normal + (viewMatrix * vec4(fBend, 0.0)).xyz);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance = fGlow;');
  };
  m.customProgramCacheKey = () => 'facade'; // one program for every facade; the uniforms differ
  return m;
}

const VARYINGS = `varying vec3 vFPos; varying vec3 vFN; varying float vFU; flat varying float vFId; flat varying float vFB;`;

const FRAGMENT = /* glsl */ `
uniform vec4 fGrid[4], fWin[4], fBars[4], fLight;
uniform vec2 fBand[4];
uniform float fInterior, fTime, fHomes, fOffices, fSkin, fLookDef;
uniform vec3 fWall[4], fGlass[4], fFrame[4], fBlood, fCrimson, fScarlet, fHigh, fIce, fWhite, fAmber, fCool;
vec3 fGlow = vec3(0.0), fBend = vec3(0.0);
float fShine = 0.0, fRough = 0.1;
// This building's grid and tone (facade() picks them from its id, facade.js facadeVariant), and its id without them.
vec4 gGrid, gWin, gBars;
vec2 gBand;
vec3 gGlass, gFrame;
float gId;

// pcg3d: a stable hash of whole numbers, so a room keeps its light from frame to frame.
uvec3 fHash(uvec3 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return v;
}
vec3 fRand(ivec3 k, uint salt) { return vec3(fHash(uvec3(k) + uvec3(salt, salt * 7u, salt * 13u)) >> 8u) / 16777216.0; }

// Window light comes from the building's lighting identity, picked once per lot in JS (facade.js lightingIdentity:
// 0 crimson-dominant, 1 cool-blue corporate, 2 warm or mixed, 3 mostly dark, 4 bright landmark) and carried in its
// building id (id + 65536 x identity), so the whole building shares it; windows outside a lot use their type's own.
float fLook() { return vFB > 0.5 ? floor(gId / 65536.0) : fLookDef; }
// AgX tone mapping (with its colour-space change) first mixes about a quarter of red into green and a sixth into
// blue, which turns saturated red salmon pink; taking out part of that beforehand (the mix is clamped at zero) keeps
// red light rich. The palette hexes are targets on screen, so each red gets the amount and brightness that lands it
// there: dim crimson fully corrected and low, the main red a little brighter, bright scarlet and the rare warm
// highlight only half corrected and bright enough that the brightest rooms pass the bloom threshold and glow.
vec3 fDeep(vec3 c, float k) { return c - vec3(0.0, 0.13, 0.07) * c.r * k; }
// The light of one room (r: its hash; offices pass a whole floor's) for an identity. band: the floor band's hash, so
// a warm building now and then has a whole section of red windows and a crimson one a band of dim floors.
// Crimson is the signature: mostly reds and muted rose, a little amber and warm white, no blue. Blue buildings are
// cold technology, not neon: cool white and muted ice, true ice-blue only now and then. Saturated cyan is kept for
// accents (roof strips, holograms), never windows.
vec3 fPick(float look, float r, float band) {
  // One exit: with early returns ANGLE's HLSL warned of a possibly unset result.
  vec3 c;
  if (look < 0.5 || (look > 1.5 && look < 2.5 && band < 0.18)) { // crimson, or a red section of a warm building
    float dim = look < 0.5 && band > 0.82 ? 0.55 : 1.0;
    c = r < 0.3 ? fDeep(fBlood * 0.55, 1.0) * dim
      : r < 0.64 ? fDeep(fCrimson * 0.8, 0.8) * dim
      : r < 0.77 ? fDeep(fScarlet * 1.15, 0.5) * dim
      : r < 0.84 ? fDeep(fHigh * 0.75, 0.7) * dim // muted rose
      : r < 0.88 ? fDeep(fHigh * 1.5, 0.4)
      : r < 0.95 ? fAmber * 0.8 : mix(fWhite, fAmber, 0.35) * 0.75; // the odd warm room keeps it from one red slab
  } else if (look < 1.5) {
    vec3 iceMuted = mix(fIce, fWhite, 0.5);
    c = r < 0.4 ? fWhite * 0.8 : r < 0.86 ? iceMuted * 1.15 : r < 0.95 ? fIce * 1.2 : fDeep(fCrimson * 0.8, 0.8);
  } else if (look < 2.5) {
    c = r < 0.45 ? fAmber : r < 0.72 ? mix(fWhite, fAmber, 0.4) * 0.8 : r < 0.88 ? fDeep(fCrimson * 0.75, 0.8) : fDeep(fBlood * 0.55, 1.0);
  } else if (look < 3.5) {
    c = r < 0.55 ? fDeep(fBlood * 0.5, 1.0) : r < 0.85 ? fAmber * 0.7 : fWhite * 0.6;
  } else {
    c = r < 0.4 ? fDeep(fScarlet * 1.2, 0.5) : r < 0.72 ? fDeep(fCrimson, 0.8) : r < 0.92 ? fDeep(fHigh * 1.3, 0.4) : fWhite;
  }
  return c;
}
// How many rooms an identity lights and how bright: industry mostly dark, landmarks full and bright.
vec2 fLookLight(float look) { return look > 3.5 ? vec2(1.4, 1.3) : look > 2.5 ? vec2(0.25, 0.8) : vec2(1.0); }

// How lit a room is (0 dark .. ~1.4 bright). kind 0 homes, 1 offices, 2 shops. color: its floor's tone; the odd home
// screen (cool) where its hash passes screens: often in blue buildings, rarely in warm or dark ones, never in crimson.
float fRoom(ivec3 k, float kind, float chance, float screens, inout vec3 color) {
  vec3 h = fRand(k, 1u), g = fRand(ivec3(0, k.y, k.z), 2u);
  // About one room in ten changes its light now and then: a slow fade, never a flash.
  float slot = fTime / 97.0 + h.y * 50.0, swap = smoothstep(0.0, 0.03, fract(slot));
  float now = h.x;
  if (h.z < 0.1) now = mix(fRand(k + ivec3(0, 0, int(floor(slot)) - 1), 3u).x, fRand(k + ivec3(0, 0, int(floor(slot))), 3u).x, swap);
  if (kind > 1.5) return now < chance ? 1.0 + 0.3 * h.y : 0.0;
  if (kind > 0.5) { // offices: whole floors on or off, the odd late worker on a dark floor
    if (g.x < chance * fOffices) return now < 0.88 ? 0.42 + 0.12 * h.y : 0.0;
    return now < 0.04 ? 0.25 : 0.0;
  }
  if (now >= chance * fHomes) return 0.0; // homes: warm and irregular, mostly dim, a few bright, the odd screen
  if (h.y > screens) color = fCool * vec3(0.55, 0.65, 0.85);
  float tier = fract(h.y * 7.31);
  return tier < 0.45 ? 0.3 + 0.4 * tier : tier < 0.87 ? 0.6 + 0.7 * (tier - 0.45) : 1.2 + tier * 0.4;
}

// The fake room behind a pane: from the glass point g, a ray into a bay-wide, storey-high box of depth gGrid.w;
// returns the brightness of whichever face it meets first (back wall with furniture, side wall, floor, ceiling).
float fInside(vec2 g, vec3 d, ivec3 k, float detail) {
  float bay = gGrid.x, fl = gGrid.y;
  float tx = (d.x > 0.0 ? bay - g.x : -g.x) / (abs(d.x) > 1e-4 ? d.x : 1e-4);
  float ty = (d.y > 0.0 ? fl - g.y : -g.y) / (abs(d.y) > 1e-4 ? d.y : 1e-4);
  float tz = gGrid.w / d.z, t = min(min(tx, ty), tz);
  vec3 hit = vec3(g, 0.0) + d * t;
  float shade = 0.5;
  if (t == tz) { // back wall, with a dark piece of furniture against it, sometimes a tall one
    shade = 0.55;
    vec2 f = fRand(k, 4u).xy;
    if (f.x < fInterior * 0.8 && hit.y < fl * (0.25 + 0.3 * f.y * f.y) && abs(hit.x / bay - f.y) < 0.18 + 0.1 * f.x) shade = 0.12;
  } else if (t == tx) shade = 0.38 + 0.1 * (1.0 - hit.z / gGrid.w);
  else if (d.y < 0.0) shade = 0.16; // floor
  else shade = 0.95 * exp(-2.0 * length(hit.xz / vec2(bay, gGrid.w) - vec2(0.5, 0.35))); // ceiling lamp
  return mix(0.55, shade, detail * mix(0.6, 1.0, fInterior));
}

void facade(inout vec3 albedo) {
  // The variant: grid + 4 x tone, above the identity in the id (0 outside a lot, and for buildings that keep today's).
  float variant = vFB > 0.5 ? floor(vFB / ${VARIANT_STEP.toFixed(1)}) : 0.0;
  int gi = int(mod(variant, 4.0)), ti = int(variant / 4.0);
  gId = vFB - variant * ${VARIANT_STEP.toFixed(1)};
  gGrid = fGrid[gi]; gWin = fWin[gi]; gBars = fBars[gi]; gBand = fBand[gi];
  gGlass = fGlass[ti]; gFrame = fFrame[ti];
  albedo *= fWall[ti]; // the wall's colour (roofs and soffits too)
  vec3 N = normalize(vFN);
  // Screen derivatives first, before any branch: they are only defined in uniform control flow.
  vec3 dpx = dFdx(vFPos), dpy = dFdy(vFPos);
  vec3 T = cross(dpy, N) * dFdx(vFU) + cross(N, dpx) * dFdy(vFU); // the direction u grows in along the wall
  float bay = gGrid.x, fl = gGrid.y, kind = fLight.z;
  vec2 c = vec2(vFU / bay, (vFPos.y - gGrid.z) / fl);
  float px = max(fwidth(c.x), fwidth(c.y)); // cells per pixel
  float side = 1.0 - smoothstep(0.5, 0.8, abs(N.y)); // walls only; roofs and soffits stay plain
  if (side <= 0.0) return;
  T.y = 0.0;
  T = dot(T, T) > 1e-12 ? normalize(T) : normalize(cross(vec3(0.0, 1.0, 0.0), N));

  bool office = kind > 0.5 && kind < 1.5, shop = kind > 1.5, glassy = fSkin > 0.5; // lighting pattern; curtain wall
  float detail = 1.0 - smoothstep(0.12, 0.45, px), far = smoothstep(0.6, 1.6, px);
  vec3 wall = glassy ? mix(gGlass * 1.4, gFrame, 0.35) : albedo; // curtain walls: dark spandrel glass between bands
  vec3 outAlbedo = wall, glow = vec3(0.0);
  float shine = glassy ? 0.6 : 0.0;
  // The building's identity, how many rooms it lights and how bright; the floor band's hash; one floor's light
  // (offices light whole floors, and far away a floor is all that can be seen).
  float look = fLook(), fi = floor(c.y);
  vec2 lookLight = fLookLight(look);
  ivec3 bb = ivec3(int(gId), int(fLight.w), 0);
  float bandH = fRand(bb + ivec3(0, 0, int(floor(fi / (2.0 + floor(fRand(bb, 5u).y * 4.0)))) + 1), 6u).x;
  vec3 tone = fPick(look, fRand(bb + ivec3(0, int(fi), 0), 11u).x, bandH);
  if (far < 1.0) { // near enough to see single windows; far away only the average below is drawn
    vec2 cell = floor(c), m = (c - cell) * vec2(bay, fl);
    ivec3 k = ivec3(int(cell.x), int(cell.y), int(vFId) * 3 + int(fLight.w) * 7919);
    vec3 light = office ? tone : fPick(look, fRand(k, 12u).x, bandH);
    float level = fRoom(k, kind, fLight.x * lookLight.x, look > 0.5 && look < 1.5 ? 0.94 : look > 1.5 && look < 3.5 ? 0.985 : 2.0, light) * fLight.y * lookLight.y;
    // Facade divisions: a floor slab at the bottom of every storey, a column every few bays.
    bool column = gBars.y > 0.5 && mod(cell.x, gBars.y) < 0.5 && m.x < 0.28;
    // A floor slab at the bottom of every storey; every few floors a deeper solid band, if the grid has one.
    bool slab = m.y < (gBand.x > 0.5 && mod(cell.y, gBand.x) < 0.5 ? max(gBars.w, gBand.y * fl) : gBars.w);
    vec2 o0 = vec2((1.0 - gWin.x) * 0.5 * bay, gWin.z * fl), o1 = o0 + vec2(gWin.x * bay, gWin.y * fl);
    vec3 V = normalize(cameraPosition - vFPos);
    float vt = dot(V, T), vn = max(dot(V, N), 0.08);
    // Recess: the glass sits gWin.w behind the wall face; where the shifted point leaves the opening we see its reveal.
    vec2 g = m - vec2(vt, V.y) / vn * gWin.w * detail;
    bool open = all(greaterThan(m, o0)) && all(lessThan(m, o1)) && !slab && !column;
    bool pane = open && all(greaterThan(g, o0)) && all(lessThan(g, o1));
    float edge = min(min(g.x - o0.x, o1.x - g.x), min(g.y - o0.y, o1.y - g.y));
    float bar = abs(fract((g.x - o0.x) / (o1.x - o0.x) * gBars.x + 0.5) - 0.5) * (o1.x - o0.x) / gBars.x;
    bool framed = pane && (edge < gBars.z || (gBars.x > 1.5 && bar < gBars.z * 0.6)) && detail > 0.2;
    if (slab || column) { outAlbedo = glassy ? gFrame : wall * 0.72; shine = 0.0; }
    if (open && !pane) { outAlbedo = wall * (V.y > 0.0 ? 0.35 : 0.6); shine = 0.0; } // reveal: the lintel shades, the sill catches light
    if (framed) { outAlbedo = gFrame; shine = 0.15; }
    else if (pane) {
      vec3 h = fRand(k, 9u);
      if (level > 0.0) { // a dark room shows nothing behind its pane, so skip tracing it (most rooms are dark)
        float shade = fInside(g, vec3(-vt, -V.y, vn), k, detail);
        // Blinds: in some lit rooms a pale blind covers the top of the pane, lit from behind.
        if (level > 0.0 && h.x < 0.28 * fInterior && g.y > o1.y - (o1.y - o0.y) * (0.25 + 0.5 * h.y)) shade = 0.5;
        float fresnel = 0.04 + 0.96 * pow(1.0 - vn, 5.0);
        // Rooms differ a little in brightness and hue (bulbs, blinds, screens), so a lit floor is not one flat colour.
        light *= (0.8 + 0.4 * h.y) * vec3(1.0, 0.88 + 0.24 * h.z, 0.92 + 0.16 * h.x);
        glow = light * level * shade * (1.0 - 0.7 * fresnel);
      }
      outAlbedo = gGlass * (0.7 + 0.5 * h.z);
      shine = 1.0;
      fRough = 0.05 + 0.14 * h.y; // panes catch reflections a little differently
      fBend = (T * (h.x - 0.5) + vec3(0.0, h.z - 0.5, 0.0)) * 0.05 * detail;
    }
  }
  // Far away: one cell per pixel or less, so draw its average instead of picking one room (no shimmer).
  float cover = gWin.x * gWin.y, avg = fLight.x * (office ? fOffices * 0.6 : shop ? 1.1 : fHomes * 0.5);
  glow = mix(glow, tone * min(avg * lookLight.x, 1.0) * fLight.y * lookLight.y * 0.6 * cover, far);
  outAlbedo = mix(outAlbedo, mix(wall, gGlass, cover), far);
  shine = mix(shine, cover * 0.6, far);
  // Street canyon: lower storeys see less sky, so walls darken towards the street (window light is unaffected).
  albedo = mix(albedo, outAlbedo, side) * mix(0.55, 1.0, smoothstep(0.0, 45.0, vFPos.y));
  fGlow = glow * side;
  fShine = shine * side;
}
`;
