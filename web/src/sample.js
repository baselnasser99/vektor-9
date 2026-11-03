// Close-up of two kit buildings, for judging detail before it goes into the city.
import * as THREE from 'three';
import { palette } from './palette.js';
import { createStage } from './stage.js';
import { loadKit } from './materials.js';
import { box, part } from './geometry.js';
import { streetLamp } from './parts.js';
import { powerPlant } from './plant.js';
import { midRise } from './showcase.js';

const { renderer, scene, start, captureReflections, bench } = createStage({ span: 35, fog: 0.008, camera: [46, 34, 58], target: [0, 13, 0] });

const kit = await loadKit(renderer, ['modular_airduct_circular_01', 'modular_fire_escape', 'utility_box_01']);
// Wet street, but not a mirror: warm lights smear into soft streaks.
part(scene, box(60, 0.2, 60), kit.mat('aerial_asphalt_01', palette.gunmetal, 0.55), 0, -0.1, 0);
const plant = powerPlant(kit);
plant.position.x = -9;
scene.add(plant);
const tower = midRise(kit, 12);
tower.position.x = 9;
scene.add(tower);

// A few real lights where the neon is strongest, so color spills onto walls and the street.
const lights = [[palette.neonCyan, 35, -11.4, 6.7, 0], [palette.neonPink, 45, 6.5, 22, 8],
  [palette.sodium, 70, 9, 3, 9], [palette.neonRed, 40, 9, 6, 7]];
// Sodium lamps along the street, each with a real warm light under its head.
for (const x of [-15, -4, 7, 18]) lights.push([palette.sodium, 120, ...streetLamp(kit, scene, x, 8.5, -Math.PI / 2).toArray()]);
for (const [color, power, x, y, z] of lights) {
  const light = new THREE.PointLight(color, power);
  light.position.set(x, y, z);
  scene.add(light);
}

captureReflections([0, 8, 14]);
start();
bench();
