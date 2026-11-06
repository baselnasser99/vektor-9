// Rooftop power and communications (roofs.js): massive armoured energy reactors built into the tops of towers, and
// reinforced communication spires, modelled in Blender (tools/blender/rooftop_tech.py, ADR-0005) for a 10 m roof
// and scaled to the roof they stand on. A reactor is not a prop on the roof: its housing rises straight out of it,
// and the building's top is reworked round it (an armoured containment crown on the roof edge, buttresses from the
// housing's feet to the crown's corners, corner ribs running down the top floors and energy conduits down two
// faces). One architectural language for all of it: midnight-blue steel, graphite, weathered gunmetal and blackened
// titanium; light only from the energy chamber (kit.core, animated in its shader), thin blood-red seams, small red
// lamps and the odd cool technical light. Every part maps onto the same few materials, so it all merges into a few
// draw calls.
import * as THREE from 'three';
import { palette } from './palette.js';
import { box, part, rng } from './geometry.js';
import { F } from './world.js';

// The models as built (m): across their feet and their ribs (the housing), and where a mast stands on a landmark.
// industrial is 9.6 x 7 m and placed by its long side.
const MODELS = {
  core_mid_a: { feet: 8.3, ribs: 6.9 }, core_mid_b: { feet: 8.9, ribs: 7.1 }, core_landmark: { feet: 10.7, ribs: 8.3, mast: 7.6 },
  core_industrial: { long: 9.6, short: 7 }, comm_spire_a: {}, comm_spire_b: {},
};
export const ROOFTECH = Object.keys(MODELS); // to load (main.js)

// Reactor kinds: the smallest roof side each needs, the share of it the housing spans, and the kind to use instead
// on a roof too small for it. signature: the three signature towers' crown, a landmark reactor with a central mast.
const KINDS = {
  mid: { min: 7, share: [0.56, 0.64] },
  industrial: { min: 8, minLong: 10, instead: 'mid' },
  landmark: { min: 9, share: [0.62, 0.62], instead: 'industrial' },
  signature: { min: 6, share: [0.66, 0.66], model: 'landmark' },
};

// The materials each role of the models takes, per kit and lighting (lit false: a blackout, every light dark steel).
const ROLES = new WeakMap();
function roles(kit, lit) {
  if (!ROLES.has(kit)) ROLES.set(kit, {});
  const cache = ROLES.get(kit);
  if (cache[lit]) return cache[lit];
  const dark = kit.steel(palette.charcoal, 0.6), on = (m) => (lit ? m : dark);
  return (cache[lit] = {
    steel: kit.steel(palette.charcoal, 0.45), graphite: kit.steel(palette.graphite, 0.55), gun: kit.steel(palette.wornGunmetal, 0.6),
    plate: kit.steel(palette.deepNavy, 0.35), dark,
    core: on(kit.core(0)), corehot: on(kit.core(1)), seam: on(kit.glow(palette.coreBlood, 1.4)), red: on(kit.warning()),
    ice: on(kit.glow(palette.coldWhite, 0.8)),
  });
}

// One model at (x, y, z) on parent g, scaled k (and ky up), turned by a. Each model is given its materials and
// folded once per lighting; every placement is a clone of that, sharing its geometry and materials.
const TEMPLATES = new WeakMap();
function place(kit, lit, g, name, x, y, z, k, a = 0, ky = k) {
  if (!TEMPLATES.has(kit)) TEMPLATES.set(kit, new Map());
  const cache = TEMPLATES.get(kit), key = `${name}:${lit}`;
  if (!cache.has(key)) cache.set(key, kit.foldDetail(kit.model(name, roles(kit, lit))));
  const m = cache.get(key).clone();
  m.position.set(x, y, z);
  m.scale.set(k, ky, k);
  m.rotation.y = a;
  g.add(m);
  return m;
}

// A communication spire on roof group g at (x, y, z), about h metres tall (modelled 10 m; its footing scales less
// than its height, so a tall one stays slender). rand picks the design.
export function commSpire(kit, lit, g, x, y, z, h, rand) {
  const k = Math.min(1.1, 0.55 + h * 0.035);
  return place(kit, lit, g, rand() < 0.5 ? 'comm_spire_a' : 'comm_spire_b', x, y, z, k, Math.floor(rand() * 4) * (Math.PI / 2), h / 10);
}

