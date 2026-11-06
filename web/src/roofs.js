// Rooftops for the building families (families.js): what sits on a building's roof, from its family and height.
// Each family has four roof types it can use; which one a building gets steps through that list by tile position
// (col + 2 x row), so no two neighbouring buildings of one family share a roof type, and stays fixed while the
// building stands. The seed only sizes and places the parts. Roofs are flat and modern: parapets, plant rooms,
// stepped crowns, cooling units, masts, terraces and utility gear, in the facade's own materials; the only sloped
// roof is a flat-topped mansard on the odd old building. Small parts go to the near-camera detail layer (c.d).
import * as THREE from 'three';
import { palette } from './palette.js';
import { box, cyl, part } from './geometry.js';
import { F } from './world.js';
import { warningLamp } from './parts.js';

const AVIATION = 24; // floors from which a tower carries red aviation lamps on two roof corners

// Roof types per family; tall buildings (16+ floors) use the second list.
const CHOICES = {
  apartment: [['parapet', 'hvac', 'terrace', 'utility'], ['penthouse', 'terrace', 'hvac', 'antenna']],
  office: [['penthouse', 'hvac', 'parapet', 'antenna'], ['stepped', 'penthouse', 'crown', 'antenna']],
  old: [['parapet', 'utility', 'parapet', 'hvac'], ['parapet', 'utility', 'hvac', 'utility']],
  luxury: [['terrace', 'stepped', 'crown', 'penthouse'], ['terrace', 'stepped', 'crown', 'penthouse']],
  industrial: [['utility', 'hvac', 'utility', 'parapet'], ['utility', 'hvac', 'utility', 'parapet']],
  mega: [['antenna', 'penthouse', 'crown', 'hvac'], ['antenna', 'penthouse', 'crown', 'hvac']],
};
const OFFSET = { apartment: 0, office: 1, old: 2, luxury: 3, industrial: 1, mega: 2 }; // so families do not line up

// The roof type for a building: its family's list, stepped by tile position. A historic old building (one in nine,
// 4 to 12 floors) gets a mansard instead.
export function roofType(family, t, slot) {
  if (family === 'old' && t.f >= 4 && t.f <= 12 && t.s % 9 === 0) return 'mansard';
  const list = CHOICES[family][t.f >= 16 ? 1 : 0];
  return list[(slot + OFFSET[family]) % list.length];
}

// Builds the roof on a top volume w x d whose roof is at height y, centred at (x, z). wall: the facade material, for
// parts that are more building; glass: whether that facade is a curtain wall. Returns whether the middle of the
// roof is left free (for a billboard).
export function roof(c, type, w, d, y, wall, glass, x = 0, z = 0) {
  const g = new THREE.Group(), small = new THREE.Group();
  g.position.set(x, y, z);
  small.position.set(x, y, z);
  c.g.add(g);
  c.d.add(small);
  const r = { ...c, g, d: small, w, d2: d, wall, glass, edge: glass ? c.kit.steel(palette.charcoal, 0.5) : c.kit.concrete(palette.gunmetal) };
  if (c.f >= AVIATION) for (const s of [-1, 1]) lamp(r, s * (w / 2 - 0.3), 1.2, s * (d / 2 - 0.3));
  accent(r, y);
  return ROOFS[type](r);
}

// Architectural light on a few lit buildings of 10+ floors, picked by a hash of the building (not the seeded
// random, so nothing else about the building changes): about one in eight gets a thin strip round its roof edge,
// most dim crimson, now and then magenta or cyan; the tallest few of those also get a light line up one corner.
// The strips use materials the city already has (the warning lamp's crimson, the mega towers' cyan seams), so
// they merge into existing draw calls; magenta adds one.
function accent(r, y) {
  if (!r.lit || r.f < 10) return;
  const h = Math.abs(Math.sin(r.H * 12.9898 + r.w * 78.233 + r.d2 * 3.71) * 43758.5453) % 1;
  if (h > 0.125) return;
  const glow = h < 0.08 ? r.kit.warning() : h < 0.1 ? r.kit.glow(palette.neonMagenta, 1.2) : r.kit.glow(palette.neonCyan, 1.6);
  for (const s of [-1, 1]) {
    part(r.g, box(r.w, 0.16, 0.14, 0), glow, 0, 0.1, s * (r.d2 / 2 + 0.05));
    part(r.g, box(0.14, 0.16, r.d2, 0), glow, s * (r.w / 2 + 0.05), 0.1, 0);
  }
  if (r.f >= 28 && h < 0.04) part(r.g, box(0.22, y * 0.45, 0.22, 0), glow, r.w / 2 + 0.08, -y * 0.225, r.d2 / 2 + 0.08);
}

