# Current handoff | Vektor-9

Updated: 2026-11-18 22:23 (+02:00)
Milestone: M1 (the city goes live). S1 done (PR #65 merged, ADR-0017 Proposed). Traffic step 1 done (PR #66). Line endings and the flaky-test deadline done (PR #67). Road arrows from the lane graph done (PR #68). Road readability done (PR #69). Interchange paint and the ramp crossings test done (PR #70); its low-end work was reverted. The sim is at SIM_VERSION 4, schema 6. Nothing is deployed
Branch: `main` at this handoff commit, on top of `3183d37` (the #70 merge)
Working tree: untracked duplicates of `docs/proposals/` at the repo root (`AUDIT_PLAN.md`, `AWS_*.md`, `URBAN_*`, `urban-audit/`) unless the owner has removed them (see Kept). Ignored `snapshots/` (v4), `snapshots-v3/`, `snapshots-v2/` and `snapshots-v1/` are shared: don't clean them

## Done (verified)
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

## Open
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
1. (2a) Ramp landings. Each low end gets a landing point where one height function, shared by cars and the drawn surface, reaches road height with a smooth vertical curve. Below about 2.5 m the ramp is drawn as solid fill between retaining walls inside its own lanes, with parapets stepping down to a terminal. Past the landing point it is ordinary street asphalt with continuous markings and a taper or gore.
   - First session: measure every low end and prototype one median ramp end, uncommitted.
   - Then roll out to the 4 carriageway ends, with `ramp_crossings` sharpened and a frozen v4 seed 7 fixture.
   - Also identify the dark block on the deck at the ramp split in view 23, and check why ramp tops read brown against the streets.
2. (2b) Sweep low ends with the walking network (the sweep clipping todo in `ramp_clearance` and the sidewalk crossing at the sweep foot, ADR-0011 amendment).
3. Dead-end fix at x -80.5, z -150 to -80.5 (view 08, ADR-0016 roadmap 2).
4. HQ-to-court crossing and court paving contrast.
5. Junction overlap guard, and replacing the `life.js` turn fallback with an explicit rule. Start from the ADR-0016 addendum (2026-11-15) and `tests/fixtures/lane-moves-seed7.json`.
6. The remaining `URBAN_MASTERPLAN` steps.
7. Architecture variation, with a Blender pack bake-off. Check pack origin and pin the Blender MCP server first.
8. Growth pace and landmark construction, in their own session.
9. S2 (explicit log groups for all CDK functions; fix ADR-0017's stale text; fix the `AWS_M1_BACKLOG.md` status line; the test that the staged Lambda asset has no CR bytes in `.py` files), S3, S4, then D1, the dev deploy. D1 needs the owner's explicit approval. The pre-D1 LF checkout rule (under PR #67) stays.
