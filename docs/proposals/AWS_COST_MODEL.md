# Cost model | Vektor-9 M1

**Status:** revision 2 (2026-11-11), for the design in `AWS_M1_ARCHITECTURE.md` revision 2. Nothing is deployed, so there is no bill yet and every dollar figure is an **estimate**.
**Sources:** sizes and request counts are **measured from the repo** (`AWS_READINESS.md`, section 2). Unit prices are public `us-east-1` list prices; the "checked" column says which were rechecked against AWS pages in this review. Visitor numbers are **scenarios, not forecasts**. Billing currency, taxes and regional price differences depend on the account and are not included.

## 1. Three kinds of number

| Kind | Meaning | Examples |
| --- | --- | --- |
| **Free allowance** | Usage AWS does not charge for, which may depend on the account's plan | Lambda 1 M requests and 400,000 GB-s a month; CloudFront 1 TB and 10 M requests |
| **Paid usage** | What is charged beyond the allowances, at list price | S3 PUT requests; custom metrics outside the free ten |
| **Account-specific assumption** | Not knowable from the repo; check in the account (backlog step 0) | Which free plan the account is on; region; Lambda concurrency quota; whether CloudFront flat-rate plans are available |

## 2. Assumptions

| Input | Value | Basis |
| --- | --- | --- |
| Ticks | 288 a day, 8,640 a 30-day month | Design |
| Tick Lambda | 256 MB, arm64; planning figure 1.0 s billed per run, range 0.3 to 3 s | **Estimate.** About 17 ms of compute locally; Lambda at 256 MB has a fraction of a core, plus S3 round trips and frequent cold starts. Measured in backlog D4. |
| Snapshot | 28 KB gzipped, 152 KB raw | Measured (seed 7, tick 4032, the city at day 14) |
| S3 requests per tick | 2 PUT (tick, head) + 1 GET (head) | Design (one commit per tick; catch-up costs the same per tick) |
| Retention | Ticks 30 days; non-current head versions 3 days; genesis and releases forever | Decision D2 |
| Site upload | 33 MB (`web/`); the release archive is the sim package, well under 1 MB | Measured / estimate |
| First visit | 11.1 MB and about 175 requests, with `.gltf` and `.bin` pre-gzipped at deploy (decision D10) | Measured from the files the page requests; not yet measured in a browser |
| Repeat visit | about 175 conditional requests answered `304`, almost no bytes | Design (decision D11) |
| Logs | 1 to 2 KB per invocation | **Estimate** |
| Monitoring | 6 custom metrics, 4 standard alarms, 1 dashboard, 1 budget, 1 anomaly monitor | Design, architecture section 7 |

## 3. Unit prices

| Service | Price used | Checked |
| --- | --- | --- |
| Lambda arm64 compute | $0.0000133334 per GB-second | Partly: AWS's page uses this figure in a worked example, but the arm64 column was not readable; x86 is $0.0000166667. Verify. |
| Lambda requests | $0.20 per million | Yes |
| EventBridge Scheduler | $1.00 per million invocations after the free allowance | Not rechecked |
| S3 Standard | $0.023 per GB-month; $0.005 per 1,000 PUT; $0.0004 per 1,000 GET; S3 to CloudFront transfer free | Not rechecked |
| CloudFront (North America and Europe) | $0.085 per GB for the first 10 TB; $0.01 per 10,000 HTTPS requests | Not rechecked (allowances were) |
| CloudWatch | $0.30 per custom metric-month; $0.10 per standard alarm-month; logs $0.50 per GB ingested; $3 per dashboard-month beyond three | Yes (metrics, alarms, log ingestion) |
| SNS email | first 1,000 a month free | Not rechecked |
| AWS Budgets | first two budgets free | Not rechecked |
| Cost Anomaly Detection | no charge | Not rechecked |

## 4. Free allowances

| Allowance | Status | Covers M1? |
| --- | --- | --- |
| Lambda: 1 M requests, 400,000 GB-s a month | Always free (checked) | Yes: 8,640 requests and about 2,200 GB-s |
| CloudFront: 1 TB out, 10 M requests a month | Always free on pay-as-you-go (checked) | Up to roughly 57,000 visits a month; the request allowance runs out before the transfer one |
| CloudWatch: 10 custom metrics, 10 standard alarms, 5 GB logs, 3 dashboards | Free tier (checked) | Yes: 6 metrics, 4 alarms, 1 dashboard |
| EventBridge Scheduler: 14 M invocations a month | Not rechecked | Yes |
| S3: 5 GB, 20,000 GET, 2,000 PUT a month | 12-month tier of older accounts only | Storage yes, PUTs no |
| CloudFront flat-rate Free plan ($0, 1 M requests, 100 GB, no overages) | Available since late 2025; one AWS guide says free-tier accounts cannot use flat-rate plans | Possible option, not assumed |

