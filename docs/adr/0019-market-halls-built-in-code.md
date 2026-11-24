# ADR-0019: Market halls built in code

**Status:** Accepted (2026-11-24)

## Context
Since ADR-0005 every market tile drew one Blender model, KUROTECH (`tools/blender/market_hall.py`), scaled to the tile's footprint. It had the same three problems ADR-0018 found with the power plant:

- **No variety.** All 66 markets on seed 7 (v4, tick 4032) were the same building with a different word on it.
- **No blackout.** The model's lights stayed on when the snapshot said a market was dark.
- **Cost.** About 6,000 triangles a hall (3,791 always drawn, 2,247 detail) and a 403 KB download.

A market's footprint is 9 to 11 m (`city.js`), and its shapes are boxes, a half cylinder and extruded triangles, so nothing about it needs Blender.

## Decision
- `web/src/market.js` builds every hall in code from the kit's materials (`palette.js` colours, no new ones), on the footprint `city.js` gives it. The style guide's "Market halls" section describes the look.
- Variants: a barrel or sawtooth roof; an open colonnade along the front, and on some halls along one end; stalls or shutters bay by bay; the wall finish, two awning colours, the hall number and where the ridge sign stands.
- The tile's own generator still gives the hall exactly one draw (the shop's name from `SHOPS`), as the model did, so the tile's later placement draws are unchanged. Every variant comes from the hall's own generator, `rng(t.s * 23 + 17)`. Same snapshot, same halls.
- When the tile is dark (`on` false) every lamp, sign and lit opening goes dark.
- The glTF (`web/assets/models/market_hall`) and its licence line are removed. `tools/blender/market_hall.py` stays, marked as retired, for reference.
- No sim or snapshot change.

## The Blender pipeline
The pipeline still works headless: `blender -b --factory-startup --python` on `market_hall.py`, with its export pointed outside the repo, rebuilt the model in about 10 s with a `.bin` byte-identical to the committed one (2026-11-24). It ran on Blender 5.4.0 Alpha, which is not on PATH here. Before any new kit piece is made in Blender, a stable LTS build must replace the alpha, and the scripts must be checked against it.

## Alternatives considered
- **Keep the model, add variants in Blender:** each variant is another download and another 6,000-triangle mesh, and blackout still needs a second set of materials.
- **Keep the model, swap its light materials in a blackout:** fixes one of the three problems.

## Consequences
- Halls are 478 to 846 always-drawn triangles plus 420 to 684 detail. On v4 seed 7 the whole city drops from 3,337,357 to 3,016,017 triangles; on v3 seed 3 by 43,188 and on v3 seed 7 by 58,496.
- Frames got faster at view 01 and at the new hall view 35 (numbers in the PR). Draw calls rose by 9 to 11: the halls use more materials than the model's roles did.
- The first visit downloads about 0.4 MB less uncompressed (19.1 to 18.7 MB), 0.07 MB gzip.
- `tests/js/market.test.mjs` checks determinism, the single tile draw, that every roof and open side appears on the frozen v4 seed-7 fixture, and blackout; `mesh_geometry.test.mjs` checks every variant, lit and dark.
