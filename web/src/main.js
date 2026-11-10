// The city: loads one snapshot and draws every tile with the building kit, at night, with its surroundings
// and ambient life (traffic, trains, rain, mist, clouds).
import { css, palette } from './palette.js';
import { createStage } from './stage.js';
import { loadKit } from './materials.js';
import { facadeClock } from './facade.js';
import { ROOFTECH } from './rooftech.js';
import { HQ_MODELS } from './headquarters.js';
import { hqEye } from './eye.js';
import { hqFleet } from './aircars.js';
import { buildCity, cityLayout } from './city.js';
import { REACH, buildDesert, farSprawl, outOfTown } from './desert.js';
import { steam, traffic, trains } from './life.js';
import { people } from './people.js';
import { airships, cloudDeck, districtGlows, horizon, moon, rain, rainAmount, stars } from './atmosphere.js';

document.body.style.background = css(palette.nightZenith); // dark while the city builds
const SCHEMA = 4;

const params = new URLSearchParams(location.search);
const snapUrl = params.get('snap') ?? '../snapshots/004032.json';
const snap = await (await fetch(snapUrl)).json();
if (snap.schema !== SCHEMA) throw new Error(`snapshot schema ${snap.schema}, renderer knows ${SCHEMA}`);

const layout = cityLayout(snap), half = layout.span / 2;
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

const kit = await loadKit(renderer, [...ROOFTECH, ...HQ_MODELS, 'telecom_tower', 'train_station', 'power_plant', 'market_hall', 'storefront', 'storefront_l',
  'shop_stalls', 'shop_counter', 'shop_frame', 'shop_arcade',
  'skybridge_bay', 'skybridge_window', 'skybridge_end', 'billboard_tower', 'billboard_wide', 'billboard_blade',
  'corp_pylon', 'corp_band', 'corp_crown', 'holo_roof', 'holo_wall', 'flagship_extension', 'flagship_lift', 'flagship_lift_top',
  'flagship_armor', 'flagship_crown', 'flagship_ad', 'flagship_conduit', 'flagship_vent',
  'prop_vending', 'prop_sign', 'prop_cabinet', 'prop_camera', 'prop_locker', 'prop_utility', 'ix_gantry', 'ix_wall', 'ix_depot', 'ix_stock', 'ix_monument']);
facadeClock(((snap.tick * 5) / 60) % 24, onFrame); // ticks are 5 minutes; room lights follow the hour
const { city, details, warp, hub, rail, roads, parked, edge, lines, benches, lamps, food, hq } = buildCity(kit, snap);
// Small building parts (balconies, rooftop plant, pipes) only near the camera: one group per sector.
const DETAIL = 400; // metres from a sector's centre
scene.add(...details.map((d) => d.group));
onFrame(() => {
  const { x, y, z } = camera.position;
  for (const { group, at } of details) group.visible = (x - at[0]) ** 2 + y * y * 0.5 + (z - at[1]) ** 2 < DETAIL * DETAIL;
});
const desert = buildDesert(kit, edge, lines, onFrame, layout);
const cars = traffic(kit, outOfTown(roads, edge, layout), onFrame, warp, hub, parked);
scene.add(city, desert, farSprawl(edge), cars);
// People on the sidewalks, crossing with the cars' lights (P shows the crowd settings).
scene.add(steam(food, warp, onFrame));
if (hq) scene.add(hqEye(hq, camera, onFrame), hqFleet(kit, hq, onFrame, stage.still)); // IKARO's eye and hovercars
scene.add(people({ snap, layout, warp, benches, lamps, food, hq, clock: cars.userData.clock, camera, controls, onFrame, still: stage.still }));
if (rail) scene.add(trains(kit, rail, onFrame));
scene.add(stars(sky), ...moon(sky), ...horizon(sky, onFrame), ...cloudDeck(REACH * 6, onFrame), ...airships(kit, half, onFrame),
  ...districtGlows(snap, layout, camera, onFrame));
// ?rain=0..1 previews weather the snapshot does not have.
const wet = params.has('rain') ? Number(params.get('rain')) : rainAmount(snap);
if (wet) scene.add(rain(wet, controls.target, onFrame));
console.info(`weather: ${wet ? `rain ${wet.toFixed(2)}` : 'dry'}`);
stage.captureReflections([0, 60, 0]);
stage.start();
stage.bench();
