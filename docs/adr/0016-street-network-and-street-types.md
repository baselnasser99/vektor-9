# ADR-0016: Street network and street types

**Status:** Proposed (2026-11-12)

Concept drawing: [`0016-concept.svg`](0016-concept.svg) (seed 7, today on the left and as proposed on the right; drawn, not built).

## Context

ADR-0009 and ADR-0010 built the street network: corridors between 4 x 4-tile blocks, a lane graph, signals and walkers. ADR-0015 then gave the simulation a fixed `plan`. It names the boulevard and the four main streets as the backbone and reserves the headquarters' site and court. Until now nobody has set out the street types as a catalogue, or measured what the traffic does on the v3 city.

This ADR measures the v3 network, proposes a catalogue of street types and a set of traffic fixes, and sorts every proposal into two classes:

- **(S)** changes what the simulation stores.
- **(R)** is renderer only.

It is a design pass. Nothing here is implemented.

Method. This pass applies the street-design and masterplan-design methods (hierarchy, cross-sections, junction types, traffic calming, streetscape, block and network structure) to a stylised city. Vektor-9 is not a real site. This ADR claims no compliance with any street standard and uses no real-world counts. Where a method asks for a real-world input, it uses one of the city's own measurements instead, and says which:

| The method asks for | This ADR uses |
|---|---|
| Average daily traffic | Cars passing a point per hour in the headless traffic (`tests/js/harness.mjs` `city()`) |
| Pedestrian volumes | The walking network's coverage. Walker counts were not measured (see Open questions) |
| Land use | The simulation's tile kinds and `masterplan.js` roles |
| Density | Floors per tile, as measured in ADR-0015 |

The section "Which method shaped what" maps each decision to the section of the method it came from.

### Measured baseline

**Snapshots.** The v3 frozen fixtures `tests/fixtures/sim-v3-seed7-t288.json.gz` and `sim-v3-seed3-t288.json.gz`. On schema 6 the street layout depends only on the seed and the plan, not on the tick: corridor kinds, the old town and the headquarters' cut all come from fixed terrain and `plan`. Traffic density depends only on street kind. So tick 288 shows the same network as tick 4032.

**Commands.** Scratch scripts, run from the repository root and not committed. Each one imports the renderer's own modules through the test harness, so it holds no second copy of the layout rules.

- `node --import ./tests/js/three-loader.mjs <scratch>/baseline.mjs <fixture> 600` does the following:
  - **Network length.** It samples `kindAt` every metre along every corridor and both axes, leaving out junction boxes.
  - **Dead ends.** It applies the dead-end rule of `masterplan.test.mjs` (`deadEnds`).
  - **Walking network.** It measures the walking network from `people.js` `network()`.
  - **Traffic.** It builds the city with `city()`, warms the traffic up for 60 s, then steps it for 600 s at 0.1 s per step. It records two things:
    - Each car's entry into each lane link. Entries summed over a corridor's lanes and divided by its blocks give the cars passing a typical point on that corridor, in both directions.
    - Each car's continuous time below 0.2 m/s, and for every stop over 75 s, where the car stood and what move it was waiting to make.
  - Runs are deterministic: two runs gave identical counts.
- `<scratch>/density.mjs <fixtures>`: junction counts and density.
- `<scratch>/hq.mjs <fixtures>`: the crossing between the headquarters and the court.

**Thresholds.** A stop counts as *long* above 75 s. That is longer than any signal cycle in `life.js` `control()`:

- 40 s at a plain signal: 2 x (15 s green + 3 s amber + 2 s all-red).
- 64 s where a protected left phase runs.
- 74 s at the roundabout.

So a long stop means a car missed at least one whole cycle.

#### Street types in use today

The table gives each street's measured share of the network's centre-line length, junction boxes excluded. The total is 17,876 m on both seeds. Seed 7 comes first, then seed 3.

- **Cross-sections and traffic rules** come from `web/src/world.js` `STREETS`, `streets.js` (`lamps`, `block`, `roadNet`) and `life.js` (`control`). They are read from the code, not measured.
- **Car speed** is the same on every street type: each car draws a cruising speed of 9 to 16 m/s (32 to 58 km/h) when placed (`life.js`, `speed: 9 + rand() * 7`).