Accounts created since mid-2025 choose between a credit-based free plan and a paid plan; older accounts have the 12-month free tier. Which applies here is an account-specific assumption.

## 5. Estimated monthly cost

### The city with no visitors

| Item | Quantity | Inside the allowances | Without any allowance |
| --- | --- | --- | --- |
| Lambda compute | ~2,200 GB-s (range 650 to 6,500) | $0 | $0.03 ($0.01 to $0.09) |
| Lambda requests, Scheduler | 8,640 each | $0 | under $0.01 each |
| S3 storage (all three buckets) | ~0.3 GB | under $0.01 | under $0.01 |
| S3 PUT | ~17,300 | $0.08 | $0.09 |
| S3 GET (tick reads) | 8,640 | under $0.01 | under $0.01 |
| CloudWatch logs | 8 to 17 MB | $0 | under $0.01 |
| Custom metrics | 6 | $0 | $1.80 |
| Alarms | 4 | $0 | $0.40 |
| Dashboard | 1 | $0 | $0 (three free) to $3 |
| SNS, Budgets, anomaly detection | | $0 | $0 |
| **Total** | | **about $0.10** | **about $2.40** (plus $3 if the dashboard is not free) |

At the first deployment only three alarms and the budget exist (architecture 7.2), so the paid figure starts slightly lower.

### Visitors, the cost that grows

| Visits a month | Transfer | Requests | Inside the 1 TB / 10 M allowance | Without it |
| --- | --- | --- | --- | --- |
| 1,000 first visits | 11 GB | 0.18 M | $0 | about $1.10 |
| 10,000 first visits | 111 GB | 1.75 M | $0 | about $11 |
| 100,000 first visits | 1.1 TB | 17.5 M | about $15 | about $112 |
| 10,000 repeat visits | almost none | 1.75 M | $0 | about $1.75 |

- Requests count as well as bytes: about 175 per visit, first or repeat, until filenames are fingerprinted (after M1).
- `latest.json` is cached at the edge with query strings ignored, so CloudFront asks the bucket at most once per edge location every 30 seconds. That stays under a dollar a month even when many edges are busy.
- Without pre-gzipping (B8), a first visit would be 19.9 MB and the 100,000 row about $90 even inside the allowance. With slimmer textures (after M1) every row falls; textures are 8.7 MB of each first visit.

### Growth

- Keeping every tick for a year instead of 30 days: about 2.9 GB, about $0.07 a month.
- `mark_ids` can add up to about 335 KB raw per snapshot in M4.
- A custom domain adds a hosted zone ($0.50 a month) and registration.

## 6. Cost controls

| Control | Where |
| --- | --- |
| Budget with actual (50, 80, 100 %) and forecast (100 %) alerts at a low monthly limit, deployed before the city stack | `Vektor9Ci` |
| Cost Anomaly Detection monitor and email subscription | `Vektor9Ci` |
| No always-on resources (NAT, VPC, EC2, RDS, load balancers, provisioned concurrency), enforced by template tests | `infra/` tests |
| Log retention on every log group, enforced by a template test | `infra/` tests |
| Lifecycle: ticks after 30 days; non-current versions after 3 days (without it, versioning keeps every overwritten head, about 8 MB a day forever) | Data bucket |
| Query strings ignored in the `/city/*` cache key; price class 100 | Distribution |
| Private buckets only reachable through CloudFront, so nothing bypasses the cache or the free allowance | OAC, Block Public Access |
| Pre-gzipped `.gltf` and `.bin` | Site deployment |

## 7. What to measure once live

1. Billed duration and memory used (the `REPORT` line), median and maximum over a day; catch-up ticks per run.
2. Snapshot size on the live seed over the first week.
3. First-visit and repeat-visit bytes and requests from the browser's network panel.
4. Response headers for each file type (`Content-Type`, `Content-Encoding`, `Cache-Control`).
5. Month-to-date cost from Cost Explorer after the first few days, then monthly. The README shows the real figure, never this estimate.
