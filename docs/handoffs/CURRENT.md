# Current handoff | Vektor-9

Updated: 2026-11-15 01:12 (+02:00)
Milestone: M1 (the city goes live). S1 done (PR #65 merged, ADR-0017 Proposed). Traffic step 1 done (PR #66). The sim is at SIM_VERSION 4, schema 6
Branch: `main` at this handoff commit, equal to `origin/main`
Working tree: clean apart from untracked duplicates of `docs/proposals/` at the repo root (`AUDIT_PLAN.md`, `AWS_*.md`, `URBAN_*`, `urban-audit/`). Ignored `snapshots/` (v4), `snapshots-v3/`, `snapshots-v2/` and `snapshots-v1/` are shared: don't clean them

## Done (verified)
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
- 15 remote and 19 local merged branches deleted; `delete_branch_on_merge` is on (it deleted `origin/infra-s1-core` and `origin/traffic-left-turns`).

## Kept, for the owner to decide
- Unmerged branches: `blender-plant` (local), `claude/highway-interchange-adr-0011-fa5fef`, `claude/keen-kilby-474fe2`, `claude/musing-bouman-ca762f`, `claude/train-station-fd11db`, `perf-far-lods`.
- Merged but dirty worktrees: `tidy-perf`, `rigid-props`, `claude/pickup-92c597`.
- Detached worktrees: `city-preview-2a14c8`, `city-preview-pickup-860447`, `pickup-cb1bc0`, and `s1-cdk-core-stack-7b38ab`.
- Empty worktree folders that Windows kept locked.
- The local `sim-v4-growth` branch and its worktree (`cleanup-weighted-growth-f1a11e`). Also local: `local/handoff-history`, `street-design-adr`, the merged `infra-s1-core`, the merged `traffic-left-turns` (worktree `traffic-left-turns-fix-d692a8`), and session branches `fix/*`.

## Open
- ADR-0016 roadmap, renderer-only, in order: (1) left turns, done in PR #66; (2) the dead-end fix; (3) the HQ-to-court crossing; (4) priority junctions; (5) speeds and calming; (6) one-way pairs; (7) shared streets; (8) dressing by type; (9) walkers on mid streets.
- A pre-existing overlap: a straight car stuck in a junction can be driven through by the crossing street.
- Court paving contrast.
- Make the Node harness's use of `snapshots/` opt-in, so local and CI runs match.
- Building variety: a later renderer pass with a download size budget; the Blender skills apply there.
- Skill hygiene: about 140 user-level skills of unconfirmed origin load in every session; review and prune.
- S2 to S4. S2 must give every CDK-created function (the `BucketDeployment` handler included) an explicit log group with retention, or the template tests fail.
- The `.gitattributes` PR must land before D1: a CRLF checkout stages different bytes and changes the Lambda asset hash. The root duplicates of `docs/proposals/`.
- ADR-0017 still describes the synth-time metric reading: its tick-function paragraph says the alarms read a synthesized EMF line; since `e84e728` they import the constants from `lambdas/tick.py`. Fix in S2.
- jsii prints a harmless temp-folder `ENOTEMPTY` error when it exits on Windows; the exit code stays 0.
- Cold-start time of the bundled package to be measured at D4.
- The flaky pytest candidate: `tests/test_sim.py:130` `test_malformed_marks_are_rejected_not_crashing` (default Hypothesis deadline). Proposed fix: `@settings(deadline=None)`. Not reproduced in three loaded runs.
- F6; GLB with meshopt; the public cost view on `PROJECT_PLAN.md` line 8.
- The `URBAN_*` docs still describe v1.

## Checks
- On `main` @ `c003433`, worktree without `snapshots/` (as in CI): `uv run pytest -rf` → 212 passed, 1 skipped (137 s); Node suite → 83 passed (79 s); `ruff check` and `ruff format --check` → pass.
- CI on PR #66 head `ac5747e`: `lint-and-test` passed.
- CDK synth: both stages with dummy context, no credentials. Deployed: no. No AWS resources exist.

## Next
1. A cleanup PR: `.gitattributes` (must land before D1), the flaky-test deadline fix, and planning the root-duplicates removal (those files are untracked in the main checkout, which a hook protects; decide the method first).
2. S2 (hosting; fix ADR-0017's text; explicit log groups for all CDK functions).
3. Traffic step 2 (the dead-end fix).
4. S3.
5. S4.
One session at a time.
