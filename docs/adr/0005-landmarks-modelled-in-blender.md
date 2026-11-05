# ADR-0005: Landmarks modelled in Blender, from a script

**Status:** Accepted (2026-11-04)

## Context
The telecom tower is the city's defining landmark. Built from code primitives (ADR-0004) it stayed simple: the shapes it needs (lofted legs, faceted armour, revolved crown floors, dished antennas) are slow to write and check in three.js. It also outgrew its spot: a believable base for a 260 m tower needs about 45 m of ground, and the roundabout island was 16 m across.

## Decision
- Landmarks may be modelled in Blender, by a Python script kept in the repo (`tools/blender/telecom_tower.py`), and loaded as glTF from `web/assets/models/<name>/`. The script is the source; the exported files are regenerated from it, never edited by hand.
- Meshes are joined per material and named by role ("concrete", "glass", ...). The renderer gives each role a palette material (`web/src/landmarks.js`), so every colour still comes from `palette.js`. Small parts sit under a "detail" node, drawn only near the camera like the rest of the city's detail.
- The script's own colours (preview materials, the review studio and city proxies) are for Blender review renders only and never reach the site.
- UVs are in metres / 4, as in `geometry.js`, so the kit's textures and the facade shader work on the model unchanged.
- The tower stands on a plaza at the central crossing: the sim keeps the 4 x 4 tiles round it as park terrain (`HUB_PLAZA`, mirrored as `HUB` in `world.js`), so nothing is built there and the snapshot schema does not change. The starting power plant moves two tiles off the centre.

## Alternatives considered
- **Keep the tower in code:** no new tooling, but the design brief could not be met at reasonable effort.
- **Hand-model in Blender, commit the .blend:** quicker to sculpt, but binary, unreviewable, and colours would drift from the palette.
- **Put the tower on a corner block, or shrink its base to the old island:** no sim change, but either moves the landmark off the boulevards' meeting point or loses the base.

## Consequences
- About 2 MB more to download (the tower's .bin); the city loaded no models before.
- The sim's starting layout changed (plaza tiles, plant position), so snapshots from before this change differ from new ones for the same seed.
- The renderer skips drawing the plaza tiles and paves them itself; the old-town warp fades out round the plaza so the roundabout stays round.
- Re-exporting is not byte-for-byte repeatable (the exporter's ordering varies), so every export rewrites the .bin in git even without a design change; export only when the design changes.
- A lighter LOD1 variant can be built by the script (`WITH_LOD`), but the renderer does not swap to it yet.

## Update (2026-11-05): the power plant
- The same approach now covers buildings of a fixed size, starting with the power plant (`tools/blender/power_plant.py`, `web/src/plant.js`), which replaces the plant built in code. Buildings whose size comes from the snapshot (floors, footprint) stay in code.
- The scripts share one modelling kit, `tools/blender/kit.py` (parts, preview roles, review studio, export, `stats()`); each model script imports it. Export gives plain node names even when several models share one .blend.
- The renderer loads every model through `kit.model(name, roles)` (`web/src/materials.js`), which fails loudly on a role with no palette material.
- A plant's near-camera detail is merged per sector, so each material in it costs a draw call in every sector with a plant: `plant.js` folds its small metal parts into two common steels and moves its few tiny lights to the always-drawn part. Measured on the local snapshot (25 plants): about 10% more triangles and 91 more draw calls per frame than the code-built plant.
- About 1 MB more to download (the plant's .bin).

## Update (2026-11-05): the market shops
- Market tiles are now one Blender model (`tools/blender/market_hall.py`), scaled to each tile's footprint. Words that vary per tile are not built into the model: it carries blank sign panels ("sign", "blade") with UVs 0..1 that the renderer fills with the tile's invented shop name and mark.
- `kit.foldDetail(g, keep)` (`web/src/materials.js`) is the shared form of the plant's draw-call fix: a model's near-camera lights move to the always-drawn part and its other small parts share one steel.
- Measured on the local snapshot (76 markets), against the build with the plant already in: about 13% more triangles per frame (6.4M from 5.6M; shadows draw each one twice) and 62 more draw calls. The market is the most repeated model, so it was trimmed hardest: flat sign lettering, no bevels on small boxes, fewer tube sides and fins, from about 7k to 3.8k always-drawn triangles. Moving parts to the near-camera group barely changes the default view, where most of the city is near; further savings have to come from cutting.
- About 0.5 MB more to download.
