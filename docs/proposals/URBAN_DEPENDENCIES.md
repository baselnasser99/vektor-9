# Urban plan dependencies | Vektor-9

Date: 2026-11-11. What each proposal in `URBAN_MASTERPLAN.md` touches, how it stays compatible with the simulation, and what could break. Read-only: nothing here is implemented.

## The contracts the city is built on

| Contract | Defined in | Read by | Why it matters |
|---|---|---|---|
| Snapshot schema 4 (tiles: kind, floors, power, seed, built tick) | `sim/state.py`, ADR-0003 | `main.js` refuses any other schema; every builder | The renderer draws only this. No proposal changes it |
| Fixed terrain (hub plaza, rail, road land, parks, works) | `sim/state.py:127 lay_terrain`, `sim/rules.py` | `city.js`, `terrain.js`, `interchange.js`, `headquarters.js` | Never changes after tick 0. Safe ground for district roles |
| Corridor order and widths | `world.js:10 STREETS`, `city.js:26 cityLayout` | Every tile position; `streets.js`; `people.js`; `life.js`; `interchange.js`; `desert.js`; `headquarters.js` | Changing a width moves every building. All proposals keep widths |
| A corridor's kind along its length | `city.js:87 kindAt` (with `layout.cut` from `city.js:308 hqCut`, and `closed` at `city.js:82`) | `streets.js` (12 uses), `people.js` (4), `interchange.js` (2), `city.js` | The one switch for market lanes, built-over stretches and the HQ cut. Proposals add stretches through it |
| Where a zebra is | `streets.js:101 hasZebra`, `zebraAt`, `stopAt` | `streets.js` paint, `life.js` give-way and walk signals, `people.js` network | Paint, traffic and walkers must agree. New crossings must go through these |
| The warp | `city.js:105 cityWarp`, `settle`, `settleProps` | `merge.js` (per vertex), `people.js` (per walker), `life.js` (parked cars) | Anything new in the old town must be settled whole or bend with the ground |
| Lane graph | `streets.js:697 roadNet`, `life.js` | Traffic | Self-checks at load: zero-length ways (`life.js:174`), stuck lanes (`life.js:176`) |
| Walking network | `people.js:108 network` | Walkers | Self-check at load: connected (`people.js:210`) |
| Merging by material | `merge.js` mergeByMaterial | The whole city | Every new material is at least one more draw call per merged group |

## What depends on the simulation's state

These change as the sim runs, so any proposal resting on them must handle every case:

- **The HQ's site** (`hqSite`): the best 6 x 4 block at load. It can move or vanish on a later snapshot or another seed (ADR-0007). The IKARO approach and the forecourt street must follow the site, and do nothing when there is none.
- **Frontier sectors**: derived from the share of empty lots. They shrink as the sim builds. That is correct, but the frontier dressing will move between loads. Rule thresholds need hysteresis only if flicker between two ticks shows; it should not, since a load is one snapshot.
- **The open court across from the HQ**: dresses empty lots only. A lot the sim builds on is drawn as its building, as now.
- **Signature, heavy and flagship towers, corporate signs**: chosen from heights at load. Weighting them toward the centre changes which buildings get them, never their height.
- **Power**: a blackout darkens tiles. New lighting (frontier lamps, crowns, the approach) must go dark with the tiles it belongs to, as every lamp does now through `t.on`.

## Sim compatibility

- No proposal needs a sim rule, a schema bump or a snapshot migration. `uv run pytest` (22 tests, all sim) is unaffected by every step.
- Direction C (districts in the sim) would need schema 5, new rules in `sim/rules.py`, tests and a renderer gate. It is not proposed.
- The renderer keeps drawing exactly the snapshot: no tile hidden (ADR-0002), no height changed (`families.js` header).

## Per-step dependencies and risks

### 1. Walkers and ramp low ends (P0-1)

- **Touches:** `people.js` network (the sidewalk links along the x = 292.5 main street and the z = ±79 cross streets); `interchange.js` `onRamp` for where a deck meets a sidewalk.
- **Could break:** the walking network's connectivity self-check if a link is removed rather than given a wait; walkers queueing into the street.
- **Check:** the connectivity assert; watch the four low ends in the browser.

### 2. Gap check at merges (P0-2)

- **Touches:** `life.js` handling of `free` nodes; the ramp and slip lanes from `interchange.js` `interchangeLanes`.
- **Could break:** a queue that backs up the ramps onto the expressway (it happened once before, ADR-0011), or a lane that never gets a gap at peak.
- **Check:** watch both loops and both slips for a few minutes; the stuck-lane assert.

### 3. The masterplan table

