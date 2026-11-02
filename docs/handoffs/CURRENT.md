# Current handoff | Vektor-9

Updated: 2026-11-03
Milestone: M0b, simulation (done, including the growth update). Next: M0c, 3D renderer
Branch: `sim-growth` @ `1dbf5d2` (verified); merged into `origin/main` as `6e76187`. Local `main` is 2 behind; run `git switch main` and `git pull`.
Working tree: clean apart from this note

## Done (verified)
- M0b sim v1 and snapshot schema (ADR-0003), merged as PR #1.
- `docs/IDEAS.md` backlog started (flying cars, news-inspired billboards, and more).
- PR #2, city growth, merged:
  - The city starts as a small core and spreads outward as new plants open.
  - Blackouts are scheduled: 3 a day, 30 minutes each, at least 2 hours apart.
  - Each sector cycles through booms and declines (district waves).
  - Busy districts redevelop taller buildings.
  - Snapshot schema moved to version 2 (new `plant_opened` event).

## Not done
- No branch protection on `main`, and no `.gitattributes` (local `core.autocrlf=true`).
- The local scratch tuner (`scratch/`, git-excluded) still runs the old rules. It can be dropped.

## Checks
- Tests: `uv run pytest` → 17 passed (local, before the push).
- Lint: `ruff check` and `ruff format --check` clean.
- CI on PR #2: lint-and-test passed.
- CDK synth: n/a. Deployed: no.

## Decisions
- Blackouts are scheduled rather than caused by overload. An overloaded plant keeps the lights on and only stops growth, which ended the every-tick flicker.
- Tuning (seed 7): about 80% of the map is built by day 14–15, and the tallest tower is about 35–40 floors by day 30. Fine-tune by eye in M0c.
- Blackout times and district waves are derived from the seed and tick, so nothing new is stored.
- Earlier tuning attempt: the user rejected the 2D pixel tuner and wants to see the city in 3D bird's-eye before tuning.
- The M1 tick Lambda must call `validate()` on the loaded state before stepping.
- PR descriptions should be plain readable language.

## Next
1. M0c: read `docs/STYLE_GUIDE.md`, then render one still 3D bird's-eye frame from a snapshot (vendored Three.js, colors from `web/src/palette.js`) and show it to the user before building the full viewer.
