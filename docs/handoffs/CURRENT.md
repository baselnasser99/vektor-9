# Current handoff | Vektor-9

Updated: 2026-11-21 22:14 (+02:00)
Milestone: M1 (the city goes live). S1 done (PR #65 merged, ADR-0017 Proposed). Traffic step 1 done (PR #66). Line endings and the flaky-test deadline done (PR #67). Road arrows from the lane graph done (PR #68). Road readability done (PR #69). Interchange paint and the ramp crossings test done (PR #70); its low-end work was reverted. Median ramp landings done (PR #71). Loop landings done (PR #72). Sweep landings done (PR #73). Landing polish done (PR #74). Parapet black screen fixed (PR #75). Signal lenses fixed (PR #76). Geometry checks for every built mesh (PR #77). The sim is at SIM_VERSION 4, schema 6. Nothing is deployed
Branch: `main` at this handoff commit, on top of `7bbb2c6` (the #77 merge)
Working tree: untracked duplicates of `docs/proposals/` at the repo root (`AUDIT_PLAN.md`, `AWS_*.md`, `URBAN_*`, `urban-audit/`) unless the owner has removed them (see Kept). Ignored `snapshots/` (v4), `snapshots-v3/`, `snapshots-v2/` and `snapshots-v1/` are shared: don't clean them

## Done (verified)
- PR #77 (merge `7bbb2c6`, head `b8360bf`, CI passed): geometry checks for every built mesh, renderer only. No sim, snapshot or lane change: `tests/fixtures/lane-moves-seed7.json` unchanged. State after it: SIM_VERSION 4, schema 6, nothing deployed.
  - `tests/js/interchange_geometry.test.mjs` renamed to `tests/js/mesh_geometry.test.mjs`: finite positions, unit normals (within 1e-3), no triangle under 1e-8 m², on both v3 fixtures, one test per builder: interchange, streets, verge, the whole city as `buildCity` merges it (tiles, props, railway, HQ, LOD groups; Blender models are empty groups in the mock kit), desert, traffic with its signals, trains (instanced: geometry as built).
  - Not covered (browser only, or not meshes): people and figures, the HQ eye, aircars, the Blender models' own geometry, the sky (`atmosphere.js`), steam.
  - Failures on origin/main: one builder, the verge (the city test failed on the same faces). Per fixture 24 vertices with zero normals and 8 zero-area triangles near (254, -60), (256.141, -68.622) and (257.389, -58.499): `cutRing` returned rings with a point repeated, extruded as a zero-width wall. Fix (`terrain.js` `verge`): points within 1e-4 m of the next are dropped before extruding. `cutRing` unchanged (the streets use it; their meshes pass). The test failed 4 of 14 on origin/main and passes 14 of 14.
  - Black share (every channel <= 4, 1200x800 headless frames) before and after: views 08, 16, 25 0 %; view 01 0.08 % on both.
  - Frame time (`?bench=1000x625`, alternating loads against origin/main, median of 3): view 01 38.1 to 39.0 ms, 25 44.4 to 45.3 (one slow load on each side). Triangles on v4 seed 7: verge 2,304 to 2,296; streets and interchange unchanged. Screenshots stay local.
- PR #76 (merge `c581597`, head `fd57ad9`, CI passed): stacked signal lenses fixed, renderer only. No sim, snapshot or lane change: `tests/fixtures/lane-moves-seed7.json` unchanged, the left-turn test passes.
  - `life.js` signal lenses and walk-signal lenses clone the cached `box()` before translating, so each lens sits at its own offset (they had stacked at the last offset, out of the housing). `box_cache` has no known list: any cached box or slab changed in place fails it.
  - Frame time (`?bench=1000x625`, median of 3 alternating loads): view 01 37.9 to 38.0 ms, 25 43.1 to 43.5. Triangles: traffic and signals on v4 seed 7 637,280 on both. Close-ups of the signals at the main corner (294, -292) and view 01; screenshots stay local. `OrbitControls` `minDistance` is 15, so a close-up's `?view` target goes past the subject.
- PR #75 (merge `4e5a8cc`, head `0726a0a`, CI passed): black screen from the merged parapet concrete mesh fixed, renderer only. No sim, snapshot or lane change: `tests/fixtures/lane-moves-seed7.json` and the ramp crossings allowlist unchanged. State after it: SIM_VERSION 4, schema 6, nothing deployed.
  - Cause, found by `setDrawRange` bisection on the merged mesh at view 31: one triangle at the inbound median ramp's landing point, (176, 0, 1.615), (176.375, 0.051, 1.615), (176.375, 0, 1.615), with all three normals (0, 0, 0). At a landed end's landing point `barriers` gives lift 0 and depth 0, so the section's points 0 and 1 coincide; `parapets.js` `sink().face` took the normal from the face's first three points only, got zero, and the `|| 1` guard kept it. On both v3 fixtures: 8 faces (32 vertices) with zero normals and 20 zero-area triangles, all in the parapet concrete.
  - Fix (`parapets.js` `face`): the normal is Newell's over the whole face outline; faces and triangles with twice-area under 1e-7 m² are dropped.
  - Test `interchange_geometry`: every merged mesh `buildInterchange` makes, on both v3 fixtures: finite positions, unit normals (within 1e-3), no triangle under 1e-8 m². Failed on origin/main (52 problems per fixture), passes on the branch.
  - View 31 (`194,22,-2,172,0,-3.4`, both median landings from above the avenue) added to `docs/visual/VIEWS.md`.
  - Black share (every channel <= 4, 1262x704 headless frames): view 31 96.4 % to 0 %; views 23 and 25 0 % on both.
  - Frame time (`?bench=1000x625`, headless Chrome over CDP in real time, alternating loads against origin/main, medians of 3 to 5): view 31 34.0 to 34.6 ms, 23 44.6 to 44.8, 25 43.4 to 43.4. Some bench loads printed no result, on both sides; those slots were rerun. Triangles on v4 seed 7: interchange 48,888 to 48,852 (-36). Screenshots stay local.
- PR #74 (merge `b0c14be`, head `5709d0d`, CI passed): paint and closure polish at the landed ramp ends, renderer only. No sim, snapshot or lane change: `tests/fixtures/lane-moves-seed7.json` and the ramp crossings allowlist unchanged; the left-turn test passes unchanged. State after it: SIM_VERSION 4, schema 6, nothing deployed.
  - Paint at every landed end (`interchange.js` `rampMarkings`): where a loop's or sweep's lane meets the kerb lane, a taper along the lane's kerb side joins the street's edge line end to end at the street end, and the edge line is left out within 10 cm of the ramp's cut (`gaps`, read by `streets.js` road). The inbound median ramp's road lines end on the stop line's edge.
  - Sweep closures (`landCuts` `closure`): toward the street end the closed sidewalk is at road height kerb to back edge (`apron`) and ends square at full width with a kerb across it; past where the fill's inner wall leaves the kerb line it is paved up to the wall, kerbed along the road, and the wedge of verge between the sidewalk's back edge and that wall is cut (`cornerVerge`, 8 m). Over the fill the sweep's cut follows the deck's drawn edges 1.25 cm out, so kerbs stand within 1 cm of the walls' face.
  - Rails stay on the stepped-down parapet to the sloped terminal; the terminal is measured along the deck from the landing point, so a run ending at a slip fork keeps its height and rail (`parapets.js` `railSpan`, `interchange.js` `openingAt`).
  - Slip tops follow the sweep: while a slip lies across its ramp its drawn top follows the ramp's surface 4.5 cm under it (`topAt`, `SLIP_DROP`), drawn in six strips a metre apart; slip lanes are unchanged. A landed deck's slab and fill-top pieces share normals (closes a wedge at the 2.5 m join).
  - Verge and paving are cut under the sweeps' unlanded slips below 0.6 m (`blockCuts`); the ground slab is left out under each landed deck's first 3 cm of rise, its cells refilled round the hole (`groundHoles`, `streets.js` ground).
  - Tests: `landing_paint` (all six ends), `ramp_surface` (seams at the landed ends; the rest a todo), `ramp_parapets` (rails and openings), `ground_holes` (opaque surface at or above y -0.05 every 0.5 m over the interchange area); `ramp_cuts` extended (closure end, kerb-to-wall corners, no kerb under a wall). Each new test failed on origin/main where the problem existed and passes on the branch; `ground_holes` passes on both and fails when the ground patches are removed (3,058 holes on seed 7).
  - Frame time (`?bench=1000x625`, headless Chrome over CDP in real time, median of 3 alternating loads against origin/main): view 25 43.4 to 43.5 ms, 27 42.9 to 42.7, 29 41.4 to 41.5. Triangles on v4 seed 7: +3,956 (interchange 42,812 to 48,888, streets 968,137 to 966,049, verge 2,336 to 2,304). Screenshots stay local.
  - Known: `ramp_surface` todo lists 54 seam locations on v3 seed 7 and 6 on v3 seed 3, away from the landed ends: the loop slip forks, the sweep forks near the expressway, the median ramps' top joins at x 258.4, and the outbound loop slip's street end.
  - The merge deleted `origin/landing-polish`.
- PR #73 (merge `50d0267`, head `06e6879`, CI passed): ramp landings for the sweeps (ramps 0 and 3), renderer only. No sim, snapshot or lane change: `tests/fixtures/lane-moves-seed7.json` unchanged. State after it: SIM_VERSION 4, schema 6, nothing deployed.
  - Both sweeps land in the main street's kerb lane (option B of the ADR-0011 amendment, 2026-11-20), 17.25 m back from their street end, where the deck clears the kerb lane's car band. One height function per sweep (`interchange.js` `sweepProfile`): level to the landing point, 10 m sag, straight grade, 10 m crest. Grade 14.21 % on both. The deck widens from the landing point; fill below 2.5 m, parapet as retaining wall, as on the loops.
  - The east sidewalk is closed under each sweep foot: walker edges 58<>70 (ramp 0) and 82<>94 (ramp 3) are dropped both ways (`people.js`, whole corner-to-corner edges). Detours: 58<>70 +39.3 m (v3 seed 7), +62.0 m (v3 seed 3); 82<>94 +62.0 m and +117.7 m. The sweeps' lanes carry no walker crossing.
  - `SWEEP_HOLD = 24.26` (`interchange.js`, read by `life.js` as `pinnedHold`): the inbound sweep's merge wait line, pinned at its origin/main value until the junction overlap guard lands (Next 6). Deriving it from the plan moved it to 25.16 m and changed left-turn outcomes.
  - Standing people (doors, kerb waits, groups) are kept out of every landed ramp's cut (`people.js` `places`, no extra random draws).
  - Parapets over the fill stand on the highest deck surface under their section, checked between points too (fixes dips at the slip joins).
  - Tests: `left_turns` checks the numbers on both fixtures equal origin/main at `f52f852` (seed 7: 6 long stops, 6 behind left turns; seed 3: 16 and 8; no overlap frames). `ramp_landings` samples every 0.5 m with the count derived from path length, 5 cm limit unchanged, and skips samples under the expressway's top (the clipping todo). `ramp_walkers` checks both closures. `ramp_grades` slip limits for ramps 0 and 3 set to 14.6 %. Ramp crossings allowlist 54 to 40 (v3 seed 7) and 24 to 10 (v3 seed 3): removals only (kerb-lane car pair and walker pairs 58>70, 70>58, 82>94, 94>82 against each sweep's slab and parapets). Neither sweep has an open slab end.
  - Views 29 (a sweep landing at road level) and 30 (the closed sidewalk at its foot) added to `docs/visual/VIEWS.md`. ADR-0011 amendment (2026-11-20) and the style guide updated.
  - Frame time (`?bench=1000x625`, median of 3 alternating loads against origin/main): view 23 44.4 to 44.2 ms, 24 41.6 to 42.0, 25 43.1 to 43.3, 27 42.6 to 42.6, 29 41.3 to 41.6. Triangles on v4 seed 7: +5,324 (interchange 41,736 to 42,812, streets 964,473 to 968,137, verge 1,752 to 2,336). Screenshots stay local.
  - Still open: the slips of ramps 1 and 2 (open slab ends, the only two left); the slips of ramps 0 and 3 at 14.6 % (over 14.3 %, level beside their sweep); the sweeps clipping the expressway slab (`ramp_clearance` todo; the `ramp_landings` wheel test skips that footprint). The clipping needs the sweep to leave the expressway elsewhere: after the slab there are 62.5 m to drop 7.75 m, about 69 m needed.
  - The merge deleted `origin/sweep-landings`; the local branch is kept.
- PR #72 (merge `b9f2c84`, head `79dca8c`, CI passed): ramp landings for the loops, renderer only. No sim, snapshot or lane change: `tests/fixtures/lane-moves-seed7.json` unchanged; the left-turn test passes. State after it: SIM_VERSION 4, schema 6, nothing deployed.
  - Both loops (ramps 1 and 2) land on their own blocks (option A of the class (b) study): one height function per end (`interchange.js` `landEnd`), shared by the lane and the drawn deck, level from a landing point 21.2 m back from the main street to the street, then one cubic into the loop's own eased profile, joined at a point 43.7 m back (2.1 m up) within 14 %. Above the join (and so at each loop's slip-road fork) the loop is unchanged. Steepest 13.6 %. Fill below 2.5 m, parapet as retaining wall, headwall and stepped-down barrier as on the median ramps.
  - The loops' points stay where they were; new points lie on the chords between them, a metre apart over the curve and the fill and never within a metre of an old point, so every lane keeps its length.
  - The lane crosses the block at road height through a cut in its paving (`streets.js` blocks, outlines from `interchange.js` `landCuts`): from the street up the whole fill, the deck's width plus 5 cm, narrowing at the street to just inside the street lane's width. Kerbs line the cut and stop at its edges; a kerb piece reaching into it is clipped. The verge is left out a metre either side (`terrain.js` verge). `geometry.js` has `cutRing`, `insideRing` and `toRing` for this.
  - A marked crossing (cream zebra bars, 0.5 m every metre) where the sidewalk crosses the cut. Walkers have right of way there: they walk it at road height (`people.js` ground), the crossing comes from `sidewalkCrossings`, walkers wait for `rampClear`, and life.js `giveWay` stops ramp cars short of walkers on it.
  - Fixes from the owner's review of the prototype: kerbs no longer run over the zebra ends; over any landed fill the parapet's foot rests on the surface and its outer face runs down to the road (`parapets.js` takes a per-point foot); landed deck tops are built in six strips across so they stay flat on a curve; no verge within 1 m of a cut stands more than 0.2 m above the ramp. Median strip fix: the avenue's wide median strip now starts where the median ramps' fill ends (`landing.fill`); their fill walls used to stand in it.
  - Tests: `ramp_cuts` (no kerb, paving or verge triangle over a cut, 1 cm tolerance; no parapet vertex over a fill more than 1 cm below the surface under it, at every landed end including the medians; the verge rule), `ramp_walkers` (every walker edge at both loop ends, every 0.5 m, on the sidewalk or the crossing at the right height), `box_cache` (no cached `box()`/`slab()` geometry changed in place while the whole city and traffic are built; two known sizes in `life.js`). `ramp_landings` and `ramp_grades` cover every landed end (at most 14.3 %). Ramp crossings allowlist 60 to 54 (v3 seed 7) and 30 to 24 (v3 seed 3): removed, on each fixture, the kerb-lane car crossing and both walker crossings at each loop. Zero new pairs.
  - Views 27 (inbound loop landing at road level) and 28 (its crossing from the sidewalk) added to `docs/visual/VIEWS.md`. ADR-0011 amendment (2026-11-19, later) and the style guide updated.
  - Frame time (`?bench=1000x625`, headless Chrome over CDP in real time, median of 3 alternating loads against origin/main): view 23 44.4 to 44.5 ms, 24 41.9 to 41.9, 25 43.5 to 43.4, 27 42.8 to 42.8, 28 43.0 to 42.6. Triangles on v4 seed 7: +8,374 (interchange 39,210 to 41,736, streets 959,609 to 964,473, verge 768 to 1,752). Screenshots stay local.
  - Not landed: the slips of ramps 0 and 3. Their low ends land easily, but their steepest stretch (14.7 %) runs level beside the sweep ramp, which a landing does not touch; they go with the sweeps (Next 2b). Their cuts would be on mid streets, which `sidewalkCrossings` does not cover: the give-way needs extending there once walkers use mid streets.
  - Open slab ends left: both sweeps (ramps 0 and 3) and the slips of ramps 1 and 2.
  - Walker size finding: walkers looked about a tenth of their size in the prototype's shots. Their real height, read from the live data texture, is 1.6 to 1.9 m on main and the branch alike; the shots used headless Chrome's virtual time budget, which captured them mid fade-in. No code change.
  - Shared geometry finding: `box()` and `slab()` return one cached geometry per size. `life.js:588` (signal lenses) and `life.js:593` (walk-signal lenses) call `box(...).translate(...)` inside a `map`, stacking those lenses at one spot; listed as known in `box_cache` (Next 1). The same bug in the prototype's crossing bars was fixed before merging.
  - The merge deleted `origin/loop-landings`; the local branch is kept.
