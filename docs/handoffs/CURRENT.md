# Current handoff | Vektor-9

Updated: 2026-11-14 12:56 (+02:00)
Milestone: M1 (the city goes live). The sim is at SIM_VERSION 4, schema 6
Branch: `main` at this handoff commit, equal to `origin/main`
Working tree: clean apart from untracked duplicates of `docs/proposals/` at the repo root (`AUDIT_PLAN.md`, `AWS_*.md`, `URBAN_*`, `urban-audit/`). Ignored `snapshots/` (v4), `snapshots-v3/`, `snapshots-v2/` and `snapshots-v1/` are shared: don't clean them

## Done (verified)
- PR #63 (merge `58ec27d`): ADR-0016, street network and street types, Accepted.
- PR #64 (merge `28e7ab9`, head `49fe23b`, CI passed): SIM_VERSION 4. Growth weighted by frontage and distance from the centre, landmark clearance; ADR-0015 criteria 4 and 6 amended. Golden `sim-v4.json`.
- Local snapshots: `snapshots/` is v4 (seed 7, schema 6, sim 4, 4,033 files). `snapshots-v3/`, `-v2/` and `-v1/` are kept (4,033 files each) and listed in `.git/info/exclude`. The site loads `snapshots/004032.json` with no console messages.

## Branch cleanup (done)
- 15 remote and 19 local merged branches deleted; `delete_branch_on_merge` is on.

## Kept, for the owner to decide
- Unmerged branches: `blender-plant` (local), `claude/highway-interchange-adr-0011-fa5fef`, `claude/keen-kilby-474fe2`, `claude/musing-bouman-ca762f`, `claude/train-station-fd11db`, `perf-far-lods`.
- Merged but dirty worktrees: `tidy-perf`, `rigid-props`, `claude/pickup-92c597`.
- Detached worktrees: `city-preview-2a14c8`, `city-preview-pickup-860447`, `pickup-cb1bc0`.
- Empty worktree folders that Windows kept locked.
- The local `sim-v4-growth` branch and its worktree (`cleanup-weighted-growth-f1a11e`). Also local: `local/handoff-history`, `street-design-adr`, and session branches `fix/*`.

## Open
- ADR-0016 roadmap, renderer-only, in order: (1) left turns (trace the hold in `life.js` first); (2) the dead-end fix; (3) the HQ-to-court crossing; (4) priority junctions; (5) speeds and calming; (6) one-way pairs; (7) shared streets; (8) dressing by type; (9) walkers on mid streets.
- Court paving contrast.
- Make the Node harness's use of `snapshots/` opt-in, so local and CI runs match.
- Building variety: a later renderer pass with a download size budget; the Blender skills apply there.
- Skill hygiene: about 140 user-level skills of unconfirmed origin load in every session; review and prune.
- S1 to S4, with the pinned `boto3` from ADR-0014 (U1 closes at S1).
- The root duplicates of `docs/proposals/`; the `.gitattributes` PR.
- F6; GLB with meshopt; the public cost view on `PROJECT_PLAN.md` line 8.
- The `URBAN_*` docs still describe v1.

## Checks
- On `main` @ `28e7ab9`: `uv run pytest` → 212 passed (150 s); Node suite → 73 passed (82 s, worktree without `snapshots/`, as in CI; 43 s with the v4 `snapshots/`); `ruff check` and `ruff format --check` → pass.
- CDK synth: n/a. Deployed: no. No AWS resources exist.

## Next
1. S1.
2. Traffic step 1 (left turns), alternating with S2 to S4.
3. The cleanups.
One session at a time.
