# Vektor-9 | A cyberpunk city that lives in the cloud

**Status:** Plan v2 (2026-11-02)
**What it is:** A passion project. A sunlit, hazy cyberpunk city, seen in 3D from above, that grows, decays, and rebuilds itself every five minutes on AWS, whether anyone is watching or not.
**Goals, in order:**
1. Fun to build and endlessly refinable visually.
2. A complete serverless system on AWS: scheduled compute, object storage behind a CDN, monitoring and alerting, all defined as code, with each architecture decision recorded in an ADR.
3. Live and transparent: the running city, its history and its cost are public, and every figure about it comes from a measurement.

## 1. The pitch

> Vektor-9 is a city that never sleeps, because it runs in the cloud. Every five minutes it grows, decays, and rebuilds itself. Drop in to see what changed, scrub back through its history, and leave your mark: one building or one sign a day.

**The 20-second visit:** you open the site and see the city in 3D, a neon-lit night under a crimson sunset, with a crane swinging over a half-built tower, a monorail sliding past, and people smoking on rooftops. A district to the east is dark: a blackout started 40 minutes ago. You drag the timeline back a week and watch that tower rise from an empty lot. You hang a sign on a rooftop. It appears at the next tick, for everyone.

## 2. What a visitor sees

- **City view:** a 3D bird's-eye city you can orbit and zoom, in the art style defined in `docs/STYLE_GUIDE.md`.
- **Timeline:** a scrubber through the city's history, with play and speed controls.
- **Event feed:** "Blackout in Sector 4", "Tower topped out in Sector 1", "Market district expands".
- **Block inspector:** hover or tap any building to see its type, floors, age, and history.
- **Leave your mark:** one action per visitor per day: commission a building on an empty lot, or hang a sign chosen from preset words and symbols. Never free text.
- **Control room:** a page showing how the city runs: live architecture diagram, last tick time, tick duration, snapshot count, uptime. This is where the AWS work becomes visible to non-engineers.

Simulated data, clearly labeled. All names in the city are invented. Visual inspiration comes from anime cyberpunk, but no names, logos, characters, designs, or screenshots from any existing show, game, or film are used anywhere in the project.

## 3. The simulation

### Core principle

The simulation is a **pure Python package** (`sim/`) with no AWS or rendering code in it:

```python
step(state, marks, rng) -> (new_state, events)
```

Same state + same marks + same seed → same result, always. This makes it testable on a laptop, replayable, and debuggable. AWS is only the shell that runs it on a schedule; the browser only draws what it produces.

### Simulated life vs. ambient life (ADR-0002)

- **Simulated life** is computed in `sim/`, stored on AWS, identical for every visitor: tiles, building heights, construction progress, power, blackouts, events, visitor marks.
- **Ambient life** is generated in each visitor's browser and never stored: pedestrians, rooftop smokers and sitters, cars, the monorail, flying vehicles, steam, crane motion. It **reacts** to the simulation (no rooftop crowds in a blacked-out district, more pedestrians near markets, a crane only where there's construction) but is never simulated on the server.

This split keeps the server simple and cheap while the city looks alive.

### Version 1 (deliberately small)

Grid: 48 × 48 tiles, with a street layout. The city starts as a small core in the center (one plant, a couple of markets, a few low houses) and spreads outward district by district, aiming to fill the map in about two weeks. After that it keeps changing: it grows upward and districts rise and fall in slow waves. Five tile types:

| Tile | Behavior |
| --- | --- |
| Empty lot | Can become a construction site if powered and near a market, or via a visitor mark |
| Construction site | Gains floors each tick until its target height (a few floors above its neighbors), then becomes housing |
| Housing stack | Fills with residents; decays when overcrowded, unpowered, or its district declines; in busy districts gets rebuilt taller |
| Night market | Boosts nearby housing; closes if its district empties |
| Power plant | Supplies a radius; at capacity its area stops growing until the city builds a new plant at its edge |

Each tile also carries a deterministic **style seed** so the renderer always draws the same building the same way (facade type, silhouette, rooftop props) without the simulation knowing anything about visuals.

Most events emerge from rules (booms, decay waves, completions, new plants). Blackouts are the exception: three a day, 30 minutes each, at least 2 hours apart, at times picked from the seed. Each hits the most loaded plant, so the busiest district goes dark. They are scheduled so they stay rare enough to be an event.

### Later versions (one at a time)

Corporate towers that acquire adjacent blocks, transit growth, district names, seasons, weather, day-night cycle driven by simulated time.

### Invariants (tested)

