# AWS readiness review | Vektor-9

**Status:** revision 2 (2026-11-11), not implemented. Reviewed on local `main` @ `d5979f7` (same code as `origin/main` @ `a911902`). The serverless direction is approved; the detailed decisions await approval.
**Scope:** can the code as it stands today be run on EventBridge Scheduler, Lambda, S3, CloudFront, CloudWatch and IAM, deployed with CDK in Python from GitHub Actions through OIDC? What must change first, and what is only nice to have?
**Companions:** `AWS_M1_ARCHITECTURE.md` (design, revision 2), `AWS_COST_MODEL.md` (cost and monitoring cost), `AWS_M1_BACKLOG.md` (ordered tasks).

Nothing here was deployed or tested on AWS. Sizes and timings below were measured from the repo and the local `snapshots/` folder (seed 7, ticks 0 to 4032) on a Windows laptop with Python 3.13; Lambda numbers will differ and are labelled as estimates wherever they appear.

## 1. What exists today

| Area | State | Evidence |
| --- | --- | --- |
| Simulation | Pure stdlib Python, no dependencies. `step(state, marks, rng)` is deterministic; tick `n` uses `random.Random(f"{seed}:{n}")`. | `sim/step.py`, `pyproject.toml` (`dependencies = []`) |
| Snapshot contract | Schema 4 (ADR-0003). The state *is* the snapshot. `sim.state.validate()` returns every violation. | `sim/state.py`, `docs/adr/0003-snapshot-schema.md` |
| CLI | `python -m sim` runs N ticks from `new_city(seed)` and writes `NNNNNN.json` per tick, compact JSON. | `sim/__main__.py` |
| Tests | 22 pytest (invariants, determinism, Hypothesis) and 56 Node tests (traffic, walkers, masterplan). All pass on `main` today. | `tests/`, run at session start |
| CI | One job on push to `main` and on PRs: ruff check, ruff format check, pytest, Node tests. `permissions: contents: read`. | `.github/workflows/ci.yml` |
| Renderer | Static HTML plus ES modules, vendored Three.js through an import map, no build step. Loads one snapshot and 56 glTF models. | `web/index.html`, `web/src/main.js`, `web/src/materials.js` |
| Lambdas | None. `lambdas/` does not exist. | |
| Infrastructure | None. `infra/` does not exist; no CDK dependency; `cdk.out/` is already in `.gitignore`. | |

## 2. Measurements

### Snapshots (seed 7, measured)

| Tick | Raw JSON | Gzip (level 6) |
| --- | --- | --- |
| 0 (new city) | 141.7 KB | 16.2 KB |
| 288 (day 1) | 142.6 KB | 17.7 KB |
| 2016 (day 7) | 147.4 KB | 23.7 KB |
| 4032 (day 14) | 151.8 KB | 27.8 KB |

- The mean raw size across all 4,033 snapshots is 147 KB. Gzip grows with the city because tiles get more varied; ADR-0003's "~26 KB gzipped at day 14" still holds (27.8 KB now with schema 4).
- `mark_ids` is empty in every local snapshot. Once visitor marks exist (M4) the list can hold up to 5,000 IDs of up to 64 characters, which could add up to about 335 KB raw. That is an M4 concern, but it means the tick must not assume snapshots stay near 150 KB.

### One tick, locally (measured, median of 50 ticks from tick 4032)

| Work | Time |
| --- | --- |
| `step()` | 7.6 ms |
| `validate()` | 6.6 ms |
| `json.dumps` (compact) | 2.5 ms |

Replaying tick 4031 to 4032 from the file on disk reproduced the stored tick 4032 exactly. On Lambda the CPU share at small memory sizes is a fraction of a laptop core, and S3 calls and cold starts add more; the cost model uses a planning figure of one second at 256 MB and gives a range.

### What the city page downloads (measured from the files `main.js` and `materials.js` ask for)

