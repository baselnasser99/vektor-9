// Facades drawn in the shader: a window grid per building type, frames, mullions, floor slabs and columns, glass
// set back in its opening, and a fake room behind every pane (interior mapping: a ray into a box the size of the
// bay, shaded wall, floor and lit ceiling). Room lights come from a hash of the room's place, so nothing flickers
// as the camera moves. It rides on MeshStandardMaterial, so lighting, shadows, fog, reflections and the merged
// batches all still work; no extra meshes, lights or textures. Far away, detail fades to the cell's average.
import * as THREE from 'three';
import { palette } from './palette.js';
import { REPEAT } from './geometry.js';
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
// floor (offices) is lit in the evening. kind picks the lighting pattern (0 homes, 1 offices, 2 shops).
export const STYLES = {
  office: { kind: 1, glass: true, bay: 1.5, floor: F, win: [0.96, 0.7, 0.2], recess: 0.12, room: 5, mullions: 1,
    column: 4, frame: 0.05, slab: 0.35, lit: 0.6 },
  residential: { kind: 0, bay: 2.8, floor: F, win: [0.56, 0.54, 0.24], recess: 0.3, room: 3.6, mullions: 2, column: 0,
    frame: 0.06, slab: 0.22, lit: 0.7 },
  shop: { kind: 2, bay: 3.5, floor: 4.6, win: [0.86, 0.66, 0.1], recess: 0.2, room: 4, mullions: 2, column: 1,
    frame: 0.07, slab: 0, lit: 0.85 },
  old: { kind: 0, bay: 2.4, floor: F, win: [0.42, 0.46, 0.28], recess: 0.3, room: 3.2, mullions: 2, column: 0,
    frame: 0.07, slab: 0.18, lit: 0.6 },
  luxury: { kind: 0, glass: true, bay: 3, floor: F, win: [0.92, 0.82, 0.08], recess: 0.15, room: 5.5, mullions: 3,
    column: 3, frame: 0.05, slab: 0.3, lit: 0.55 },
  industrial: { kind: 1, bay: 4, floor: F, win: [0.86, 0.28, 0.6], recess: 0.1, room: 8, mullions: 4, column: 1,
    frame: 0.06, slab: 0, lit: 0.5 },
};

// Shared by every facade: seconds for slow light changes, and how lit homes and offices are at this hour.
const clock = { time: { value: 0 }, homes: { value: 1 }, offices: { value: 1 } };
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
export function facadeMaterial(style, { lit = true, seed = 1, color = palette.slate, map = null } = {}) {
  const s = STYLES[style], c = (v) => new THREE.Color(v);
  const m = new THREE.MeshStandardMaterial({ color, map, roughness: 0.85, metalness: 0.1 });
  const uniforms = {
    fGrid: { value: new THREE.Vector4(s.bay, s.floor, 0.18, s.room * FACADE.depth) },
    fWin: { value: new THREE.Vector4(...s.win, s.recess * FACADE.depth) },
    fBars: { value: new THREE.Vector4(s.mullions, s.column, s.frame, s.slab) },
    fLight: { value: new THREE.Vector4(s.lit * FACADE.lit, lit ? FACADE.brightness : 0, s.kind, seed) },
    fInterior: { value: FACADE.interior }, fSkin: { value: s.glass ? 1 : 0 },
    fFrame: { value: c(palette.charcoal) }, fGlass: { value: c(palette.deepNavy) },
    fWarm: { value: c(palette.warmWindow) }, fWarm2: { value: c(palette.sodium) }, fCool: { value: c(palette.glare) },
    fTime: clock.time, fHomes: clock.homes, fOffices: clock.offices,
  };
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VARYINGS}`)
      .replace('#include <project_vertex>', `#include <project_vertex>
        vec4 fWorld = modelMatrix * vec4(transformed, 1.0);
        vFPos = fWorld.xyz;
        vFN = normalize(mat3(modelMatrix) * objectNormal);
        vFU = uv.x * ${REPEAT.toFixed(1)};
        vFId = floor(dot(vFPos.xz, normalize(vFN.xz + 1e-4)) * 0.5);`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${VARYINGS}\n${FRAGMENT}`)
      .replace('#include <color_fragment>', '#include <color_fragment>\nfacade(diffuseColor.rgb);')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, fRough, fShine);')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = mix(metalnessFactor, 0.55, fShine);')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = normalize(normal + (viewMatrix * vec4(fBend, 0.0)).xyz);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance = fGlow;');
  };
  m.customProgramCacheKey = () => 'facade'; // one program for every facade; the uniforms differ
  return m;
}

const VARYINGS = `varying vec3 vFPos; varying vec3 vFN; varying float vFU; flat varying float vFId;`;