// A bar of material mat from point a to point b, t thick (buttresses).
const UP = new THREE.Vector3(0, 1, 0);
function bar(g, mat, a, b, t) {
  const v = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const m = part(g, box(t, Math.round(v.length() * 10) / 10, t, 0), mat, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  m.quaternion.setFromUnitVectors(UP, v.normalize());
}

// Ties a reactor into its building's top (r: the roof; reach: how far the housing's feet reach from its centre):
// an armoured containment crown on the roof edge (in place of a parapet), buttresses from the feet to its corners,
// corner ribs down the top two floors, and on the two faces along x an energy conduit down the top two floors,
// glowing in a recessed channel. Ribs and conduits never reach below the top volume's walls (r.below). Simple
// boxes in the reactors' own materials.
function integrate(r, M, reach) {
  const { w, d2: d, g } = r, t = 0.4, hc = 0.7, down = Math.max(0, Math.min(2 * F, r.below - 0.8));
  for (const s of [-1, 1]) {
    part(g, box(w + 0.2, hc, t, 0), M.plate, 0, hc / 2, s * (d / 2 - t / 2));
    part(g, box(t, hc, d - 2 * t, 0), M.plate, s * (w / 2 - t / 2), hc / 2, 0);
    part(g, box(w + 0.5, 0.18, 0.6, 0), M.gun, 0, hc + 0.09, s * (d / 2 - 0.2)); // coping
    part(g, box(0.6, 0.18, d, 0), M.gun, s * (w / 2 - 0.2), hc + 0.09, 0);
  }
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    // A corner rib: from the top floors up through the crown, so the facade carries into the containment.
    part(g, box(0.75, down + hc + 0.5, 0.75, 0), M.gun, sx * (w / 2 + 0.12), (hc + 0.5 - down) / 2, sz * (d / 2 + 0.12));
    // A buttress from the housing's foot out to the crown's corner.
    const ax = sx * reach * 0.62, az = sz * reach * 0.62, bx = sx * (w / 2 - 0.7), bz = sz * (d / 2 - 0.7);
    if (Math.hypot(bx - ax, bz - az) > 0.8) bar(g, M.gun, [ax, 0.35, az], [bx, hc - 0.1, bz], 0.5);
  }
  if (down > 1.5) for (const s of [-1, 1]) { // energy conduits down the middle of the two faces along x
    const z = s * (d / 2 + 0.2);
    part(g, box(1.0, down, 0.4, 0), M.steel, 0, -down / 2 + 0.2, z);
    part(g, box(0.26, down - 0.6, 0.08, 0), M.core, 0, -down / 2 + 0.2, s * (d / 2 + 0.42));
    part(g, box(1.2, 0.3, 0.55, 0), M.gun, 0, -down + 0.2, z); // its foot
  }
}

// Builds a reactor roof of the given kind (KINDS) on r (roofs.js: kit, g, w, d2, f, below, s tile seed, lit), tied
// into the building, and on a few a spire: on a landmark's crown as its central mast, or beside an industrial plant
// on its own footing, never through a housing. A roof too small for the kind gets the smaller kind it names, or
// nothing (returns false; the caller then draws an ordinary roof).
export function reactorRoof(r, kind) {
  const s = Math.min(r.w, r.d2), long = Math.max(r.w, r.d2), rand = rng(r.s * 7919 + 13);
  while (kind && (s < KINDS[kind].min || long < (KINDS[kind].minLong ?? 0))) kind = KINDS[kind].instead;
  if (!kind) return false;
  const M = roles(r.kit, r.lit), ky = 1 + Math.min(Math.max(r.f - 10, 0), 20) * 0.012; // taller towers, a taller housing
  if (kind === 'industrial') {
    const { long: ml, short: ms } = MODELS.core_industrial, k = Math.min((long * 0.8) / ml, (s * 0.8) / ms), along = r.w >= r.d2;
    place(r.kit, r.lit, r.g, 'core_industrial', 0, 0, 0, k, (along ? 0 : Math.PI / 2) + (rand() < 0.5 ? Math.PI : 0), k * ky);
    integrate(r, M, (ml / 2) * k);
    if (r.s % 3 === 0 && long - ml * k > 3.4) commSpire(r.kit, r.lit, r.g, along ? r.w / 2 - 1.3 : 0, 0, along ? 0 : r.d2 / 2 - 1.3, 8 + rand() * 4, rand);
    return true;
  }
  const landmark = (KINDS[kind].model ?? kind) === 'landmark', name = landmark ? 'core_landmark' : `core_mid_${rand() < 0.5 ? 'a' : 'b'}`;
  const { feet, ribs, mast } = MODELS[name], [lo, hi] = KINDS[kind].share;
  const k = Math.min(((lo + rand() * (hi - lo)) * s) / ribs, (s - 1.4) / feet); // its feet well inside the crown
  place(r.kit, r.lit, r.g, name, 0, 0, 0, k, landmark ? rand() * Math.PI * 2 : Math.floor(rand() * 8) * (Math.PI / 4), k * ky);
  integrate(r, M, (feet / 2) * k);
  const signature = kind === 'signature';
  if (landmark && (signature || r.s % 3 === 0)) commSpire(r.kit, r.lit, r.g, 0, mast * k * ky, 0, signature ? 18 + r.f * 0.15 : 10 + rand() * 4, rand);
  return true;
}
