// Street level: asphalt roadways with lane markings, zebra crossings and planted medians on the avenues, raised sidewalks with curbs around every
// sector, a cross of service alleys and pedestrian lanes through each sector, sodium lamps along the curbs, and the traffic lanes cars drive in.
import * as THREE from 'three';
import { palette } from './palette.js';
import { box, part, rng } from './geometry.js';
import { streetLamp } from './parts.js';
import { radialTexture } from './textures.js';
import { ALLEY, BLOCK, HALF, SIDEWALK, STREET, TILE } from './world.js';

const ROADWAY = STREET - 2 * SIDEWALK;
const LANES = [1.9, 5.7]; // lane centres from the street's centre line; positive side drives toward +axis
const LAMP_EVERY = 55;

// Centre lines of the main streets: around the city edge and between sectors. Same for x and z.
export function streetLines({ n, pos }) {
  const lines = [];
  for (let k = 0; k < n / BLOCK; k++) lines.push(pos(k * BLOCK) - TILE / 2 - STREET / 2);
  lines.push(pos(n - 1) + TILE / 2 + STREET / 2);
  return lines;
}

export function buildStreets(kit, layout, root) {
  const { n, pos } = layout, lines = streetLines(layout), [lo, hi] = [lines[0] - STREET / 2, lines.at(-1) + STREET / 2];
  const rand = rng(31);

  const asphalt = kit.mat('aerial_asphalt_01', palette.gunmetal).clone();
  asphalt.roughness = 0.55; // wet, but not a mirror
  part(root, box(hi - lo + 80, 0.1, hi - lo + 80, 0), asphalt, 0, -0.05, 0);

  // Sectors: raised paving out to the curb, a curb line, and an alley cross through the middle.
  const paving = kit.concrete(palette.slate), curb = kit.concrete(palette.roseGrey), alley = kit.mat('aerial_asphalt_01', palette.gunmetal);
  const planter = kit.concrete(palette.gunmetal), shrub = kit.concrete(palette.teal);
  for (let by = 0; by < n; by += BLOCK) {
    for (let bx = 0; bx < n; bx += BLOCK) {
      const [x0, x1] = [pos(bx) - TILE / 2 - SIDEWALK, pos(bx + BLOCK - 1) + TILE / 2 + SIDEWALK];
      const [z0, z1] = [pos(by) - TILE / 2 - SIDEWALK, pos(by + BLOCK - 1) + TILE / 2 + SIDEWALK];
      const [cx, cz, w, d] = [(x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0];
      part(root, box(w, 0.18, d, 0), paving, cx, 0.09, cz);
      for (const z of [z0, z1]) part(root, box(w, 0.22, 0.35, 0), curb, cx, 0.11, z);
      for (const x of [x0, x1]) part(root, box(0.35, 0.22, d, 0), curb, x, 0.11, cz);
      // Each half of the cross is a service alley (asphalt, dumpsters) or a paved pedestrian lane with planters,
      // so neighbouring sectors do not repeat.
      const [ax, az] = [pos(bx + HALF) - TILE / 2 - ALLEY / 2, pos(by + HALF) - TILE / 2 - ALLEY / 2];
      for (const [x, z, along, across] of [[ax, cz, d - 2 * SIDEWALK, 'z'], [cx, az, w - 2 * SIDEWALK, 'x']]) {
        const lane = rand() < 0.4, size = across === 'z' ? [ALLEY, 0.04, along] : [along, 0.04, ALLEY];
        part(root, box(...size, 0), lane ? curb : alley, x, 0.19, z);
        for (let k = 0; k < (lane ? 5 : 3); k++) {
          const s = (rand() - 0.5) * (along - 6), side = rand() < 0.5 ? -1 : 1;
          const [px, pz] = across === 'z' ? [x + side * 1.6, z + s] : [x + s, z + side * 1.6];
          const item = lane ? part(root, box(1.4, 0.6, 1.4, 1), planter, px, 0.5, pz)
            : part(root, box(1.2, 1.3, 1.9, 0), kit.steel(palette.gunmetal, 0.8), px, 0.85, pz);
          item.rotation.y = across === 'z' ? 0 : Math.PI / 2;
          if (lane) part(root, box(1.1, 0.25, 1.1, 1), shrub, px, 0.9, pz);
        }
      }
    }
  }

  markings(kit, root, lines, lo, hi);
  lamps(kit, root, lines, lo, hi);
  return { lanes: trafficLanes(lines, lo, hi), lines, lo, hi };
}

// Dashed lane dividers and a double centre line on every street, zebra crossings at every intersection.
function markings(kit, root, lines, lo, hi) {
  // Road paint is retroreflective: a faint glow so it reads at night without lamps on it.
  const paint = kit.glow(palette.cream, 0.35), median = kit.concrete(palette.roseGrey);
  const shrub = kit.concrete(palette.teal);
  const crossing = (v) => lines.some((c) => Math.abs(v - c) < STREET / 2 + 4);
  for (const c of lines) {
    for (let v = lo; v < hi; v += 10) {
      if (crossing(v) || crossing(v + 3)) continue;
      for (const off of [-3.8, 3.8]) {
        part(root, box(0.15, 0.02, 3, 0), paint, c + off, 0.01, v + 1.5);
        part(root, box(3, 0.02, 0.15, 0), paint, v + 1.5, 0.01, c + off);
      }
    }
    // Centre of each block-long stretch: a planted median on every other inner street (avenues), else a double line.
    const avenue = lines.indexOf(c) % 2 === 1 && c !== lines.at(-1);
    for (let k = 0; k < lines.length - 1; k++) {
      const [a, b] = [lines[k] + STREET / 2 + 4, lines[k + 1] - STREET / 2 - 4], len = b - a, mid = (a + b) / 2;
      if (avenue) {
        part(root, box(1.2, 0.25, len, 0), median, c, 0.12, mid);
        part(root, box(len, 0.25, 1.2, 0), median, mid, 0.12, c);
        for (let v = a + 6; v < b - 3; v += 12) {
          part(root, box(0.9, 0.5, 0.9, 1), shrub, c, 0.45, v);
          part(root, box(0.9, 0.5, 0.9, 1), shrub, v, 0.45, c);
        }
        continue;
      }
      for (const off of [-0.2, 0.2]) {
        part(root, box(0.12, 0.02, len, 0), paint, c + off, 0.01, mid);
        part(root, box(len, 0.02, 0.12, 0), paint, mid, 0.01, c + off);
      }
    }
    for (const c2 of lines) {
      for (const side of [-1, 1]) {
        const at = side * (STREET / 2 + 1.8);
        for (let s = -ROADWAY / 2 + 0.6; s < ROADWAY / 2; s += 1.2) {
          part(root, box(0.6, 0.02, 3, 0), paint, c + s, 0.01, c2 + at); // crossing the x street
          part(root, box(3, 0.02, 0.6, 0), paint, c2 + at, 0.01, c + s); // crossing the z street
        }
      }
    }
  }
}

// Sodium lamps on both curbs of every street, arms over the road, with a soft pool of light under each.
function lamps(kit, root, lines, lo, hi) {
  const pools = new THREE.MeshBasicMaterial({ map: radialTexture(128), color: palette.sodium, transparent: true, opacity: 0.16,
    blending: THREE.AdditiveBlending, depthWrite: false });
  const kerb = ROADWAY / 2 + 0.6;
  for (const c of lines) {
    for (let v = lo + 20; v < hi - 20; v += LAMP_EVERY) {
      if (lines.some((c2) => Math.abs(v - c2) < STREET / 2 + 2)) continue;
      for (const side of [-1, 1]) {
        for (const p of [streetLamp(kit, root, c + side * kerb, v, side > 0 ? Math.PI : 0),
          streetLamp(kit, root, v, c + side * kerb, side > 0 ? Math.PI / 2 : -Math.PI / 2)]) {
          part(root, new THREE.CircleGeometry(6, 20), pools, p.x, 0.25, p.z).rotation.x = -Math.PI / 2;
        }
      }
    }
  }
}

// Two lanes each way on every street. A lane runs along `axis` at offset `at`, from `from` to `to`.
function trafficLanes(lines, lo, hi) {
  const lanes = [];
  for (const c of lines) {
    for (const off of LANES) {
      for (const axis of ['x', 'z']) {
        lanes.push({ axis, at: c + off, from: lo, to: hi, y: 0.65, cars: 3 });
        lanes.push({ axis, at: c - off, from: hi, to: lo, y: 0.65, cars: 3 });
      }
    }
  }
  return lanes;
}