- The grid is always 48 × 48; no tile outside known types.
- Floors and populations are never negative; construction progress never exceeds its target.
- Power supplied never exceeds total plant capacity.
- Exactly three 30-minute blackouts a day, at least 2 hours apart.
- Determinism: replaying from a snapshot with the same marks and seed reproduces the same next state.
- A visitor mark is applied at most once, even if delivered twice.

Use Hypothesis (property-based testing) to throw random cities and mark sequences at the invariants.

### The snapshot contract (ADR-0003, to be written in M0)

The JSON snapshot is the contract between simulation, storage, and renderer. Define it early, version it (`"schema": 1`), keep it compact (target well under 100 KB gzipped for 48 × 48), and test that the simulation always produces valid snapshots.

## 4. Architecture

```text
Visitor ─▶ CloudFront ─▶ S3 (site, latest.json, snapshots)
   │
   └─▶ API Gateway ─▶ Mark Lambda ─▶ DynamoDB (one mark per day) ─▶ SQS
                                                                   │
EventBridge Scheduler (every 5 min) ─▶ Tick Lambda ◀───────────────┘
                                        │
                                        ├─▶ S3 snapshots + latest.json
                                        ├─▶ DynamoDB event timeline
                                        └─▶ CloudWatch metrics ─▶ alarm ─▶ SNS email
```

### Components and decisions

- **Frontend (ADR-0001):** static HTML/CSS/JS with **Three.js** for the 3D city. Three.js is vendored into the repo at a pinned version (no CDN dependency at runtime) and loaded as ES modules with an import map. No bundler or framework unless an ADR justifies it. All colors come from one palette module that mirrors `docs/STYLE_GUIDE.md`.
- **Renderer principle:** the renderer is a pure function of the snapshot plus ambient-life randomness. It never invents simulated state.
- **API:** a few small Python Lambda handlers behind API Gateway. Flask isn't used in production; a tiny Flask app may wrap the same handlers for local development.
- **Tick:** EventBridge Scheduler triggers the tick Lambda every 5 minutes. **Reserved concurrency = 1**, so two ticks can never run at once. A failed tick is retried; if it still fails, the next tick resumes from the last good snapshot.
- **Marks:** validated server-side (enum type, coordinates in bounds, lot empty), one per visitor per day via a DynamoDB conditional write, then queued in SQS. The tick drains the queue and skips mark IDs already applied.
- **Visitor identity:** an anonymous signed cookie, documented honestly as bypassable. API Gateway throttling limits abuse. Cognito accounts are a possible later addition.
- **Storage (S3):**
  - `latest.json`: current city; CloudFront TTL ~30 s.
  - `ticks/YYYY/MM/DD/HHMM.json.gz`: every tick; immutable; expired after 7 days.
  - `hourly/YYYY/MM/DD/HH.json.gz`: hourly keyframes for the timeline; Standard-IA after 30 days, Glacier Instant Retrieval after 90.
  - Immutable keys get long cache TTLs. Versioning on. Bucket private, read by CloudFront via Origin Access Control.
- **DynamoDB:** `marks` (one per visitor per day; TTL cleanup) and `events` (city timeline, queryable by day).
- **Monitoring:** custom metrics (tick duration, population, power deficit); alarm if no successful tick in 15 minutes → SNS email. Explicit log retention everywhere.
- **Infrastructure as code:** AWS CDK in Python (`infra/`).
- **Deploys:** GitHub Actions with OIDC (no stored keys). Tests and `cdk synth` on every push; deploy on `main`.

### Cost guardrails (day one of AWS work)

- AWS Budgets alert at a low monthly threshold.
- No EC2, RDS, load balancers, or NAT gateways. Lambdas are not placed in a VPC.
- CloudWatch log retention set on every log group.
- Check which AWS free plan the account is on; design to run cheaply after it ends.
- README publishes the real monthly cost from the actual bill.

## 5. Architecture concepts by feature

| Feature | AWS services | Well-Architected focus |
| --- | --- | --- |
| City served worldwide, private bucket | S3, CloudFront, OAC | Secure, high-performing |
| The heartbeat | EventBridge Scheduler, Lambda, reserved concurrency | Resilient |
| Marks wait for the tick | SQS, idempotent processing | Resilient |
| One mark per day | DynamoDB conditional writes, TTL | High-performing |
| History that fades to cold storage | S3 lifecycle, storage classes | Cost-optimized |
| Undo an apocalypse | S3 versioning | Resilient |
| City can't silently die | CloudWatch metrics and alarms, SNS | Resilient |
| Abuse limits | API Gateway throttling, input validation | Secure |
| No stored keys | IAM roles, least privilege, GitHub OIDC | Secure |
| Whole stack as code | CDK / CloudFormation | All |