- PR #71 (merge `4d4ee54`, head `2140045`, CI passed): ramp landings for the median ramps, renderer only. No sim, snapshot or lane change: `tests/fixtures/lane-moves-seed7.json` unchanged. State after it: SIM_VERSION 4, schema 6, nothing deployed.
  - Both median ramps land at road height. One height function (`interchange.js` `landing`), shared by the car lanes and the drawn deck: level from the stop line at the crossing at `west` to a landing point 26 m east of it (found by distance along the deck from its street end), a 14 m sag curve into a straight 14 percent grade, a 14 m crest curve into the deck's level. The deck is drawn down to the landing point exactly at road height; the two open slab ends at (188.38, ±3.38) are gone.
  - Below 2.5 m: solid fill (the asphalt top only, no slab underside), the parapets' outer face running down to the ground as the retaining wall, and a headwall under the slab's end. Parapet step-down: 0.8 m over the fill with no rail or reflectors, sloping down to the road over its last 6 m (`parapets.js` takes a per-point depth and height). Edge lines continue along the road as lane lines to 0.4 m short of the stop line. The shared median piers keep one cap under both ramps.
  - The two 1.2 m slate cubes at the expressway's inner end (the dark block on the deck in view 23) are removed: they stood above the deck, and no pier stands under them.
  - `tests/js/ramp_landings.test.mjs` (14 tests): for each median ramp, the wheels stay within 5 cm of the drawn surface every 0.5 m along every car path through it, no grade over 14.3 percent, and the deck ends at its landing point at road height. `ramp_crossings` known open slab ends: 6 to 4 on v3 seed 7, 4 to 2 on v3 seed 3; zero new pairs; allowlist file unchanged (two self-pair entries, each median lane against its own slab, now first met at x 239.8 and 186.3 instead of 240.1 and 192.6).
  - Views 25 (median landing at road level) and 26 (median landing from the sidewalk) added to `docs/visual/VIEWS.md`. ADR-0011 amendment (2026-11-19) and the style guide updated.
  - Frame time (`?bench=1000x625`, median of 3 alternating loads against origin/main): view 25 42.8 to 43.5 ms, view 26 38.6 to 39.6, a high three-quarter view of the landing 38.8 to 39.4, view 23 44.1 to 44.4, view 01 38.2 to 38.7. Interchange triangles on v4 seed 7: 36,850 to 39,210 (+2,360). Screenshots stay local.
  - Open slab ends left: both sweeps (ramps 0 and 3) and the slips of ramps 1 and 2.
  - Phase 1 classes from the landing study (v4 seed 7; v3 seed 3 the same where it has the end):
    - (a), fits its own space: both median ramps (done).
    - (b), needs the kerb lane and a sidewalk stretch: the loops (ramps 1 and 2), the slips of ramps 0 and 3.
    - (c), needs the walking network: both sweeps.
    - Beyond (b), needs the split point moved: the slips of ramps 1 and 2, at 18.4 and 18.9 percent.
  - Notes: the median ramps now rise earlier and about 0.4 m higher over the mid street. The fill's side reads as a plain tall wall from road level (polish later). The brown ramp tops come from the single reflection capture at (0, 60, 0): every surface reflects it by view direction only, and a street seen looking west at a grazing angle reads the same brown.
  - The merge deleted `origin/ramp-landings`; the local branch is kept.
