// The fusion plant, used for every plant tile and on the sample page.
import * as THREE from 'three';
import { palette } from './palette.js';
import { box, cyl, metric, part, ring } from './geometry.js';
import { cable, edgeLights, pipe, railing, truss } from './parts.js';

// Fusion plant on a 12 m tile: turned reactor with a cyan core behind glass, LED-ringed cooling stacks,
// a curved-roof hall with a hologram, a gantry, pipe runs and cables.
// props: false leaves out the detailed CC0 utility boxes (thousands of triangles each), for the city view.
export function powerPlant(kit, { props = true } = {}) {
  const g = new THREE.Group();
  const red = kit.steel(palette.charcoal, 0.4), dark = kit.steel(palette.gunmetal, 0.55), cage = kit.steel(palette.charcoal, 0.5);
  part(g, box(12, 1, 12), kit.concrete(palette.slate), 0, 0.5, 0);

  // Reactor: one turned profile (flared foot, tapering shell, domed crown) with a glass core window,
  // curved tube buttresses and a glowing coil wound around the upper shell.
  const rx = -2.4, rz = 0, y0 = 1;
  const lower = [[3.6, 0], [3.6, 0.25], [3.25, 0.6], [3.05, 1.3], [3, 3.2]];
  const upper = [[3, 6.2], [2.95, 8], [2.75, 10.5], [2.3, 12.4], [1.6, 13.6], [1.15, 14], [1.1, 15.4], [0.7, 15.8], [0, 15.9]];
  const profile = [...lower, ...upper];
  const rAt = (y) => {
    const k = profile.findIndex(([, py]) => py >= y);
    if (k <= 0) return profile[Math.max(k, 0)][0];
    const [[r0, y1], [r1, y2]] = [profile[k - 1], profile[k]];
    return r0 + ((r1 - r0) * (y - y1)) / (y2 - y1);
  };
  const lathe = (pts) => metric(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 64), () => [Math.PI * 6, 8]);
  part(g, lathe(lower), red, rx, y0, rz);
  part(g, lathe(upper), kit.mat('box_profile_metal_sheet', palette.gunmetal), rx, y0, rz);
  part(g, cyl(2.3, 2.3, 3, 32), kit.glow(palette.neonCyan, 2), rx, y0 + 4.7, rz);
  const coreGlass = new THREE.MeshStandardMaterial({ color: palette.glassHighlight, roughness: 0.25, transparent: true, opacity: 0.3 });
  part(g, cyl(2.95, 2.95, 3, 48), coreGlass, rx, y0 + 4.7, rz).castShadow = false;
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    part(g, cyl(0.07, 0.07, 3, 8), dark, rx + Math.cos(a) * 3, y0 + 4.7, rz + Math.sin(a) * 3);
  }
  for (const y of [3.2, 6.2]) ring(g, 3.1, 0.22, dark, rx, y0 + y, rz);
  for (const y of [1.4, 11.6]) ring(g, rAt(y) + 0.05, 0.06, kit.glow(palette.neonMagenta, 3), rx, y0 + y, rz);
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + Math.PI / 4, [c, sn] = [Math.cos(a), Math.sin(a)];
    const pts = [[4.2, 0], [3.8, 1.5], [3.55, 4.7], [3.4, 8.5], [3, 11.6], [1.9, 13.5]]
      .map(([r, y]) => new THREE.Vector3(rx + c * r, y0 + y, rz + sn * r));
    part(g, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.2, 10), cage);
    part(g, box(1, 0.4, 1), dark, rx + c * 4.2, y0 + 0.2, rz + sn * 4.2);
  }
  const coil = new THREE.CatmullRomCurve3(Array.from({ length: 97 }, (_, i) => {
    const t = i / 96, y = 7 + t * 4.2, a = t * Math.PI * 2 * 3, r = rAt(y) + 0.08;
    return new THREE.Vector3(rx + Math.cos(a) * r, y0 + y, rz + Math.sin(a) * r);
  }));
  part(g, new THREE.TubeGeometry(coil, 300, 0.07, 6), kit.glow(palette.neonCyan, 2.5)).castShadow = false;
  ring(g, 1.15, 0.08, kit.glow(palette.neonCyan, 3), rx, y0 + 15.4, rz);

  // Cooling stacks with LED rings and aircraft lights
  for (const z of [-4, 4]) {
    part(g, cyl(0.75, 1, 20, 24), kit.steel(palette.gunmetal, 0.35), 4.2, 11, z);
    for (const y of [6, 11, 16]) ring(g, 0.92 - y * 0.008, 0.06, kit.glow(palette.neonRed, 3), 4.2, y, z);
    part(g, cyl(0.8, 0.8, 0.6, 24), red, 4.2, 20.7, z);
    part(g, new THREE.SphereGeometry(0.18, 8, 6), kit.glow(palette.signal, 2), 4.2, 21.2, z);
  }

  // Hall: corrugated walls, curved roof with a glowing skylight, a hologram sign
  part(g, box(4.5, 4, 6.4), kit.mat('box_profile_metal_sheet', palette.charcoal), 3.6, 3, 0);
  part(g, cyl(2.25, 2.25, 6.4, 16, -Math.PI / 2, Math.PI), kit.mat('box_profile_metal_sheet', palette.gunmetal), 3.6, 5, 0).rotation.x = -Math.PI / 2;
  part(g, box(0.5, 0.1, 6), kit.glow(palette.neonViolet, 2), 3.6, 7.26, 0);
  part(g, box(3.2, 1.6, 0.1), kit.glass(), 3.6, 2.4, 3.22);
  part(g, new THREE.PlaneGeometry(4, 1), kit.holo('KORU', palette.neonRed), 3.6, 8.6, 3.2);
  edgeLights(kit, g, 4.5, 4, 6.4, 3.6, 1, 0);

  // Gantry and catwalk
  const gantry = truss(kit, 5.5, 1.4, 1.4);
  gantry.position.set(1.3, 9.5, 0);
  g.add(gantry);
  part(g, box(1.4, 0.12, 6.4), kit.mat('metal_grate_rusty', palette.slate), 6.6, 4.4, 0);
  const rail = railing(kit, 6.4);
  rail.rotation.y = Math.PI / 2;
  rail.position.set(7.25, 4.45, 0);
  g.add(rail);

  // Pipe runs from the reactor to the hall and down to the plinth
  const pipeMat = kit.steel(palette.slate, 0.35);
  pipe(kit, g, [[-0.2, 2.2, -2], [1.4, 2.2, -2], [1.4, 2.2, -3.6], [5.8, 2.2, -3.6]], 0.32, pipeMat);
  pipe(kit, g, [[-0.4, 4, 1.8], [1.3, 4, 1.8], [1.3, 1.3, 1.8], [1.3, 1.3, 4.8]], 0.25, kit.steel(palette.charcoal, 0.4));
  pipe(kit, g, [[-0.6, 12.5, 0.8], [0.9, 12.5, 0.8], [0.9, 7, 0.8]], 0.2, pipeMat);
  cable(kit, g, [4.2, 18, -4], [3.6, 7.2, -3.2], 1);
  cable(kit, g, [4.2, 18, 4], [-2.4, 17.5, 0.9], 2);

  if (props) for (const [x, z] of [[-5.3, 4.8], [-4.2, 4.8], [5.3, -5.3]]) {
    const b = kit.piece('utility_box_01');
    b.position.set(x, 1, z);
    g.add(b);
  }
  return g;
}
