// The long-stop and throughput measure of ADR-0016 (its baseline method), shared by the traffic tests and runnable on
// its own: node --import ./tests/js/three-loader.mjs tests/js/traffic_metrics.mjs [fixture ...]
// It warms the headless traffic up for 60 s, then steps it for `seconds` at 0.1 s. A stop is a car's continuous time
// below 0.2 m/s; a long stop is one over LONG s (longer than any signal cycle, so the car missed a whole one). A long
// stop is blamed on a left turn when the car at the head of its queue (on the same lane) was waiting to turn left.
// Throughput is cars entering main-street, boulevard and avenue lanes per hour per lane (each lane entry is a car
// passing a fixed point, its start). Stuck: a car stopped for STUCK s or more, which no signal cycle explains.
import { pathToFileURL } from 'node:url';
import { city, fixture } from './harness.mjs';

export const LONG = 75, STUCK = 300;
const MAIN = new Set(['street', 'boulevard', 'avenue']);

export function measure(C, seconds = 600, each) {
  const { roads } = C, edges = roads.links.flatMap((L) => [L.edge, ...(L.moves ?? []).map((m) => m.edge)]);
  const stops = new Map(), long = [], lane = new Map();
  let entries = 0;
  const done = (c) => {
    const s = stops.get(c);
    if (s?.s > LONG) long.push(s);
    stops.delete(c);
  };
  C.run(60);
  for (const E of edges) for (const c of E.cars) lane.set(c, E.link);
  C.run(seconds, (t) => {
    each?.(t);
    for (const E of edges) E.cars.forEach((c, i) => {
      if (E.link && lane.get(c) !== E.link) {
        lane.set(c, E.link);
        if (MAIN.has(E.link.kind) && !E.link.out) entries++;
      }
      if (c.v >= 0.2) return done(c);
      const s = stops.get(c) ?? { s: 0, at: E.link?.end?.key ?? E.node.key, left: false };
      s.s += 0.1;
      if (E.link) s.left = E.cars[0].choice?.move === 'left'; // as it stands now: the head of its queue
      stops.set(c, s);
    });
  });
  for (const c of [...stops.keys()]) done(c);
  const mainLanes = roads.links.filter((L) => MAIN.has(L.kind) && !L.out).length;
  return {
    long: long.length,
    leftLong: long.filter((s) => s.left).length,
    over150: long.filter((s) => s.s > 150).length,
    longest: Math.max(0, ...long.map((s) => s.s)),
    stuck: long.filter((s) => s.s >= STUCK).map((s) => s.at),
    throughput: (entries / mainLanes) * (3600 / seconds),
  };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const info = console.info;
  console.info = () => {};
  for (const name of process.argv.slice(2).length ? process.argv.slice(2) : ['sim-v3-seed7-t288.json.gz', 'sim-v3-seed3-t288.json.gz']) {
    const m = measure(city(fixture(name)));
    console.log(name, JSON.stringify({ ...m, longest: +m.longest.toFixed(1), throughput: +m.throughput.toFixed(1) }));
  }
  console.info = info;
}