- PR #70 (merge `3183d37`, head `9b6b9f3`, CI passed): interchange paint and the ramp crossings test, renderer only. No sim, snapshot or lane change: `tests/fixtures/lane-moves-seed7.json` unchanged.
  - Edge lines on every ramp, loop, median ramp and slip road, and gore hatching where each slip road parts from or joins its ramp (`interchange.js` `rampMarkings`, cream paint from the palette). Interchange triangles on v4 seed 7: 34,636 to 36,850 (+2,214).
  - Reverted in the same PR (commit `9b6b9f3` undoes the low-end part of `7402dcf`): decks drawn down to the road, retaining walls at the low ends, and a straight grade on the loop slip roads. Car and walker paths ran through the walls, cars sank into the extension, and the slip grade held the slip ends over the cross street's lane. The findings are in the ADR-0011 amendment (2026-11-16).
  - `tests/js/ramp_crossings.test.mjs` with `tests/fixtures/ramp-crossings-allowlist.json` (60 entries on v3 seed 7, 30 on v3 seed 3, recorded on origin/main): every car lane and walker link against every slab, parapet and wall face, failing on a path and face owner pair not in the allowlist; and the exact set of open slab ends per fixture, by ramp and end, within 0.05 m. About 4 s. It failed all 4 cases on `7402dcf` and passes on `9b6b9f3`. Limits: keyed by path and face owner, coarser than the cells it checks; v3 fixtures only; door and bench walks unchecked. Regenerate with `RAMP_CROSSINGS_WRITE=1`.
  - Also `ramp_markings`, `ramp_grades` and `ramp_clearance` tests. Todos: the two sweep ramps clipping the expressway slab (`ramp_clearance`) and the loop slip grade target of 14.3 percent (`ramp_grades`, "low-end redesign, follow-up").
  - No shading difference was found at the deck joints (the sheen is view-dependent), so nothing changed there.
  - Views 23 and 24 added to `docs/visual/VIEWS.md`; view 24 shows the inbound sweep's open slab end.
  - Frame time (`?bench=1000x625`, median of 3 alternating loads against origin/main): view 01 39.3 to 39.1 ms, view 24 43.1 to 43.1 ms. Screenshots stay local.
  - Open slab ends, unchanged from origin/main and fixed by none of #70 (seed 7 and v4 seed 7: 6; v3 seed 3: the first 4):
    - inbound sweep (ramp 0) at (299.85, -49.38), 0.73 m
    - outbound sweep (ramp 3) at (299.85, 49.38), 0.73 m
    - median ramp 0 at (188.38, -3.38), 0.79 m
    - median ramp 1 at (188.38, 3.38), 0.79 m
    - inbound loop's slip road (slip of ramp 1) at (243.64, -75.71), 1.02 m, the highest
    - outbound loop's slip road (slip of ramp 2) at (259.60, 77.69), 0.68 m
  - The merge deleted `origin/interchange-polish`; the local branch is kept.
