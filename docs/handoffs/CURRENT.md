# Current handoff | Vektor-9

Updated: 2026-11-11 23:08 (+02:00)
Milestone: M1 (the city goes live), task L1 done and merged; L2 not authorized yet. Urban masterplan step 3a done; M0c hover inspector still open
Branch: local `main` @ merge of `origin/main` @ `a76660c` (PR #56). Local `main` is ahead of `origin/main` by local-only handoff history, never pushed. PR branches are cut from `origin/main`
Working tree: clean apart from untracked files to keep and not commit unasked: `AWS_READINESS.md`, `AWS_M1_ARCHITECTURE.md`, `AWS_COST_MODEL.md`, `AWS_M1_BACKLOG.md`, `AUDIT_PLAN.md`, `URBAN_*.md`, `URBAN_*.svg`, `urban-audit/`. Ignored `snapshots/` (schema 4, seed 7, 4,033 files) is shared: don't clean it

## Done this session (verified)
- AWS readiness review and M1 design, revision 2 (untracked docs above): serverless, EventBridge Scheduler, Lambda, S3, CloudFront, CloudWatch, SNS, CDK in Python. Backlog L1-L3, S1-S4, D1-D5, P1-P3, O1-O6.
- L1 simulation versioning, PR #56 merged as `a76660c` (merge commit, head `3a7cd78` checked with `--match-head-commit`; CI `lint-and-test` passed). Schema 5 adds `sim` (`SIM_VERSION` 1, independent of `SCHEMA`); `validate()` checks format, `resume_error()` decides whether this code may advance a snapshot; golden-output tests in `tests/test_golden.py` and `tests/golden/sim-v1.json`; renderer accepts schemas 4 and 5; masterplan test uses local history only when complete. ADR-0013.
- Seed 7 replay ticks 0 to 4032 matches the shared schema-4 history apart from `schema` and `sim`; `buildCity` fingerprint identical for schema 4 and 5.
- External review of PR #56: approved, with follow-ups F1-F6 below.

## In progress / not done
- Review follow-ups (small, none blocking): F1 `validate()` docstring/ADR wording should say it accepts the current schema only; F2 in L2, a `resume_error` refusal is terminal and non-retryable, a rollback after a `SIM_VERSION` bump halts ticking, recovery is by rolling forward; F3 decision D3 must choose a fresh schema-5 genesis or a 4 to 5 migration with `sim` 1; F4 a multi-day golden case; F5 a test that v2 continues a mid-run v1 snapshot; F6 an optional `sim-v1` tag.
- Proposals awaiting a decision: (1) `sim/rng.py` built only on `random()`, shipped as `SIM_VERSION` 2 before genesis; (2) correctness must not rely on reserved concurrency (accounts keep 100 unreserved, new accounts have low quotas); (3) always bundle a pinned `boto3` (closes U1); (4) commit the untracked AWS and urban docs under `docs/proposals/` and move the local handoff history off `main`; (5) GLB with meshopt and fingerprinted asset names at deployment.
- Urban, carried over: permanent IKARO HQ anchoring (fixed order vs land reserved in the sim, a schema change); ADR-0012 follow-ups (`main.js` layout lacks the HQ's cut; frontier-to-residential treatment); seed 3 car dead ends; traffic standstills outside the interchange; walkers off mid streets; dirt-track cars don't tilt; plant ignores blackouts; HQ campus 8 m wider than its model; no `.gitattributes`.
- Branches kept: `sim-versioning` (local and remote, worktree `.claude/worktrees/sim-versioning`), `masterplan-table`, `interchange-circulation`, `claude/audit-fixes-04845d`.

## Checks
- On local `main` after merging `origin/main` @ `a76660c`: `uv run pytest` → 38 passed (11 golden); Node suite → 57 passed (with the full local history present); `ruff check` and `ruff format --check` → pass; `node --check` on `web/src` and `tests/js` → ok.
- CDK synth: n/a (no CDK app). Deployed: no. No AWS resources exist.

## Decisions
- M1 direction approved: serverless stack above, recovery R1 (scheduled catch-up, one commit per tick), three buckets, pre-gzipped glTF. ADR-0014 (tick protocol) comes with L2.
- L1 merged; L2 not started and needs explicit approval. No AWS deployment without explicit approval.

## Next
1. `/pickup` on `main`.
2. Decide on proposals (1) to (5) and follow-ups F1 to F6; then approve or hold L2 (tick handler and protocol, local only, ADR-0014).
