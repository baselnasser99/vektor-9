# CLAUDE.md | Vektor-9

Vektor-9 is a passion project: a cyberpunk city simulation that advances every 5 minutes on AWS (serverless), rendered in the browser as a 3D bird's-eye city with Three.js in a bright daylight anime style. Python simulation and Lambdas, AWS CDK in Python, static HTML/CSS/JS with vendored Three.js. Full plan: `PROJECT_PLAN.md`. Visual source of truth: `docs/STYLE_GUIDE.md`.

## Start of every session

1. Read `docs/handoffs/CURRENT.md`.
2. Check `git status --short --branch` and the last few commits. If notes and repo disagree, say so.
3. State the current milestone and the single next task in 2–3 sentences.
4. For any visual work, read `docs/STYLE_GUIDE.md` first.

## Repo layout

- `sim/`: pure simulation package. **No AWS, network, or rendering code here, ever.**
- `lambdas/`: tick and mark handlers (thin wrappers around `sim/`).
- `web/`: static site. `web/vendor/` holds the pinned Three.js; `web/src/palette.js` holds every color.
- `infra/`: CDK app. All AWS resources are defined here.
- `tests/`: pytest + Hypothesis.
- `docs/adr/`: architecture decisions. `docs/STYLE_GUIDE.md`: visual decisions.

## Commands

<!-- Fill in during M0a and keep accurate. -->
- Install: `uv sync`
- Run the simulation locally (N ticks → snapshots): `uv run python -m sim --ticks 288 --seed 7 --out snapshots`
- Serve the site locally: not yet (M0c)
- Tests: `uv run pytest`
- Lint/format: `uv run ruff check .` and `uv run ruff format .` (CI runs `ruff format --check .`)
- CDK synth / diff: not yet

## Rules

- `step(state, marks, rng)` stays pure and deterministic: no `datetime.now()`, no unseeded randomness, no I/O.
- The snapshot JSON (see ADR-0003 once written) is the contract between sim and renderer. Schema changes need a branch, a version bump, and tests.
- The renderer draws only what the snapshot says. Ambient life (people, cars, steam, crane motion) is browser-only, never stored, and must stay consistent with the snapshot (ADR-0002).
- All colors come from `web/src/palette.js`, which mirrors the style guide. No hard-coded colors elsewhere.
- Visitor input is never free text. Marks are enums plus coordinates, validated server-side; each mark has an ID and is applied at most once.
- All AWS resources go through CDK. Lambdas are not placed in a VPC. Every log group gets a retention period. No EC2, RDS, load balancers, or NAT gateways without an ADR.
- No flashing above 3 times per second; respect `prefers-reduced-motion`; never use color alone to carry meaning.
- No names, logos, characters, designs, or screenshots from existing shows, games, or films. Invented names only.
- Never claim a test, deploy, or measurement happened unless you ran it and saw the result.
- Never commit, push, deploy, or run `cdk deploy` without my explicit go-ahead in this session.
- Never write secrets, account IDs, or personal data into files.

## Workflow

- Design, styling, copy: small commits to `main` are fine. Update the style guide when a visual decision changes.
- Simulation rules, snapshot schema, infra, IAM, API: branch + PR, with tests and a short note on what could break, be abused, or cost money. Run `/ship` before proposing the PR.
- New architecture decision → add an ADR.
- At checkpoints or when context runs low: `/handoff`. New session: `/pickup`. Protocol: `docs/process/SESSION_HANDOFF.md`.