Every non-obvious choice gets a short ADR in `docs/adr/`: requirements first, then the simplest and cheapest design that meets them, with the alternatives considered.

## 6. Art direction

See **`docs/STYLE_GUIDE.md`**: a richly detailed neon cyberpunk night, dark gunmetal and charcoal structure lit by warm sodium lamps, lit windows and red and pink neon (cyan and violet only as accents), a crimson sunset sky behind a cold blue haze, wet streets, physically based materials, and lots of ambient life. The style guide is the source of truth for every visual decision.

## 7. Milestones

Each milestone ends with something visible.

| Milestone | What you get | Architecture concepts |
| --- | --- | --- |
| **M0a: Foundation** | Repo, Python project setup, tests, linting, CI on GitHub Actions | GitHub Actions basics |
| **M0b: The city, as data** | `sim/` v1 with the five tile types and invariant tests; snapshot schema (ADR-0003); a CLI that runs N ticks and writes snapshots to disk | (Python only) |
| **M0c: The city, in 3D** | Three.js renderer that loads a snapshot from disk: plain boxes, orbit camera, hover inspector, local dev server | (Frontend) |
| **M0d: First art pass** | Palette module, cel shading, haze, outlines, first facade textures and silhouettes from the style guide | (Design) |
| **M1: The city goes live** | CDK app; S3 + CloudFront site; tick Lambda on a schedule; OIDC deploys; Budgets alert; log retention | S3, CloudFront, Lambda, EventBridge, IAM |
| **M2: History** | Hourly keyframes, timeline scrubber, event feed, lifecycle rules, caching strategy | S3 storage classes, caching, DynamoDB |
| **M3: Ambient life** | Pedestrians, rooftop people, cars, monorail, cranes, steam, all reacting to the snapshot; instanced rendering for performance | (Frontend) |
| **M4: Visitors** | API Gateway, mark Lambda, DynamoDB conditional writes, SQS, throttling | API Gateway, SQS, DynamoDB |
| **M5: Control room** | CloudWatch metrics and alarm, SNS email, public control-room page | CloudWatch, SNS |
| **M6: Timelapse** | Nightly timelapse render; optional Step Functions | Step Functions |
| **Ongoing** | Detail and polish, new tile types and events, day-night cycle | As new features need them |

Design work (M0d onward) is meant to be continuous: small daily refinements are encouraged once the data-to-3D pipeline exists.

## 8. Working rules (light, because this is meant to be fun)

- **Small commits straight to `main`** are fine for design, styling, and copy.
- **Use a branch and PR** for simulation rules, the snapshot schema, infrastructure, IAM, or the API. These get tests and a short self-review: what could break, what could be abused, what could cost money.
- **Tests:** simulation invariants and determinism; snapshot validity; mark validation. CI runs tests (and `cdk synth` once `infra/` exists) on every push.
- **No invented claims.** Uptime, costs, and performance numbers come from real measurements.
- **Architecture decisions** go in `docs/adr/`. **Visual decisions** go in `docs/STYLE_GUIDE.md`.
- **Commits should be real work.** Design iteration naturally produces many small commits; never pad.

## 9. README plan

- Hero GIF and a live link at the top.
- One-paragraph pitch, then "How this city runs": architecture diagram and the table of architecture concepts by feature.
- Links to ADRs, the style guide, the control room, and real monthly cost.
- "Simulated city, invented names" disclosure.
- Honest limitations.

## 10. Risks

| Risk | Mitigation |
| --- | --- |
| Simulation too complex to tune | Five tile types; one mechanic at a time |
| 3D performance on phones | Instancing, texture atlases, level of detail, pixel-ratio cap; measure on a real phone |
| Endless polishing before anything works | Data → 3D pipeline first (M0b, M0c), then art |
| Surprise AWS bill | Budgets alert, no always-on resources, log retention, read the bill monthly |
| Offensive content from visitors | Preset signs only; rollback via S3 versioning |
| Photosensitivity | Flash and reduced-motion rules in the style guide |
| Looking derivative of an existing show | Own designs and names only; inspiration stays at the level of palette and technique |

## 11. First action

Start **M0a**: create the repo with these docs, set up the Python project (tests, linting), and add a GitHub Actions workflow that runs them. Then M0b: the simulation and snapshot schema.
