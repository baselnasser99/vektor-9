# M1 implementation backlog | Vektor-9

**Status:** proposal (2026-11-11), nothing started. Design: `AWS_M1_ARCHITECTURE.md` (revision 2).
**Rules that apply to every task:** a branch and a PR per task (simulation, schema, infrastructure and IAM all fall under the CLAUDE.md branch-and-PR rule); no commit, push, deploy or `cdk deploy` without explicit approval in the session; no account IDs, email addresses or secrets in files; every number in a PR or document is a measured one or labelled an estimate.

Each task ends at a checkpoint that can be checked on its own, without the later tasks. The stages are in order: nothing in stage 3 starts before stages 1 and 2 are merged.

## Stage 1: local development and tests (no AWS, no CDK)

| # | Task | Touches | Checkpoint |
| --- | --- | --- | --- |
| **L1** | **Simulation version in the snapshot.** ADR-0013 (simulation versioning and replay) and an ADR-0003 update for schema 5: top-level `sim`. `SIM_VERSION = 1` in `sim/rules.py`; `new_city` and `step` set it; `validate` checks it. Golden-output test `tests/golden/sim-v1.json` (SHA-256 of canonical JSON at fixed seed and tick points). The renderer accepts schemas 4 and 5. | `sim/rules.py`, `sim/state.py`, `sim/step.py`, `tests/`, `web/src/main.js` (schema check only), `docs/adr/` | `uv run pytest` and the Node tests pass; a deliberate one-constant change makes the golden test fail (shown, then reverted); the page still loads the shared schema-4 `snapshots/004032.json` with no console errors; `ruff` clean. |
| L2 | **Tick handler and protocol.** ADR-0014 (tick protocol and S3-only coordination). `lambdas/tick.py` over a storage interface; `lambdas/store_memory.py` with conditional semantics and fault injection; `lambdas/store_s3.py` thin adapter (not unit-tested against AWS). Tests T1 to T18. | `lambdas/`, `tests/` | All tests pass in CI with no AWS credentials and no new runtime dependency; `sim/` unchanged by this task. |
| L3 | **Replay tool.** `tools/replay.py`: verify tick `n` from `n−1` (local folder or URL), replay from the seed, and `--catch-up` through the same handler. | `tools/`, `tests/` | Replays a range of the local `snapshots/` (schema 4) and handler-produced schema-5 ticks; a corrupted tick is reported. |

## Stage 2: CDK synthesis (no AWS account needed)

| # | Task | Touches | Checkpoint |
| --- | --- | --- | --- |
| S1 | **CDK app and core stack.** `infra/` (app, `cdk.json`, an `infra` dependency group in `pyproject.toml`); data and releases buckets, bucket policies (TLS only, conditional writes on ticks), tick function and log group, schedule with input template, EMF metrics, three first-deployment alarms, SNS topic. Template tests: log retention everywhere, no VPC, no forbidden resource types (EC2, RDS, load balancers, NAT), IAM actions and resources scoped, schedule cron and retry settings, async retries 0. CI runs `cdk synth` and the template tests. | `infra/`, `pyproject.toml`, `uv.lock`, `.github/workflows/ci.yml` | CI green on the PR without AWS credentials; synth is deterministic (two synths, same template). |
| S2 | **Hosting.** Site bucket, distribution, OAC on both origins, cache policies per path, response headers with CSP hashes computed from the HTML, the staging copy with gzipped `.gltf`/`.bin`, three `BucketDeployment`s, release archive deployment. Template tests: OAC conditions, CSP contains the current import-map hash, content types and encodings per filter, the site deployment cannot touch the data bucket. | `infra/` | CI green; a test fails if `index.html`'s import map changes without the policy following (it cannot, by construction, but the test proves it). |
| S3 | **Frontend for hosting.** Default snapshot URL `/city/v5/latest.json` when served from the distribution, the local path otherwise; `people.js` crowd panel colour through `element.style` instead of an inline `style` attribute. | `web/src/main.js`, `web/src/people.js` | Locally the page is unchanged (same default view, crowd panel looks the same), Node tests pass. |
| S4 | **CI stack.** `Vektor9Ci`: GitHub OIDC provider, deploy role (subject pinned to the `production` environment), budget, Cost Anomaly Detection monitor and subscription. Email and limits come from deploy-time context, not files. | `infra/` | Template tests: the trust policy's `sub` and `aud` conditions, the role can only assume `cdk-*` roles. |

