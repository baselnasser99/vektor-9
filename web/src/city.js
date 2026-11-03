// The whole city from a snapshot: one building per tile, streets with sodium lamps, then one merged mesh per material.
import * as THREE from 'three';
import { palette } from './palette.js';
import { box, part, rng } from './geometry.js';
import { streetLamp } from './parts.js';
import { powerPlant } from './plant.js';
import { F, construction, market, plaza, tower } from './tiles.js';
import { mergeByMaterial } from './merge.js';

export const TILE = 14; // metres per tile; buildings fill 12 m of it
export const STREET = 17; // street width between sectors
const BLOCK = 8; // tiles per sector side, as in sim/rules.py

export function cityLayout(snap) {
  const n = snap.size, span = n * TILE + (n / BLOCK - 1) * STREET;
  return { n, span, pos: (i) => i * TILE + Math.floor(i / BLOCK) * STREET - span / 2 + TILE / 2 };
}

export function buildCity(kit, snap) {
  const { n, span, pos } = cityLayout(snap);
  const root = new THREE.Group();

  // Wet asphalt everywhere, raised concrete sidewalks under each sector.
  const street = kit.mat('aerial_asphalt_01', palette.gunmetal).clone();
  street.roughness = 0.55;
  part(root, box(span + 60, 0.4, span + 60, 1), street, 0, -0.2, 0);
  const pools = [];
  for (let by = 0; by < n; by += BLOCK) {
    for (let bx = 0; bx < n; bx += BLOCK) {
      const [x0, x1] = [pos(bx) - TILE / 2 - 1.5, pos(bx + BLOCK - 1) + TILE / 2 + 1.5];
      const [z0, z1] = [pos(by) - TILE / 2 - 1.5, pos(by + BLOCK - 1) + TILE / 2 + 1.5];
      part(root, box(x1 - x0, 0.3, z1 - z0, 1), kit.concrete(palette.slate), (x0 + x1) / 2, 0.15, (z0 + z1) / 2);
      // Lamps along each edge, arms reaching over the street.
      for (const t of [0.2, 0.5, 0.8]) {
        const [x, z] = [x0 + (x1 - x0) * t, z0 + (z1 - z0) * t];
        pools.push(streetLamp(kit, root, x, z0 + 0.5, Math.PI / 2), streetLamp(kit, root, x, z1 - 0.5, -Math.PI / 2),
          streetLamp(kit, root, x0 + 0.5, z, Math.PI), streetLamp(kit, root, x1 - 0.5, z, 0));
      }
    }
  }
  // Pools of warm light under each lamp: cheap additive decals instead of hundreds of real lights.
  const poolMat = new THREE.MeshBasicMaterial({ map: poolTexture(), color: palette.sodium, transparent: true, opacity: 0.3,
    blending: THREE.AdditiveBlending, depthWrite: false });
  for (const p of pools) part(root, new THREE.CircleGeometry(7, 24), poolMat, p.x, 0.35, p.z).rotation.x = -Math.PI / 2;

  snap.tiles.forEach((t, i) => {
    const rand = rng(t.s);
    const sector = Math.floor(i / n / BLOCK) * (n / BLOCK) + Math.floor((i % n) / BLOCK);
    // Each sector leans glass or concrete; about one building in four goes the other way.
    const concrete = ((sector * 7 + snap.seed) % 2 === 0) !== (rand() < 0.25);
    const g = { house: () => tower(kit, t.f, rand, t.on, concrete), build: () => construction(kit, t.f, rand, t.on),
      market: () => market(kit, rand, t.on), plant: () => powerPlant(kit, { props: false }), lot: () => plaza(kit, rand, t.on) }[t.k]();
    g.position.set(pos(i % n), 0.3, pos(Math.floor(i / n)));
    g.rotation.y = Math.floor(rand() * 4) * (Math.PI / 2);
    root.add(g);
    // Skybridge to the east neighbour when both are tall enough and in the same sector (no street between).
    const east = snap.tiles[i + 1];
    if (t.k === 'house' && east?.k === 'house' && (i % n) % BLOCK !== BLOCK - 1 && Math.min(t.f, east.f) >= 12 && rand() < 0.12) {
      const y = Math.min(t.f, east.f) * F * (0.4 + rand() * 0.2), x = pos(i % n) + TILE / 2, z = pos(Math.floor(i / n));
      part(root, box(TILE, 3.2, 3.6, 1), kit.windows(2, t.on && east.on), x, y, z);
      if (t.on) part(root, box(TILE, 0.12, 0.12, 1), kit.glow(palette.neonCyan, 2), x, y - 1.7, z + 1.8);
    }
  });
  return { city: mergeByMaterial(root), lanes: lanes(n, span, pos) };
}

// Traffic lanes down the middle of every street (between sectors and around the edge), two directions each.
function lanes(n, span, pos) {
  const lines = [];
  for (let k = 0; k <= n / BLOCK; k++) {
    const c = k < n / BLOCK ? pos(k * BLOCK) - TILE / 2 - STREET / 2 : pos(n - 1) + TILE / 2 + STREET / 2;
    for (const side of [-1, 1]) {
      lines.push({ axis: 'z', at: c + side * 3.2, dir: side });
      lines.push({ axis: 'x', at: c + side * 3.2, dir: -side });
    }
  }
  return { lines, length: span + 2 * STREET };
}

function poolTexture() {
  const canvas = Object.assign(document.createElement('canvas'), { width: 128, height: 128 });
  const g = canvas.getContext('2d'), grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}
