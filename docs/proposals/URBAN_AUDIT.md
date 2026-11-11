# Urban design audit | Vektor-9

Date: 2026-11-11. Seed 7, tick 4032 (`uv run python -m sim --ticks 4032 --seed 7 --out snapshots`), renderer at `main` @ `b90d348`. Read-only: nothing in the city, the generators, the sim or the snapshots was changed.

Companion documents: `URBAN_MASTERPLAN.md` (proposals), `URBAN_DEPENDENCIES.md` (code, sim compatibility, regression risks). Diagram: `URBAN_PLAN.svg` (made by `urban-audit/make_plan.py`). Screenshots: `urban-audit/*.jpg`.

## How to read the evidence

Every claim carries one of these labels.

- **[S nn]** a screenshot I took this session, `urban-audit/nn-*.jpg`, with its `?view=` below.
- **[M]** measured this session from the snapshot, or from the renderer's own layout functions run in the page (`cityLayout`, `kindAt`, `hqSite`, `plan` in `interchange.js`).
- **[C]** read in the code (file and line given).
- **[K]** known from an ADR, the handoff or `AUDIT_PLAN.md`, and not seen again this session.
- **[A]** an assumption or a judgement.

The snapshot happens to be in a blackout: 220 tiles in the north-east and south-east are dark [M]. Dark buildings in some shots are the sim, not a fault.

## Viewpoints captured

All at `http://localhost:8001/web/` with these `?view=` values (a second server held port 8000).

| # | Subject | ?view= |
|---|---|---|
| 01 | Full aerial, straight down | `0,1100,1,0,0,0` |
| 02 | Roundabout and telecom tower | `-70,110,150,0,0,10` |
| 03 | Boulevard looking north past the tower | `-30,260,330,0,0,-60` |
| 04 | Highway interchange | `170,230,190,300,0,0` |
| 05 | Old town from above | `-90,170,-90,-220,0,-220` |
| 06 | Old town market lane, low | `-215,45,5,-220,0,-110` |
| 07 | IKARO HQ | `230,150,-170,115,60,-80` |
| 08 | HQ forecourt and its street | `200,40,-40,130,5,-80` |
| 09 | Skyline from the south-east | `620,260,620,0,60,0` |
| 10 | Rail terminus and old works | `-120,200,-200,-220,0,-370` |
| 11 | North-east frontier of empty lots | `150,260,-120,180,0,-340` |
| 12 | Pedestrian walk at z = 150 | `-60,70,150,30,0,150` |
| 13 | Residential south-west | `-150,160,180,-230,0,330` |
| 14 | West park | `-200,170,120,-290,0,10` |
| 15 | Behind the HQ (paved mid street) | `40,230,-10,70,0,-82` |

Not captured, so not claimed as seen: walkers on the interchange ramps, cars merging, other seeds, other ticks, rain, mobile widths.

## The existing structure

### What is procedural, what is fixed, what follows the simulation

| Element | Where | Kind |
|---|---|---|
| Tiles: kind, floors, power, style seed | `sim/step.py`, `sim/state.py` | **Simulation state.** Changes every tick. The renderer must draw it as it is (ADR-0002). |
| Terrain: hub plaza, railway, interchange land, two parks, the works | `sim/state.py:127 lay_terrain` | **Fixed by the sim at tick 0**, from the seed. Never built on, never changes. Interchange land is the same 64 tiles on every seed. |
| Street grid: corridor order and widths | `web/src/city.js:26 cityLayout`, `world.js:10 STREETS` | **Procedural, renderer only.** Main corridors between sectors, a mid street inside each; the boulevard through the centre, ring road outside. Which narrow lines are walks or lanes, and which mid streets are one-way, comes from the seed. |
| Street kind along its length | `city.js:87 kindAt` | Procedural: avenue stretches, old-town market lanes, built-over half-stretches (T-junctions), the HQ's cut. |
| Old town location and warp | `city.js:71-77`, `city.js:105 cityWarp` | Procedural from the snapshot: the inner 2 x 2-sector quarter with the least terrain (seed 7: the north-west one). |
| Buildings | `families.js:18 familyOf`, `city.js:200` | Height and kind from the sim; family, footprint, frontage and turn are fixed rules on the tile. |
| Telecom tower, roundabout | `streets.js:519 plaza`, `landmarks.js:21` | Fixed: always at the centre, on the sim's hub plaza. |
| IKARO HQ | `headquarters.js:39 hqSite` | **Depends on the sim**: the best 6 x 4 block of houses and lots near the centre at load time. It can move or vanish on a later snapshot (ADR-0007). |
| Signature, heavy and flagship towers, corporate signs, billboards, skybridges | `city.js:336-601` | Depend on the sim: chosen from tile heights each load. |
| Interchange | `interchange.js:40 plan` | Fixed geometry on the fixed road land; the slip roads depend on the seed's street kinds. |
| Rail, station, works | `terrain.js`, `landmarks.js:109` | Fixed by the sim's terrain. |
| Traffic, walkers, steam, hovercars | `life.js`, `people.js`, `aircars.js` | Ambient, browser only, never stored (ADR-0002). |