- **Touches:** a new module reading `snap`, `layout` and `hqSite`'s result. No builder reads it yet.
- **Could break:** nothing visible. Risk is in later steps reading it before it is right.
- **Check:** a self-check at load (every sector has one role; the HQ's sector is corporate when there is an HQ). Run it on seeds 1-10 headless or in the browser.
- **Needs:** ADR-0012 (a masterplan table derived from the snapshot).

### 4. Frontier dressing (P1-1)

- **Touches:** `tiles.js` plaza (lots), `city.js` (which builder a lot gets), `streets.js` lamps (`lamps`, `streets.lamps`), `life.js` signal control per crossing (a crossing without lights becomes a give-way crossing, as local crossings are today).
- **Shared data that moves with it:** a lot's parked cars feed `life.js` parked cars (`city.js:255`); fewer plazas means fewer parked cars. Lamps feed `people.js` (lamps as places) and `city.js` streetProps spacing.
- **Could break:** walkers waiting for a light that no longer exists (walk signals come from the same rule, `roadNet`); the busiest-crossing props if a lamp moves.
- **Performance:** fewer lamps, fewer parked cars and fewer signal heads; expected to save a little. Measure with `?bench=1000x625`.

### 5. The IKARO approach, forecourt street, open court (P1-2)

- **Touches:** `city.js` `closed` and `hqCut` (keep the stretch between the HQ and the next main corridor closed while the HQ stands); `streets.js` paving of built-over stretches and a raised crossing; `kindAt` for a shared-surface stretch of the lane; `tiles.js` for lots facing the campus.
- **Could break:** `closed` is shared with every T-junction. Forcing a stretch closed must not make the other half of that sector's mid street close too, or a stretch becomes a dead end (ADR-0010's rule). The lane graph's stuck-lane assert catches it. The hovercars' approach (`aircars.js`) uses the open air over the front street: a shared surface changes nothing above the ground.
- **Other seeds:** the HQ may face any of four directions or not exist; the rule must be written per heading.

### 6. Pedestrian access to the tower island (P1-4)

- **Touches:** `streets.js` plaza (zebras, island paving); `people.js` (the plaza walk at radius 44 and the four removed corner nodes, `people.js:118-120`); `life.js` roundabout circulation (give-way at the new zebras).
- **Could break:** the roundabout's flow if cars stop at four zebras; the walking network's distance table if new nodes are added (it is all-pairs).
- **Unknown:** how much of the 26 m island the tower's base leaves free. Measure before designing the promenade.

### 7. Parks as connected areas (P1-5)

- **Touches:** `terrain.js` park (per tile today), `city.js` (terrain tiles are settled per tile, `city.js:223-226`), `streets.js` crossings where a park meets a street.
- **Could break:** the old town's warp if a park lies in it (not on seed 7; the warp would need the slab bent like paving); per-sector detail culling if one park mesh spans sectors.
- **Performance:** one slab and one path set per park instead of per tile: fewer parts.

### 8. Signs and crowns weighted to the centre (P1-3)

- **Touches:** `city.js` corpSigns ordering, signatureTowers ordering, `landmarks.js` retrofit.
- **Could break:** the busiest crossing's billboards and the skybridges, which exclude sign towers through `skip`; seeds where fewer towers qualify.
- **Visible change:** different buildings carry the corporate signs on every seed. That is a look change for review, not a regression.

### 9. Walkers along mid streets (P1-6)

- **Touches:** `people.js` network (nodes, links, the all-pairs distance table), `places`, `seatsOf` (benches and food on market lanes).
- **Could break:** start-up time and memory (576+ nodes need a different routing approach than the current table, ADR-0009); walker density per sidewalk.
- **Needs:** its own design note and a measured start-up time.

### 10. Turn pockets on the interchange's main street (P1-7)

- **Touches:** `streets.js` lane paint and arrows (`exits`, `lanesMay`), `interchange.js` `turnsAt`, `life.js` lane rules.
- **Could break:** the lane rules that keep the median ramps' lanes straight at x = 150 (ADR-0011 amendment).

### 11. Gateway gantries (P2-4)

- **Touches:** `desert.js` highway arrivals; reuses the `ix_gantry` model already loaded.
- **Could break:** clearance over the causeway's traffic.

## Cross-cutting risks

- **Determinism.** Every new choice must come from `rng(...)` with its own seed or from `chance(...)` in `cityLayout`, never from shared generators, or unrelated buildings change (the pattern `city.js` already follows: "its own generator: the tile's other choices stay").
- **Other seeds.** Only seed 7 was checked this session. The old town's quarter, the HQ's site and heading, the walks-versus-lanes choice and the one-way pattern all change by seed. Each step should be checked on at least three seeds.
- **Frame time.** The steady frame is about 40 ms at the default view (handoff). Every step should report `?bench=1000x625` before and after.
- **No renderer tests.** The Python suite covers the sim only. The renderer relies on load-time asserts (walking network connected, no stuck lanes, no zero-length ways, slip lanes found). New rules should add asserts of the same kind.
- **Costs and abuse.** All proposals are static front-end changes: no AWS resources, no API, no visitor input, no new cost.

## Files this audit added

- `URBAN_AUDIT.md`, `URBAN_MASTERPLAN.md`, `URBAN_DEPENDENCIES.md`
- `URBAN_PLAN.svg` (annotated aerial plan) and `URBAN_CONCEPTS.svg` (before and after crops)
- `urban-audit/make_plan.py` (draws both from `snapshots/004032.json`; run `uv run python docs/proposals/urban-audit/make_plan.py` from the repo root) and `urban-audit/01-15*.jpg` (the screenshots)
