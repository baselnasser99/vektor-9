// The power plant, built in code for every plant tile and on the sample page (ADR-0018; it replaced the SECTOR 07
// glTF modelled in Blender).
import * as THREE from 'three';
import { palette } from './palette.js';
import { box, cyl, metric, part, rng } from './geometry.js';
import { pipe, warningLamp } from './parts.js';
import { OPERATORS, pick } from './world.js';

// A plant tile's plant (city.js buildCity): its own generator from the tile's seed, so the tile's other draws (its
// placement) stay as they were before plants were built in code.
export const plantOn = (kit, t) => powerPlant(kit, rng(t.s * 19 + 11), t.on);

// An aging grid plant on the 12 m lot, one of three layouts by the tile's own generator (rand), mirrored or not:
// a single hyperboloid cooling tower with one tall stack, twin smaller towers behind a long hall, or a squat reactor
// drum with two stacks. In front of each a turbine hall with a low gable roof, a ridge vent and a clerestory, a
// roll-shutter gate in a hazard frame with a door beside it, the operator's name over it; a transformer yard under a
// gantry; a low wall round the back. Silhouette first, light last: a dim amber clerestory and gate lamp, a faint warm
// glow deep inside each tower's throat, cold-white indicators, steady red lamps on the stacks and tower rims; all
// dark in a blackout (lit false). Small parts (fins, insulators, pipes, ladders, rails) go into `detail`.
export function powerPlant(kit, rand, lit) {
  const g = new THREE.Group(), d = new THREE.Group();
  d.name = 'detail';
  g.add(d);
  const off = (m) => (lit ? m : kit.steel(palette.charcoal, 0.6));
  const m = {
    soot: kit.concrete(palette.blackenedConcrete), shell: kit.concrete(palette.weatheredConcrete), apron: kit.concrete(palette.slate),
    steel: kit.mat('rusty_painted_metal', palette.gunmetal, 0.7), ti: kit.mat('rusty_painted_metal', palette.weatheredTitanium, 0.6),
    scorch: kit.mat('rusty_painted_metal', palette.scorched, 0.85), sheet: kit.mat('box_profile_metal_sheet', palette.gunmetal),
    dark: kit.steel(palette.charcoal, 0.6), mech: kit.steel(palette.slate, 0.6), hazard: kit.steel(palette.hazardPaint, 0.7),
    amber: off(kit.glow(palette.dirtyAmber, 0.6)), lamp: off(kit.glow(palette.dirtyAmber, 1.2)), ice: off(kit.glow(palette.coldWhite, 0.8)),
    throat: off(kit.glow(palette.dirtyAmber, 0.25)), sign: off(kit.sign(pick(rand, OPERATORS), palette.coldWhite)),
  };
  const layout = Math.floor(rand() * 3), sx = rand() < 0.5 ? 1 : -1, X = (x) => sx * x;
  const red = (x, y, z) => lit && warningLamp(kit, g, X(x), y, z, 0.45);
  g.userData = { layout: ['tower', 'twin', 'reactor'][layout], mirrored: sx < 0 }; // for the tests

  part(g, box(12, 0.25, 12, 0), m.apron, 0, 0.125, 0); // the yard
  part(g, box(12, 1.1, 0.3, 0), m.soot, 0, 0.8, -5.85); // a low wall round the back and sides
  for (const x of [-5.85, 5.85]) part(g, box(0.3, 1.1, 7, 0), m.soot, x, 0.8, -2.5);

  // Cooling tower: a hyperboloid shell (outer and inner faces), a sooted band at the lip, a dim glow deep in its
  // throat, red lamps on the rim.
  const tower = (x, z, r, h) => {
    const prof = [[r, 0], [r * 0.84, h * 0.3], [r * 0.7, h * 0.68], [r * 0.72, h * 0.86], [r * 0.76, h]];
    const lathe = (pts, mat) => {
      const geo = new THREE.LatheGeometry(pts.map(([a, b]) => new THREE.Vector2(a, b)), 20);
      geo.normalizeNormals(); // three leaves the end rings' normals unnormalized
      part(g, metric(geo, () => [2 * Math.PI * r, h]), mat, X(x), 0.25, z);
    };
    lathe(prof.slice(0, 4), m.shell);
    lathe(prof.slice(3), m.scorch);
    lathe(prof.map(([a, b]) => [a - 0.25, b]).reverse(), m.scorch);
    part(g, new THREE.RingGeometry(r * 0.76 - 0.25, r * 0.76, 20).rotateX(-Math.PI / 2), m.scorch, X(x), h + 0.25, z);
    part(g, new THREE.CircleGeometry(r * 0.7 - 0.25, 16).rotateX(-Math.PI / 2), m.throat, X(x), h * 0.55, z);
    for (let k = 0; k < 6; k++) part(d, box(0.35, 2.2, 0.35, 0), m.dark, X(x + Math.cos(k) * r * 0.97), 1.35, z + Math.sin(k) * r * 0.97); // the legs' lintels
    for (const a of [0.4, 0.4 + Math.PI]) red(x + Math.cos(a) * r * 0.76, h + 0.5, z + Math.sin(a) * r * 0.76);
  };
  // Stack: tapered steel, two hazard bands, a sooted head, a ladder, a red lamp.
  const stack = (x, z, h, r = 0.75) => {
    part(g, cyl(r * 0.7, r, h, 12), m.steel, X(x), h / 2 + 0.25, z);
    for (const f of [0.62, 0.84]) part(g, cyl(r * (1 - 0.3 * f) + 0.06, r * (1 - 0.3 * f) + 0.06, 0.9, 12), m.hazard, X(x), h * f + 0.25, z);
    part(g, cyl(r * 0.72, r * 0.72, 1.4, 12), m.scorch, X(x), h - 0.4, z);
    part(d, box(0.06, h - 2, 0.5, 0), m.dark, X(x + r + 0.12), h / 2, z);
    red(x, h + 0.6, z);
  };
  // Turbine hall at the front: concrete walls, a low gable of metal sheet with a ridge vent, a dim clerestory, the
  // gate in a hazard frame, a door, the operator's name and a lamp over the gate.
  const hall = (x, z, w, h, dd) => {
    const front = z + dd / 2;
    part(g, box(w, h, dd, 1), m.soot, X(x), h / 2 + 0.25, z);
    for (const s of [1, -1]) part(g, box(w + 0.4, 0.18, dd / 2 + 0.5, 0), m.sheet, X(x), h + 0.25 + dd * 0.09, z + s * dd / 4).rotation.x = s * 0.34;
    part(g, box(w * 0.8, 0.7, 0.9, 0), m.mech, X(x), h + 0.25 + dd * 0.2, z);
    part(g, box(w - 1, 0.5, 0.06, 0), m.amber, X(x), h - 0.6, front + 0.02);
    part(g, box(w - 1, 0.5, 0.06, 0), m.amber, X(x), h - 0.6, z - dd / 2 - 0.02);
    const gx = x - sx * w * 0.12; // the gate, off centre
    part(g, box(3.2, 3.6, 0.08, 0), m.dark, X(gx), 2.05, front + 0.03);
    for (const s of [-1, 1]) part(g, box(0.3, 4, 0.2, 0), m.hazard, X(gx) + s * 1.75, 2.25, front + 0.08);
    part(g, box(3.8, 0.3, 0.2, 0), m.hazard, X(gx), 4.25, front + 0.08);
    part(g, box(0.5, 0.18, 0.3, 0), m.lamp, X(gx), 4.6, front + 0.2);
    const door = gx + sx * 2.7;
    part(g, box(1, 2.2, 0.08, 0), m.mech, X(door), 1.35, front + 0.03);
    part(g, box(0.15, 0.15, 0.08, 0), m.ice, X(door) + 0.7, 1.6, front + 0.05);
    part(g, box(Math.min(5, w - 1.5), 0.9, 0.2, 1), m.sign, X(x), Math.min(h - 1.6, 5.6), front + 0.12);
    pipe(kit, d, [[X(x - w / 2 - 0.4), 0.4, z - dd / 4], [X(x - w / 2 - 0.4), h + 0.6, z - dd / 4]], 0.22, m.steel, 8);
  };
  // Transformers under a gantry, with fins, insulators and a cold-white indicator each.
  const yard = (x, z, n) => {
    for (let k = 0; k < n; k++) {
      const tz = z + (k - (n - 1) / 2) * 1.9;
      part(g, box(1.6, 1.9, 1.3, 1), m.mech, X(x), 1.2, tz);
      for (const s of [-1, 1]) for (let f = 0; f < 3; f++) part(d, box(0.06, 1.5, 0.9, 0), m.dark, X(x + s * (0.85 + f * 0.12)), 1.1, tz);
      for (const s of [-0.45, 0, 0.45]) part(d, cyl(0.09, 0.12, 0.9, 6), m.ti, X(x + s), 2.6, tz);
      part(g, box(0.12, 0.12, 0.05, 0), m.ice, X(x), 1.7, tz + 0.68);
    }
    const span = n * 1.9 + 0.6;
    for (const s of [-1, 1]) part(g, box(0.25, 5.2, 0.25, 0), m.steel, X(x + s * 1.2), 2.85, z + span / 2 - 0.3);
    part(g, box(2.7, 0.3, 0.3, 0), m.steel, X(x), 5.4, z + span / 2 - 0.3);
    part(g, box(1.1, 0.12, span, 0), m.hazard, X(x + 1.4), 0.31, z); // painted keep-out strip on the apron
  };

  if (layout === 0) { // one big tower, a stack, the hall and the yard in front
    tower(2.4, -2.4, 3.5, 22 + rand() * 6);
    stack(-4.6, -4.6, 30 + rand() * 6);
    hall(-1.9, 3.2, 7.6, 6.5 + rand() * 1.5, 5);
    yard(4.4, 3.4, 2);
    pipe(kit, d, [[X(-1), 6, 0.7], [X(-1), 6, -1], [X(0.2), 6, -2.4]], 0.3, m.steel, 8);
  } else if (layout === 1) { // twin towers behind a long hall
    const h = 16 + rand() * 3;
    tower(-3.1, -3.0, 2.6, h);
    tower(3.1, -3.0, 2.5, h - 2 - rand() * 2);
    hall(-1.5, 3.6, 8.6, 5.5 + rand(), 4.2);
    yard(4.6, 3.4, 1);
    stack(-5, 1.2, 22 + rand() * 4, 0.5);
  } else { // a reactor drum under an armoured band and a cap, two stacks
    const r = 3.2, h = 12 + rand() * 4;
    part(g, cyl(r * 0.96, r, h, 20), m.soot, X(2.5), h / 2 + 0.25, -2.4);
    part(g, cyl(r + 0.15, r + 0.15, 1.6, 20), m.steel, X(2.5), h * 0.7, -2.4);
    for (let k = 0; k < 8; k++) part(g, box(0.5, 0.35, 0.08, 0), m.amber, X(2.5 + Math.cos(k * 0.785) * (r + 0.2)), h * 0.7, -2.4 + Math.sin(k * 0.785) * (r + 0.2)).rotation.y = -k * 0.785 + Math.PI / 2;
    part(g, cyl(r * 0.45, r * 0.96, 2.2, 20), m.ti, X(2.5), h + 1.35, -2.4);
    part(g, cyl(0.6, 0.6, 1.4, 10), m.scorch, X(2.5), h + 3.1, -2.4);
    for (let k = 0; k < 4; k++) part(g, box(0.5, h * 0.9, 0.7, 0), m.soot, X(2.5 + Math.cos(k * 1.571 + 0.785) * (r + 0.2)), h * 0.45 + 0.25, -2.4 + Math.sin(k * 1.571 + 0.785) * (r + 0.2)).rotation.y = -(k * 1.571 + 0.785);
    red(2.5, h + 4, -2.4);
    stack(-4.7, -4.6, 26 + rand() * 6, 0.6);
    stack(-2.9, -4.6, 20 + rand() * 4, 0.5);
    hall(-1.9, 3.2, 7.6, 7 + rand(), 5);
    yard(4.4, 3.6, 2);
    pipe(kit, d, [[X(-1.5), 7, 0.7], [X(-1.5), 7, -1.2], [X(0), 7, -2.4]], 0.32, m.steel, 8);
  }
  return g;
}