## Stage 3: AWS dev deployment (manual, from a laptop, each step approved)

Prerequisites done by the account owner: root MFA, an Identity Center user with MFA, region chosen, free-plan type and Lambda concurrency quota checked, `cdk bootstrap` once.

| # | Task | Checkpoint |
| --- | --- | --- |
| D1 | Deploy `Vektor9-dev` (core). | Within 10 minutes: `genesis.json`, tick 0 and the head exist; the log shows `scheduled_time` on a 5-minute boundary; the conditional puts succeed on the deployed runtime; an unconditional `put-object` to a tick key is denied. |
| D2 | Recovery drills. | A manual invoke with the same `scheduled_time` writes nothing; disabling the schedule for 20 minutes fires "City stalled" by email, and re-enabling it catches up with contiguous ticks and `RecoveryActions` > 0; deleting the head is repaired from history, not reset; a replay check of a few deployed ticks passes locally with `tools/replay.py`. |
| D3 | Deploy hosting to dev. | Direct S3 URLs return 403, CloudFront URLs return 200; `curl -I` shows the expected `Content-Type`, `Content-Encoding` and `Cache-Control` for HTML, JS, `.gltf`, `.bin`, JPEG and `latest.json`; the page loads in the browser with no CSP violations and draws the live city; a second site deploy leaves city history intact and does not delete the `.gltf`/`.bin` files. |
| D4 | Measure. | Recorded from the dev stack: median and maximum billed duration, memory used, catch-up ticks per run, snapshot size, first-visit bytes and requests from the browser's network panel. `AWS_COST_MODEL.md` and the time budget updated with measured values. |
| D5 | Destroy and redeploy dev. | `cdk destroy` leaves nothing behind but the CDK bootstrap; a fresh deploy bootstraps a new city; no log group without retention exists afterwards. |

## Stage 4: production deployment

| # | Task | Checkpoint |
| --- | --- | --- |
| P1 | Deploy `Vektor9Ci` by hand; create the GitHub `production` environment with a required reviewer; set the role ARN as a repository variable. | `aws sts get-caller-identity` from a test workflow run shows the deploy role; nothing else is allowed. |
| P2 | Add the deploy job and smoke test to CI; pin actions to commit SHAs in that job. | A merged PR waits for approval, then deploys `Vektor9-prod`; the smoke test passes. |
| P3 | Fix seed and genesis (decision D3) and go live. | The first prod tick appears at genesis; the smoke test confirms advancement. |

## Stage 5: operational verification

| # | Task | Checkpoint |
| --- | --- | --- |
| O1 | First 24 hours. | 288 ticks committed; `HeadTick` increases by one per slot; `TicksBehind` 0; no alarm; `Errors` 0. |
| O2 | Daily replay check. | A scheduled GitHub workflow replays random recent ticks from the public URL with the archived release and passes. |
| O3 | Runbook. | `docs/process/RUNBOOK.md`: pause the city, restore the head from a version, replay from the seed, roll back the frontend, destroy dev. Each procedure was exercised once in dev (D2, D5). |
| O4 | Cost check. | After the first few billed days, Cost Explorer's figures replace the estimates in `AWS_COST_MODEL.md`; the budget threshold is adjusted to the measured baseline. |
| O5 | Remaining alarms. | City behind, Tick slow and Cost Anomaly Detection enabled; M1 is complete. |
| O6 | README "How it runs". | Diagram from the deployed stacks, with an Implemented list and a separate Planned list; every number in it measured. |

## After M1

Shrink the first visit (textures are 8.7 MB of it), fingerprinted asset names, a scoped CDK bootstrap execution policy, the timeline and hourly keyframes (M2).
