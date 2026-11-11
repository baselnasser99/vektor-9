// Builds a seed's street plan, road graph and walking network in Node, without a GPU or a browser, for the
// regression tests. Buildings are not built: only what the cars and walkers use. Run the tests with
// `node --import ./tests/js/three-loader.mjs --test tests/js/` from the repo root (the loader maps 'three').
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// textures.js draws on 2D canvases; here every canvas call is a no-op.
const ctx2d = new Proxy(function () {}, {
  get: (_, k) => (k === 'width' ? 1 : k === 'data' ? new Uint8ClampedArray(4) : ctx2d),
  apply: () => ctx2d,
  set: () => true,
});
globalThis.document ??= { createElement: () => ({ width: 1, height: 1, getContext: () => ctx2d }) };

const THREE = await import('three');
const { cityLayout, crossing, hqCut } = await import('../../web/src/city.js');
const { hqSite } = await import('../../web/src/headquarters.js');
const { buildStreets } = await import('../../web/src/streets.js');
const { outOfTown } = await import('../../web/src/desert.js');
const { traffic } = await import('../../web/src/life.js');
const { network } = await import('../../web/src/people.js');

// A kit whose materials are all one placeholder and whose Blender models are empty groups.
const mat = new THREE.MeshStandardMaterial();
mat.emissiveMap = new THREE.Texture();
const model = () => {
  const g = new THREE.Group(), detail = new THREE.Group();
  detail.name = 'detail';
  g.add(detail);
  return g;
};
const kit = new Proxy({}, { get: (_, k) => (k === 'model' ? model : k === 'foldDetail' ? (g) => g : () => mat) });

// The snapshot for a seed: snapshots/004032.json for seed 7 if it is there, else a fresh one-day run of the sim.
export function snapshot(seed) {
  const local = 'snapshots/004032.json';
  if (seed === 7 && existsSync(local)) {
    const snap = JSON.parse(readFileSync(local));
    if (snap.seed === 7) return snap;
  }
  const out = mkdtempSync(join(tmpdir(), `v9-seed${seed}-`));
  execFileSync('uv', ['run', 'python', '-m', 'sim', '--ticks', '288', '--seed', String(seed), '--out', out], { stdio: 'ignore' });
  return JSON.parse(readFileSync(join(out, readdirSync(out).sort().at(-1))));
}

const still = (x, z, out) => {
  out[0] = out[1] = 0;
  return out;
};

// Everything the circulation tests need for a snapshot: the layout as buildCity sets it up (the HQ's cut), the
// streets, the road graph with the interchange's lanes, the walking network, and running traffic with a manual
// clock: run(seconds) steps it at 0.1 s, calling each(t) after every step.
export function city(snap) {
  const layout = cityLayout(snap), hq = hqSite(snap, layout, new Set(crossing(snap).corners));
  if (hq) layout.cut = hqCut(layout, hq);
  const streets = buildStreets(kit, layout, new THREE.Group());
  const roads = outOfTown(streets.roads, streets.hi, layout);
  const net = network(layout);
  const frame = [];
  const cars = traffic(kit, roads, (f) => frame.push(f), still, streets.hub, []);
  const run = (seconds, each) => {
    for (let k = 0; k < seconds * 10; k++) {
      for (const f of frame) f(0.1, 0, 0.1);
      each?.(cars.userData.clock());
    }
  };
  return { layout, streets, roads, net, run };
}
