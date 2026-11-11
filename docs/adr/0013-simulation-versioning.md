# ADR-0013: Simulation versioning and replay

**Status:** Accepted (2026-11-11)

## Context
The city is meant to run unattended for a long time, and any published tick should be reproducible from the tick before it (ADR-0003). Two things can change underneath a snapshot:

- **the format** (keys, kinds, meaning), which ADR-0003 already versions as `schema`;
- **the rules**: the constants in `sim/rules.py`, the logic in `step()` and `new_city()`, and the order of random draws. ADR-0003 allows tuning rules without a schema change, so until now nothing said which rules produced a snapshot. After a tuning change, replaying old history with new code would quietly give a different city.

The rules also depend on the Python interpreter, through its `random` module (see below).

## Decision

### The version in the snapshot
- `SIM_VERSION` in `sim/rules.py` numbers the simulation rules, starting at 1.
- Schema 5 adds a top-level `"sim"` to every snapshot: the `SIM_VERSION` of the code that produced it. `new_city()` and `step()` set it.
- Two questions are kept apart:
  - **Is the snapshot well formed?** `validate()` checks the format only. Any positive `sim` is valid, so a historical snapshot made by other rules, older or newer, still validates and can be stored, drawn and inspected.
  - **May this code advance it?** `resume_error()` in `sim/step.py`, which `step()` calls first and turns into a `ValueError`. It refuses a snapshot in another schema (such as the schema-4 files in `snapshots/`) and one made by newer rules than the running code. A snapshot from older rules may be continued: that is how a rules change takes effect, and the next tick records the new version, so the switch is visible in the history rather than silent.
  - Replaying a historical tick therefore needs the code of that tick's version; current code refuses anything newer than itself.
- `schema` and `sim` are independent. A rules change bumps `sim` and leaves the format alone; a format change bumps `schema`. Neither implies the other.

### When to bump `SIM_VERSION`
Bump it when `new_city()` or `step()` can produce a different result for any input:

| Change | `SIM_VERSION` | `SCHEMA` |
| --- | --- | --- |
| Refactor with identical results | same | same |
| A constant in `sim/rules.py`, a rule, or the number or order of random draws | +1 | same |
| A Python version upgrade for the code that runs the city | +1, unless the golden-output test passes unchanged on the new version | same |
| A new key, kind or meaning in the snapshot | +1 if results change too | +1 |

### Golden outputs
`tests/test_golden.py` runs fixed cases and compares SHA-256 digests of each snapshot field (`seed`, `tick`, `size`, `tiles`, `power`, `events`, `mark_ids`) at fixed ticks against `tests/golden/sim-v{SIM_VERSION}.json`. `schema` and `sim` themselves are left out, so a format change that keeps the city the same does not disturb the file.

- **Cases:** seeds 7, 3 and 11 for one city day (ticks 0, 1, 12, 96 and 288); seed 5 for 24 ticks with visitor marks (new, repeated and malformed); a dense random city (seed 2) for 48 ticks, which reaches decline, redevelopment, overcrowding and collapse; seed 9 with an isolated extra market, which closes. Together they produce every event kind, and a test checks that.
- **Sensitivity:** tests change one constant at a time (the starting city, growth, construction, redevelopment) and check that the digests move.
- **Recording:** `uv run python -m tests.test_golden --write` writes the file for the current `SIM_VERSION` and refuses to overwrite an existing one: the outputs of a released version never change.

A change that fails the golden test is either an accident (fix it) or intended (bump `SIM_VERSION`, record the new file, keep the old one).

### Python's random numbers: what holds and what does not
The simulation seeds `random.Random` with an integer (`new_city`) and with strings (`"{seed}:{tick}"` for each tick, and `"{seed}:terrain"`, `"{seed}:blackouts:{day}"`, `"{seed}:wave:{sector}"`). It draws with `random()`, `randint()`, `randrange()`, `choice()` and `sample()`.

Python's documentation on reproducibility promises two things only: a backward-compatible seeder is always offered when seeding changes, and `random()` returns the same sequence for the same seed. Everything built on top of it, `randint`, `randrange`, `choice` and `sample` included, may change between Python versions.

| | Guaranteed? |
| --- | --- |
| Same code, same Python minor version, any machine or OS | Yes in practice: the simulation uses integers, the same generator and no hash-ordered iteration that affects results (the one set it iterates, the starting markets, is only tested with `any()`). Checked by the golden test and the replay tests. |
| Seeding with integers and strings | Yes, by Python's backward-compatible seeding promise. |
| `random()` across Python versions | Yes, by Python's promise. |
| `randint`, `randrange`, `choice`, `sample` across Python versions | **No.** Not promised; a new version may change how they turn the generator's bits into results. |
| Another Python implementation (PyPy and others) | Not promised and not tested. |

So the Python minor version is part of what a `SIM_VERSION` means. `.python-version` pins 3.13, the golden file records the version it was recorded on, and a failure message names both versions. Moving the city to a new Python version means running the golden test there first.

### Replay of historical ticks
- Replaying tick `n` needs tick `n−1`, the marks applied at `n`, and code of version `n.sim` running on the recorded Python minor version.
- A Git commit alone does not guarantee that old code can still be run: history can be rewritten, and a commit does not say which interpreter produced the output. When the city is deployed, each released simulation package is therefore stored as an artifact (the code itself, its hash and its Python version), kept for as long as the history it produced. The storage and the replay tool are part of the deployment work, not of this ADR's code change.
- Until visitor marks exist, the whole history is also reproducible from the seed alone with `python -m sim`.

### Renderer compatibility
The renderer accepts a list of schemas (`web/src/main.js`), currently 4 and 5. It does not read `sim`. Schema-4 snapshots, such as the shared local `snapshots/` folder, draw exactly as before.

## Alternatives considered
- **Record the Git commit as storage metadata only.** Cheap, but metadata is lost when a snapshot is copied, and a commit is not a runnable artifact.
- **Derive the version from a hash of `sim/`.** Automatic, but any comment or refactor would look like a rules change, and the number would carry no meaning.
- **Fold the rules version into `schema`.** One number, but every tuning change would break renderers that only care about the format.
- **Golden snapshots stored in full.** Easier to inspect, but several megabytes in the repo; per-field digests are a few kilobytes and still name the field and tick that changed.

## Consequences
- Every snapshot says which rules made it; an unintended rules change fails CI.
- The golden test adds about ten seconds to `uv run pytest` (measured locally).
- Coverage is limited to what the cases reach: one city day from three seeds, plus the marks, dense-city and lone-market cases. Very long-run effects (district waves over several days) are only covered as far as those cases reach them, and through the property tests in `tests/test_sim.py`.
- A Python upgrade is a deliberate step with its own check.
