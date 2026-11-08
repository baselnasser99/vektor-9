# ADR-0009: A street network of blocks, corridors and a lane graph

**Status:** Accepted (2026-11-08). Supersedes ADR-0008.

## Context
ADR-0008 gave the streets a hierarchy but kept every street's total width, so the city remained seven wide streets each way around 112 m blocks. Local streets stayed as wide as avenues, and crossings stayed large. Cars drove straight lines from one edge of the city to the other and never turned.

Every tile is positioned from the street widths, so changing a width moves buildings. Streets exist only in the renderer, though, so none of this touches the simulation or the snapshot.

## Decision
- **Grid** (`cityLayout` in `city.js`): corridors and runs of 4 tiles alternate.
  - Between sectors there is a main corridor, as before.
  - Inside each sector, the old 5 m alley is now a **mid street**: a 13 m local street in the inner sectors and a 6 m service alley in the outermost ones.
  - Most blocks are therefore 4 × 4 tiles (56 m). Every tile and building keeps its tile, and the city grows by about 10 m across.
- **Corridors** (`STREETS` in `world.js`), with 3.25 m lanes:

  | Street | Width | Notes |
  |---|---|---|
  | Boulevard | 36 m | 3 + 3 lanes, a 3.5 m median, 6.5 m sidewalks |
  | Main streets | 21 m | 2 + 2 lanes |
  | Ring road | 16 m | 1 + 1 lanes, with parking bays |
  | The narrow lines | 14 m | Local or pedestrian |
  | Mid streets | 13 m | |
  | Alleys | 6 m | |

- **Where a street changes along its length** (`kindAt`):
  - The old town's mid streets become car-free market lanes.
  - The mid street the headquarters straddles is paved over across its campus, and its stub carries no cars.
- **Blocks** are drawn from their outlines. Each corner's radius comes from the streets that meet there, between 3.5 and 5 m.
- **Crossings** are only as large as the two carriageways. Zebras sit in line with the sidewalks and stop lines just behind them (`zebraAt`, `stopAt`).
- **Traffic** is a lane graph (`roadNet` in `streets.js`, `traffic` in `life.js`):
  - Lane links run between crossings, with connectors through each crossing for straight on, right turns from the outer lane, left turns from the inner lane, and arcs round the roundabout.
  - Lane rules say which lane may go where. Dead-end stubs carry no cars.
  - Cars leaving town come back in on another road.
- **Control:**
  - Crossings involving a main street, the boulevard or a pedestrian street have lights. One controller per crossing runs green, amber, then all-red. Left turns are protected where the boulevard meets another street. Elsewhere they are permitted: they give way to oncoming cars and clear at the end of the phase.
  - Local-to-local crossings have no lights. Cars stop and go one at a time.
  - Turning cars give way to people on the zebra they cross.
- **Walkers** keep their sector-corner network. Their sidewalks now cross each mid street on its zebra, waiting for the light where it has one. Ground height knows every corridor.

## Alternatives considered
- **Keeping the widths (ADR-0008):** no building moves, but the grid stays coarse and the streets oversized.
- **Converting every alley, outermost sectors included:** this gives 56 m blocks everywhere. Keeping alleys at the edges leaves the outskirts a different, coarser grain.
- **Walkers on a full block-corner network:** 576 nodes need a different routing approach than the current all-pairs table. Left for later; walkers do not yet walk along the mid streets, only across them.

## Consequences
- Building positions shift by up to a few metres. Landmarks, the headquarters and the viaduct stay on their tiles.
- The headquarters' campus is 8 m wider than its model. The extra strip at each side is plain paving.
- There are about 880 cars in total, instanced. The roughly 110 crossings each run a small controller. Frame rate has not been measured yet.
- Rolling back means reverting this change. No simulation or snapshot change is involved.