const FRAGMENT = /* glsl */ `
uniform vec4 fGrid, fWin, fBars, fLight;
uniform float fInterior, fTime, fHomes, fOffices, fSkin;
uniform vec3 fFrame, fGlass, fWarm, fWarm2, fCool;
vec3 fGlow = vec3(0.0), fBend = vec3(0.0);
float fShine = 0.0, fRough = 0.1;

// pcg3d: a stable hash of whole numbers, so a room keeps its light from frame to frame.
uvec3 fHash(uvec3 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return v;
}
vec3 fRand(ivec3 k, uint salt) { return vec3(fHash(uvec3(k) + uvec3(salt, salt * 7u, salt * 13u)) >> 8u) / 16777216.0; }

// How lit a room is (0 dark .. ~1.4 bright) and its light color. kind 0 homes, 1 offices, 2 shops.
float fRoom(ivec3 k, float kind, float chance, out vec3 color) {
  vec3 h = fRand(k, 1u), g = fRand(ivec3(0, k.y, k.z), 2u);
  // About one room in ten changes its light now and then: a slow fade, never a flash.
  float slot = fTime / 97.0 + h.y * 50.0, swap = smoothstep(0.0, 0.03, fract(slot));
  float now = h.x;
  if (h.z < 0.1) now = mix(fRand(k + ivec3(0, 0, int(floor(slot)) - 1), 3u).x, fRand(k + ivec3(0, 0, int(floor(slot))), 3u).x, swap);
  color = mix(fWarm, fWarm2, h.z);
  if (kind > 1.5) return now < chance ? 1.0 + 0.3 * h.y : 0.0;
  if (kind > 0.5) { // offices: whole floors on or off, cool light, the odd late worker on a dark floor
    color = mix(fCool, fWarm, 0.35);
    if (g.x < chance * fOffices) return now < 0.88 ? 0.42 + 0.12 * h.y : 0.0;
    return now < 0.04 ? 0.25 : 0.0;
  }
  if (now >= chance * fHomes) return 0.0; // homes: warm and irregular, mostly dim, a few bright, the odd screen
  if (h.y > 0.94) color = fCool * vec3(0.55, 0.65, 0.85);
  float tier = fract(h.y * 7.31);
  return tier < 0.45 ? 0.3 + 0.4 * tier : tier < 0.87 ? 0.6 + 0.7 * (tier - 0.45) : 1.2 + tier * 0.4;
}

// The fake room behind a pane: from the glass point g, a ray into a bay-wide, storey-high box of depth fGrid.w;
// returns the brightness of whichever face it meets first (back wall with furniture, side wall, floor, ceiling).
float fInside(vec2 g, vec3 d, ivec3 k, float detail) {
  float bay = fGrid.x, fl = fGrid.y;
  float tx = (d.x > 0.0 ? bay - g.x : -g.x) / (abs(d.x) > 1e-4 ? d.x : 1e-4);
  float ty = (d.y > 0.0 ? fl - g.y : -g.y) / (abs(d.y) > 1e-4 ? d.y : 1e-4);
  float tz = fGrid.w / d.z, t = min(min(tx, ty), tz);
  vec3 hit = vec3(g, 0.0) + d * t;
  float shade = 0.5;
  if (t == tz) { // back wall, with a dark piece of furniture against it, sometimes a tall one
    shade = 0.55;
    vec2 f = fRand(k, 4u).xy;
    if (f.x < fInterior * 0.8 && hit.y < fl * (0.25 + 0.3 * f.y * f.y) && abs(hit.x / bay - f.y) < 0.18 + 0.1 * f.x) shade = 0.12;
  } else if (t == tx) shade = 0.38 + 0.1 * (1.0 - hit.z / fGrid.w);
  else if (d.y < 0.0) shade = 0.16; // floor
  else shade = 0.95 * exp(-2.0 * length(hit.xz / vec2(bay, fGrid.w) - vec2(0.5, 0.35))); // ceiling lamp
  return mix(0.55, shade, detail * mix(0.6, 1.0, fInterior));
}

void facade(inout vec3 albedo) {
  vec3 N = normalize(vFN);
  // Screen derivatives first, before any branch: they are only defined in uniform control flow.
  vec3 dpx = dFdx(vFPos), dpy = dFdy(vFPos);
  vec3 T = cross(dpy, N) * dFdx(vFU) + cross(N, dpx) * dFdy(vFU); // the direction u grows in along the wall
  float bay = fGrid.x, fl = fGrid.y, kind = fLight.z;
  vec2 c = vec2(vFU / bay, (vFPos.y - fGrid.z) / fl);
  float px = max(fwidth(c.x), fwidth(c.y)); // cells per pixel
  float side = 1.0 - smoothstep(0.5, 0.8, abs(N.y)); // walls only; roofs and soffits stay plain
  if (side <= 0.0) return;
  T.y = 0.0;
  T = dot(T, T) > 1e-12 ? normalize(T) : normalize(cross(vec3(0.0, 1.0, 0.0), N));

  bool office = kind > 0.5 && kind < 1.5, shop = kind > 1.5, glassy = fSkin > 0.5; // lighting pattern; curtain wall
  float detail = 1.0 - smoothstep(0.12, 0.45, px), far = smoothstep(0.6, 1.6, px);
  vec3 wall = glassy ? mix(fGlass * 1.4, fFrame, 0.35) : albedo; // curtain walls: dark spandrel glass between bands
  vec3 outAlbedo = wall, glow = vec3(0.0);
  float shine = glassy ? 0.6 : 0.0;
  if (far < 1.0) { // near enough to see single windows; far away only the average below is drawn
    vec2 cell = floor(c), m = (c - cell) * vec2(bay, fl);
    ivec3 k = ivec3(int(cell.x), int(cell.y), int(vFId) * 3 + int(fLight.w) * 7919);
    vec3 light;
    float level = fRoom(k, kind, fLight.x, light) * fLight.y;
    // Facade divisions: a floor slab at the bottom of every storey, a column every few bays.
    bool column = fBars.y > 0.5 && mod(cell.x, fBars.y) < 0.5 && m.x < 0.28;
    bool slab = m.y < fBars.w;
    vec2 o0 = vec2((1.0 - fWin.x) * 0.5 * bay, fWin.z * fl), o1 = o0 + vec2(fWin.x * bay, fWin.y * fl);
    vec3 V = normalize(cameraPosition - vFPos);
    float vt = dot(V, T), vn = max(dot(V, N), 0.08);
    // Recess: the glass sits fWin.w behind the wall face; where the shifted point leaves the opening we see its reveal.
    vec2 g = m - vec2(vt, V.y) / vn * fWin.w * detail;
    bool open = all(greaterThan(m, o0)) && all(lessThan(m, o1)) && !slab && !column;
    bool pane = open && all(greaterThan(g, o0)) && all(lessThan(g, o1));
    float edge = min(min(g.x - o0.x, o1.x - g.x), min(g.y - o0.y, o1.y - g.y));
    float bar = abs(fract((g.x - o0.x) / (o1.x - o0.x) * fBars.x + 0.5) - 0.5) * (o1.x - o0.x) / fBars.x;
    bool framed = pane && (edge < fBars.z || (fBars.x > 1.5 && bar < fBars.z * 0.6)) && detail > 0.2;
    if (slab || column) { outAlbedo = glassy ? fFrame : wall * 0.72; shine = 0.0; }
    if (open && !pane) { outAlbedo = wall * (V.y > 0.0 ? 0.35 : 0.6); shine = 0.0; } // reveal: the lintel shades, the sill catches light
    if (framed) { outAlbedo = fFrame; shine = 0.15; }
    else if (pane) {
      vec3 h = fRand(k, 9u);
      float shade = fInside(g, vec3(-vt, -V.y, vn), k, detail);
      // Blinds: in some lit rooms a pale blind covers the top of the pane, lit from behind.
      if (level > 0.0 && h.x < 0.28 * fInterior && g.y > o1.y - (o1.y - o0.y) * (0.25 + 0.5 * h.y)) shade = 0.5;
      float fresnel = 0.04 + 0.96 * pow(1.0 - vn, 5.0);
      glow = light * level * shade * (1.0 - 0.7 * fresnel);
      outAlbedo = fGlass * (0.7 + 0.5 * h.z);
      shine = 1.0;
      fRough = 0.05 + 0.14 * h.y; // panes catch reflections a little differently
      fBend = (T * (h.x - 0.5) + vec3(0.0, h.z - 0.5, 0.0)) * 0.05 * detail;
    }
  }
  // Far away: one cell per pixel or less, so draw its average instead of picking one room (no shimmer).
  float cover = fWin.x * fWin.y, avg = fLight.x * (office ? fOffices * 0.6 : shop ? 1.1 : fHomes * 0.5);
  vec3 hue = office ? mix(fCool, fWarm, 0.35) : mix(fWarm, fWarm2, 0.5);
  glow = mix(glow, hue * min(avg, 1.0) * fLight.y * 0.6 * cover, far);
  outAlbedo = mix(outAlbedo, mix(wall, fGlass, cover), far);
  shine = mix(shine, cover * 0.6, far);
  albedo = mix(albedo, outAlbedo, side);
  fGlow = glow * side;
  fShine = shine * side;
}
`;
