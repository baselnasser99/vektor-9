// The city: loads one snapshot and draws every tile with the building kit, at night, with its surroundings
// and ambient life (traffic, trains, rain, mist, clouds).
import { css, palette } from './palette.js';
import { createStage } from './stage.js';
import { loadKit } from './materials.js';
import { facadeClock } from './facade.js';
import { buildCity, cityLayout } from './city.js';
import { REACH, buildDesert, outOfTown } from './desert.js';
import { traffic, trains } from './life.js';
import { airships, cloudDeck, horizon, moon, rain, rainAmount, stars } from './atmosphere.js';

document.body.style.background = css(palette.nightZenith); // dark while the city builds
const SCHEMA = 3;

const params = new URLSearchParams(location.search);
const snapUrl = params.get('snap') ?? '../snapshots/004032.json';
const snap = await (await fetch(snapUrl)).json();
if (snap.schema !== SCHEMA) throw new Error(`snapshot schema ${snap.schema}, renderer knows ${SCHEMA}`);

const half = cityLayout(snap).span / 2;
// Start low over the southeast corner so streets, shopfronts and signs show; orbit out for the overview.
const stage = createStage({ span: half * 1.1, fog: 0.0007, camera: [half * 0.55, half * 0.25, half * 0.8], target: [0, 25, half * 0.15] });
const { renderer, scene, camera, controls, onFrame } = stage;
const sky = stage.far * 0.7; // inside the sky dome (stage.js puts it at 0.8 of the far plane)
// ?view=x,y,z,tx,ty,tz sets the camera position and target (metres), for sharing or checking a view.
const view = params.get('view')?.split(',').map(Number);
if (view?.length === 6 && view.every(Number.isFinite)) {
  camera.position.set(...view.slice(0, 3));
  controls.target.set(...view.slice(3));
  controls.update();
}

const kit = await loadKit(renderer, ['telecom_tower', 'power_plant', 'market_hall', 'storefront', 'storefront_l',
  'shop_stalls', 'shop_counter', 'shop_frame', 'shop_arcade',
  'skybridge_bay', 'skybridge_window', 'skybridge_end', 'billboard_tower', 'billboard_wide', 'billboard_blade',
  'corp_pylon', 'corp_band', 'corp_crown', 'holo_roof', 'holo_wall',
  'prop_vending', 'prop_sign', 'prop_cabinet', 'prop_camera', 'prop_locker', 'prop_utility']);
facadeClock(((snap.tick * 5) / 60) % 24, onFrame); // ticks are 5 minutes; room lights follow the hour
const { city, details, warp, hub, rail, lanes, edge, lines } = buildCity(kit, snap);
// Small building parts (balconies, rooftop plant, pipes) only near the camera: one group per sector.
const DETAIL = 400; // metres from a sector's centre
scene.add(...details.map((d) => d.group));
onFrame(() => {
  const { x, y, z } = camera.position;
  for (const { group, at } of details) group.visible = (x - at[0]) ** 2 + y * y * 0.5 + (z - at[1]) ** 2 < DETAIL * DETAIL;
});
const desert = buildDesert(kit, edge, lines, onFrame);
scene.add(city, desert, traffic(kit, outOfTown(lanes, edge), onFrame, warp, hub));
if (rail) scene.add(trains(kit, rail, onFrame));
scene.add(stars(sky), ...moon(sky), ...horizon(sky, onFrame), ...cloudDeck(REACH * 6, onFrame), ...airships(kit, half, onFrame));
// ?rain=0..1 previews weather the snapshot does not have.
const wet = params.has('rain') ? Number(params.get('rain')) : rainAmount(snap);
if (wet) scene.add(rain(wet, controls.target, onFrame));
console.info(`weather: ${wet ? `rain ${wet.toFixed(2)}` : 'dry'}`);
stage.captureReflections([0, 60, 0]);
stage.start();
stage.bench();