| Type (`STREETS` key) | Width | Lanes, lane 3.25 m | Sidewalk each side | Parking | Median | Lighting | Traffic rules | Share, seed 7 / 3 |
|---|---|---|---|---|---|---|---|---|
| Boulevard (`boulevard`) | 36 m | 3 + 3 | 6.5 m | none | 3.5 m planted, refuges at zebras | sodium lamps on both kerbs about every 40 m; lit studs at zebras | signals with a protected left phase; inner lane left only; shuttle stops; the roundabout at the tower | 5.4% / 5.4% |
| Avenue (`avenue`, the boulevard's second sector out) | 36 m | 2 + 2 | 6.5 m | none | 10 m, trees | as the boulevard | as the boulevard; outer lane merges where it narrows | 2.5% / 2.5% |
| Main street (`street`) | 21 m | 2 + 2 | 3.75 m | none | double centre line | both kerbs about every 40 m | signals; left turns permitted (they give way); shuttle stops | 15.5% / 15.5% |
| Ring road (`ring`) | 16 m | 1 + 1 | 2.5 m | 6 m bays in runs of three, both sides, about half filled | none | one kerb, alternating, about every 40 m | signal where it meets a main street, the boulevard or a walk; otherwise give way | 15.4% / 15.4% |
| Lane (`lane`, a 14 m line) | 14 m | 1 + 1 | 3.75 m | none | none | alternating | signal at main streets and walks; otherwise all-way give way | 3.8% / 7.7% |
| Local mid street (`local`) | 13 m | 1 + 1 | 3.25 m | none | none | alternating | all-way give way at other local streets | 13.8% / 14.9% |
| One-way mid street (`oneway`) | 13 m | 2, one way | 3.25 m | none | none | alternating | as local | 10.2% / 8.8% |
| Walk (`walk`, a 14 m line, or an old-town mid street) | 14 / 13 m | none | paved across | none | trees, planters, benches; food streets on about three in four long stretches | alternating | no cars; a walk crossing a car street gets lights with a walk phase | 16.5% / 13.0% |
| Service alley (`alley`, outer sectors' mid streets) | 6 m | none drawn, no cars | none | none | none | none | no cars | 15.2% / 15.2% |
| Built over (`none`: half-sector pocket squares and the headquarters' campus) | 13 m | none | paved | none | two trees (pocket squares) | none | no cars | 1.6% / 1.6% |

Corridor counts (one corridor per axis):

| | Seed 7 | Seed 3 |
|---|---|---|
| Ring road | 4 | 4 |
| Main street | 4 | 4 |
| Boulevard | 2 | 2 |
| Walk lines | 3 | 2 |
| Lane lines | 1 | 2 |
| Local mid streets | 5 | 5 |
| One-way mid streets | 3 | 3 |
| Alleys | 4 | 4 |

**Junctions** (measured):

- **Node types in the road graph.**
  - Seed 7: 70 signals, 38 give-way, 1 roundabout, 1 priority, 20 free (merges and splits at the interchange).
  - Seed 3: 69, 43, 1, 1 and 12.
- **Corridor crossings with three or more street arms** (walks and alleys count): 163 on seed 7 and 165 on seed 3 over 0.764 km², or 213 and 216 per km².
- **Crossings where three or more arms carry cars:** 80 on seed 7 (43 T, 37 four-way) and 90 on seed 3 (48 T, 42 four-way), or 105 and 118 per km².

#### Traffic (measured)

Cars in town: 870 on seed 7 and 910 on seed 3.

**Cars per hour past a typical point, both directions.** This is the stand-in for daily traffic. Mean per corridor type, with the range in brackets:

| Type | Seed 7 | Seed 3 |
|---|---|---|
| Main street | 656 (592-715) | 600 (558-632) |
| Boulevard | 656 (637-674) | 603 (526-680) |
| Ring road | 421 (356-535) | 423 (353-490) |
| Lane | 304 | 329 (280-377) |
| Local mid street | 209 (177-249) | 204 (149-255) |
| One-way mid street | 189 (156-246) | 173 (158-199) |
| Expressway median ramp | 48 | 80 |

Only the ratios carry meaning. The absolute numbers follow from how many cars `life.js` places per metre of lane (`EVERY`), not from any demand. Main street and boulevard are equal (1.0). The ring road is about 0.65 of them, the 14 m lanes 0.5, and the mid streets about 0.3.

**Stopped.** 25.1% (seed 7) and 25.6% (seed 3) of car-frames are below 0.2 m/s. That includes every normal wait at a red light.

**Long stops (over 75 s) in 10 minutes:**

| | Seed 7 | Seed 3 |
|---|---|---|
| Long stops | 42 | 124 |
| Of those, over 150 s | 11 | 23 |
| Longest | 211 s | 264 s |

Where they happen, as (x, z) in metres from the centre, with the approach:

- **Seed 7.** Mostly at the four corners where the main streets meet the ring road and leave town:
  - (292.5, 429), ring approach: 14 stops, up to 211 s.
  - (292.5, -292.5), main-street approach: 5.
  - (-429, 292.5), ring approach: 4.
  - Where main streets meet each other: 3.
- **Seed 3.**
  - Where main streets meet 14 m lanes and ring corners: (150, -292.5) 11 stops, up to 239 s; (-292.5, -429) 11; (80.5, -292.5) 10; (292.5, -429) 10, up to 264 s.
  - At give-way crossings of a lane or one-way street: (150, 80.5) 8 and 4; (80.5, 80.5) 5 and 4.

**Cause.** The car at the head of a long-stopped queue was waiting to turn left on 10 of 11 occasions on seed 7, and on 21 of 25 on seed 3. The cars behind it wanted to go straight or right: 20 of 24 on seed 7 and 68 of 87 on seed 3.

A permitted left turn gives way to oncoming traffic. While a steady oncoming stream lasts, the turning car stays at the stop line and holds every car behind it in a lane shared with straight-on traffic.

ADR-0009 says permitted lefts "clear at the end of the phase". The measurements show the head car still waiting at the stop line (not in the junction box) across several cycles. So that clearing applies only to cars already in the box. This is an inference from the measurements; the code path was not traced.

#### Dead ends (measured)

The test for a dead end is a crossing with exactly one car arm (the rule of `masterplan.test.mjs`):

- Seed 7: one, at (-80.5, -150).
- Seed 3: two, at (80.5, 150) and (219.5, 150).

All three have the same cause, read from `cityLayout`'s `closed` rule and confirmed by sampling `kindAt` along those corridors.

- A two-way mid street is built over for half a sector.
- The half it keeps ends at a 14 m line that is a walk, so it carries no cars there.
- The kept half becomes a one-block stub with cars at only one end.

ADR-0010's rule "at most one half per sector, so no stretch is left a dead end" assumes the crossing line carries cars, and a walk line does not. `life.js` drops dead-end lanes, so these stubs are drawn as streets with no traffic. The existing self-checks do not catch them. `masterplan.test.mjs` looks for dead ends only around the headquarters' approach.

#### Walkers (measured)

The walking network (`people.js` `network()`) has 140 corner nodes on both seeds:

| | Seed 7 | Seed 3 |
|---|---|---|
| Sidewalk links | 17,190 m | 17,190 m |
| All sidewalk on both sides of every street | 29,768 m | 29,744 m |
| Share walkers can use | 57.7% | 57.8% |
| Mid streets' sidewalks | 10,400 m | 10,376 m |
| Crossings | 104 | 98 |
| Links on at least one shortest route | 244 of 244 | 238 of 238 |

- Walkers have no link along any mid street's sidewalks; they only cross mid streets.
- Every link lies on at least one shortest route, so the network has no unused links.
- Walker counts per street were not measured.

#### CURRENT.md's open street items, checked on v3

- **"A pedestrian crossing between the HQ and the court": still present** (measured with `hq.mjs`).
  - **Seed 7.** The headquarters (columns 24-27, rows 9-14) and the court (columns 22-23) face each other across the avenue on the line of the mid street at z = -219.5. That mid street is paved over on both sides, and the avenue has no zebra there. The nearest walker crossings of the avenue are at the next lines either way, z = -150 and z = -292.5, whose centre lines are 69.5 m and 73 m from the headquarters' line.
  - **Seed 3.** The mid street west of the avenue is a local street meeting it at a signalled T, but `hasZebra` gives no zebra on either arm across the avenue.
- **ADR-0011's "slip roads cross only mid-street sidewalks, which nobody walks along yet": still true.** The walking network has no mid-street sidewalk links (above).
- **Not re-measured here:**
  - ADR-0012's "second layout in `main.js`" (the page's walkers do not see the headquarters' cut) needs a browser check.
  - The `URBAN_*` documents still describe the v1 city. They are not street items.

#### What the measurements say

- **Variety.** The network already has ten kinds. Three things hide them:
  - Every car street drives at the same speed.
  - Junctions are either signals or all-way give-way.
  - Walks, pocket squares and campus all read as "no cars" in the same way.
- **Congestion.** The worst congestion comes from permitted left turns sharing a lane with straight traffic. It is worst on single-lane approaches (the ring road) and at main-street crossings that carry the most cars.
- **Dead ends.** Three exist, all from one rule.
- **Walkers.** They use about 58% of the sidewalk. The mid streets are crossed, never walked along.

## Street type catalogue

Every type keeps an existing corridor width. No width changes in the proposed option; see Option C for what a width change would move.

### Hierarchy

The classes come from the measured flow ratios above, in place of the daily-traffic bands of the street-design hierarchy:

| Class | Corridors | Flow (main street = 1.0) |
|---|---|---|
| Arterial | Boulevard, avenue, main streets | 1.0 |
| Collector | Ring road, 14 m lanes | 0.5-0.65 |
| Local | Mid streets | about 0.3 |
| Shared and pedestrian | Shared streets, market and night-market streets, passages | below local |

Each type below has a target speed. Today every car draws 32 to 58 km/h whatever the street; the proposal caps cruising speed by type (R3).

| # | Type (invented display name) | Corridor and width | Cross-section, each side from the building line in | Traffic rules | Where |
|---|---|---|---|---|---|
| 1 | **Grand boulevard** (Orrin Boulevard) | `boulevard`, 36 m | 6.5 m sidewalk (frontage, clear walkway, a furnishing strip with shuttle stops and lamps), 3 x 3.25 m lanes, 3.5 m planted median with refuges | signals, protected left phase (as today); target 50 km/h | both central axes, from the tower out one sector, and the outermost sector to the highway |
| 2 | **Civic avenue** (Vessa Avenue) | `avenue`, 36 m | 6.5 m sidewalk, 2 x 3.25 m lanes, 10 m median with trees; a signalled walk crossing on the headquarters-court line | as the boulevard; target 40 km/h | the boulevard's second sector out, where the headquarters and court face each other |
| 3 | **Main street** (Kiln Street and its three sisters) | `street`, 21 m | 3.75 m sidewalk, 2 x 3.25 m lanes, double centre line | signals with protected-permitted left turns at other main streets and the ring road; target 40 km/h | lines 1 and 5 on both axes (the plan's arterials) |
| 4 | **Ring road** (Outer Loop) | `ring`, 16 m | 2.5 m sidewalk, parking bays in runs of three with kerb build-outs and trees, 1 x 3.25 m lane | signals with protected-permitted lefts at the main streets; priority over side streets elsewhere; target 40 km/h | the perimeter |
| 5 | **Lane** | `lane`, 14 m | 3.75 m sidewalk, 1 x 3.25 m lane | priority over the mid streets it crosses; signals at main streets; target 30 km/h | the 14 m lines the seed makes lanes |
| 6 | **Night-market street** (Lantern Row, on seed 7) | `walk`, 14 m line | paved kerb to kerb; stalls, cafe terraces, overhead canopies and strings of low lights at 3-5 m; trees and benches in between | no cars; a lit walk phase where it crosses a car street, with a raised table; target: walking | the 14 m lines the seed makes walks |
| 7 | **Market lane** | `walk` in the old town, 13 m | paved; awnings and stall frames along both edges; a clear middle at least 3.5 m wide for service access | no cars (service at no time drawn); walkers cross at its ends | the old town's mid streets |
| 8 | **One-way pair** | `oneway`, 13 m | 3.25 m sidewalk, 2 x 3.25 m lanes in one direction, arrows on every approach | runs opposite to its partner; priority over local streets; target 30 km/h | at most one pair per axis: the two mid streets either side of that axis's first walk line, carrying the through traffic the night-market street does not |
| 9 | **Local street** | `local`, 13 m | 3.25 m sidewalk, 1 x 3.25 m lane each way | all-way give-way at other local streets, drawn as a raised junction; target 30 km/h | the other inner mid streets |
| 10 | **Shared street** | new `shared`, 13 m | one flush surface; a single 4 m way, one direction, that bends between planters, benches and trees; bollard lights at 1 m | cars give way to everything; target 15 km/h; entered over a continuous sidewalk | the half-sector stretches built over today (except the headquarters' cut) |
| 11 | **Service alley** | `alley`, 6 m | asphalt, no sidewalks; dumpsters and planters at the edges; wall lamps | no through traffic; parked delivery vans only | the outer sectors' mid streets |
| 12 | **Campus passage** | `none` at the headquarters' cut, 13 m | paved, pedestrian only | no cars | the mid street the headquarters straddles |

How the catalogue changes today's layout:

- **One-way streets come only in pairs.** Today 45% of inner mid streets, chosen at random, are one way, not always next to a partner. Under the proposal, a one-way street that is not part of a pair becomes a local street.
- **Built-over halves become shared streets.** They still carry cars, slowly, so they never leave a stub. This removes all three measured dead ends. On seed 7, one of the three is also removed by its mid street becoming part of the pair.
- **Night-market streets and market lanes are walks dressed by where they lie** (a main line or the old town). No new kind is needed in `world.js`.

### The network on seed 7 (the v3 plan)

Drawn in `0016-concept.svg`. Seed 7's lines along x are ring, main street, walk, boulevard, walk, main street, ring. Along z they are ring, main street, walk, boulevard, lane, main street, ring. The old town is quarter (1, 3). The headquarters is on the north candidate (sector 9).

- **Grand boulevard and civic avenue: unchanged.** These are the plan's `boulevard` corridors.
- **The avenue at the headquarters.** A signalled walk crossing on the headquarters-court line (z = -219.5) gives the forecourt a direct way over. It needs no node beyond the walk-only signal that `life.js` `control()` already runs where a walk crosses a car street.
- **Main streets:** the plan's four `arterial` corridors. The four crossings of main street with main street, and the eight where a main street meets the ring road, get protected-permitted left turns (amber squares in the drawing). All five of seed 7's crossings with repeated long stops are among them, and 4 of seed 3's 10 worst.
- **Lantern Row** (the walk at z = -150 along x, and x = -150 along z) becomes a night-market street. The second walk along x (z = 150) borders the old town: a night-market street too, but its pair is not built (one pair per axis).
- **One-way pairs.** Along x, the mid streets at z = -219.5 (eastbound) and z = -80.5 (westbound) either side of Lantern Row. Along z, those at x = -219.5 and x = -80.5. The x pair is interrupted at the headquarters' cut and becomes the campus passage there.
  - This removes the dead end at (-80.5, -150): that mid street's built-over half goes, since one-way streets are never built over.
  - Elsewhere it turns seed 7's lone one-way streets (x = 80.5 and 219.5 along z) into local streets.
- **Shared streets.** The remaining built-over halves outside the pairs. On seed 7 that is one stretch, east of the avenue in the south.
- **Market lanes.** The old town's mid streets in quarter (1, 3), as today.
- **Ring road and alleys:** as today, with the junction and dressing changes below.

### Traffic improvements

**Junction types.**

| Meeting | Today | Proposed |
|---|---|---|
| Boulevard or avenue with any car street | signal, protected left | unchanged |
| Main street with main street, main street with ring road | signal, permitted left (gives way) | signal with a protected-permitted left: a left arrow phase (7 s, as the boulevard's) after each street's own phase, permitted the rest of the time. The first car waiting to turn pulls into the junction box on green and clears on amber |
| Main street with a lane or mid street | signal, permitted left | signal, permitted left, with the same pull-in-and-clear rule. No arrow phase |
| Ring road with a lane or mid street | all-way give-way | priority: the ring road does not stop; the side street gives way (node type `priority`, which exists since ADR-0011) |
| Lane with a mid street; one-way pair with a local street | all-way give-way | priority to the lane or the one-way pair |
| Local street with local street | all-way give-way | unchanged in behaviour; drawn as a raised junction (paving at sidewalk height, short ramps) |
| Shared street with anything | (built over today) | give way to everything; entry over a continuous sidewalk |
| Walk (night-market) across a car street | signal with a walk phase | unchanged, plus a raised table at the zebra |
| Tower roundabout | roundabout | unchanged |
| Headquarters-court line on the avenue | none | walk-only signal (existing walk phase type), timed with its neighbours |

**Signals or give-way.** The street-design method decides with traffic thresholds. Here the measured flow ratios stand in for them:

- **Signals** where an arterial is involved (as today) or a walk crosses a car street (as today).
- **Priority** where a collector meets a local street.
- **All-way give-way** only where two equal local streets meet.

How many of today's 38 (seed 7) and 43 (seed 3) give-way crossings become priority junctions was not counted here. PR 3 measures it.

**Turn lanes.** None are added. Every carriageway is already full at its width, and the boulevard and avenue already have their inner lane as a left-turn lane. The protected-permitted phase and the pull-in-and-clear rule do the work a pocket would do, without moving a kerb. The left-turn arrows painted today follow the same lane rules (`lanesMay`), so the paint stays true.

**One-way systems.** At most one pair per axis, either side of the first night-market street (above).

**Calming.**

- A cruising-speed cap per type (the target speeds above). It is ambient only and changes nothing stored.
- Raised tables at mid-street zebras and night-market crossings.
- Raised junctions where two local streets meet.
- A gateway where each main street enters the city at the ring road: a change of paving and a narrowing in paint.
- On shared streets, the bending way between planters.
- Nothing flashes. Raised tables are drawn, not animated.

**Fixes for each measured problem.**

| Measured | Fix | Check in its PR |
|---|---|---|
| Long stops behind permitted lefts where main streets meet each other or the ring road (seed 7 at (292.5, ±429), (±292.5, -292.5), (-429, 292.5); seed 3 at (±292.5, -429), (-292.5, 429), (-292.5, 292.5)) | protected-permitted left, pull-in-and-clear | `baseline.mjs` method as a Node test on both v3 fixtures: long stops at least halved and none over 150 s, with no rise in two cars' bodies overlapping |
| Long stops where an arterial meets a 14 m lane or a mid street (seed 3: (150, -292.5), (80.5, -292.5), (-292.5, 219.5), (150, 0)) | pull-in-and-clear | the same test |
| Long stops at give-way crossings of a lane or one-way street (seed 3: (150, 80.5), (80.5, 80.5)) | priority junctions | the same test |
| Dead ends (seed 7: (-80.5, -150); seed 3: (80.5, 150), (219.5, 150)) | R1: `closed` never builds over a half whose other end meets a corridor carrying no cars; then R6: shared streets | a dead-end test over seeds 0-49, plus the two fixtures asserting none |
| No crossing between headquarters and court | walk-only signal on the avenue | the walking network gains the crossing; `hasZebra` true there; browser check of seeds 7 and 3 |
| Mid streets' sidewalks never walked along | R8 (later): walkers on the full block-corner network | the walking network's coverage of sidewalk length (57.7% today) |

## Options

- **A. Catalogue on today's widths, renderer only (proposed).** Everything above. The `plan` is unchanged. PR B reads the backbone as ADR-0015 defines it.
- **B. A, plus every corridor's class in the plan (S).** The plan's `backbone` today names 6 corridors. Under B it would list all 14 lines with a class each: the ring road as `collector`, and each 14 m line as `lane` or `market`. The lane-or-walk draw would move from the renderer's generator (`rng(seed * 13 + 5)` in `cityLayout`) into `plan_for(seed)`. PR B's frontage weighting could then give night-market and ring-road frontage their own weight (`MINOR_SHARE` split by class).
- **C. Real cross-sections with new widths (R, but it moves tiles).** The method's full cross-sections:
  - main streets at 24 m with parking and a tree strip;
  - the ring road at 18 m;
  - mid streets at 12 m.

  Tile centres come from the sum of corridor widths (`cityLayout`), so every width change moves buildings on screen. By `cityLayout`'s arithmetic (estimated, not run):
  - Main streets 21 to 24 m move every tile beyond them 3 m outward.
  - The ring road 16 to 18 m grows the city's edge by 2 m each side.
  - Mid streets 13 to 12 m move every tile in an inner sector by up to 2 m inward.
  - The headquarters and court lie between the boulevard and the 14 m line, so they move only with the mid-street change.
  - The interchange's ramps are laid round the main street at x = 292.5 and would need their curves redone.

| | A. Renderer catalogue | B. A + classes in the plan | C. New widths |
|---|---|---|---|
| Class | R | S + R | R (moves tiles) |
| Sim and schema | none | `plan` gains entries and roles; `validate()` changes; a new `SIM_VERSION` and golden; a schema decision (6 with new roles, or 7) | none |
| Must land before PR B and genesis | no | yes | no, but it should land before the first public view |
| Moves anything on screen | no tile moves | no tile moves; on every seed some 14 m lines switch between walk and lane (a fresh draw) | every building, the headquarters, the interchange geometry |
| Renderer fixtures and tests | new tests; existing ones keep their meaning | v3 fixtures stay valid (schema 6 code still reads a v3 plan) only if the new entries are optional | screen-space and position-based checks rework |
| Variety gained | 12 types, junction variety, speed by type | as A, plus height and frontage that follow the street type | real proportions: narrower locals, parked main streets |
| Cost and risk | low: renderer PRs one at a time | medium: one more sim change before genesis | high |
| Reversibility | revert each PR | before genesis: easy; after: a new schema | revert, but every check redone |

**Decision proposed: A.** B is offered as the one S choice, for the owner to take or leave before PR B (Open question 1). C is not proposed.

## Classification of every proposal

**(S): changes what the simulation stores.** Must land before PR B and before genesis.

- **None in option A.**
- Option B only:
  - S1: every corridor's class in `plan`, with the lane-or-walk draw moved to the simulation.
  - S2: PR B's frontage weight split by class.

**(R): renderer only.** Can land at any time:

1. Dead-end fix in `closed`.
2. Protected-permitted lefts and pull-in-and-clear.
3. Priority junctions.
4. Speed by street type.
5. Raised tables, raised junctions and gateways.
6. The walk crossing between headquarters and court.
7. One-way pairs by rule.
8. Shared streets (a new `STREETS` entry, same 13 m).
9. Dressing by type: night-market canopies and low lights, market-lane awnings, alley wall lamps, a second row of low lamps on the boulevard and main streets.
10. Later, walkers along mid streets.

**Widths.** No width change is proposed. Every type keeps its corridor's width, so no tile, building, headquarters or interchange piece moves on screen. What moves on screen:

- paint (arrows, raised tables, gateways);
- which mid streets are one way;
- where cars may drive (shared streets);
- signal phases;
- car speeds.

## Compatibility with ADR-0015

**The headquarters' site and court stay valid.**

- The boulevard and avenue keep their widths, kinds and lanes.
- The site's front edge stays on the avenue and the court directly across it. The campus's cut mid street stays paved over (the campus passage).
- The proposed crossing lies on the site's own centre line, the mid street it straddles, so it needs nothing from the plan.
- On seed 3 that line is today a signalled T on the avenue. The crossing becomes a zebra on that T's arms across the avenue.
- On seed 7 it is a walk-only signal mid-block. Seed 7's mid street there is paved over on both sides.
- The test in ADR-0015's acceptance criterion 5 (`hq.front.kind` is `avenue`) is unaffected.

**What PR B's frontage weighting should read.**

- Only `state["plan"]["backbone"]`, as ADR-0015 defines it: `F = 1` on the `boulevard` corridors, `ARTERIAL_SHARE` on the `arterial` ones, `MINOR_SHARE` (0) elsewhere.
- It must not read anything from this catalogue: the renderer's types are not in the snapshot, and the simulation never reads the renderer (ADR-0002).
- If the owner wants night-market or ring-road frontage weighted, that is option B, and it lands with or before PR B.

**The transect as a shape for PR B's height envelope.** This is a suggestion only; PR B owns the numbers and its acceptance criteria.

- **The idea.** The transect's zones (T3 to T6) order height from the core outward. The masterplan method adds that transitions should fall at streets, not mid-block.
- **ADR-0015's centrality term.** `C = max(0, 1 - ring / CENTRE_REACH)` changes every tile. Two faces of one 56 m block can therefore get different caps.
- **A transect version.** Make `C` a step function of the sector ring instead (the Chebyshev distance of the tile's sector from the centre, 0 to 2). The envelope would then change only at the main streets.

| Zone | Where | Envelope |
|---|---|---|
| T6 | the four centre sectors | `FLOORS_MAX` |
| T5 | the next ring | between |
| T4 | the outer ring | `EDGE_FLOORS` |

- Backbone frontage keeps `FRONT_FLOORS` on top, as ADR-0015 has it, which reads as a T5 band along the arterials. The ordering is the transect's. Its storey numbers (T6 6-30+, T5 4-8) are for real towns and are not proposed.
- **Cost.** One `if` instead of a division, and the same draws. Whether it passes criteria 1 to 4 is untested. It might make criterion 2 (no reversal) easier, since steps fall where bands already change.

## Later: building variety (out of scope here)

A separate pass on how buildings look should cover:

- **Frontage by street type.** Shopfronts and arcades on main streets and the boulevard. Stalls built into ground floors on night-market streets. Stoops and small entrances on local and shared streets. Loading doors on alleys.
- **Corner buildings** at main-street crossings.
- **Podium and tower forms** matching the transect zones above, once PR B's heights exist.
- **Street walls.** Setback zero on arterials, small setbacks on local streets.
- **How new models enter `families.js`**, and their levels of detail.
- **A download budget.** Today `web/assets` holds 64 glTF models (0.93 MB of JSON and 9.9 MB of buffers, about 10.9 MB raw) and 20.6 MB of textures (measured with `find web/assets`). Proposed budget: new building models add at most 3 MB raw (about +28% of today's model data). New textures go into existing atlases rather than new files. Mesh compression (the open GLB-with-meshopt item) should land first, so the budget is measured compressed.
- **The frame-time check** (`?bench=1000x625`) before and after.

## Roadmap

In order. Every PR is renderer only unless marked. Sizes are estimates.

| # | PR | Class | Size | Tests | Depends on |
|---|---|---|---|---|---|
| 0 | (Only if option B is taken) every corridor's class in `plan`; `validate()`; `SIM_VERSION` bump and golden; renderer reads the classes from `plan` on new snapshots and draws today's for v3 | S | 200-300 lines | plan identical each tick; `validate()`; contract test that `cityLayout` agrees with the plan; golden | before PR B and genesis |
| 1 | `closed` never builds over a half that would leave a stub | R | 20-40 lines | dead ends over seeds 0-49 is zero; seed 7 and 3 fixtures; existing lane and walking self-checks | none |
| 2 | Protected-permitted lefts at main-street and ring-road corners; pull-in-and-clear for permitted lefts | R | 100-150 lines | long-stop test on both fixtures (halved, none over 150 s); no body overlap; the interchange tests unchanged | none |
| 3 | Priority junctions (collector over local, pair over local) | R | 40-80 lines | long stops at give-way crossings; no stuck lanes; turning cars still give way to walkers | 2 (shares the long-stop test) |
| 4 | Walk crossing between headquarters and court | R | 40-80 lines | walking network has the crossing on seeds 7 and 3; `hasZebra` there; walk signal heads drawn; browser check | none |
| 5 | Speed by street type; raised tables, raised junctions, gateways | R | 80-150 lines | speeds per kind in the harness; frame time with `?bench` | none |
| 6 | One-way pairs by rule; lone one-ways to local | R | 40-80 lines | one pair per axis at most; arrows match `lanesMay`; no dead end; long-stop test | 1, 3 |
| 7 | Shared streets on built-over halves | R | 200-300 lines | new kind in `STREETS`, `CARS`; no dead end; cars yield; walkers cross; long-stop test | 1, 5, 6 |
| 8 | Dressing by type (night-market, market lane, alleys, low lamps) | R | 300-500 lines | headless fingerprint changes only where intended; frame time; style guide updated | 6, 7 |
| 9 | Walkers along mid streets (full block-corner network, ADR-0009's deferred alternative) | R | large, its own ADR | coverage of sidewalk length; route table size and load time | 7 |

PR B (ADR-0015) can land before, between or after 1 to 9. Only row 0 constrains it.

## Which method shaped what

- **street-design, §1 Street Hierarchy Classification** (classes by daily traffic and function; contextual modifiers): the four classes above, using measured flow ratios in place of daily-traffic bands. The "historic district" modifier set the old town's market lanes; the "commercial" modifier set night-market dressing.
- **street-design, §2 Cross-Section Design Methodology** (layers from the building face in): each catalogue row is written as frontage, clear walkway, furnishing strip, then lanes. It also gave the check that option A fits every type inside today's widths, and the rejection of turn pockets (no room at fixed widths).
- **street-design, §4 Intersection Design** and **references/intersection-design.md** (signal warrants, stop-controlled and raised intersections, turn lanes "only where warranted", the pedestrian-hybrid-beacon spacing of 90 m from the nearest signal):
  - the junction table;
  - priority instead of all-way give-way;
  - raised junctions where two local streets meet;
  - the headquarters crossing as a walk phase tied to its neighbours rather than a free-standing beacon, since it is 69.5 to 73 m from the nearest signals.
- **street-design, §6 Traffic Calming Toolkit:** speed targets by type; raised tables; gateways; bending shared-street ways with no straight run over 30-50 m.
- **street-design, §5 Streetscape** and **references/street-typologies.md** (lighting heights by type, festival street, alley, passage): the dressing per type and the night-market's low lights at 3-5 m.
- **masterplan-design, §2 Movement Framework and §4 Step 5** (connectivity, multiple routes, T-junctions, "avoid cul-de-sac plans"): the dead-end fixes, and keeping T-junctions as a source of variety. The one-pair-per-axis rule follows "distribute traffic across multiple routes".
- **masterplan-design, §5 Phasing** and **references/phasing-strategies.md** ("infrastructure leads development"; the primary road built to full cross-section first): the rule that the only S choice must land before PR B and genesis.
- **masterplan-design references/typologies.md** (block faces and intersection density):
  - Today's 56 m blocks are below every maximum block length given there.
  - 213 junctions per km² is above every minimum given.
  - So no block or network change is proposed.
- **zoning-and-codes, §2 Transect Zone Specifications:** the height-envelope suggestion (ordering and steps at streets, not the storey numbers).
- **urban-calculator, `walkability_scorer.py`**, run from the skill's folder with arguments only (`python -I scripts/walkability_scorer.py --intersection-density 213`). Output: "Intersection Bonus: 10.0", "WALK SCORE: 10 / 100", "Amenities within range: 0 / 9".
  - Its connectivity term is at its maximum at the measured density.
  - The amenity terms need real-world distances, which this city does not have, so none were substituted.
  - It decided nothing beyond confirming that the grid needs no more junctions.

## Consequences

- **Option A** changes nothing stored. The simulation, the snapshot, the plan, the fixtures and the golden files are untouched. PR B proceeds as ADR-0015 says.
- **What changes is the renderer only, one PR at a time:** which mid streets are one way, a new shared-street kind, junction control, car speeds, paint and dressing. Two visitors still see the same streets, since all of it is derived from the seed and the plan.
- **ADR-0002 holds.** Cars and walkers stay browser-only. They react to the snapshot's streets and sites and invent nothing. Shared streets replace stretches that are already streets in the renderer; they are not simulated land.
- **ADR-0010 is amended** by PRs 1 and 6 (built-over halves and one-way choice) and **ADR-0009** by PR 2 (permitted lefts), each recorded in its PR.
- **What could break:**
  - Priority junctions can starve a side street. PR 3 needs the same patience rule as ADR-0011's merges.
  - Protected-permitted phases lengthen cycles at 12 crossings, from 40 s to 64 s. Walkers wait longer there, still within the 60-90 s the method gives as the most a walker should wait.
  - Shared streets bring cars onto paving that walkers use. Cars must give way, which needs a walker check like the ramps' (ADR-0011).
  - Changing one-way choices changes every seed's mid streets, as ADR-0010 did.
- **Cost:** no AWS, no API, no visitor input. Frame time is checked in PRs 5 and 8.

## Open questions

1. **Option B:** should the plan carry every corridor's class, so that PR B can weight night-market and ring-road frontage? Default: no (option A). If yes, it lands before PR B.
2. **Walker counts.** This pass measured walking-network coverage, not how many walkers use each street. Should PR 9's ADR count them (people per sector per minute, headless) before designing walkers along mid streets?
3. **The pull-in-and-clear rule** is inferred from where cars stopped, not from tracing `life.js`. PR 2 should confirm the mechanism first.
4. **Night-market streets with no pair.** Seed 7's second walk along x borders the old town and gets no one-way pair. Is one pair per axis enough, or should each walk line get one when it does not border the old town?
5. **Mini-roundabouts** at the ring road's corners, in place of protected-permitted lefts. A 16 x 21 m junction box fits only a mini roundabout with a mountable centre. Worth a prototype after PR 2's numbers?
6. **The transect envelope** (step by sector ring): offer it to PR B, or leave PR B as ADR-0015 wrote it?
7. **Other seeds.** Only seeds 7 and 3 were measured. Should PR 1's dead-end test cover seeds 0-49 from fresh runs, or from frozen fixtures only (the fixture rule in `CLAUDE.md`)?
