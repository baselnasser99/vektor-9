// The city: loads one snapshot and draws every tile with the building kit, at night, with its surroundings
// and ambient life (traffic, rain, mist, clouds).
import { palette } from './palette.js';
import { createStage } from './stage.js';
import { loadKit } from './materials.js';
import { buildCity, cityLayout } from './city.js';
import { REACH, buildDesert } from './desert.js';
import { traffic } from './life.js';
import { cloudDeck, mist, rain, rainAmount } from './atmosphere.js';

document.body.style.background = `#${palette.nightZenith.toString(16).padStart(6, '0')}`; // dark while the city builds
const SCHEMA = 2;

const params = new URLSearchParams(location.search);
const snapUrl = params.get('snap') ?? '../snapshots/004032.json';
const snap = await (await fetch(snapUrl)).json();
if (snap.schema !== SCHEMA) throw new Error(`snapshot schema ${snap.schema}, renderer knows ${SCHEMA}`);

const half = cityLayout(snap).span / 2;
// Start low over the southeast corner so streets, shopfronts and signs show; orbit out for the overview.
const stage = createStage({ span: half * 1.1, fog: 0.0011, camera: [half * 0.55, half * 0.25, half * 0.8], target: [0, 25, half * 0.15] });
const { renderer, scene, camera, controls, onFrame } = stage;
// ?view=x,y,z,tx,ty,tz sets the camera position and target (metres), for sharing or checking a view.
const view = params.get('view')?.split(',').map(Number);
if (view?.length === 6 && view.every(Number.isFinite)) {
  camera.position.set(...view.slice(0, 3));
  controls.target.set(...view.slice(3));
  controls.update();
}

const kit = await loadKit(renderer);
const { city, lanes } = buildCity(kit, snap);
scene.add(city, buildDesert(kit, half, onFrame), traffic(kit, lanes, onFrame), cloudDeck(REACH * 6, onFrame), ...mist(half, onFrame));
// ?rain=0..1 previews weather the snapshot does not have.
const wet = params.has('rain') ? Number(params.get('rain')) : rainAmount(snap);
if (wet) scene.add(rain(wet, controls.target, onFrame));
console.info(`weather: ${wet ? `rain ${wet.toFixed(2)}` : 'dry'}`);
stage.captureReflections([0, 60, 0]);
stage.start();
stage.bench();
