# Urban masterplan proposals | Vektor-9

Date: 2026-11-11. Proposals only: nothing here is built. Findings and evidence are in `URBAN_AUDIT.md`; code and risk in `URBAN_DEPENDENCIES.md`. Concept views: `URBAN_CONCEPTS.svg` (the measured plan on the left, the proposal drawn over it on the right; drawn, not built).

## Ground rules every proposal keeps

- **The snapshot stays the truth.** No tile is hidden, moved, re-heighted or invented. A house is drawn at its floors; an empty lot stays an empty lot. Only how the renderer dresses it may change (ADR-0002).
- **No sim or schema change.** Everything below is renderer-only, unless marked otherwise, and those items are not recommended now.
- **Street widths stay as they are.** Every tile's position comes from the corridor widths (`cityLayout`), so a width change moves every building, the HQ and the landmarks. Proposals change what a corridor is used for, not how wide it is.
- **Landmarks stay as they are.** The telecom tower, IKARO HQ, the interchange and its monuments, the station, the plant, the market hall, the flagship and the retrofits keep their models. Proposals design their surroundings.
- **Deterministic.** Every choice is a fixed rule on the snapshot and the seed, like everything in `city.js` today.
- **The canyon stays.** Height-to-width ratios, tower gaps and signage density are the city's character, not defects.

## Three directions

### A. Incremental generator improvements

Fix each finding where it lives, one rule at a time, inside the existing modules: `people.js` for the walkers, `life.js` for merges, `tiles.js` and `streets.js` for the frontier, `terrain.js` for parks, `kindAt` for the HQ approach, `streets.js` plaza for the centre.

- **Pros:** the smallest diffs; each change is reviewable and revertable on its own; no new concepts.
- **Cons:** district logic ends up spread as special cases ("if this is the HQ's sector...", "if the lot is on the frontier...") across five files. After a few rounds, nobody can say where a district's look is decided.

### B. A lightweight, data-driven masterplan table (recommended, after A's P0 fixes)

One small module (say `web/src/masterplan.js`, sitting next to `world.js`) that computes, once per load, a **role for each sector** and a handful of **overrides**, from the snapshot and the layout alone. The existing builders read it the way they read `STREETS` today.

- Sector roles: `centre`, `old`, `corporate`, `gateway`, `industry`, `frontier`, `park`, `residential`. Derived from fixed terrain (works, rail, road land, parks), from the old town, from the HQ's site, and from the share of empty lots (frontier). Nothing new is stored.
- Street-use overrides by corridor stretch, using `kindAt`'s existing vocabulary: keep a stretch closed (the IKARO approach), make a stretch a shared surface (the HQ forecourt lane), mark a stretch unlit (frontier streets with no houses).
- Dressing rules by role: what an empty lot becomes (`plaza`, vacant ground, work yard, night-market pitch), lamp density, whether a junction gets signals, which tile families are allowed to look industrial.
- **Pros:** one place to read the plan; deterministic; adds data, not architecture; each rule is still a few lines in the builder that uses it.
- **Cons:** a new shared module that several builders depend on; roles that come from lot share can change as the sim grows (that is correct, but the frontier will move between loads).

### C. A district-based planning system (not recommended now)

Districts as first-class objects with their own block typologies, street sections, height envelopes and land uses, possibly stored by the sim.

- To be worth it, it would need the sim to know districts (a schema change and new rules) or the renderer to override the sim's building choices, which ADR-0002 forbids.
- It is a new generation architecture, which this phase rules out.
- Keep it as the long-term option if the sim ever grows zoning. B's role table is designed so it could later be filled from sim data instead of derived.

### Comparison

| | A. Incremental | B. Masterplan table | C. District system |
|---|---|---|---|
| Complexity | Low per change; grows with special cases | Low to medium: one module plus small reads | High: sim rules, schema, renderer |
| Maintainability | Falls over time | Good: one place for the plan | Good if finished; heavy to carry |
| Determinism | Yes | Yes (rules on snapshot and seed) | Yes, if the sim owns it |
| Sim compatibility | Full | Full: no sim or schema change | Needs schema 5 and new sim rules |
| Render performance | Neutral to better (fewer lamps and signals on the frontier) | Same as A | Unknown; likely more geometry |
| Visual benefit | Fixes the defects | Fixes them and makes districts legible | Largest, at the highest cost |

## Recommendation and why