// ---- parts -------------------------------------------------------------------------------------------------------

// A warning lamp on lit buildings only, on machinery, masts and tall corners.
function lamp(r, x, y, z) {
  if (r.lit) warningLamp(r.kit, r.g, x, y, z, 0.7);
}

// A parapet: a low wall round the roof edge, in the facade's edge material.
function parapet(r, h = 1, w = r.w, d = r.d2) {
  for (const s of [-1, 1]) {
    part(r.g, box(w, h, 0.3, 0), r.edge, 0, h / 2, s * (d / 2 - 0.15));
    part(r.g, box(0.3, h, d - 0.6, 0), r.edge, s * (w / 2 - 0.15), h / 2, 0);
  }
}

// Packaged cooling units with a fan on top, in a row along x from x0, n of them.
function coolers(r, n, x0, z, step = 2.4) {
  const { steel, slab } = r.m;
  for (let k = 0; k < n; k++) {
    part(r.d, box(2, 1.2, 1.6, 0), slab, x0 + k * step, 0.6, z);
    part(r.d, cyl(0.55, 0.55, 0.12, 6), steel, x0 + k * step, 1.26, z);
  }
}

// A box of plant h tall standing at height oy: solid below, louvres above, a cap.
function plantRoom(r, pw, pd, h, ox = 0, oz = 0, oy = 0) {
  const { kit } = r;
  part(r.g, box(pw, h * 0.45, pd, 0), r.glass ? kit.steel(palette.gunmetal, 0.6) : kit.concrete(palette.slate), ox, oy + h * 0.225, oz);
  part(r.g, box(pw - 0.2, h * 0.55, pd - 0.2, 0), kit.mat('metal_grate_rusty', palette.gunmetal), ox, oy + h * 0.725, oz);
  part(r.g, box(pw + 0.3, 0.3, pd + 0.3, 0), kit.steel(palette.charcoal), ox, oy + h + 0.15, oz);
}

// A box w x d at the bottom narrowing to k of that at the top, h tall: a mansard's slopes with a flat top.
function frustum(w, d, h, k) {
  const geo = new THREE.BoxGeometry(w, h, d), p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) if (p.getY(i) > 0) p.setXYZ(i, p.getX(i) * k, p.getY(i), p.getZ(i) * k);
  geo.computeVertexNormals();
  return geo;
}

// ---- the roof types ----------------------------------------------------------------------------------------------

