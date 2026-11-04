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