**Do A for the two P0s now, then build B as a thin table and move the P1 work onto it.**

- The P0s are local bugs in the walker and car code; they need no plan.
- Most P1s are the same problem seen from different places: the renderer dresses every sector the same way, whatever it is for. A single role table answers that once, instead of five special cases.
- B respects every constraint: no sim change, no width change, no landmark change, no new architecture. Every rule stays deterministic and revertable.
- C's benefit over B is real only if the sim learns districts. That is a product decision, not an urban-design fix.

## District strategy (seed 7 names; the rules are general)

| Role | Rule (derived, never stored) | Seed 7 | Treatment |
|---|---|---|---|
| Centre | The hub plaza and the four sectors touching it, outside the old town | Sectors round (0, 0) | Pedestrian access to the tower, the strongest lighting, corporate signs favoured here |
| Old town | Existing rule (`cityLayout`) | North-west inner quarter | Keep. Strengthen at street level: more market lanes lit, cafe and stall density, narrower lamp spacing. Heights stay the sim's |
| Corporate | The HQ's sector and the boulevard frontage beside it | Sector (row 2, col 3) | The IKARO approach, the forecourt street, an open court on the lots across the lane |
| Gateway | Sectors on the interchange land and its four blocks' neighbours | East, round (292.5, 0) | Keep the interchange. Sign gantries, heavier lighting, the yard; a clear end to the expressway |
| Industry and logistics | Sectors with works or rail tiles, plus tiles within 2 of them (as `surroundings` already does) | North-west outer | Industrial family, yard dressing for empty lots, freight signs; lamps sodium only |
| Frontier | Sectors more than about half empty lots | North row east of x = -150; south-west corner | Empty lots as vacant ground and work yards, streets unlit where no house fronts them, signals only where a lit street crosses |
| Park | Park terrain and its connected tiles | West, north-east | Drawn as one park per connected area, with continuous paths, crossings where a street cuts it |
| Residential | Everything else | Most of the city | As today |

Single-tile power plants and markets stay where the sim puts them. In industry and frontier sectors they read naturally. In residential sectors a plant can get a screening wall and a quieter lamp on its street faces, as renderer dressing.

## Road hierarchy

Widths stay. Uses change only where noted.