### The plan in numbers (seed 7) [M]

- The city is 874 m across (about 71 ha inside the ring road's outer kerb, 76 ha to its outer edge), 48 x 48 tiles in 6 x 6 sectors.
- Corridors each way, from west to east (and the same north to south): ring 16 m, alley 6, main street 21, mid 13, **walk 14**, mid 13, **boulevard 36**, mid 13, **walk / lane 14**, mid 13, main street 21, alley 6, ring 16.
- The two 14 m lines at ±150 m are pedestrian walks in three of their four directions. Only x = 150 running north-south is a 14 m lane with one lane each way.
- The boulevard narrows to a 10 m-median avenue in the second sector out each way.
- Tiles: 1,442 houses (median 12 floors, max 31), 569 empty lots, 31 building sites, 67 markets, 20 power plants, 79 park tiles (16 of them the hub plaza), 16 rail, 16 works, 64 interchange road.
- Blocks are 4 x 4 tiles (56 m of land, about 250 m perimeter at the kerb) [K, AUDIT_PLAN §4]. Intersection density is about 220 per km² [K].

## Assessment

Each area separates what is intended (the cyberpunk canyon, density, signage) from what does not work.

### 1. Road hierarchy, connectivity, intersection geometry

- **Intended and working.** A clear three-step hierarchy reads from the air: boulevard, main streets, ring road, with fine mid streets between [S 01]. Lane widths of 3.25 m, kerb radii of 3.5-5 m and 3 m zebras are all in normal urban ranges [K]. T-junctions, one-way pairs and the avenue stretches break the repetition, as ADR-0010 intended [M].
- **Coarse through-network.** Because the lines at ±150 m are walks, multi-lane east-west travel has only three roads: z = -292.5, 0 and +292.5, 292 m apart. North-south it has the same three plus the 14 m lane at x = 150 [M]. Everything between is a 13 m mid street with one lane each way or one way. The boulevard is the only multi-lane road across the centre. For a city of this density that is thin, though it suits a car-light cyberpunk core [A].
- **The roundabout** has an island of 26 m radius and an outer kerb at 39.6 m: a multi-lane roundabout at the scale of a suburban arterial junction (45-55 m inscribed) [C `streets.js:517-518`]. It works as a stage for the tower; as traffic it is oversized for the streets feeding it.

### 2. Traffic and the vehicle graph

- Cars use a lane graph with turns, lights, protected lefts on the boulevard and give-way at local crossings (ADR-0009, ADR-0010) [K].
- **The interchange's only distributor is a 21 m main street** (two lanes each way, no median, no turn lanes) at x = 292.5. All four ramps and their slip roads land on it or on the 13 m cross streets beside it [M, `interchange.js` plan]. The inner lanes run on west down the boulevard's median ramps.
- **Merges do not look for a gap** at the `free` nodes where ramps and slips join (P0-2) [K, ADR-0011].
- Car-free walks interrupt car streets cleanly: cars never enter a walk; it is a lights-controlled crossing [S 12].

### 3. Pedestrian connectivity, crossings, accessibility

- **Walkers move between sector corners only** [C `people.js:108 network`: 12 x 12 nodes on main-street sidewalks]. They walk along main streets and the ±150 walks and cross the mid streets, but never walk **along** a mid street. The old town's market lanes are mid streets, so they have seated and queuing people (food places) but nobody strolling them [C, A].
- About a third of car junctions have no zebra (51 of 150), by design (ADR-0010) [K]. Walkers go round.
- **Walkers pass through the low ends of ramps and slip roads** where these cross the main street's and the cross streets' sidewalks at the interchange (P0-1) [K, ADR-0011, handoff].
- The tower island cannot be reached on foot: walkers circle the roundabout at 44 m [C `people.js:38`]. The four plaza corners outside the ring are paved squares with three trees each [C `streets.js:519-554`].
- Accessibility features (kerb ramps, tactile paving) are not modelled. At this viewing distance that is reasonable [A].

### 4. Density, footprints, orientation, placement

- Footprints 7.5-12.5 m on 14 m lots, perimeter frontage (buildings pushed to the street, courtyards behind), one-storey shop strips joining into street walls [C `city.js:213-232`, `city.js:619-655`].
- Gross FAR is about 2.8 [K]. Gaps of 1.5-6.5 m between 40-100 m towers and H:W of about 2:1 on 21 m streets are the intended canyon [K]. Keep them.
- **Heights do not rise toward the centre** [M]. Mean floors by ring from the centre: 11.4 (0-4 tiles out), 11.2, 12.8, 11.2, 11.2, 12.7 (20-24 tiles out). The p90 is 18-22 everywhere. The tallest towers are 31 floors at the east edge (x 414), 29 at x -192 and 26 on the south edge. This is sim truth (growth and redevelopment by sector), not a renderer bug.

### 5. Districts and identity

- **Old town** (north-west inner quarter): winding streets, market lanes with cafe tables and stalls, brick "old" family. At street level it works [S 06]. From any oblique view it reads as dense 12-16 floor towers like everywhere else, because the sim's heights are the same there [S 05]. From straight above the warp reads [S 01].
- **Everywhere else** has one grain: 4 x 4-tile blocks, the same frontage strips, the same lamp spacing. Sectors differ only by a glass or concrete lean and by building family [C `city.js:207-209`, S 13].
- **Industry** is the 16-tile works and the rail terminus in the north-west outer sector [S 10]. It reads well but is small and surrounded by towers.
- **20 power plants and 67 market halls** are single tiles scattered through housing [M]. Ten plants sit on a main-street edge. They are sim facts. They read as clutter rather than as part of a district [A].
- **The north-east frontier** (the north row of sectors east of x = -150) is 211 empty lots out of 256 tiles, 62-90% per sector [M]. The south-west corner sector is 68% empty. See area 10.

### 6. IKARO HQ placement and access

- The site is chosen by `hqSite` [C `headquarters.js:39`]: seed 7 gives cols 28-31, rows 17-22, centre (115, -80.5), **front facing +x onto the 14 m lane at x = 150** [M].
- So the city's seat of power has its 18 m forecourt on a one-lane-each-way street, looking at four- to ten-floor buildings and empty lots across it [S 08, M]. Its back faces a one-way mid street at x = 80.5. The boulevard is 80 m behind it and has no relationship with it.
- The mid street through the gap between its towers is paved over by the campus, as designed. On seed 7 the next half-stretch toward the boulevard (cols 24-27) is also built over by the T-junction rule [M, `city.js:82 closed`], so a 56 m paved square lies between the boulevard and the HQ's rear, **on the axis of the gap where the eye floats** [S 15]. It is chance (one sector in three), not planned. It is the cheapest opportunity in the city.
- The boulevard-facing alternative site (cols 24-27) is not eligible on seed 7: it holds a power plant (col 25, row 19) and hub-plaza tiles [M].
- The campus is 8 m wider than its model, so plain paving strips show at its sides [K].

### 7. Public spaces and street life

- **Working:** the ±150 walks with food stalls, cafe tables and planting [S 12]; the old-town market lanes [S 06]; the interchange loop parks with ponds and the monuments [S 04].
- **The centre has no place to stand** (area 3). The sim reserves 4 x 4 tiles as the "tower's plaza", and almost all of it is roundabout carriageway [S 02].
- **Parks are tile mosaics.** Each park tile draws its own 13.4 m slab, one 2.2 m path along z offset by up to ±2 m, two to four trees and a lamp [C `terrain.js:29 park`]. Paths never cross, never turn and do not line up between tiles [S 14].
- **Both parks are cut by main streets.** The west park (32 tiles) straddles the boulevard and the x = -292.5 main street, so it is four pieces. The north-east park (31 tiles) straddles the x = 292.5 and z = -292.5 main streets [M].
- Green space within 300 m of a house: 64%; within 400 m: 84% [M]. Markets within 200 m: 100%.

### 8. Skyline, view corridors, landmark visibility

- Two landmarks carry the skyline: the telecom tower and the HQ [S 09]. Everything else is an even carpet (area 4). The signature towers' retrofits do not read from the skyline view because their heights are ordinary and they sit at the edges [S 09, M].
- **The boulevard is the one real view corridor**, and it ends on the tower from every direction [S 03]. But the corridor is 36 m between 40-70 m walls, so the tower is seen in slices.
- No corridor leads to the HQ [M].

### 9. Highway connections, ramps, industrial access

- One grade-separated arrival (east). The other three highways meet the ring road at grade as causeways [K, ADR-0011, `desert.js`]. The city's gateways differ a lot in weight.
- The interchange itself reads well: loops, ponds, monuments, sound walls, a yard [S 04].
- **No freight logic.** The works and rail are in the north-west outer sector, the highway interchange in the east. Nothing links them except ordinary streets [M].

### 10. Strange geometry, overlaps, unused land, implausible transitions

- **The frontier is drawn as fully serviced parking.** Every empty lot is a parking plaza with two to five cars and sometimes a lit kiosk [C `tiles.js:90 plaza`]. Every street around it has lamps, signals and zebras. Four sectors of this read as a car park the size of a district, not as the edge of a growing city [S 11].
- **The city ends abruptly.** The ring road with parking bays meets bare desert [S 10, S 11]. That is partly intended (the city in the dust), but there is no transition at all.
- The park paths' offsets and the HQ's paving strips are small geometry seams (area 7, area 6).
- No overlaps of buildings, ramps or streets were seen in the captures. The ramp ends crossing sidewalks are known (P0-1).

## Scorecard (composite, only the criteria that apply to a simulated city)

Scores 1-5. Earlier scores from `AUDIT_PLAN.md` are kept where nothing changed.

| Criterion | Score | Why |
|---|---|---|
| A1 Permeability | 5 | Fine grid, mid streets, walks [K, M] |
| A2 Street connectivity | 4 | 220 crossings per km², but a coarse multi-lane network (area 1) |
| A3 Block size | 5 | About 250 m perimeters [K] |
| B1 Land-use diversity | 3 | Markets everywhere, but no legible districts (area 5) |
| B2 Active ground floors | 4 | Continuous shop strips; dead frontage on the frontier |
| C1 Public space quantity | 3 | Two parks, walks, hub corners; centre has none to stand in |
| C2 Public space quality | 2 | Parks are tile mosaics, cut by roads (area 7) |
| C4 Streetscape | 4 | Trees, lamps, furniture on walks [S 12] |
| D1 Pedestrian comfort | 4 | 2.5-6.5 m sidewalks [K] |
| D2 Traffic safety | 3 | Lights and give-way; walkers through ramp ends (P0-1) |
| E1 Legibility | 4 | Boulevard and tower strong; HQ unaddressed; districts weak |
| E3 Human scale | 2 | By intent: the canyon |
| E4 Richness | 4 | Signs, stalls, steam, the old town at street level |

## Findings, ranked

P0 is broken geometry, circulation or function. P1 is a major coherence problem. P2 is optional or aesthetic. Pins on `URBAN_PLAN.svg` carry the same IDs.

### P0

| ID | Finding | Evidence | Affected systems |
|---|---|---|---|
| P0-1 | Walkers walk through the low ends of the ramps (main street x = 292.5, z ≈ ±37-65) and the slip roads (cross streets, z = ±79). | [K] ADR-0011, handoff. Not re-observed. | `people.js` network and crossings, `interchange.js` `onRamp` |
| P0-2 | Ramp and slip merges (`free` nodes) don't look for a gap, so cars can overlap or bunch for a moment. | [K] ADR-0011. Not re-observed. | `life.js` traffic, `interchange.js` lanes |

No new P0 was found in the plan or the captures.

### P1

| ID | Finding | Evidence | Affected systems |
|---|---|---|---|
| P1-1 | The north-east frontier (211 of 256 tiles empty) and the south-west corner read as a district-sized car park with full street lighting and signals. | [S 11], [M], [C] `tiles.js:90` | `tiles.js` plaza, `streets.js` lamps and crossings, `city.js` |
| P1-2 | IKARO HQ fronts the 14 m lane, faces low-rise and lots, and has no link to the boulevard 80 m behind it. A chance paved square lies on its axis. | [S 07, 08, 15], [M] | `headquarters.js` hqSite, `city.js` kindAt and closed, `streets.js` |
| P1-3 | Flat skyline: mean height 11-13 floors in every ring; the tallest towers stand at the edges. Only two landmarks read. | [S 09], [M] | sim heights (not to change); `city.js` signature, heavy, flagship, corporate signs |
| P1-4 | The city's centre is a traffic island. The hub plaza is mostly carriageway; the tower cannot be reached on foot. | [S 02], [C] | `streets.js` plaza, `people.js` PLAZA, `life.js` roundabout |
| P1-5 | Parks are per-tile mosaics with unconnected, misaligned paths, and both parks are cut into four by main streets. | [S 14], [M], [C] `terrain.js:29` | `terrain.js` park, `streets.js`, `people.js` |
| P1-6 | Walkers never walk along mid streets, including the old-town market lanes. | [C] `people.js:108`, [K] ADR-0009 | `people.js` network |
| P1-7 | Thin multi-lane network: three east-west roads 292 m apart; the interchange spills onto a 21 m main street. | [M] | `world.js` STREETS, `city.js` cityLayout, `interchange.js`, `life.js` |
| P1-8 | One grain everywhere outside the old town; plants and markets scattered as single tiles; industry tiny. Districts are not legible. | [S 01, 13], [M] | `city.js`, `families.js`, `tiles.js`, `plant.js` |

### P2

| ID | Finding | Evidence | Affected systems |
|---|---|---|---|
| P2-1 | The old town is old only at street level; sim heights hide the warp from oblique views. | [S 05, 06] | `families.js`, `city.js` cityWarp |
| P2-2 | The city ends at a ring road with parking bays, then bare desert, with no edge. | [S 10, 11] | `desert.js`, `streets.js` ring |
| P2-3 | No freight logic between the works and rail (north-west) and the highway (east). | [M], [S 10] | `terrain.js`, sim terrain (fixed) |
| P2-4 | Three of the four highway arrivals are plain at-grade causeways; the gateways are unequal. | [K] ADR-0011 | `desert.js`, `interchange.js` |
| P2-5 | HQ details: paving strips 8 m wide at its sides; the paved square behind it is chance. | [K], [M] | `headquarters.js`, `city.js` |
| P2-6 | Lamps are 6 m everywhere, the boulevard included. A style choice. | [K] AUDIT_PLAN §4 | `streets.js` lamps |

## Intentional, keep as they are

The canyon proportions and tight tower gaps; the 250 m blocks; the telecom tower on its roundabout as the centre of every view; dense signs and billboards at the busiest crossing; skybridges; the market lanes; the interchange's ponds and monuments; the blackout darkness. None of these should be "fixed" toward Western suburban standards.
