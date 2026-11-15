# Visual baseline, 2026-11-15 (read-only)

Copied from a local session report. Screenshots, probes, generated snapshots and SVGs it names were kept in a local scratch folder and are **local only, not committed**; paths to them are marked *(local only)*. The fixed views are kept in [`docs/visual/VIEWS.md`](../visual/VIEWS.md). Section 4's two arrow faults are fixed by the arrows-from-lanes PR (ADR-0016 addendum, 2026-11-15); the text below is the baseline as found.

Seed 7, tick 4032, SIM_VERSION 4, schema 6. Renderer at `origin/main` d7776cc. Nothing in the repo was changed: no branch, commit or push. Everything below lived in a local scratch folder *(local only)*, ignored by Git (`git status` was clean).

Labels: **[M]** measured this session, **[C]** read in the code, **[S nn]** screenshot `nn-*.png` *(local only)*, **[I]** inference.

## 0. Start

- `git fetch origin`, then `git log --oneline -3 origin/main`: `d7776cc docs: handoff next order, visual work before AWS`, `9e9574e docs: handoff after #67`, `50731de Merge pull request #67`. d7776cc is on top, as expected. The worktree branch is at d7776cc and clean.
- Milestone: M1 (the city goes live). S1, traffic step 1 (#66) and #67 are done, and the owner put visual work before AWS. The task is item 1 of Next: a read-only visual baseline (plan SVG for v4, roadmap status, fixed views for before and after shots), with the road, building and outskirts inventories and proposals.

Skills loaded: **street-design** only. Not loaded: masterplan-design (it is in the user-level skills folder but not in this session's skill list), zoning-and-codes and urban-calculator (not needed). No Blender skill and no Blender MCP tool was run.

## 1. Snapshots

Generated into a scratch folder *(local only)* with `uv run python -m sim --ticks 4032 --seed 7 --out <scratch>/snapshots` (4,033 files, 1 m 9 s). Why: this worktree has no local `snapshots/` (it is ignored, so it lives only in the main checkout). The new `004032.json` is byte-identical to the main checkout's `snapshots/004032.json` (`cmp`), and reports `sim: 4`, `schema: 6`, seed 7. So the shared v4 set and this one agree [M]. The page loaded it with `?snap=` pointing at that scratch copy *(local only)*.

## 2. City plan

- `plan-today.svg` *(local only)*: the committed `docs/proposals/urban-audit/make_plan.py`, copied to `make_plan_today.py`, with the paths changed (snapshot in, SVG out, concepts out). It **did not run with path changes only**: v4 has a new tile kind `site` (the HQ and court reserve) and the script stopped with `KeyError: 'site'`. I added one dict entry (`"site"` colour), and nothing else.
- **That plan is stale where the script hardcodes things.** It draws today's tiles, but under the 2026-11-11 (v1) street kinds, HQ box and annotations: the old town, the HQ site (now cols 24-27, rows 9-14 facing -x onto the avenue, court cols 22-23), the parks and the three tallest towers have all moved. House shading is capped at 31 floors, but v4 goes up to 60.
- `plan-today-live.svg` *(local only)* (extra, clearly not "path only"): same script, with the street kinds read from the renderer (`cityLayout` + `kindAt` with the HQ cut, exported by a scratch probe *(local only)*), the HQ and court boxes from `snapshot.plan.sites`, shading to 60 floors and the stale pins removed. Use this one as today's plan.
- `concepts-today.svg` *(local only)*: the script's before/after crops, also stale (v1 street plan).

v4 numbers [M]: 1,461 houses (median 24 floors, max 60), 542 lots, 66 markets, 21 plants, 70 park (16 of them the hub plaza), 36 site, 19 works, 16 rail, 64 road, 9 building sites. Mean floors by ring from the centre: 35.1, 33.4, 30.2, 24.6, 25.7, 15.8 (p90 45 to 25). The skyline now peaks in the centre.

## 3. Fixed views

Headless Chrome 1000x625 (`?bench=1000x625`), Intel UHD 630 via ANGLE D3D11, driven over the DevTools protocol (a scratch capture script, *local only*). There were no console errors or exceptions in any load. Base URL: `http://localhost:8000/web/?bench=1000x625&view=...` (the local copy used `?snap=` pointing at the scratch snapshot, which is byte-identical to `snapshots/004032.json`). Bench median and p90 are from the page's own `?bench` line.

| # | Subject | ?view= | median / p90 ms |
|---|---|---|---|
| 01 | Centre and tower island | `0,150,130,0,0,0` | 38.3 / 42.0 |
| 02 | IKARO HQ and court across the avenue | `0,100,-120,15,25,-226` | 36.0 / 37.8 |
| 03 | Interchange | `170,230,190,300,0,0` | 40.2 / 43.4 |
| 04 | Frontier, north-east (81-100% lots) | `180,210,-180,290,0,-360` | 36.7 / 39.0 |
| 05 | Park cut by a street (north park at x 150, z -292.5) | `150,95,-200,150,0,-292` | 35.0 / 36.2 |
| 06 | Old town market lane (z 80.5) | `-110,18,80.5,-200,2,80.5` | 35.7 / 41.0 |
| 07 | Busy junction, main corner (292.5, -292.5) | `380,55,-292.5,292.5,0,-292.5` | 39.6 / 46.2 |
| 08 | Dead-end stub (x -80.5, z -150..-80.5) | `-80.5,30,-55,-80.5,0,-150` | 38.0 / 41.7 |
| 09 | Boulevard stretch toward the tower | `16,32,150,0,4,55` | 40.5 / 42.1 |
| 10 | Ordinary local street (z 80.5, east) | `100,22,80.5,200,2,80.5` | 35.0 / 36.9 |
| 11 | #66 arrows and left heads, main corner | `300,9,-252,294,1,-292` | 38.2 / 39.2 |
| 12 | Edge, grid to outskirts (south-west corner, 98% lots) | `-560,90,520,-400,0,380` | 49.2 / 56.2 |
| 13 | Highway arrival across the outskirts (north) | `60,70,-760,0,0,-440` | 48.4 / 62.6 |
| 14 | Wide shot from outside | `1500,450,1300,0,40,0` | 50.2 / 63.6 |
| 15 | Extra: the arrow fault at (150, 0) | `112,10,13,140,0,9` | 38.0 / 41.3 |
| 16 | Extra: court paving, close | `2,28,-165,-32,0,-226` | 39.8 / 51.5 |
| 17 | Extra: roundabout north entry (overlap spot) | `0,45,-80,10,0,-30` | 35.6 / 37.3 |

Seven first-try views (the audit's 2026-11-11 viewpoints and my first picks) put the camera inside v4's taller towers. Those PNGs were kept locally *(local only)*, and the retakes put the camera over street corridors. **The audit's `?view=` list in URBAN_AUDIT.md is no longer usable on v4 for low shots** [S, M]. Logs: `views/capture-log-run1.json`, `-retake.json`, `-extra.json`.

## 4. Roads inventory (as drawn today)

From `web/src/world.js:12-21` STREETS, `streets.js` and `life.js` [C]; counts on seed 7 v4 [M].

| Corridor | Width | Lanes | Median | Markings | Surface arrows | Signs and control |
|---|---|---|---|---|---|---|
| Boulevard | 36 m | 3+3 | 3.5 m planted, refuges, nose at stop line (`streets.js:291-300`) | edge lines, dashed dividers solid last 15 m, stop lines, zebras, lit cold-white studs at zebras (`streets.js:139-158`, `:198-207`) | yes, every lane (`streets.js:171-179`) | signals, protected left phase; shuttle stops (`streets.js:262`); roundabout at the tower |
| Avenue (boulevard's 2nd sector out) | 36 m | 2+2 | 10 m, trees | as boulevard | yes | as boulevard |
| Main street | 21 m | 2+2 | none (centre line) | as above, no studs | yes | signals, permitted lefts; since #66 a 7 s leading left arrow and left heads at the 12 main corners (`life.js:38-40`, `:552-617`); shuttle stops |
| Ring road | 16 m | 1+1 | none | bays in runs of three with build-outs and trees (`streets.js:181-197`); no zebras on the outer side | none (one lane) | signal at main, boulevard and walk crossings, else give way |
| Lane (x 150 along z) | 14 m | 1+1 | none | stop lines, zebras | none | signal at main streets and walks, else give way |
| Walks | 14 m (13 m in the old town) | none | none | paved, planted | none | walk phase lights where they cross car streets |
| Mid: local | 13 m | 1+1 | none | stop lines, zebras where `hasZebra` | none | all-way give way |
| Mid: one-way | 13 m | 2, one way | none | full-width stop line, dashed divider | yes, flow direction only | as local |
| Alleys | 6 m | none drawn | none | none | none | no cars |

Signs at corners (traffic signs, cameras) come from `city.js` streetProps (`city.js:406-440`, messages in `world.js:47`). I did not inventory them per corridor.

**Surface arrows.** Rule (`streets.js:171-179`): at each approach end of each block, 7 m back from the lane paint's end, one arrow per lane, on `boulevard`, `avenue`, `street` and `oneway` only. None at the roundabout, none on blocks of 16 m or less, none at the city's outer ends. Its moves are `lanesMay` (`streets.js:217-222`) intersected with `exits` (`streets.js:228-237`: straight if the street goes on with a lane k, a turn if the cross street carries cars that way). With nothing left and a merge ahead, it is painted straight. The shape is drawn by `arrow` (`streets.js:241-260`).

Checked every painted arrow against the moves `life.js` really gives that lane (`life.js:186-190`), with a scratch probe *(local only)* on an instrumented scratch copy of `web/src` [M]:

- **300 arrows. None points to a move cars cannot make, and no arrow sits on a dropped (dead) lane.**
- **Two lanes where the paint and the traffic disagree:**
  1. **(150, 0), boulevard eastbound, outer lane:** painted right only, but cars go right **and straight**. The interchange's `turnsAt` lets it go straight by offset, but `exits()` checks `STREETS[beyond].lanes.length > k` and ignores that rule [S 15].
  2. **(429, 0), boulevard eastbound, middle lane:** no arrow, but cars turn left and right there.
- 22 straight arrows on the main-street and boulevard approaches to the ring road point out of town. They are true (cars leave on the dirt tracks and highways), but past the ring the asphalt ends, there is no zebra, and a dark track carries on. **[I]** This is the likeliest "arrow that points to nothing" the owner saw [S 11, 12].

## 5. Buildings inventory

Per tile kind [C], with counts on v4 [M]:

| Kind (count) | Builder | Variants |
|---|---|---|
| house (1,461) | `families.js:18` familyOf picks 1 of 6 families; builders at `families.js:102-243`; podium `tiles.js:11`; roofs `roofs.js:17-24` | apartment: 3 shapes x bay or not; office: 2 widths x setback or not; old: 3 depths x 2 sides; luxury: 2 tier plans; industrial: 2 by seed%3; mega: 2 layer counts x 2 seam colours. Roofs: 4-slot lists, but old and industrial repeat entries (3 distinct), and luxury and mega use one list for both height bands. Reactors: 4 kinds (`roofs.js:42-53`). Mansard on 1 in 9 old buildings. Façades from `kit.windows` |
| special towers | signature, heavy, flagship (`city.js:336-601`, `flagship_*` models); storefronts at the busiest crossing (`tiles.js:27`) | chosen by height each load |
| lot (542) | `tiles.js:90` plaza | **1**: parking slab with 2-5 cars, a kiosk half the time |
| build (9) | `tiles.js:127` construction | procedural, a crane sometimes |
| market (66) | `tiles.js:158` + `market_hall` model | **1 model** (6 invented shop names) |
| plant (21) | `plant.js:12` `power_plant` model | **1 model** |
| park (54 off the plaza) | `terrain.js:29` | **1**: slab, one path, 2-4 trees |
| site (36) | HQ `headquarters.js:83` (14 `hq_*` models, about 2.0 MB) and court `tiles.js:118` | HQ 1; court **1** |
| rail, works, road | `terrain.js`, `landmarks.js`, `interchange.js` | fixed landmarks |

Least variety, flagged: **market (66 tiles, 1 model), plant (21, 1 model), lot (542, one parking look), park (1 per-tile layout), court (1)**. Also, **[M] only 12 of the old town's 220 houses are under 16 floors**, and `familyOf` gives the old family there only below 16 floors (`families.js:20`). So under v4 the old town hardly gets its old look any more [I].

Sizes on disk [M]: 64 glTF models at 10.31 MB (gltf+bin). The largest are telecom_tower 2,857 KB, power_plant 989 KB, the three modular_* at about 500 KB each, train_station 407 KB, hq_plaza 402 KB and market_hall 393 KB. Textures in `web/assets/textures` are 8.31 MB (5 PBR sets x arm/diff/nor jpg). Model folders also hold 18 jpgs (about 12.3 MB).

**First visit, served locally** (`tools/serve.py`, no compression, no cache), measured with the Performance API in the browser pane [M]: **180 requests, 19.09 MB**. That is models 8.67 MB (60 of 64), textures 8.31 MB, vendored Three.js 1.45 MB, `web/src` 0.52 MB and the snapshot 0.15 MB. There were no external requests. Not loaded by the city: `utility_box_01` and the three `modular_*` models (13.6 MB with their textures), which only `sample.js` and `showcase.js` use.

## 6. Outskirts inventory

Everything is in `web/src/desert.js`, and it is decoration only (ADR-0002). `terrain.js` draws only rail, park and works inside the grid.

- **Ground:** a 3,800 m square (`REACH` 1900) of 240x240 cells, vertex-coloured (`desert.js:66-84`). Packed dirt by the city fades to moonlit sand over 260 m, along a ragged line starting about 120 m out, with sodium glow within 500 m. Flat for 420 m (`SPRAWL`), then dunes rise over 500 m and are flattened along the highway corridors (`desert.js:55-63`). A 12 km flat sand plane sits 3 m below (`desert.js:87`).
- **Sand drifts:** 160 soft discs over the ring road's outer edge (`desert.js:91-102`).
- **Dirt tracks:** every non-centre street goes on for 500 m as 20 m box pieces that narrow and break up (`desert.js:106-121`).
- **Highways:** 4 causeways 30 m wide, 6 m up (the +x one off the expressway), with piers every 50 m and lamps every 150 m, out to 1,900 m (`desert.js:125-152`).
- **Wastes:** 1,100 boulder clusters out to 1,250 m, 1,600 scrub stones out to 700 m, 220 wrecked cars along the tracks, 10 scrapyards of 30 heaps, 40 half-buried containers, 10 barrel fires (steady sprites) (`desert.js:157-237`). Then a line of 10 dead pylons (`desert.js:240-257`).
- **farSprawl:** 9,000 instanced unlit boxes from 937 m to 2,900 m, with windows drawn in the shader, kept at a quarter of their colour through fog (`desert.js:264-303`). The fog takes the sky colour, so the far desert melts into it (style guide §4).
- **Counts** (a scratch probe *(local only)*, headless) [M]: the desert merges to **15 meshes, 397,678 triangles**. That is ground 115,200; tyres 108,100 (the torus is 100 triangles each); boulders and scrub about 132,000; wrecks, containers and pylons the rest. farSprawl is **1 InstancedMesh, 9,000 instances, 108,000 triangles**. Its own bytes: **0**. It is procedural and reuses `rusty_painted_metal` and `rusty_corrugated_iron`, which the city loads anyway.
- **Frame time:** **not measured in isolation**. Nothing hides the outskirts without a code change. The views that include them and the whole city (12-14) ran at 48-50 ms median, against 34-41 ms in town, but that gap is not attributable to the desert alone.
- **Where the edge is abrupt** [S 12, 13, 14]:
  - the asphalt slab stops on a straight line at the ring road's outer kerb (`streets.js:19`);
  - the dirt tracks are hard-edged dark rectangles, not worn ground;
  - the frontier corner sectors are fully lit car parks right up to the ring;
  - along the north arrival, a wall of towers stands directly on the ring road with flat sand in front.

## 7. Blender skill packs (read-only, nothing run)

| Pack | Skills | Declared origin | What it claims | Notes |
|---|---|---|---|---|
| "blender-agent-skills" v1.2.0, MIT | 28: `blender-core`, `-animation`, `-asset-qa`, `-character-rigging`, `-clothing`, `-environment-kits`, `-export-pipelines`, `-facial-shapekeys`, `-game-optimization`, `-geometry-nodes`, `-hair-grooming`, `-hardsurface-modeling`, `-lighting-lookdev`, `-pbr-materials`, `-pipeline-automation`, `-rendering`, `-retopology-uv`, `-scene-setup`, `-sculpting`, `-simulation`, `-stylized-npr`, `-texture-baking`, `-texturing`, `-time-of-day`, `-video-editing`, `-weather-fx`, `-workflow-recipes`, `-addon-development` | `author: blender-agent-skills`, no URL. **Origin unknown** | Blender 5.2 workflows: modelling, PBR, baking, QA gate, export (GLB, meshopt), game budgets | Ships **Python scripts** (2-5 per skill) that run inside Blender. Read them before any use |
| arjun988 pack v1.0.0, MIT | 94 with `domain: blender`: `blender-director`, `blender-modeler`, and the artist, style, genre and mood skills (`archviz`, `hard-surface`, `lod-pipeline`, `sci-fi-punk-worlds`, `neon-retrofuturism`, `brutalist-mood`, `apocalypse-worlds`, ...), plus the shared `~/.claude/skills/references/` | `author: https://github.com/arjun988` (declared in metadata, not verified) | Art direction and MCP-driven modelling recipes, polycount budgets | Text only, no scripts |
| Blender MCP server (not a skill) | `mcp__blender__*` | user config: `uvx mcp-for-blender`, unpinned (latest from PyPI on each start) | Runs bpy in the live Blender; imports assets from Poly Haven, Sketchfab and Poly Pizza; `generate_3d` "may cost the user a credit" | Not called this session |

Neither pack has an install record (they are not in `installed_plugins.json`, and the folders have no git metadata). 140 skill folders were dated 2026-11-11, 11 on 2026-10-28 and the rest scattered. The repo's own `tools/blender/` scripts are separate and are what made today's models (ADR-0005).

## 8. Masterplan status (URBAN_MASTERPLAN roadmap, URBAN_AUDIT findings) under v4

| Item | Status | Evidence |
|---|---|---|
| Step 1 / P0-1, walkers give way at ramp and slip low ends | **Done** | PR #54; `life.js:67-75`, `:364-373` (rampWalks, giveWay) |
| Step 2 / P0-2, gap check at `free` merges | **Done** | PR #54; `life.js:15` PATIENCE, `:194-247` hold lines, `:342-347`. No overlaps at `free` nodes in 10 min on v4 seed 7 [M] |
| Step 3, masterplan table | **Done (no consumers, by design)** | PR #55; `masterplan.js`; `city.js:183,187` "nothing reads yet" |
| Step 4 / P1-1, frontier dressing | **Open** | `tiles.js:90` plaza is still parking [S 04, 12]. Frontier sectors on v4: NE row 0 cols 4-5 (81%, 100% lots) and SW corner (98%) [M] |
| Step 5 / P1-2, IKARO approach, forecourt, court | **Partly done** | PR #62: the HQ is on the plan's site facing the avenue, with the court across it (`city.js:223`, `tiles.js:118`). P1-2's premise (front on the 14 m lane) is **obsolete under v4**. Still open: the HQ-to-court walk crossing (ADR-0016 roadmap 3; the cut at z -219.5 runs over cols 20-27 [M]), court paving contrast [S 16], and the approach, which is descriptive only (`masterplan.js` approachOf) |
| Step 6 / P1-4, walk to the tower island | **Open** | `people.js:39` PLAZA 44 m ring; no zebra to the island [S 17] |
| Step 7 / P1-5, parks as connected areas | **Open** | `terrain.js:29-33` per-tile slab and path [S 05]. On v4 the parks moved: north (cols 29-36, rows 5-11), cut by the z -292.5 main street and the x 150 lane; south-east (cols 32-39, rows 39-44), cut by z 292.5 and x 219.5 [M]. The audit's "west park" no longer exists |
| Step 8 / P1-3, signs weighted to the centre, beacons | **Partly done (by the sim) [I]** | v4 heights now rise to the centre (35 vs 16 floors mean) [M], PR #64; `city.js:517` still sorts corporate signs by height only, so they now land central anyway [I]. Beacons are open |
| Step 9 / P1-6, walkers on mid streets | **Open** | `people.js:110` network has corner nodes only; ADR-0016 roadmap 9 |
| Step 10 / P1-7, turn pockets on the interchange main street | **Obsolete** | ADR-0016 (line 270): no turn lanes; protected-permitted lefts instead, done in #66. The coarse network itself is kept (option A, no width change) |
| Step 11 / P2-4, gateway gantries on the three at-grade arrivals | **Open** | `desert.js` has no gantry; `ix_gantry` only at `interchange.js:302` [S 13] |
| Step 12, P2 polish | **Open** | see the P2 rows |
| P1-8, one grain, districts not legible | **Open** | roles exist (`masterplan.js`), unused |
| P2-1, old town old only at street level | **Open, likely worse [I]** | the old town moved to the SW inner quarter [M]; 12 of its 220 houses are under 16 floors (`families.js:20`) |
| P2-2, abrupt city edge | **Open** | [S 12, 13] |
| P2-3, no freight logic | **Open** (sim terrain, fixed) | not rechecked |
| P2-5, HQ side strips | **Not checked** under the v4 site | |
| P2-6, lamps 6 m everywhere | **Open** (style choice) | not rechecked |

## 9. Open visual items, reproduced

- **Car overlap in junctions:**
  - *Reproduced headlessly at the roundabout, not at a signal.* A scratch probe *(local only)* checks every pair of car bodies in every crossing box (any move), 60 s warm-up plus 600 s [M]:
    - v4 seed 7: at the roundabout (0, 0), z+ straight against x+ straight for 0.7 s at 596 s, and x- straight against x- right near (15.4, -33.7); at the priority node (219.5, 0), two right-turners from one approach for 0.7 s.
    - v3 seed 3 fixture: at the roundabout, z- straight against x- straight, 88 frames between 301 and 601 s near (6.6, -37.9).
  - The reported case (a straight car stuck in a **lit** junction, driven through by the crossing street) did **not** occur in 10 min on either seed. It may need longer runs or browser frame timing.
  - Fixed view for the spot: 17 (`0,45,-80,10,0,-30`). A live overlap was not caught on screen, because traffic timing in the page is not deterministic.
- **Court paving contrast: reproduced** [S 16, 02]. The court is `palette.slate` concrete (`tiles.js:120`), the same tone as the sidewalks beside it, with only the bollard line along the avenue.
- **Dead ends: reproduced.** One on v4 seed 7: the local street at x -80.5 between z -150 (a walk) and -80.5. Its two lane links are dropped by `life.js` (a scratch probe, *local only*) [M], and it is drawn as a street with no traffic [S 08]. The cause is the same as ADR-0016's v3 finding.

## 10. Proposals (not started)

### a. First four visual PRs (one session each, renderer only)

1. **Arrows from the lane graph.** Paint each arrow from the moves `life.js` gives that lane (or make `exits()` apply `turnsAt`'s offset rule), so (150, 0) shows straight and right and (429, 0) gets its arrow. Add a Node test that every painted arrow equals its lane's real moves on the frozen fixtures (the scratch arrow probe was the method; now `tests/js/arrows.test.mjs`). Decide whether straight arrows on approaches leaving town stay (true) or drop. Before and after: views 15, 11, 07, 12.
2. **The dead-end fix** (ADR-0016 roadmap 2): `closed` never builds over a half whose other end meets a corridor without cars. CI check on the v3 fixtures plus the 0-49 sweep. Before and after: view 08, then 05 and 10 for regressions.
3. **HQ-to-court crossing and court paving** (ADR-0016 roadmap 3 plus the contrast item): a walk-only signal on the avenue at z -219.5, and a court surface that differs from the sidewalk (paving pattern or tone from the palette; a style guide entry). Before and after: views 02, 16.
4. **Junction overlap guard:** widen the left-turn test's overlap check to every pair of moves; fix roundabout entry so a car does not enter its ring while a body is in its path; then rerun the lit-junction case over longer runs. Before and after: views 17, 01, 07.

Road variety within today's widths (priority junctions, speeds and raised tables, one-way pairs, shared streets, dressing by type) follows as ADR-0016 roadmap 4-8.

### b. Outskirts track (lower priority): an abandoned wasteland

Nothing inside the ring changes, and every piece stays at least 15 m beyond the ring road's outer edge. Today's budget is 398k desert triangles plus 108k sprawl, 16 draw groups and 0 own bytes.

1. **O1, the edge.** Break the straight asphalt edge with broken aprons, rubble and kerb fragments; wear the dirt-track mouths into the sand; add barriers or fences where the tracks leave. Pay for it by cutting the tyre torus to 3x6 segments (108k down to about 40k triangles). Budget: no more triangles than today, 0 bytes, at most 3 draw calls more. Risk: z-fighting with the ring road, and sand reading as if it were on the snapshot's streets.
2. **O2, terrain, rocks and dust.** Eroded ridges and washes in `duneHeight`, instanced rock outcrops (3-5 shapes), a low dust haze that never flashes. Budget: at most +150k triangles, at most +0.5 MB, at most +3 draw calls, and the outside views (12-14) no slower than +10% median on `?bench`. Risk: frame time on integrated GPUs, transparency sorting.
3. **O3, ruins and derelict structures.** Collapsed causeway spans, half-built shells, a dead plant near the pylon line; instanced, possibly a small Blender kit. Budget: at most +100k triangles, at most 1 MB (glTF, meshopt once that lands). Risk: it contradicts the style guide's "the megacity goes on" (`farSprawl`), so decide wasteland or sprawl first; ruins must not read as city buildings the snapshot does not have (keep them past about 80 m).

### c. Building variety track

- **Remodel first:**
  - the market hall (66 tiles, 1 model): 2-3 variants on the same footprint and roles;
  - the power plant (21 tiles, 1 model): a compact or screened variant;
  - the lot (542 tiles): dressing by masterplan role, shared with step 4;
  - the old-family rule: v4 heights starve it (12 of 220), so it needs a renderer rule decision, not a model.
  - Then corner and frontage variants by street type (ADR-0016 "Later").
- **Budget:** keep ADR-0016's +3 MB raw for new building models, textures into existing sets, and land meshopt first. Hold first-visit bytes at or under about 22 MB raw (19.09 MB today), plus a frame-time check at views 03, 09 and 14.
- **Pack comparison (not run):**
  - Same subject: one market-hall variant.
  - Same brief and limits: 14 m tile, footprint at most 12.5 m, at most 8k triangles, at most 2 materials using the kit's named roles (`materials.js:270-277`), no new textures, glTF at most 150 KB after meshopt, origin at ground centre.
  - One fresh session per arm:
    - pack A (blender-agent-skills, with its asset-qa gate);
    - pack B (arjun988 director and modeler);
    - a control: the repo's own `tools/blender/` script style.
  - No `generate_3d` (credits) and no downloaded assets.
  - Score each arm on triangles, bytes, `?bench` at one fixed view, review at two fixed views, QA (normals, z-fighting, floating parts) and session time.
  - Before any arm runs, read pack A's scripts and pin `mcp-for-blender` to a version.
