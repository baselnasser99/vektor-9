# Current handoff | Vektor-9

Updated: 2026-11-12 00:16 (+02:00)
Milestone: M1 (the city goes live), before L2. L1 and the RNG module (SIM_VERSION 2) are done; urban masterplan step 3a done; M0c hover inspector still open
Branch: `main` @ `f5d88b8` (merge of PR #58), equal to `origin/main`. Local-only branch `local/handoff-history` @ `392ba92` keeps the old handoff history (not pushed)
Working tree: clean apart from untracked duplicates of `docs/proposals/` at the repo root (`AUDIT_PLAN.md`, `AWS_*.md`, `URBAN_*`, `urban-audit/`) and the ignored `snapshots-v2/` (listed in `.git/info/exclude`). Ignored `snapshots/` is shared: don't clean it

## Done this session (verified)
- PR #56 (`a76660c`): schema 5 records `sim`; `validate()` checks format, `resume_error()` decides whether this code may advance a snapshot; golden outputs per version. ADR-0013.
- PR #57 (`71ce9ba`): AWS M1 plan and urban audit under `docs/proposals/`; `PROJECT_PLAN.md` reworded; handoff process below.
- PR #58 (`f5d88b8`, head `5433dc9`, CI passed): SIM_VERSION 2. `sim/rng.py` builds `randint`, `randrange`, `choice` and `sample` on `random()` alone, and every draw in `sim/` goes through it (a test enforces it). Golden `sim-v2.json` (v1 kept), a three-day golden case, a test continuing the v1 fixture. ADR-0013 revision; F1 wording in ADR-0003/0013. Masterplan guard test reads `tests/fixtures/sim-v1-seed3-t288.json.gz`. Traffic fix in `life.js`: at the interchange's widening merge (2 lanes into 3) crossing ways now take turns; regression tests read the v2 fixtures of seeds 7 and 3. Tick time unchanged within noise; `buildCity` fingerprint unchanged by the traffic fix.

## Handoff workflow
- Handoff updates are docs-only commits on `main`, pushed only with the owner's approval. Local `main` tracks `origin/main` exactly. PR branches are cut from `origin/main`.

## In progress / not done
- Fixture rule (in `CLAUDE.md`): renderer tests that assert one seed's specific outcome read a frozen fixture via `fixture()`, not a fresh sim run.
- The urban docs (`docs/proposals/URBAN_*`, ADR-0012's seed-7 roles, screenshots) describe the v1 city. Under v2 seed 7's HQ, old town, parks and works sit elsewhere.
- `snapshots/` still holds the v1 schema-4 history, so locally the seed-7 JS tests and the default page use the v1 city while CI runs v2 fresh. Regenerating it is a decision (shared folder).
- `snapshots-v2/` (seed 7 v2, ticks 0-4032) exists in the main checkout and as a single-file copy in `.claude/worktrees/sim-rng/`; both ignored, both kept.
- Render glitch to check: `v2-same-view07.jpg` shows a screen-aligned black rectangle, probably a render or capture glitch rather than the camera inside a tower. Reproduce with `?view=230,150,-170,115,60,-80&snap=../snapshots-v2/004032.json`. Screenshots: `C:\Users\User\Documents\vektor-9-review\sim-rng-screens\` (outside the repo).
- Review follow-ups still open: F2 (in L2 a `resume_error` refusal is terminal and non-retryable; recover by rolling forward); F3 (decision D3: fresh schema-5 genesis vs 4 to 5 migration); F6 (optional `sim-v1` tag).
- Proposals awaiting a decision: correctness must not rely on reserved concurrency; always bundle a pinned `boto3` (closes U1); GLB with meshopt and fingerprinted assets at deployment.
- Urban, carried over: permanent IKARO HQ anchoring; ADR-0012 follow-ups; seed 3 car dead ends (v1); traffic standstills outside the interchange; walkers off mid streets; dirt-track cars don't tilt; plant ignores blackouts; HQ campus 8 m wider than its model; no `.gitattributes`.
- Branches kept: `sim-rng`, `docs-proposals`, `sim-versioning` (local and remote, with worktrees), `local/handoff-history` (local only), older PR branches.

## Checks
- On `main` @ `f5d88b8`: `uv run pytest` → 60 passed; Node suite → 60 passed; `ruff check` and `ruff format --check` → pass; `node --check` on `web/src` and `tests/js` → ok.
- CDK synth: n/a (no CDK app). Deployed: no. No AWS resources exist.

## Decisions
- M1 direction approved: EventBridge Scheduler, Lambda, S3, CloudFront, CloudWatch, SNS, CDK in Python; recovery R1; three buckets; pre-gzipped glTF.
- No AWS deployment and no L2 without explicit approval.

## Next
1. In parallel: L2 (tick handler and protocol, ADR-0014, local only), and a timeboxed urban structure ADR: an arterial and boulevard backbone plus reserved landmark sites as terrain in `new_city` (schema 6), then growth weighted by frontage and distance from the centre (SIM_VERSION 3), both before any AWS genesis.
2. Clean up the root duplicates of `docs/proposals/`; the `.gitattributes` PR.
3. CDK S1 to S4.
