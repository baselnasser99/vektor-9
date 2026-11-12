# ADR-0003: Snapshot schema

**Status:** Accepted (2026-11-02)

## Context
The snapshot JSON is the contract between the simulation, storage (S3), and the renderer. It must be replayable on its own (determinism), small (target well under 100 KB gzipped for 48 × 48), easy to read in a browser without a build step, and versioned so the renderer can refuse what it doesn't understand.

## Decision
The simulation state **is** the snapshot: `step()` takes and returns the same plain dict that is written to JSON. There is no separate model layer.

```json
{
  "schema": 6,
  "sim": 3,
  "tick": 288,
  "seed": 7,
  "size": 48,
  "plan": {
    "backbone": [{"along": "x", "at": 8, "role": "arterial"}, {"along": "x", "at": 24, "role": "boulevard"}, "... 6 total"],
    "sites": [{"use": "hq", "x0": 24, "y0": 9, "x1": 27, "y1": 14, "face": "-x"}, {"use": "court", "x0": 22, "y0": 9, "x1": 23, "y1": 14}]
  },
  "tiles": [{"k": "house", "f": 9, "t": 9, "p": 74, "on": true, "s": 1834402211, "b": 2016}, "... 2304 total"],
  "power": {"capacity": 16000, "demand": 15031, "supplied": 10988},
  "events": [{"kind": "blackout", "sector": 14, "x": 21, "y": 13}],
  "mark_ids": ["..."]
}
```

- **schema:** this format's version. **sim:** the version of the simulation rules that produced this snapshot (`SIM_VERSION`, ADR-0013); a positive integer. Within the current schema, `validate()` accepts any `sim`; a snapshot in another schema (such as the schema-4 files in `snapshots/`) fails `validate()`. `step()` refuses to advance a snapshot from newer rules or another schema (ADR-0013). The two are independent: a rules change bumps `sim`, a format change bumps `schema`.
- **tiles:** row-major, index `y * size + x`. Every tile has exactly these keys:
  - `k`: `lot` | `build` | `house` | `market` | `plant`, or terrain: `rail` | `park` | `works` | `road` | `site`. Terrain is laid out by `new_city` from the seed (a railway from one edge to a terminus beside the core, a couple of parks, an old industrial site, the land of the highway interchange, and the plan's reserved sites, all clear of the starting core) and never changes; nothing is built on it, and it has `f = t = p = 0`.
  - `f`: floors (built so far for `build`, current for `house`; 0 otherwise)
  - `t`: target floors (`build`, `house`; 0 otherwise); `f <= t` always
  - `p`: residents (houses only; 0 otherwise)
  - `on`: powered this tick
  - `s`: style seed in `[0, 2^31)`; the renderer derives facade, silhouette, and rooftop props from it. It changes only when the tile becomes a new building.
  - `b`: the tick at which the tile took its current form (a construction start, a topping out, a new market, plant or empty lot); 0 for the starting city and terrain. `b <= tick` always. The renderer uses it to tell old districts from new ones.
- **plan:** the static plan (ADR-0015), laid out by `new_city` and copied unchanged by every tick.
  - `backbone`: the corridors with a role. `along` is the axis the corridor runs along (`x`, or `y`, the row axis); `at` is the tile boundary it runs on (rows or columns `at - 1` and `at` face it); `role` is `boulevard` or `arterial`. Widths and classes stay the renderer's (`cityLayout`), which a test checks against these roles.
  - `sites`: land reserved for a landmark, as inclusive tile rectangles `x0..x1`, `y0..y1`. `use` is `hq` (with `face`: `+x`, `-x`, `+y` or `-y`, the side it fronts) or `court`. The `site` tiles are exactly the tiles inside these rectangles; sites are in bounds and never overlap road, rail, works or the starting core.
  - `validate()` checks only this format and its agreement with the tiles. That a stored plan equals the one the current rules would lay out for the seed is a test, never a validation rule, so history made under other rules stays valid.
- **Streets are not tiles.** The grid is split into 8 × 8 blocks; the renderer draws streets between blocks. Block number is the **sector** (1–36, row-major), used in event text.
- **power:** totals for the tick; `supplied <= min(capacity, demand)`.
- **events:** what happened during this tick only. Kinds: `commissioned`, `topped_out`, `collapse`, `market_opened`, `market_closed`, `plant_opened`, `blackout`, `power_restored`. Display text is the renderer's job.
- **mark_ids:** IDs of visitor marks already handled (most recent 5000), so a mark delivered twice is applied once.
- **Randomness:** tick `n` uses `random.Random(f"{seed}:{n}")`, so any tick can be replayed from the previous snapshot alone.
- **Validation:** `sim.state.validate(state)` returns the list of violations. Tests run it on every tick; the tick Lambda will run it before writing.

## Versions
- **1** (2026-11-02): first version.
- **6** (2026-11-12): adds the top-level `plan` and terrain kind `site` (ADR-0015): the headquarters' site and its court, reserved from tick 0, and the backbone corridors' roles. Terrain tiles must have no floors. A fresh genesis: schema-5 snapshots are not migrated and code for schema 6 refuses to advance them; the renderer still draws schemas 4, 5 and 6.
- **5** (2026-11-11): adds the top-level `sim`, the simulation version that produced the snapshot (ADR-0013). Nothing else changes; the renderer draws schemas 4 and 5 the same way.
- **4** (2026-11-09): adds terrain kind `road`, the land of the highway interchange (ADR-0011): four blocks round one crossing on the +x side, on every seed.
- **3** (2026-11-03): adds terrain kinds `rail`, `park`, `works` and the per-tile `b` (built at tick). A sector's built share for decline and redevelopment now counts only its buildable (non-terrain) tiles.
- **2** (2026-11-02): adds the `plant_opened` event kind; `power.supplied` now counts an overloaded plant as supplying its capacity instead of nothing, since overload no longer cuts power. Blackout schedule and district waves are derived from `seed` and `tick`, so no new fields.

## Alternatives considered
- **Columnar arrays** (one array per field): about half the raw size, but harder to read and debug; gzip closes most of the gap.
- **JSON Schema file + `jsonschema` library:** reusable from JS, but one more dependency and still needs Python checks for cross-field rules like `f <= t`.
- **Streets as a sixth tile type:** more realistic layouts, but breaks the five-type v1 and adds rules about what may border a street.

## Consequences
- Measured (schema 3): a day-14 snapshot for seed 7, with the map mostly built, is ~26 KB gzipped (schema 2 was ~20 KB; `b` adds the rest).
- Any change to keys, kinds, or meaning bumps `schema`, needs a branch, and updates `validate()` and its tests.
- Rule constants (`sim/rules.py`) can be tuned without a schema change, but any change to the simulation's results bumps `SIM_VERSION` (ADR-0013); the golden-output test enforces it.