const ROOFS = {
  // Flat roof behind a parapet, a few units and a hatch.
  parapet(r) {
    parapet(r);
    coolers(r, 1 + (r.seed % 2), -r.w / 4, -r.d2 / 4);
    part(r.d, box(1, 0.8, 1, 0), r.m.steel, r.w / 4, 0.4, r.d2 / 4); // roof hatch
    return true;
  },
  // A mechanical penthouse set to one side, louvred, with exhaust fans on top.
  penthouse(r) {
    parapet(r, 0.8);
    const pw = r.w * 0.55, pd = r.d2 * 0.5, side = r.seed % 2 ? 1 : -1, h = 1.6 * F;
    plantRoom(r, pw, pd, h, side * (r.w - pw) * 0.25, -side * (r.d2 - pd) * 0.2);
    if (r.seed % 2 === 0) lamp(r, side * (r.w - pw) * 0.25 + pw / 2, h + 0.45, -side * (r.d2 - pd) * 0.2 + pd / 2); // fan plant
    for (const k of [-1, 1]) part(r.d, cyl(0.6, 0.6, 0.8, 6), r.m.steel, side * (r.w - pw) * 0.25 + k * pw * 0.25, h + 0.7, 0);
    return false;
  },
  // Two or three storeys stepping in, in the facade's own material, a plant room on the last.
  stepped(r) {
    let w = r.w, d = r.d2, y = 0;
    for (let k = 0; k < 2 + (r.seed % 2); k++) {
      w *= 0.76;
      d *= 0.76;
      part(r.g, box(w, F, d, 1), r.wall, 0, y + F / 2, 0);
      part(r.g, box(w + 0.3, 0.4, d + 0.3, 1), r.kit.steel(palette.charcoal), 0, y + F + 0.2, 0);
      y += F + 0.4;
    }
    plantRoom(r, w * 0.6, d * 0.6, F, 0, 0, y);
    if (r.lit) part(r.g, box(w + 0.35, 0.12, d + 0.35, 0), r.kit.glow(palette.warmWindow, 0.9), 0, y - 0.05, 0); // a lit band
    return false;
  },
  // A field of cooling units in rows, behind a low parapet.
  hvac(r) {
    parapet(r, 0.7);
    const rows = Math.max(1, Math.floor((r.d2 - 2) / 2.6)), per = Math.max(1, Math.floor((r.w - 2) / 2.4));
    for (let k = 0; k < rows; k++) coolers(r, per, -(per - 1) * 1.2, -(rows - 1) * 1.3 + k * 2.6);
    if (r.seed % 3 === 0) lamp(r, -(per - 1) * 1.2 - 0.8, 1.35, -(rows - 1) * 1.3 - 0.6); // a unit's fault light
    return false;
  },
  // A communications mast on an equipment shelter, dishes, steady red lamps.
  antenna(r) {
    parapet(r, 0.8);
    const { kit } = r, h = 5 + (r.seed % 3) * 2.5, side = r.seed % 2 ? 1 : -1, mx = side * r.w * 0.2;
    part(r.g, box(r.w * 0.4, 2.6, r.d2 * 0.35, 0), kit.steel(palette.gunmetal, 0.6), -mx, 1.3, 0); // shelter
    part(r.g, box(0.7, h, 0.7, 0), kit.mat('metal_grate_rusty', palette.gunmetal), mx, h / 2, r.d2 * 0.2);
    for (const k of [0.45, 0.75]) {
      const dish = part(r.d, new THREE.SphereGeometry(0.9, 8, 3, 0, Math.PI * 2, 0, Math.PI / 4), r.m.steel, mx + 0.6, h * k, r.d2 * 0.2);
      dish.rotation.z = -1.1;
    }
    for (const k of [0.5, 1]) part(r.g, new THREE.SphereGeometry(0.22, 8, 6), kit.warning(), mx, h * k + 0.2, r.d2 * 0.2);
    return false;
  },
  // A planted terrace: glass rail, planters along two sides, a glazed pavilion and a pergola.
  terrace(r) {
    const { kit } = r, { steel, slab, green } = r.m;
    for (const s of [-1, 1]) {
      part(r.d, box(r.w - 0.4, 0.08, 0.08, 0), steel, 0, 1.1, s * (r.d2 / 2 - 0.1));
      part(r.d, box(r.w * 0.7, 0.5, 0.7, 0), slab, 0, 0.25, s * (r.d2 / 2 - 0.7));
      part(r.d, box(r.w * 0.7 - 0.2, 0.35, 0.5, 0), green, 0, 0.67, s * (r.d2 / 2 - 0.7));
    }
    parapet(r, 0.4);
    const pw = r.w * 0.38, side = r.seed % 2 ? 1 : -1;
    part(r.g, box(pw, F * 0.9, r.d2 * 0.4, 0), kit.windows(r.seed, r.lit, false, 'luxury'), side * r.w * 0.22, F * 0.45, 0);
    part(r.g, box(pw + 0.4, 0.3, r.d2 * 0.4 + 0.4, 0), kit.steel(palette.charcoal), side * r.w * 0.22, F * 0.9 + 0.15, 0);
    for (let k = 0; k < 4; k++) part(r.d, box(0.15, 0.15, r.d2 * 0.35, 0), steel, -side * r.w * 0.2 + (k - 1.5) * 0.9, 2.6, 0); // pergola
    return false;
  },
  // Utility roof: water tanks on a steel frame, a cooling tower, ducts.
  utility(r) {
    parapet(r, 0.8);
    const { steel, slab } = r.m, side = r.seed % 2 ? 1 : -1;
    for (const k of [-1, 1]) {
      for (const [lx, lz] of [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]]) part(r.d, box(0.15, 1.6, 0.15, 0), steel, side * r.w * 0.22 + lx, 0.8, k * r.d2 * 0.22 + lz);
    }
    for (const k of [-1, 1]) part(r.g, cyl(1.2, 1.2, 2.2, 8), r.kit.concrete(palette.gunmetal), side * r.w * 0.22, 2.7, k * r.d2 * 0.22);
    part(r.g, cyl(1.5, 2.1, 3.4, 10), r.kit.concrete(palette.slate), -side * r.w * 0.22, 1.7, 0); // cooling tower
    if (r.seed % 2) lamp(r, -side * r.w * 0.22 + 1.45, 3.5, 0);
    part(r.d, box(r.w * 0.4, 0.7, 0.7, 0), slab, 0, 0.35, r.d2 * 0.35); // duct
    return false;
  },
  // A distinctive crown, rare: a ring of tall fins, a halo roof floating on posts, or a top sliced at an angle.
  crown(r) {
    const { kit } = r, frame = kit.steel(palette.gunmetal, 0.4), accent = r.lit && kit.glow(r.glass ? palette.glare : palette.warmWindow, 1);
    const kind = r.seed % 3;
    if (kind === 0) { // fins
      const h = 2 * F, n = Math.max(3, Math.round(r.w / 1.5));
      for (let k = 0; k < n; k++) {
        const v = -r.w / 2 + (k + 0.5) * (r.w / n);
        for (const s of [-1, 1]) part(r.g, box(0.25, h, 0.9, 0), frame, v, h / 2, s * (r.d2 / 2 - 0.45));
      }
      plantRoom(r, r.w * 0.5, r.d2 * 0.5, F, 0, 0);
      if (accent) part(r.g, box(r.w, 0.12, r.d2, 0), accent, 0, h, 0);
    } else if (kind === 1) { // halo roof on posts
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) part(r.g, box(0.5, 2 * F, 0.5, 0), frame, sx * r.w * 0.35, F, sz * r.d2 * 0.35);
      part(r.g, box(r.w + 1.6, 0.5, r.d2 + 1.6, 1), frame, 0, 2 * F + 0.25, 0);
      plantRoom(r, r.w * 0.45, r.d2 * 0.45, F, 0, 0);
      if (accent) part(r.g, box(r.w + 1.7, 0.12, r.d2 + 1.7, 0), accent, 0, 2 * F, 0);
    } else { // sliced: the top storeys cut at an angle, a glazed slope
      const h = 2 * F;
      part(r.g, box(r.w, h * 0.5, r.d2, 1), r.wall, 0, h * 0.25, 0);
      const slope = part(r.g, box(r.w, 0.4, Math.hypot(r.d2, h * 0.5), 0), kit.steel(palette.charcoal, 0.5), 0, h * 0.75, 0);
      slope.rotation.x = Math.atan2(h * 0.5, r.d2);
      if (accent) part(r.g, box(r.w + 0.1, 0.12, 0.12, 0), accent, 0, h * 0.5, r.d2 / 2);
    }
    return false;
  },
  // Mansard: steep slate sides to a flat top, with dormers; the one sloped roof, on historic old buildings.
  mansard(r) {
    const { kit } = r, h = 1.4 * F, slate = kit.steel(palette.gunmetal, 0.7);
    part(r.g, frustum(r.w, r.d2, h, 0.6), slate, 0, h / 2, 0);
    for (const s of [-1, 1]) for (const k of [-1, 1]) part(r.g, box(1.2, 1.5, 1, 0), kit.windows(r.seed, r.lit, true, 'old'), k * r.w * 0.22, h * 0.4, s * r.d2 * 0.36);
    part(r.g, box(r.w * 0.6, 0.3, r.d2 * 0.6, 0), kit.steel(palette.charcoal), 0, h + 0.15, 0);
    return false;
  },
};
