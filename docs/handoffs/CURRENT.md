# Current handoff | Vektor-9

Updated: 2026-11-14 15:59 (+02:00)
Milestone: M1 (the city goes live). S1 done (PR #65 merged, ADR-0017 Proposed). The sim is at SIM_VERSION 4, schema 6
Branch: `main` at this handoff commit, equal to `origin/main`
Working tree: clean apart from untracked duplicates of `docs/proposals/` at the repo root (`AUDIT_PLAN.md`, `AWS_*.md`, `URBAN_*`, `urban-audit/`). Ignored `snapshots/` (v4), `snapshots-v3/`, `snapshots-v2/` and `snapshots-v1/` are shared: don't clean them

## Done (verified)
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
- 15 remote and 19 local merged branches deleted; `delete_branch_on_merge` is on (it deleted `origin/infra-s1-core`).

## Kept, for the owner to decide
- Unmerged branches: `blender-plant` (local), `claude/highway-interchange-adr-0011-fa5fef`, `claude/keen-kilby-474fe2`, `claude/musing-bouman-ca762f`, `claude/train-station-fd11db`, `perf-far-lods`.
- Merged but dirty worktrees: `tidy-perf`, `rigid-props`, `claude/pickup-92c597`.
- Detached worktrees: `city-preview-2a14c8`, `city-preview-pickup-860447`, `pickup-cb1bc0`, and now `s1-cdk-core-stack-7b38ab`.
- Empty worktree folders that Windows kept locked.
- The local `sim-v4-growth` branch and its worktree (`cleanup-weighted-growth-f1a11e`). Also local: `local/handoff-history`, `street-design-adr`, the merged `infra-s1-core`, and session branches `fix/*`.

## Open
- ADR-0016 roadmap, renderer-only, in order: (1) left turns (trace the hold in `life.js` first); (2) the dead-end fix; (3) the HQ-to-court crossing; (4) priority junctions; (5) speeds and calming; (6) one-way pairs; (7) shared streets; (8) dressing by type; (9) walkers on mid streets.
- Court paving contrast.
- Make the Node harness's use of `snapshots/` opt-in, so local and CI runs match.
- Building variety: a later renderer pass with a download size budget; the Blender skills apply there.
- Skill hygiene: about 140 user-level skills of unconfirmed origin load in every session; review and prune.
- S2 to S4. S2 must give every CDK-created function (the `BucketDeployment` handler included) an explicit log group with retention, or the template tests fail.
- The `.gitattributes` PR must land before D1: a CRLF checkout stages different bytes and changes the Lambda asset hash. The root duplicates of `docs/proposals/`.
- ADR-0017's tick-function paragraph still says the alarms read a synthesized EMF line; since `e84e728` they import the constants from `lambdas/tick.py`. Correct it in the next infra PR.
- jsii prints a harmless temp-folder `ENOTEMPTY` error when it exits on Windows; the exit code stays 0.
- Cold-start time of the bundled package to be measured at D4.
- One `uv run pytest` run on `main` @ `4ccf0df` failed one test while the Node suite ran alongside it; the failing test was not captured, and two reruns passed. Watch for a timing-sensitive test.
- F6; GLB with meshopt; the public cost view on `PROJECT_PLAN.md` line 8.
- The `URBAN_*` docs still describe v1.

## Checks
- On `main` @ `4ccf0df`, worktree without `snapshots/` (as in CI): `uv run pytest` → 212 passed, 1 skipped (124 s, rerun; see Open); template tests with the `infra` and `lambda` groups → 27 passed (98 s); Node suite → 73 passed (98 s); `ruff check` and `ruff format --check` → pass.
- CI on PR #65 head `aba8a4b`: 212 passed, 1 skipped; 27 template tests passed.
- CDK synth: both stages with dummy context, no credentials. Deployed: no. No AWS resources exist.

## Next
1. Traffic step 1 (left turns; trace the hold in `life.js` first).
2. The `.gitattributes` PR and the root-duplicates cleanup.
3. S2.
4. S3.
5. S4.
One session at a time.
