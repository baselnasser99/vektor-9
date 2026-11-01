# ADR-0003: Snapshot schema v1

**Status:** Accepted (2026-11-02)

## Context
The snapshot JSON is the contract between the simulation, storage (S3), and the renderer. It must be replayable on its own (determinism), small (target well under 100 KB gzipped for 48 × 48), easy to read in a browser without a build step, and versioned so the renderer can refuse what it doesn't understand.

## Decision
The simulation state **is** the snapshot: `step()` takes and returns the same plain dict that is written to JSON. There is no separate model layer.

```json
{
  "schema": 1,
  "tick": 288,
  "seed": 7,
  "size": 48,
  "tiles": [{"k": "house", "f": 9, "t": 9, "p": 74, "on": true, "s": 1834402211}, "... 2304 total"],
  "power": {"capacity": 16000, "demand": 15031, "supplied": 10988},
  "events": [{"kind": "blackout", "sector": 14, "x": 21, "y": 13}],
  "mark_ids": ["..."]
}
```

- **tiles:** row-major, index `y * size + x`. Every tile has exactly these keys:
  - `k`: `lot` | `build` | `house` | `market` | `plant`
  - `f`: floors (built so far for `build`, current for `house`; 0 otherwise)
  - `t`: target floors (`build`, `house`; 0 otherwise); `f <= t` always
  - `p`: residents (houses only; 0 otherwise)
  - `on`: powered this tick
  - `s`: style seed in `[0, 2^31)`; the renderer derives facade, silhouette, and rooftop props from it. It changes only when the tile becomes a new building.
- **Streets are not tiles.** The grid is split into 8 × 8 blocks; the renderer draws streets between blocks. Block number is the **sector** (1–36, row-major), used in event text.
- **power:** totals for the tick; `supplied <= min(capacity, demand)`.
- **events:** what happened during this tick only. Kinds: `commissioned`, `topped_out`, `collapse`, `market_opened`, `market_closed`, `blackout`, `power_restored`. Display text is the renderer's job.
- **mark_ids:** IDs of visitor marks already handled (most recent 5000), so a mark delivered twice is applied once.
- **Randomness:** tick `n` uses `random.Random(f"{seed}:{n}")`, so any tick can be replayed from the previous snapshot alone.
- **Validation:** `sim.state.validate(state)` returns the list of violations. Tests run it on every tick; the tick Lambda will run it before writing.

## Alternatives considered
- **Columnar arrays** (one array per field): about half the raw size, but harder to read and debug; gzip closes most of the gap.
- **JSON Schema file + `jsonschema` library:** reusable from JS, but one more dependency and still needs Python checks for cross-field rules like `f <= t`.
- **Streets as a sixth tile type:** more realistic layouts, but breaks the five-type v1 and adds rules about what may border a street.

## Consequences
- Measured: a day-288 snapshot for seed 7 is ~131 KB raw, ~20 KB gzipped.
- Any change to keys, kinds, or meaning bumps `schema`, needs a branch, and updates `validate()` and its tests.
- Rule constants (`sim/rules.py`) can be tuned without a schema change.
