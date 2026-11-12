# ADR-0014: Tick protocol and S3-only coordination

**Status:** Proposed (2026-11-12)

## Context
In M1 the city advances on AWS: EventBridge Scheduler invokes a Lambda every 5 minutes, and the Lambda keeps the city in an S3 bucket (`docs/proposals/AWS_M1_ARCHITECTURE.md`, revision 2, sections 3 and 4). Requirement 2 of that document is the hard one: every tick from 0 to now exists exactly once, in order, whatever the infrastructure does. Scheduler can deliver late or twice, Lambda can run a queued copy or two copies at once, a run can time out or crash between any two calls, and an operator can delete the head by hand.

There is no database and no lock service. The only coordination available is S3's conditional writes: `If-None-Match: *` (create only) and `If-Match: <etag>` (replace only that version), which return `412 Precondition Failed` when refused and can return `409 ConditionalRequestConflict` when two conditional writes race.

The simulation is pure: `step(state, [], tick_rng(state))` depends only on the snapshot, because `tick_rng` seeds the tick's generator from the snapshot's `seed` and `tick` (ADR-0013). So any run that starts from the same head computes the same next tick, which is what makes coordination through conditional writes enough.

This ADR records the protocol as implemented in `lambdas/tick.py` (L2), and the decisions taken relative to revision 2.

## Decision

### Due tick and configuration
- The seed, the genesis instant and the metrics stage come from `VEKTOR9_SEED`, `VEKTOR9_GENESIS` (ISO 8601, UTC offset zero) and `VEKTOR9_STAGE`, parsed once per container. A genesis off a 5-minute boundary is rejected.
- `due = min(⌊(scheduled − genesis) / 300⌋, ⌊(now − genesis) / 300⌋)` in integer epoch seconds. No `scheduled_time` means the clock alone; a malformed one fails closed before anything is read or written; `due < 0` is a no-op.
- `run_tick(store, config, *, now, scheduled_time, remaining_ms, emit, max_ticks=288, reserve_ms=15000)` holds the protocol. `handler(event, context)` reads the event, the clock and `context.get_remaining_time_in_millis` and prints to stdout; nothing else reads the clock, and `step()` stays pure.

### Keys and headers
| Key | Written | Headers |
| --- | --- | --- |
| `city/genesis.json` | once, `If-None-Match: *` | `{seed, genesis, first_schema}`, plain JSON, `Cache-Control: no-store` (never served) |
| `city/v{SCHEMA}/ticks/{tick:08d}.json` | once per tick, `If-None-Match: *` | gzip (`mtime=0`), `application/json`, `Content-Encoding: gzip`, `public, max-age=31536000, immutable`; metadata `sim-version`, `artifact-sha256` |
| `city/v{SCHEMA}/latest.json` | every tick, `If-Match` (created with `If-None-Match: *`) | as a tick, but `public, max-age=30` |

- The prefix is built from `sim.rules.SCHEMA` at call time, never written as a literal, so a schema change before genesis needs no change here.
- The stored bytes are the canonical JSON (`sort_keys`, compact separators) gzipped; `artifact-sha256` is the SHA-256 of that canonical JSON. Contents are always compared as canonical decompressed JSON, never as gzip bytes.

### State machine
Revision 2, section 4.3, one commit per tick:

1. **Due**: as above.
2. **ReadHead**: read the head and `genesis.json`.
3. **CheckGenesis**: neither exists → **Bootstrap**. A head without `genesis.json` → FailClosed. `genesis.json` that does not match the config (seed or genesis) → FailClosed.
4. **Bootstrap**: `new_city(seed)`, then tick 0, `genesis.json` and the head, each `If-None-Match: *`. A `412` on tick 0 compares contents (identical continues, different is divergence); a `412` on `genesis.json` or the head means another bootstrap won: stop.
5. **RepairHead** (head missing, `genesis.json` present): list the tick keys, walk them from the highest down, and take the first that decodes, validates, matches the genesis seed and holds the tick its key names. It becomes the head (`If-None-Match: *`; a `412` means another run repaired it: Yield). No such tick → FailClosed. Never a new city.
6. **Validate**: `validate(head)` must be empty, `head.seed == genesis.seed`, and `resume_error(head)` must be `None` (see F2).
7. **Compare**: `head.tick ≥ due` → done, no write.
8. **Step**: `step(head, [], tick_rng(head))`; the result must pass `validate`.
9. **WriteTick**: `If-None-Match: *`. A `412` reads the stored tick: identical → continue (an earlier run wrote it and died); different or unreadable → FailClosed (divergence).
10. **WriteHead**: `If-Match: <etag>`. Success → back to Compare. A `412` → **Yield**.
11. **Yield**: re-read the head for the log, emit `RecoveryActions` (`conflict_yielded`), stop cleanly.
12. **FailClosed**: emit `PublishFailures` with the reason, raise `FailClosed`; nothing more is written.