- PR #69 (merge `1d9d988`, head `b771738`, CI passed): road readability, renderer only. Three commits after two owner review rounds. No traffic or placement change: `tests/fixtures/lane-moves-seed7.json` unchanged, still 300 arrows on v4 seed 7.
  - Arrows (`streets.js` `arrowGlyph`): all seven move sets (straight, left, right, straight+left, straight+right, left+right, all three) as filled glyphs, one cached flat mesh each, 6.3 m long, 2 cm above the road: one 0.3 m shaft, solid heads, turn branches curving 55 degrees off the shaft at one point.
  - The approach wear band (a darker 1.3 m by 14 m asphalt patch in every approach lane, the "dark boxes" under the arrows) is removed on every approach.
  - Parapets (`interchange.js` `barriers`, new `parapets.js`): a safety-shape concrete barrier (`weatheredConcrete`) with a sloped inner face to a wide foot, 3 m panels with dark joints, a grime gradient by vertex colours, small `agedAmber` reflectors every 6 m, a `wornGunmetal` cap rail on short posts, tapered end caps at openings, and an outer face 1 cm outside the slab edge that runs down as the fascia to exactly the slab's underside (it used to share a plane with the slab side and flickered).
  - Every run end is joined or capped: each deck edge is cut exactly where it crosses another deck's outline or a street corridor; meeting ends are joined flush and mitred. Seed 7: from 58 raw ends (none joined or capped) and 2 near misses to 36 joined, 30 capped, 0 raw, 0 near misses; seed 3: from 34 raw to 20 joined, 22 capped. The only height steps left are the two sweep exits (41 cm).
  - One asphalt (`aerial_asphalt_01`, `gunmetal`, roughness 0.55) for streets, ramps and the expressway deck; the deck was concrete and is rebuilt as a ribbon like the ramps (as a box its top read as a different surface beside them), its inner end closed by a thin slab. Ribbon tops take plan UVs.
  - Steel expansion joints (`graphite`) across each place a deck runs onto another at its level and across each ramp's low end at the street.
  - Views 19 to 22 added to `docs/visual/VIEWS.md` (deck, driver's-eye arrows, deck-end joins, a sweep exit).
  - Tests: `tests/js/barriers.test.mjs` (run ends meet within 2 cm in plan and height or are capped; no near misses or height steps; every opening gets a cap; every deck edge covered). It failed 8 of 8 on the first head `ad21097` and passes on `b771738`.
  - Frame time (`?bench=1000x625`, headless Chrome, Intel UHD 630, `origin/main` against the final head, median of 3 alternating loads): 01 38.5 to 38.3 ms, 03 41.1 to 40.2, 11 37.5 to 37.2, 15 37.8 to 37.5, 18 35.5 to 37.0, 19 43.5 to 44.4, 20 38.6 to 38.4. All within 2 ms.
  - Triangles on the v4 seed 7 snapshot (headless count): interchange 14,200 to 34,636 (+20,436, budget +25,000); street geometry 986,642 to 959,609.
  - Not changed: the sweep-ramp descent (see Next 1); the desert causeways; the rail viaduct (0.9 m walls except along its station). Screenshots stay local.
  - The merge deleted `origin/roads-readability` (the repo's `delete_branch_on_merge`); the local branch is kept.
- PR #68 (merge `453fef3`, head `a6f5ecd`, CI passed): road arrows painted from the lane graph's moves.
  - `streets.js` `laneMoves` (moved from `life.js` `paths`) picks each lane's moves once. Cars drive them and `paintArrow` paints from them. `exits()` is gone.
  - `buildStreets` now calls `outOfTown` itself, so `roads` from `buildCity` and the harness is already carried out of town and dead-end lanes are already dropped. `main.js` and `tests/js/harness.mjs` no longer call it. `outOfTown` runs once per graph; a second call is a no-op, guarded and tested.
  - Fixed: the boulevard's outer lane heading +x into (150, 0) now shows straight and right; the middle lane into the ring road at (429, 0) now shows left and right. The latter is the turn fallback (a lane with no rule move takes any turn that fits), recorded in the ADR-0016 addendum (2026-11-15) as a known issue.
  - Arrow counts: v4 seed 7 299 to 300; v3 fixtures 299 to 300 (seed 7) and 295 to 296 (seed 3). The 22 straight arrows out of town at the ring road are unchanged and held by a test.
  - Traffic equivalence: every lane's moves and target lane, from the old `life.js` code and from `laneMoves`, were identical on both v3 fixtures (540 and 552 lanes; empty diff).
  - Tests: `tests/js/arrows.test.mjs` (paint equals moves for every lane into a crossing, or a named bare rule); `tests/js/lane_moves.test.mjs` against the golden `tests/fixtures/lane-moves-seed7.json` (81,658 bytes). After an intended traffic change, update it with `node --import ./tests/js/three-loader.mjs tests/js/lane_moves.test.mjs --write`. The arrow test failed on the old placement (scratch copy of `d7776cc`), on exactly the two lanes.
  - Frame time (`?bench=1000x625`, headless Chrome, Intel UHD 630, median of 3 alternating loads): view 11 37.5 to 37.0 ms, view 15 37.9 to 39.2 ms (within noise), view 18 35.4 to 35.4 ms. Screenshots stay local.
  - Docs: `docs/visual/VIEWS.md` (15 fixed views plus extras 16-18, the `?bench` before/after method); `docs/proposals/VISUAL_BASELINE.md` (the 2026-11-15 baseline report, scratch paths marked local only).
- PR #67 (merge `50731de`, head `5644407`, CI passed): `.gitattributes` with `* text=auto eol=lf` and `binary` for `*.jpg`, `*.bin` and `*.gz` (the only binary types tracked); `git add --renormalize .` changed no files (the index was already LF). `tests/test_line_endings.py` fails if `git ls-files --eol` shows `i/crlf` or `i/mixed` in the index. `@settings(deadline=None)` on `test_malformed_marks_are_rejected_not_crashing` only.
  - Line endings and the asset hash, correcting an earlier claim: CDK 2.277's `contentFingerprint` converts CRLF to LF before hashing, so the Lambda asset hash is identical for CRLF and LF checkouts, but a CRLF checkout would zip CRLF bytes under that same hash. Measured: the dev tick asset hash was the same from a CRLF tree and from two LF synths. Pre-D1 rule: deploy only from a checkout whose working files are LF (`git ls-files --eol` shows no `w/crlf`).
  - The flaky test: `deadline=None` was added by elimination (the only property test without it whose examples do real work, about 20 ms each); the original failure was never captured. 20 of 20 repeated runs passed on an idle machine. If a flake recurs, save the full failure output.
- PR #66 (merge `c003433`, head `ac5747e`, CI passed): left-turn hold fixed. The cause was mutual blocking of opposing permitted left-turners at `life.js` `mayGo`. Changes: oncoming lefts no longer block each other; the first waiting left-turner pulls into the junction and clears; a 7 s protected arrow at the 12 main corners; a same-approach clearance and an exit-lane reservation.
  - Results: long stops 56→6 (seed 7) and 127→16 (seed 3); throughput -0.9% and +6.4%.
- PR #65 (merge `4ccf0df`, head `aba8a4b`, CI passed): S1, the CDK core stack. Env-agnostic `Vektor9-dev` and `Vektor9-prod`; stage values (seed, genesis, alert email, reserved concurrency) from CDK context, nothing real committed. 27 template tests in `tests/infra/`, run in CI without AWS credentials. Exact pins: `aws-cdk-lib` 2.277.0, `constructs` 10.8.1 (`infra` group); `boto3` 1.44.3 and its dependencies (`lambda` group), all pure Python and bundled into the package at synth without Docker. U1 answered locally (the staged boto3's `PutObject` accepts `IfMatch` and `IfNoneMatch`); confirmed on the deployed function at D1.
  - Package 16.9 MB zipped, 23.1 MB unpacked (measured). Two synths give the same templates and asset hash.
  - Ticks are kept forever in prod (replaces D2's 30 days); only noncurrent versions of `city/v{SCHEMA}/latest.json` expire, after 3 days.
  - Reserved concurrency is a switch, default off.
  - The budget alarm moved to S4.
  - `lambdas/tick.py` names the EMF namespace, dimension and metrics as constants; the alarms import them. `lambdas/` is a regular package.
- PR #63 (merge `58ec27d`): ADR-0016, street network and street types, Accepted.
- PR #64 (merge `28e7ab9`, head `49fe23b`, CI passed): SIM_VERSION 4. Growth weighted by frontage and distance from the centre, landmark clearance; ADR-0015 criteria 4 and 6 amended. Golden `sim-v4.json`.
- Local snapshots: `snapshots/` is v4 (seed 7, schema 6, sim 4, 4,033 files). `snapshots-v3/`, `-v2/` and `-v1/` are kept (4,033 files each) and listed in `.git/info/exclude`. The site loads `snapshots/004032.json` with no console messages.

## Branch cleanup (done)
- 15 remote and 19 local merged branches deleted; `delete_branch_on_merge` is on (it deleted `origin/infra-s1-core`, `origin/traffic-left-turns` and `origin/chore/gitattributes-test-deadline`).

## Kept, for the owner to decide
- Removal commands were given to the owner for the root duplicates and for the merged branches and worktrees; status is unconfirmed until the owner says so. Nothing has been deleted by a session.
  - Root duplicates: 24 root files are byte-identical to the committed `docs/proposals/` blobs. `URBAN_DEPENDENCIES.md` and `urban-audit/make_plan.py` differ: they are older versions still using the root paths.
  - Merged local branches: `claude/pickup-92c597`, `infra-s1-core`, `rigid-props`, `sim-v4-growth`, `street-design-adr`, `tidy-perf`, `traffic-left-turns`, `chore/gitattributes-test-deadline`, and session branches `fix/*`.
  - Merged, clean worktrees: `city-preview-2a14c8`, `city-preview-pickup-860447`, `cleanup-weighted-growth-f1a11e`, `merge-pr-64-snapshots-v4-4f8dc7`, `s1-cdk-core-stack-7b38ab`, `street-design-adr-249ca5`, `traffic-left-turns-fix-d692a8`.
- Undecided: unmerged branches `blender-plant` (local), `claude/highway-interchange-adr-0011-fa5fef`, `claude/keen-kilby-474fe2`, `claude/musing-bouman-ca762f`, `claude/train-station-fd11db`, `local/handoff-history`, `perf-far-lods`; the detached, unmerged worktree `pickup-cb1bc0`.
- Undecided: merged but dirty worktrees (one uncommitted change each) `cyberpunk-pedestrian-system-93ab30` (`tidy-perf`), `musing-bouman-ca762f` (`rigid-props`), `pickup-92c597` (`claude/pickup-92c597`).
- Empty worktree folders that Windows kept locked.

## Conventions
- Visual shots must be captured in real time, at least 30 s after load. Headless virtual time captures walkers mid fade-in at about a tenth of their size.
- Shots and bench runs go through headless Chrome over CDP in real time, never the app's browser pane (hidden, it runs as a throttled background page and captures partly drawn black frames).
- No tests while a shot or bench server is up: the Node tests move `snapshots/` aside, and a page loading then gets a 404.
- "Before" servers are served from a `git archive origin/main` into scratch, verified by comparing the served `web/src/interchange.js` hash with `git show origin/main:web/src/interchange.js`.
- Every shot is checked for its snapshot loading (no 404) and for black frames (mean brightness and near-black share); a failing shot is retaken.
- Traffic outcomes change with lane sampling density (adding points to a lane, even on its own line, changes later traffic) and can expose the junction overlap at (293, -80). Keep new lane points on the existing chords where a lane's length must stay the same.

## Open
- The fill's side reads as a plain tall wall from road level (polish later).
- Known: a single zero normal anywhere becomes NaN in the half-float render target, and bloom spreads it across the frame (the #75 black screen; `merge.js` asserts against flat-scaled parts for the same reason).
- ADR-0016 roadmap, renderer-only, in order: (1) left turns, done in PR #66; (2) the dead-end fix; (3) the HQ-to-court crossing; (4) priority junctions; (5) speeds and calming; (6) one-way pairs; (7) shared streets; (8) dressing by type; (9) walkers on mid streets.
- A pre-existing overlap: a straight car stuck in a junction can be driven through by the crossing street.
- #66 left-turn arrows not yet visually checked by the owner; owner reports road arrows that point to nothing. Since #68 every arrow matches its lane's moves; the 22 straight arrows out of town at the ring road remain (true, but the road beyond is a dirt track: outskirts work).
- Court paving contrast.
- Make the Node harness's use of `snapshots/` opt-in, so local and CI runs match.
- Building variety: a later renderer pass with a download size budget; the Blender skills apply there.
- Skill hygiene: about 140 user-level skills of unconfirmed origin load in every session; review and prune.
- S2 to S4. S2 must give every CDK-created function (the `BucketDeployment` handler included) an explicit log group with retention, or the template tests fail. S2 also adds a test that the staged Lambda asset has no CR bytes in its `.py` files.
- Older checkouts keep CRLF working files until Git rewrites them; no test checks the working tree. See the pre-D1 rule under PR #67.
- ADR-0017 still describes the synth-time metric reading: its tick-function paragraph says the alarms read a synthesized EMF line; since `e84e728` they import the constants from `lambdas/tick.py`. Fix in S2.
- `docs/proposals/AWS_M1_BACKLOG.md` line 3 still says "nothing started". Fix in S2.
- jsii prints a harmless temp-folder `ENOTEMPTY` error when it exits on Windows; the exit code stays 0.
- Cold-start time of the bundled package to be measured at D4.
- F6; GLB with meshopt; the public cost view on `PROJECT_PLAN.md` line 8.
- The `URBAN_*` docs still describe v1.
- Owner decisions pending:
  - Growth curve: target that day 30 looks like today's tick 4032.
  - Landmark construction stages owned by the sim: a start and completion tick per landmark in the static plan (schema 7, needs an ADR).
  - Launch at tick 0 versus a genesis in the past: check `ResumeRefused` and the catch-up rate. Visual checks at ticks 0, 288 and 2016.
  - Outskirts style: wasteland versus "the megacity goes on".
  - Old town look: only 12 of its 220 houses are below the 16-floor old-style limit (`families.js:20`).
  - Target hardware: the baseline runs 34 to 50 ms per frame on Intel UHD 630.
- First visit is 19 MB uncompressed; check whether sample-only models (`utility_box_01`, the three `modular_*`) load on the main page.
- Ramp lane ids in `tests/fixtures/lane-moves-seed7.json` contain `undefined` for fields ramps don't have (unique and stable, but untidy).
- graphify is installed for code-only use and is not part of any prompt.
- The desert causeways (`desert.js`) are concrete and have no barriers, so the surface changes where the expressway meets the highway at the city edge (outskirts, O1).
- ADR-0011's interchange text may still describe the old slim barriers and the concrete deck; amend it in a later docs change.

## Checks
- On `main` @ `7bbb2c6` (detached, this worktree without `snapshots/`, as in CI):
  - Node suite → 274 tests: 268 passed, 0 failed, 6 todo.
  - `uv run pytest` (without the infra groups) → 213 passed, 1 skipped (measured on both PR branches).
  - `ruff check` and `ruff format --check` → pass (both PR branches). No changed file has CR bytes.
- CI on PR #76 head `fd57ad9` and PR #77 head `b8360bf`: `lint-and-test` passed.
- On `parapet-black` @ `0726a0a` (this worktree with `snapshots/` copied in for the shot servers, servers stopped during tests):
  - Node suite → 262 tests: 256 passed, 0 failed, 6 todo.
  - `uv run pytest` (without the infra groups) → 213 passed, 1 skipped.
  - `ruff check` and `ruff format --check` → pass. No changed file has CR bytes.
- CI on PR #75 head `0726a0a`: `lint-and-test` passed.
- On `landing-polish` @ `5709d0d` (this worktree without `snapshots/`, as in CI):
  - Node suite → 260 tests: 254 passed, 0 failed, 6 todo.
  - `uv run pytest` (without the infra groups) → 213 passed, 1 skipped.
  - `ruff check` and `ruff format --check` → pass. No changed file has CR bytes.
- CI on PR #74 head `5709d0d`: `lint-and-test` passed.
- On `sweep-landings` @ `06e6879` (this worktree without `snapshots/`, as in CI):
  - Node suite → 196 tests: 192 passed, 0 failed, 4 todo.
  - `uv run pytest` (without the infra groups) → 213 passed, 1 skipped.
  - `ruff check` and `ruff format --check` → pass. No changed file has CR bytes.
- CI on PR #73 head `06e6879`: `lint-and-test` passed.
- On `loop-landings` @ `79dca8c` (this worktree without `snapshots/`, as in CI):
  - Node suite → 164 tests: 160 passed, 0 failed, 4 todo.
  - `uv run pytest` (without the infra groups) → 213 passed, 1 skipped.
  - `ruff check` and `ruff format --check` → pass. No changed file has CR bytes.
- CI on PR #72 head `79dca8c`: `lint-and-test` passed.
- On `ramp-landings` @ `2140045` (this worktree without `snapshots/`, as in CI):
  - Node suite → 127 tests: 123 passed, 0 failed, 4 todo.
  - `uv run pytest` (without the infra groups) → 213 passed, 1 skipped.
  - `ruff check` and `ruff format --check` → pass.
- CI on PR #71 head `2140045`: `lint-and-test` passed.
- On `interchange-polish` @ `9b6b9f3` (this worktree without `snapshots/`, as in CI):
  - Node suite → 113 tests: 109 passed, 0 failed, 4 todo.
  - `uv run pytest` (without the infra groups) → 213 passed, 1 skipped.
  - `ruff check` and `ruff format --check` → pass.
- CI on PR #70 head `9b6b9f3`: `lint-and-test` passed.
- On `main` @ `1d9d988` (detached, this worktree without `snapshots/`, as in CI):
  - Node suite → 99 passed, 0 failed.
  - `uv run pytest` (without the infra groups) → 213 passed, 1 skipped (132 s).
  - `ruff check` and `ruff format --check` → pass.
- CI on PR #69 head `b771738`: `lint-and-test` passed.
- On `main` @ `453fef3`, this worktree without `snapshots/` (as in CI):
  - Node suite → 91 passed, 0 failed.
  - `uv run pytest` (without the infra groups) → 213 passed, 1 skipped (163 s).
  - `ruff check` and `ruff format --check` → pass.
- CI on PR #68 head `a6f5ecd`: `lint-and-test` passed.
- Earlier, on `main` @ `50731de`, worktree without `snapshots/` (as in CI), working files LF (0 `w/crlf`):
  - With the `infra` and `lambda` groups (`uv run --group infra --group lambda pytest`): 240 passed, 0 skipped (183 s). Of these, `tests/infra` → 27 passed (56 s).
  - Without the infra groups (as in CI's first pytest step), last measured on `c003433` before #67: 212 passed, 1 skipped; #67 adds one test.
  - Node suite → 83 passed (81 s); `ruff check` and `ruff format --check` → pass.
- CI on PR #67 head `5644407`: `lint-and-test` passed.
- CDK synth: both stages with dummy context, no credentials. Deployed: no. No AWS resources exist.

## Next
Visual work before AWS (owner decision, 2026-11-15). One session at a time. Each visual PR uses `docs/visual/VIEWS.md` for before/after shots and frame times.
1. Dead-end fix at x -80.5, z -150 to -80.5 (view 08, ADR-0016 roadmap 2).
2. HQ-to-court crossing and court paving contrast (view 16).
3. The remaining `URBAN_MASTERPLAN` steps, the masterplan table and frontier dressing first (542 empty lots drawn as parking).
4. Junction overlap guard, and replacing the `life.js` turn fallback with an explicit rule (start from the ADR-0016 addendum, 2026-11-15, and `tests/fixtures/lane-moves-seed7.json`); then re-derive `SWEEP_HOLD` from the merge and drop the pin.
5. Interchange leftovers, parked: the slips of ramps 1 and 2 (move the split point so they can land at 14.3 percent or less, the `ramp_grades` todo; their open slab ends); the slips of ramps 0 and 3 at 14.6 percent; the `ramp_surface` seam todos; the sweeps clipping the expressway slab (the `ramp_landings` clipping todo).
6. Then: architecture variation, with a Blender pack bake-off (check pack origin and pin the Blender MCP server first); outskirts O1 to O3; growth pace and landmark construction, in their own session; S2 (explicit log groups for all CDK functions; fix ADR-0017's stale text; fix the `AWS_M1_BACKLOG.md` status line; the test that the staged Lambda asset has no CR bytes in `.py` files), S3, S4, then D1, the dev deploy. D1 needs the owner's explicit approval. The pre-D1 LF checkout rule (under PR #67) stays.