| Part | Files | Raw | With gzip |
| --- | --- | --- | --- |
| glTF JSON (`.gltf`) | 56 | 0.82 MB | 0.13 MB |
| glTF buffers (`.bin`) | 56 | 8.06 MB | 1.70 MB |
| PBR textures (`.jpg`, 5 sets × 3 maps) | 15 | 8.71 MB | 8.68 MB |
| Code (`web/src`, `web/vendor`, `index.html`) | 47 | 2.14 MB | 0.52 MB |
| Snapshot | 1 | 0.15 MB | 0.03 MB |
| **First visit** | **about 175 requests** | **about 19.9 MB** | **about 11.1 MB** |

- `web/` as a whole is 33 MB on disk; `web/assets` holds 162 files, 35 of which the city page never requests (they belong to `sample.html` close-ups or are unused). The largest single file is `telecom_tower.bin` at 2.9 MB.
- JPEG textures do not compress further and are the largest part of a visit once the rest is gzipped. They are the main lever on transfer cost.
- The ~175 request count is an upper estimate from the file list (some vendor modules may not be imported by the city page). It was not measured in a browser.

## 3. Compatibility with each service

| Service | Fit | Notes |
| --- | --- | --- |
| **Lambda (Python 3.13)** | Good | The sim needs only the standard library, so the deployment package is just `sim/` plus a handler: no bundling, no Docker, no layers. `pyproject.toml` targets Python 3.13, which Lambda supports. arm64 works because nothing is compiled. |
| **EventBridge Scheduler** | Good | A `rate(5 minutes)` schedule with a Lambda target. Delivery retries are configurable and must be set deliberately (section 4 of the architecture document). |
| **S3** | Good | A tick writes one object of about 150 KB, or about 28 KB gzipped. Conditional writes (`If-None-Match`, `If-Match`) give the tick a compare-and-swap without another service. |
| **CloudFront** | Good, with changes | Static files, private bucket through Origin Access Control. The renderer needs a stable snapshot URL (blocker B2), and the inline import map needs care under a Content-Security-Policy (blocker B5). |
| **CDK in Python** | Good | `aws-cdk-lib` has L2 constructs for every piece: `aws_scheduler`, `aws_lambda`, `aws_s3`, `aws_cloudfront` with `S3BucketOrigin.withOriginAccessControl`, `aws_s3_deployment`, `aws_cloudwatch`, `aws_budgets` (L1). Needs Node for the CDK CLI, which CI already installs. |
| **CloudWatch** | Good | Metrics can be emitted as Embedded Metric Format log lines, so the tick needs no `PutMetricData` permission. |
| **IAM with GitHub OIDC** | Good | The repo already scopes CI to `contents: read`. Deploys add `id-token: write` on one job only. |

## 4. Confirmed blockers (must be fixed before M1 can run)

These are things that would stop M1 or make it unsafe, checked against the code and, where marked, against AWS documentation. Every one now has a settled design; none is implemented.