### Time budget
Before each tick the loop stops if it has committed `max_ticks` (288, one city day) or `remaining_ms()` is below `reserve_ms` (15 s of the 60 s timeout). A timeout can therefore only interrupt the tick in flight, which the next run finishes (WriteTick's `412`, identical).

### Retry layers
- SDK: `boto3` standard retries for transient S3 errors.
- Scheduler: 2 attempts, maximum event age 300 s. Lambda asynchronous retries: 0. Every duplicate they create ends in Compare as a no-op.
- Application: a `409` on a tick or `genesis.json` create is retried once. For the head move, the run first re-reads the head: if it still holds the tick this run started from, the put is retried once with the ETag it now has; otherwise Yield. A `409` while creating the head (Bootstrap, RepairHead) stops the run like a `412`, because another writer is creating it; the next slot finds it or repairs it. A second `409`, and any other storage error, raises without FailClosed; the next slot retries.

### F2: a refused head is terminal
`resume_error()` (ADR-0013) refuses a head from another schema or from newer rules than the running code, for example after a rollback to older code. The run raises `ResumeRefused`, a subclass of `FailClosed`, with `PublishFailures` reason `resume_refused`, and writes nothing. It is not retryable: every later slot refuses the same way, including slots that would otherwise be no-ops, until code that may advance the head is deployed. Recovery is rolling forward. History is never reset or rewritten, and the older code never writes a tick under rules it does not have.

### Reserved concurrency is not a correctness guard
Correctness never depends on reserved concurrency; at most it saves work. The argument:
- A tick key is created only with `If-None-Match: *`, so each tick object is written at most once, and the bucket policy (S1) denies tick writes without that header.
- Any run that creates tick `n + 1` computed it from a head at tick `n` that passed Validate, and `step` with `tick_rng` is a function of that snapshot alone, so every writer computes the same tick `n + 1`. A writer that finds a different stored tick stops (divergence) instead of publishing.
- The head moves only by `If-Match` from the ETag the run read, so it moves from `n` to `n + 1` and never backwards or by two; a writer whose ETag is stale gets `412` and yields.
- So with any number of concurrent runs, the head only advances one tick at a time over a contiguous, write-once history. Reserved concurrency 1 (when the account quota allows it) only avoids duplicate computation. T10 and T17 run concurrent writers on one store.

### boto3
`If-Match` and `If-None-Match` on `put_object` need a recent `botocore`; the Lambda runtime's bundled copy may be older. The Lambda package will bundle a pinned `boto3` instead of using the runtime's copy (closes U1 in `AWS_READINESS.md`). The pin and the packaging land in S1; L2 adds no dependency. `lambdas/store_s3.py` takes an injected client, imports `boto3` only when none is passed, and maps errors by the duck-typed `e.response["Error"]["Code"]` and HTTP status (`NoSuchKey`/404 → `NotFound`, 412 → `PreconditionFailed`, 409 → `ConditionalConflict`, anything else → `StoreError`), so it is tested with a stub and importing the handler needs only the standard library.

### Metrics and logs
Each run emits, through the injected `emit`, one EMF line (namespace `Vektor9`, dimension `Stage`) with `HeadTick`, `TicksPublished`, `TicksBehind` (`due − head`, at least 0), `DeliveryDelaySeconds` (`now − scheduled_time`, only when the event has one), `PublishFailures` (0 or 1) and `RecoveryActions` (`catch_up`, `head_repaired`, `conflict_yielded`), plus one JSON summary line: due, head before and after, ticks published, duration, outcome, reason and recovery kinds. A run that dies (a crash or timeout) emits nothing; Lambda's `Errors` and the stalled alarm cover it.

### Deviations from revision 2
- **Validate** uses `validate()` and `resume_error()` instead of `head.sim ≤ SIM_VERSION`: `resume_error` is the single place that decides whether this code may advance a snapshot (ADR-0013), and it also refuses another schema.
- **F2**, **reserved concurrency** and **boto3**: as above, decided for L2.
- **Bootstrap writes tick 0 first**, then `genesis.json`, then the head (revision 2 lists genesis first). With genesis first, a crash between `genesis.json` and tick 0 leaves `genesis.json` and no ticks, which RepairHead must refuse (T14: never a new city once a city exists), so the city would stop until an operator steps in. In this order every crash point is finished by the next run through existing states: after tick 0 the run bootstraps again and finds tick 0 identical; after `genesis.json` RepairHead makes tick 0 the head.
- **Every run reads `genesis.json`**, not only when the head is missing: Validate compares the head's seed with it and T15 compares the config with it. One extra GET per run.
- **Validate runs before Compare**, so a refused or invalid head fails closed even on a slot that would be a no-op.
- **A `409` on the head is re-read before the retry** (above), so the retry cannot overwrite a head another writer moved.
- **Duration** is the difference between `remaining_ms()` at the start and the end of the run, so `run_tick` reads no clock.

## Alternatives considered
- **R2, a self-continuing chain** (the handler invokes itself while behind): needs `lambda:InvokeFunction` on itself and a recursion guard, risks running away, and competes with scheduled runs. Rejected.
- **R3, orchestrated backfill** (Step Functions or a backfill function): a second code path and more resources for the same work. Rejected for M1; raising memory comes first if catch-up is too slow.
- **R4, skip ahead** (jump the city clock to now): skips ticks, breaks replay and the tick-to-time mapping, and needs a recorded offset, a schema change. Rejected.
- **A lock** (DynamoDB conditional item, or a lock object in S3): one more resource and a lease to expire, and still not needed for correctness, because the conditional writes already order the writers.

## Consequences
- **What could break.** A rules change without a `SIM_VERSION` bump makes recomputed ticks differ from stored ones: divergence, FailClosed, city paused (the golden test exists to catch this before deploy). A deploy of older code over a newer head pauses the city by design (F2) until code that may advance it is deployed. Losing the head and every tick object while `genesis.json` survives stops the city until an operator replays from the seed. The deployed `botocore` must send `IfMatch`/`IfNoneMatch` (to verify in D1); an old client would make every conditional put fail and the city would not start.
- **What could be abused.** The handler takes no visitor input in M1. The event's `scheduled_time` is clamped to the clock, so a crafted invocation cannot push the city ahead of real time; a malformed one fails closed without writing. Only the tick role writes the data bucket, and the bucket policy denies tick writes without `If-None-Match`. `genesis.json` is never served.
- **What costs money.** Per normal run: two GETs (head, `genesis.json`) and two PUTs (tick, head), about 1,150 S3 requests a day (estimate: 288 runs × 4). Catch-up adds two PUTs per tick. RepairHead adds one LIST page per 1,000 tick keys and one GET per tick tried. Storage grows by one gzipped tick per 5 minutes (about 16 KB each locally, measured on seed 7; about 4.6 MB a day), bounded by the retention in decision D2. Logs are two lines per run.

## Test map
| Test | What it checks | Requirement (architecture section 1) |
| --- | --- | --- |
| T1 | Bootstrap on an empty store; headers and metadata; second run no-op | 1, 2, 4 |
| T2 | Two bootstraps racing make one city | 2, 3 |
| T3 | Same scheduled time twice: no write | 2, 3 |
| T4 | Late delivery: no write | 2, 3 |
| T5 | Future scheduled time clamped; before genesis no-op | 1, 2 |
| T6 | One missed slot: two contiguous ticks | 1, 2, 3 |
| T7 | Gap far beyond the per-run cap, small budget: many runs, every tick once, in order | 1, 2, 3 |
| T8 | Crash after the tick, before the head: head moved, tick not rewritten | 2, 3 |
| T9 | Timeout mid catch-up: committed ticks kept, resume from the head | 2, 3 |
| T10 | Two handlers interleaved, and two in threads: one yields, history clean | 2, 3 |
| T11 | Stored tick differs: FailClosed, head unchanged, `PublishFailures` | 2, 4, 7 |
| T12 | Head unreadable or invalid: FailClosed, no writes | 3, 4 |
| T13 | Head deleted: repaired from the newest valid tick, never tick 0 | 3 |
| T14 | Only `genesis.json` left: FailClosed, no new city | 2, 3 |
| T15 | Config or head from another city: FailClosed | 2, 4 |
| T16 | One `409` on a tick, the head or `genesis.json`: retried; two: raised, no damage | 3 |
| T17 | Hypothesis: crashes, a second writer, missed, duplicate and late deliveries: history equals a clean run | 2, 3, 6 |
| T18 | Rules version change: new ticks carry the new `sim`, old ticks unchanged | 4, 6 |
| T19 | Head refused by `resume_error`: `ResumeRefused`, no write, same on the next run | 3, 4, 7 |
| T20 | Handler history equals `python -m sim` for the same seed | 2, 6 |
| T21 | S3 store over a stub: errors mapped, conditions and headers passed through | 2, 5 |
| T22 | Due-tick arithmetic, config parsing, import without `boto3` | 1, 9 |
