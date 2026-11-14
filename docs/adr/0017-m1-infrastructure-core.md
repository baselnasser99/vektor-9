# ADR-0017: M1 infrastructure core

**Status:** Proposed (2026-11-14)

## Context
Backlog task S1 (`docs/proposals/AWS_M1_BACKLOG.md`) puts the core of the M1 design (`AWS_M1_ARCHITECTURE.md`, revision 2) into CDK in Python: the data and releases buckets, the tick function, its schedule, the first-deployment alarms and the alert topic. It must synthesize in CI with no AWS account, credentials or Docker. Hosting is S2, the frontend changes S3, the CI stack and budget S4.

## Decision

### Env-agnostic stacks
`infra/app.py` defines `Vektor9-dev` and `Vektor9-prod` from one stack class, `infra/stack.py`. No account or region appears in code and the app makes no context lookups, so synth needs no credentials and there is no `cdk.context.json`. The account and region come from the deploying credentials.

### Stage values come from CDK context
Each stage takes `<stage>.seed`, `<stage>.genesis` (ISO 8601 UTC on a 5-minute boundary), `<stage>.alert_email` and optionally `<stage>.reserved_concurrency` (`true` or `false`, default `false`), passed with `-c` at synth or deploy time. Nothing real is committed; the template tests use dummy values. A stack is synthesized for each stage that has context, so deploying dev needs no prod values; a stage with missing values, or no stage at all, fails the synth. Seed and genesis are checked with the handler's own `load_config`, so a value the tick would reject fails at synth rather than in the first run. The SNS subscription has a fixed construct ID so the address never appears in a logical ID.

### Reserved concurrency is a switch
Off by default, on with `<stage>.reserved_concurrency=true` when the account quota allows reserving 1 (U5). It only avoids duplicate work: correctness comes from the tick protocol (ADR-0014), whatever the concurrency.

### boto3 is bundled and pinned (closes U1)
The `lambda` dependency group pins boto3 and every dependency exactly (boto3 and botocore 1.44.3, s3transfer 0.19.3, jmespath 1.1.0, python-dateutil 2.9.0.post0, six 1.17.0, urllib3 2.8.0), recorded in `uv.lock`. All are pure-Python wheels (`py3-none-any`), so the copy installed in the Python 3.13 environment is the same bytes an arm64 Linux install gets. `infra/package.py` stages `sim/`, `lambdas/` and those installed files at synth, with no Docker and no download, and refuses a distribution that is not pure or not at its pin. No `.pyc` files and no installer bookkeeping are copied, and files are copied by content only, so two synths give the same asset hash. A template test imports the staged boto3 with no site-packages and checks that `PutObject` accepts `IfMatch` and `IfNoneMatch`. The package is 23.1 MB unpacked, 16.9 MB as a zip (measured), inside Lambda's 250 MB and 50 MB limits. The `infra` group pins `aws-cdk-lib` 2.277.0 and `constructs` 10.8.1. `sim/` stays standard-library only.

### Tick retention: kept forever in prod
This replaces decision D2's 30 days. The tick stores gzipped canonical JSON: 15.6 KB at tick 0 and 27.8 KB at tick 4032, day 14 (measured, seed 7, schema 6, `SIM_VERSION` 4). At 8,640 ticks a month and the day-14 size, history grows by about 240 MB a month, 2.9 GB a year. At $0.023 per GB-month (list price, not rechecked) that is about $0.07 a month after one year and about $0.43 in total over the first year (**estimate**; snapshot size beyond day 14 is not measured, and visitor marks in M4 can add up to about 335 KB raw per snapshot). That is small against the value of replaying any tick from the one before it (requirement 6) without a keyframe scheme, so the decision is revisited with keyframes in M2. Tick objects are never overwritten, so versioning adds nothing for them. Prod's only lifecycle rule expires non-current versions of `city/v{SCHEMA}/latest.json` after 3 days (the moved head, about 8 MB a day without it). S3 lifecycle filters are prefixes, so the rule names the current schema and follows it when `SCHEMA` changes and the stack is redeployed.

### Buckets
Both buckets are private, Block Public Access, SSE-S3, TLS only (a deny on `aws:SecureTransport` false), with generated names. The data bucket policy also denies `s3:PutObject` on `city/*/ticks/*` without `s3:if-none-match`. Prod: versioned, `RETAIN`. Dev: unversioned, `DESTROY`, as revision 2 section 9 has it for both data and releases. The release archive deployment is S2.

### Dev removal: no autoDeleteObjects
`autoDeleteObjects` adds a provider function whose log group CDK creates without retention, which the house rules forbid. Dev therefore uses `DESTROY` without it: `cdk destroy` fails on a non-empty bucket, so destroying dev means emptying its two unversioned buckets first (one command each).

### Tick function, schedule, alarms
As revision 2: Python 3.13, arm64, 256 MB, 60 s, asynchronous retries 0, maximum event age 300 s; an explicit log group with 30-day retention; a custom role with explicit statements only (no managed policy, no `grant*` helpers). The schedule uses the stable `aws_scheduler` L2 construct: `cron(0/5 * * * ? *)` in UTC, flexible window off, retry 2 attempts and 300 s, no DLQ, input `scheduled_time`, `execution_id`, `attempt`. Its role trusts `scheduler.amazonaws.com` with `aws:SourceAccount` and may invoke only the tick (CDK's grant also covers its qualified ARNs). City stalled and Tick errors notify one SNS email topic. The alarm's namespace and dimension are read from a real EMF line the handler emits (a bootstrap against the in-memory store), and synth fails if the handler stops emitting `TicksPublished`, so the alarm cannot drift from the handler.

### Deferred
The budget alarm lands in S4 with the CI stack. CloudFront, the site bucket and the deployments are S2. The dashboard and the behind, slow and anomaly alarms come before M1 is called done (O5).

## Consequences
- CI synthesizes both stages and runs the template tests on every pull request, without AWS credentials.
- A boto3 upgrade is an edit to the `lambda` group and `uv.lock`, reviewed like any dependency.
- The asset hash depends on the bytes of `sim/` and `lambdas/`; a Windows checkout with CRLF line endings stages different bytes from CI, so packages built on different machines can differ in hash while behaving the same.
- History in prod grows without bound until M2 decides on keyframes.