| # | Blocker | Evidence | Resolution (design section; backlog task) |
| --- | --- | --- | --- |
| B1 | There is no tick handler and no infrastructure. | No `lambdas/`, no `infra/`. | Tick handler with a storage interface (4; L2), CDK app (9; S1, S2, S4). |
| B2 | The renderer loads a fixed local file: `../snapshots/004032.json`. Deployed, there is no such object and no "latest" URL. | `web/src/main.js:21` | Default to `/city/v5/latest.json` on the distribution, local path otherwise (5.4; S3). |
| B3 | Nothing decides *which* tick is due. A handler that runs one `step()` per invocation would double-tick on every duplicate delivery and drift on every miss. | `sim/__main__.py` | Due tick from Scheduler's `scheduled-time` (confirmed context attribute) on a cron aligned to genesis, clamped to the clock; one commit per tick; time-budget catch-up (3, 4; L2). |
| B4 | A snapshot does not record which simulation rules produced it, and ADR-0003 lets rule constants change without a schema bump. | `docs/adr/0003-snapshot-schema.md` | Revised: commit metadata alone is not enough. Schema 5 adds `sim`; `SIM_VERSION` with a golden-output test; each deployed package archived in a releases bucket with its Python version (5; L1, S2). |
| B5 | `index.html` and `sample.html` use an inline `<style>` and an inline import map, which a strict CSP blocks. | `web/index.html`, `web/sample.html` | Hashes computed from the HTML at synth (6.4; S2). |
| B6 | The renderer throws on any schema other than 4, so a schema bump could take the public page down. | `web/src/main.js:23` | Schema in the storage path; renderer reads its own schema's path; bump procedure (5.4, 5.5; L1, S3). |
| B7 | A pruning site deploy into the same bucket as the city would delete its history. | CDK `BucketDeployment` behaviour | Separate site, data and releases buckets (6.1; S1, S2). |
| B8 | CloudFront does not compress `model/gltf+json` or `application/octet-stream` (confirmed: neither is on its list of compressible types), and Python's `mimetypes` returns no type for `.gltf` (measured). Served as-is, a first visit would be about 20 MB instead of 11 MB. | AWS compression docs; measured | Pre-gzip `.gltf` and `.bin` at deploy with explicit `Content-Type` and `Content-Encoding` (6.3; S2). |
| B9 | Python guarantees only that `random()` repeats across versions. The sim also calls `randint`, `randrange`, `choice` and `sample`, so a runtime upgrade can change the city silently. | `sim/state.py`, `sim/step.py`; Python `random` docs | Pin Lambda to `python3.13` (matches `.python-version`); record the Python minor version with each release; treat a runtime upgrade as a version change unless the golden test proves identical output (5.2, 5.3; L1). |
| B10 | `web/src/people.js:1084` builds the crowd panel with `innerHTML` containing a `style="..."` attribute, which a CSP without `'unsafe-inline'` blocks. | code | One-line change to set it through `element.style` (6.4; S3). |
| B11 | Bootstrap must never start a second city. If the head were missing for any reason, "no head → new city" would reset the city to tick 0. | design risk | `city/genesis.json` written once; a missing head with genesis present repairs from history or fails closed (4.3; L2). |

## 5. Optional improvements (worth doing, not required for M1)