| Corridor | Today | Proposal |
|---|---|---|
| Boulevard / avenue (36 m) | 3+3 or 2+2 lanes, median, through every sector | Keep. The tower's approaches. Add raised zebras where it cuts the west park |
| Main streets (21 m) | 2+2 lanes, no median | Keep. At x = 292.5 (the interchange's distributor) consider a turn pocket at its two boulevard-side junctions, inside the existing carriageway (paint and lane rules only) |
| Ring road (16 m) | 1+1, parking bays | Keep. Frontier stretches: bays empty, lamps every other pole |
| Lane at x = 150 (14 m) | 1+1 | Along the HQ (rows 17-22): a shared forecourt street, low speed, flush paving (`kindAt` stretch, like the market lanes; cars still pass) |
| Walks at ±150 (14 m) | Car-free, stalls | Keep. Extend the stall and cafe pattern out into the frontier on x = -150 (a night-market spine) |
| Mid streets (13 m) | Local or one-way, some built over | Keep. The built-over stretch on the HQ's axis becomes a fixed rule while the HQ stands there (the IKARO approach) |
| Alleys (6 m) | Service only | Keep |

### Circulation fixes (direction A)

- **P0-1:** walkers stop at the kerb before a ramp's or slip's low end and cross it as a give-way crossing, or route round it. The interchange's `onRamp` already says where the decks are.
- **P0-2:** a `free` node lets a car in only when the target lane has a gap of at least one car length plus a margin behind and ahead.
- **P1-6:** add mid-street sidewalks to the walking network as links between the existing corner nodes and new mid-block nodes. The ADR-0009 note already names the routing cost (576 nodes); the old town's market lanes alone are a smaller first step.

## Landmark integration

### Telecom tower and the centre (P1-4)

- Four zebras across the roundabout's carriageway to the island, one between each pair of corner squares, on raised tables.
- A promenade round the tower's base on the island (26 m in radius), with benches and the existing lighting. How much room the tower's base leaves has not been measured; that comes first.
- The four corner squares joined visually: the same paving and a low planted edge along the ring.
- Walkers get a path to the island; the roundabout's cars give way at the zebras, as at any turning give-way.
- No change to the tower model or the roundabout's lanes.

### IKARO HQ (P1-2)

- **The IKARO approach.** On seed 7 the half mid street between the boulevard and the HQ's back (cols 24-27 at z = -80.5) is already built over by chance, and it lines up with the gap between the towers where the eye floats. Make it a rule: whenever the HQ stands, keep the mid-street stretch between it and the next main corridor closed, and pave it as the approach, with a raised crossing over the one-way street behind the campus. From the boulevard you then look straight down a paved axis into the gap, at the eye.
- **The forecourt street.** The 14 m lane along the campus front becomes a shared surface for the length of the campus.
- **The open court.** Across the lane, the empty lots in front of the HQ (ten of the 24 tiles there on seed 7) are dressed as an open security court (paving, bollards, lit kiosks) instead of parking. They stay empty lots in the snapshot; when the sim builds on one, a building is drawn there as usual.
- Moving the HQ to face the boulevard is not proposed: the boulevard-side block holds a power plant and hub tiles on seed 7, and moving the site would hide a different set of 24 buildings.

### Interchange (gateway)

- Keep it. Light the expressway's end (where the median ramps come down) as the city's front door.
- The other three highway arrivals (at-grade causeways) get a gate: a pair of sign gantries (the existing `ix_gantry` model) where they meet the ring road.

### Signature and heavy towers, the skyline (P1-3)

Heights are the sim's, so the skyline is shaped with light and placement, not with height.

- Pick corporate signs and crown lighting nearest the centre first (today they are picked by height alone, so they follow the tallest towers to the edges).
- Give the three signature towers a lit crown beacon that reads at skyline distance, so the outer tallest towers mark the city's corners on purpose.
- Keep view corridors down the boulevard clear of skybridges and signs that cross it.

### Parks (P1-5)

- Draw a park as one area per connected set of park tiles: one ground slab, one path network that crosses between tiles in straight runs, lamps along the paths rather than one per tile.
- Where a main street cuts a park, raise the crossing and paint zebras on every arm, so the four pieces read as one park split by a road.

### Frontier (P1-1)

- Empty lots in frontier sectors become vacant ground (dust, fencing, a few work yards beside building sites), not parking.
- Streets with no house fronting them: lamps every other pole or none; signals only where a street with houses crosses.
- The ring road there keeps its bays but parks fewer cars.
- As the sim fills the frontier, sectors drop out of the role by the same rule, and the dressing follows.

## Roadmap (prioritised and reversible)

Each step is its own branch and PR, behind no flag, revertable by reverting it. None changes the sim or the snapshot.

| Step | What | Finding | Size | Needs |
|---|---|---|---|---|
| 1 | Walkers give way or route round ramp and slip low ends | P0-1 | Small | `people.js`, `interchange.js` onRamp |
| 2 | Gap check at `free` merge nodes | P0-2 | Small | `life.js` |
| 3 | The masterplan table: sector roles and the override list, no consumers yet, with a self-check | (B) | Small | New `masterplan.js`; ADR-0012 |
| 4 | Frontier dressing for empty lots, lamps and signals | P1-1 | Medium | `tiles.js`, `streets.js`, `life.js` signals |
| 5 | The IKARO approach, the forecourt street, the open court | P1-2 | Medium | `city.js` kindAt, `streets.js`, `tiles.js` |
| 6 | Pedestrian access to the tower island | P1-4 | Medium | `streets.js` plaza, `people.js`, `life.js` roundabout give-way |
| 7 | Parks as connected areas, raised crossings | P1-5 | Medium | `terrain.js`, `city.js`, `streets.js` |
| 8 | Corporate signs and crowns weighted to the centre; signature beacons | P1-3 | Small | `city.js` corpSigns, `landmarks.js` |
| 9 | Walkers along mid streets, the old town's market lanes first | P1-6 | Large | `people.js` network |
| 10 | Turn pockets on the interchange's main street | P1-7 | Small | `streets.js` lanes, `interchange.js` turnsAt |
| 11 | Gateway gantries on the three at-grade arrivals | P2-4 | Small | `desert.js` |
| 12 | P2 polish: HQ side strips, plant screening, ring-road edge | P2 | Small each | various |

Steps 1-2 can start at once. Step 3 should land before 4, 5 and 7, which read it. Steps 6, 8, 10 and 11 are independent of the table. Step 9 is the largest and the most valuable for street life; it needs its own design note first (the routing table's size).
