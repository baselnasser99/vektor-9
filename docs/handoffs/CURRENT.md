# Current handoff | Vektor-9

Updated: 2026-11-12 22:30 (+02:00)
Milestone: M1 (the city goes live), after L2 and PR A of ADR-0015. M0c hover inspector still open
Branch: `main` @ `a75e861` (merge of PR #62), equal to `origin/main`. Local-only branch `local/handoff-history` @ `392ba92` keeps the old handoff history (not pushed)
Working tree: clean apart from untracked duplicates of `docs/proposals/` at the repo root (`AUDIT_PLAN.md`, `AWS_*.md`, `URBAN_*`, `urban-audit/`). Ignored `snapshots/` (v3), `snapshots-v2/` and `snapshots-v1/` are shared: don't clean them

## Done this session (verified)
- PR #60 (merge `2fba117`): ADR-0015 (urban structure in the simulation) Accepted.
- PR #61 (merge `f69ed53`): L2 tick handler and protocol, ADR-0014, local only; includes the three bootstrap crash tests in `tests/test_tick_protocol.py`.
- PR #62 (merge `a75e861`, head `2baf8f1`, CI passed): schema 6, SIM_VERSION 3. `new_city` lays out a static `plan` (backbone at 8, 24, 40 on both axes; `hq` and `court` sites as `site` terrain); the HQ stands on the plan's site from tick 0, facing the avenue, with the court across it; seed 443 gets works (`lay_works` retries). Schema-6 code refuses schema-5 snapshots (fresh genesis, no migration). Renderer draws schemas 4, 5 and 6. Golden `sim-v3.json`; v3 fixtures for seeds 7 and 3. ADR-0015 criterion 6 amended: 12-seed mean population within ±10% (v2 113,952, v3 110,653, -2.9%). ADR-0003: schema 6.
- Local snapshots: `snapshots/` is now v3 (seed 7, schema 6, sim 3, 4,033 files, ticks 0 to 4032). `snapshots-v2/` (schema 5, sim 2) and `snapshots-v1/` are kept; both are in `.git/info/exclude`. The seed-7 JS tests (`snapshot(7)`, `localSeries` in `tests/js/harness.mjs`) read `snapshots/` when present; the Node suite passes on the v3 folder.

## Closed follow-ups
- F2: implemented as `ResumeRefused` in L2. F3: a fresh schema-6 genesis, per ADR-0015. Permanent HQ anchoring. Seed 443 without works.

## In progress / not done
- PR B: growth weighted by frontage and distance from the centre (SIM_VERSION 4), judged by the 12-seed mean population in ADR-0015; adds a test continuing the v3 fixtures under v4.
- Court visual check: `http://localhost:8000/web/?bench=1000x625&view=20,30,-180,-32,0,-225` (seed 7, tick 4032).
- A pedestrian crossing between the HQ and the court (renderer follow-up).
- S1 to S4, with the pinned `boto3` decided in ADR-0014 (U1 closes at S1).
- The root duplicates of `docs/proposals/`; the `.gitattributes` PR.
- F6 (optional sim tags); GLB with meshopt; the public cost view promised on `PROJECT_PLAN.md` line 8.
- The `URBAN_*` proposal docs still describe the v1 city.
- Branch and worktree cleanup. Local branches kept: `blender-plant`, `claude/audit-fixes-04845d`, `claude/highway-interchange-adr-0011-fa5fef`, `claude/keen-kilby-474fe2`, `claude/l2-tick-handler-306ebb`, `claude/musing-bouman-ca762f`, `claude/pickup-92c597`, `claude/screen-blackness-snapshots-aaaa07`, `claude/train-station-fd11db`, `claude/urban-structure-adr-4b0018`, `docs-proposals`, `fix-black-screen`, `fix/adr-0015-schema-6-static-plan-2aa7f4`, `interchange`, `interchange-circulation`, `interchange-west`, `l2-tick-handler`, `local/handoff-history`, `masterplan-table`, `parked-walkers`, `perf-far-lods`, `rigid-props`, `sim-rng`, `sim-v3-site-plan`, `sim-versioning`, `street-mix`, `tidy-perf`, `train-station`, `urban-structure-adr` (most also on `origin`). Worktrees under `.claude/worktrees/`: `adr-0015-schema-6-static-plan-2aa7f4`, `audit-fixes-04845d`, `blender-tower-asset-ebe299`, `city-preview-2a14c8`, `city-preview-pickup-860447`, `cyberpunk-pedestrian-system-93ab30`, `docs-proposals`, `highway-interchange-adr-0011-fa5fef`, `keen-kilby-474fe2`, `l2-tick-handler-306ebb`, `musing-bouman-ca762f`, `pickup-92c597`, `pickup-cb1bc0`, `screen-blackness-snapshots-aaaa07`, `sim-rng`, `sim-versioning`, `train-station-fd11db`, `urban-structure-adr-4b0018`.

## Checks
- On `main` @ `a75e861`: `uv run pytest` → 192 passed (90 s); Node suite → 70 passed (44 s; 37 s on the v3 `snapshots/`); `ruff check` and `ruff format --check` → pass.
- CDK synth: n/a (no CDK app). Deployed: no. No AWS resources exist.

## Decisions
- ADR-0015: schema 6 is a fresh genesis; validate() and resume_error() never compare against `new_city(seed)`; criterion 6 uses the 12-seed mean.
- No AWS deployment without explicit approval.

## Next
1. PR B (SIM_VERSION 4).
2. S1.
3. The cleanups (root duplicates, `.gitattributes`, branches and worktrees).
One session at a time.