| # | Improvement | Why | When |
| --- | --- | --- | --- |
| O1 | Shrink the first visit: downscale or convert the 8.7 MB of JPEG textures (KTX2 or smaller JPEG/WebP), compress meshes (meshopt or Draco), drop the 35 unused files from the upload. | Transfer is the only cost that scales with visitors, and load time on phones. | Before the site is shared widely. |
| O2 | (Promoted to blocker B8 after confirming CloudFront's compressible types.) | | |
| O3 | Fingerprint asset filenames (hash in the name) so they can be cached for a year without invalidations. | Repeat visits cost almost nothing. Without a bundler, invalidation on deploy is the simpler choice for M1. | Later, if deploys become frequent. |
| O4 | `?snap=` accepts any URL, so a crafted link can make the public page draw someone else's JSON. The page draws only shapes and fixed event kinds, so the harm is small, and `connect-src 'self'` in the CSP closes it. | Defence in depth. | With B5. |
| O5 | Pin GitHub Actions to commit SHAs instead of tags. | Supply-chain hygiene once a job holds AWS credentials. | When the deploy job is added. |
| O6 | Scope the CDK bootstrap's CloudFormation execution policy instead of the default `AdministratorAccess`. | Least privilege for the one role that creates resources. | After M1 works; needs care to avoid blocking legitimate deploys. |
| O7 | A `latest.json` poll in the renderer so an open page picks up new ticks. | Today the page loads once. | M2 (timeline). |
| O8 | Write `mark_ids` as random IDs that cannot be linked to a visitor, since snapshots are public. | Privacy. | M4. |

## 6. Known gaps that are not blockers

- **Python version on Lambda.** `boto3` ships with the Lambda runtime. Conditional writes need a reasonably recent `boto3`; the M1 smoke test must confirm that an `If-Match` put succeeds on the deployed function. If it ever does not, the fix is to vendor a pinned `boto3` in the package.
- **Region.** CloudFront certificates for a custom domain must be in `us-east-1`. M1 uses the default `*.cloudfront.net` domain, so the stack can live in any region; a custom domain is a later, separate decision.
- **The 4,033 local snapshots stay local.** The deployed city starts from its own genesis (`new_city(seed)` at tick 0) and does not need the local history.
- **No marks in M1.** The handler passes `marks=[]`. Deterministic replay of the whole deployed history is therefore possible from the seed alone until M4, when marks must also be archived.

## 7. Confirmed in this review

| Behaviour | Source |
| --- | --- |
| Scheduler substitutes `<aws.scheduler.scheduled-time>`, `<aws.scheduler.execution-id>` and `<aws.scheduler.attempt-number>` into the target input. | Scheduler user guide, context attributes |
| Scheduler retry policy: up to 185 retries and 24 hours by default, configurable; optional SQS dead-letter queue. | Scheduler user guide |
| Lambda retries a failed asynchronous invocation twice by default; retries and event age are configurable. | Lambda developer guide |
| S3 `If-None-Match: *` and `If-Match: <etag>` on `PutObject`; `412` on a failed precondition, `409` on a concurrent conflict; `If-Match` needs `s3:GetObject` and `s3:PutObject`; bucket policies can require the headers. | S3 user guide, conditional writes |
| CloudFront compresses only listed content types and never responses that already carry `Content-Encoding`; glTF and octet-stream are not listed. | CloudFront developer guide, serving compressed files |
| Free allowances: see `AWS_COST_MODEL.md`. | AWS pricing pages |

## 8. Unresolved risks

| # | Risk | Impact | Where it is resolved |
| --- | --- | --- | --- |
| U1 | The deployed runtime's bundled `boto3` must support `IfMatch` / `IfNoneMatch`. | Tick cannot coordinate; it fails closed. Fallback: vendor a pinned `boto3` in the package. | D1 |
| U2 | `aws s3 sync --delete` behind `BucketDeployment` must leave files excluded by a filter alone, so three filtered deployments can share the site bucket. | A deploy could delete the glTF files. Fallback in architecture 6.3. | D3 |
| U3 | Browser support for a CSP hash on an inline import map. | The page would not start under the CSP. | D3, with the console open |
| U4 | Time per tick on Lambda, and so the catch-up rate after long outages, is not measured. | Slower recovery; adjust memory. | D4 |
| U5 | The account's Lambda concurrency quota may not allow reserving 1. | None for correctness; overlapping runs yield. | Step 0 |
| U6 | Exact names of the `AWS/Scheduler` delivery metrics. | One optional dashboard panel. | D1 |
| U7 | The arm64 Lambda price and whether this account's free plan includes the allowances in the cost model. | Cost estimates off by small amounts. | Step 0, O4 |
| U8 | `BucketDeployment` options used for the release archive (`extract: false`) must exist in the pinned CDK version. | Fallback: a CI step uploads the zip. | S2 |
| U9 | Single region; the account itself (root, Identity Center) is managed outside the repo. | Accepted. | Runbook |
| U10 | Repeat visits revalidate about 175 files each (cheap `304`s, but each is a CloudFront request). | Request charges above 10 M a month. Fingerprinting removes it later. | After M1 |

## 9. Verdict

The simulation is ready for serverless use: pure, dependency-free, fast and already replay-tested. The gaps are in the shell around it (the tick protocol, storage layout, hosting headers) plus three small changes inside the repo, which are all in the backlog: a `sim` field and version constant (schema 5, before launch), a default snapshot URL, and one CSP-safe line in `people.js`. No rule of the simulation changes.
