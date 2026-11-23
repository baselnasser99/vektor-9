# ADR-0018: Power plants built in code

**Status:** Accepted (2026-11-23)

## Context
Since 2026-11-05 every plant tile drew one Blender model, SECTOR 07 (`tools/blender/power_plant.py`, ADR-0005 update). Three things counted against it:

- **No variety.** All 21 plants on seed 7 (v4, tick 4032) were the same building.
- **No blackout.** The model's lights stayed on when the snapshot said a plant was dark.
- **Cost.** About 19,000 triangles a plant (14,703 always drawn, 4,285 detail) and a 1 MB download.

A plant has a fixed 12 m lot (the snapshot gives it no floors), so nothing about its size needs the snapshot, and nothing about its shapes needs Blender: a hyperboloid tower is one lathe, the rest is boxes and cylinders.

## Decision
- `web/src/plant.js` builds every plant in code from the kit's materials (`palette.js` colours, no new ones). Each tile picks one of three layouts, mirrored or not: a single cooling tower with a stack, twin towers behind a long hall, or a reactor drum with two stacks. Each has a turbine hall, a transformer yard and a low back wall. The style guide's power plant section describes them.
- The plant uses its own generator, seeded from the tile (`rng(t.s * 19 + 11)`, `plantOn`), so the tile's placement draws in `buildCity` stay as they were. Same snapshot, same plants.
- When the tile is dark (`on` false) every glow, sign and red lamp is swapped for unlit steel.
- The operator's name over each gate comes from `OPERATORS` in `world.js`: KALDRA GRID, TORVEK POWER, NOVRIN ENERGY, ULMARA GRID. All invented.
- The glTF (`web/assets/models/power_plant`) is removed. `tools/blender/power_plant.py` stays, marked as retired, for reference.
- No sim or snapshot change.

## Alternatives considered
- **Keep the model, add variants in Blender:** each variant is another 1 MB file and another 19,000-triangle mesh, and blackout still needs a second set of materials.
- **Keep the model, swap its light materials in a blackout:** fixes one of the three problems.

## Consequences
- Plants are 1,200 to 1,500 always-drawn triangles plus 550 to 1,050 detail. On v4 seed 7 the whole city drops from 3,290,721 to 2,938,849 triangles (about 352,000 fewer); on v3 seed 3, which has one plant, by 16,724.
- Frames got faster at view 01 and at the new plant view 34 (numbers in the PR). Draw calls rose by 6 to 9: the plants use a few more materials than the model's roles did.
- The first visit downloads about 1 MB less uncompressed, 0.2 MB gzip.
- The plants' look is now reviewed in code and in the browser, not in Blender renders.
- `tests/js/plant.test.mjs` checks determinism, that all three layouts appear on the frozen v4 seed-7 fixture, and blackout; `mesh_geometry.test.mjs` checks every layout and mirror, lit and dark.
