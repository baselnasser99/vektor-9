# Current handoff | Vektor-9

Updated: 2026-11-11 23:24 (+02:00)
Milestone: M1 (the city goes live), task L1 done; L2 not authorized yet. Urban masterplan step 3a done; M0c hover inspector still open
Branch: `main` @ `71ce9ba` (merge of PR #57), equal to `origin/main`. The old local-only handoff history is kept on local branch `local/handoff-history` @ `392ba92` (not pushed)
Working tree: clean apart from the untracked originals of the proposals at the repo root (`AUDIT_PLAN.md`, `AWS_*.md`, `URBAN_*`, `urban-audit/`), now duplicates of `docs/proposals/`; not deleted yet. Ignored `snapshots/` (schema 4, seed 7, 4,033 files) is shared: don't clean it

## Done this session (verified)
- L1 simulation versioning, PR #56 merged as `a76660c` (head `3a7cd78`; CI passed on Python 3.13.18). Schema 5 adds `sim` (`SIM_VERSION` 1); `validate()` checks format, `resume_error()` decides whether this code may advance a snapshot; golden-output tests; renderer accepts schemas 4 and 5. ADR-0013. A fresh run writes `"schema": 5, "sim": 1`.
- PR #57 merged as `71ce9ba` (head `bee2d9c`; CI passed): the AWS M1 plan (revision 2) and the urban audit are in `docs/proposals/` with a README (proposals, not decisions; ADRs win); `make_plan.py` writes its SVGs next to the documents; `PROJECT_PLAN.md` describes goals and the feature table in architecture terms; new handoff rule in `CLAUDE.md` and `docs/process/SESSION_HANDOFF.md`.

## Handoff workflow (new)
- Handoff updates are docs-only commits on `main`, pushed only with the owner's approval. Local `main` tracks `origin/main` exactly. PR branches are cut from `origin/main`.

## In progress / not done
- Open decision: `sim/rng.py` built only on `random()` (the only draw Python promises across versions), shipped as `SIM_VERSION` 2 before genesis. Needs approval; branch and PR with a new golden file.
- Other proposals awaiting a decision: correctness must not rely on reserved concurrency; always bundle a pinned `boto3` (closes U1); GLB with meshopt and fingerprinted asset names at deployment.
- Review follow-ups to L1: F1 `validate()` wording (current schema only); F2 in L2 a `resume_error` refusal is terminal and non-retryable, recovery by rolling forward; F3 decision D3: fresh schema-5 genesis or a 4 to 5 migration with `sim` 1; F4 a multi-day golden case; F5 a test that v2 continues a mid-run v1 snapshot; F6 an optional `sim-v1` tag.
- Urban, carried over: permanent IKARO HQ anchoring (fixed order vs land reserved in the sim, a schema change); ADR-0012 follow-ups (`main.js` layout lacks the HQ's cut; frontier-to-residential treatment); seed 3 car dead ends; traffic standstills outside the interchange; walkers off mid streets; dirt-track cars don't tilt; plant ignores blackouts; HQ campus 8 m wider than its model; no `.gitattributes`.
- Branches kept: `docs-proposals`, `sim-versioning` (local and remote, with worktrees), `masterplan-table`, `interchange-circulation`, `claude/audit-fixes-04845d`, `local/handoff-history` (local only).

## Checks
- On `main` @ `71ce9ba`: `uv run pytest` → 38 passed (11 golden); Node suite → 57 passed; `ruff check` and `ruff format --check` → pass; `node --check` on `web/src` and `tests/js` → ok.
- CDK synth: n/a (no CDK app). Deployed: no. No AWS resources exist.

## Decisions
- M1 direction approved: EventBridge Scheduler, Lambda, S3, CloudFront, CloudWatch, SNS, CDK in Python; recovery R1; three buckets; pre-gzipped glTF. ADR-0014 (tick protocol) comes with L2.
- No AWS deployment and no L2 without explicit approval.

## Next
1. `/pickup` on `main`.
2. Decide on `sim/rng.py` (`SIM_VERSION` 2) and the other proposals; then approve or hold L2 (tick handler and protocol, local only, ADR-0014).
3. Optionally delete the duplicate untracked originals at the repo root.
