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

## Update (2026-11-06): rooftop reactors and spires
- Rooftop energy reactors (mid-size in two designs, industrial and landmark in one each) and two communication spires are Blender models (`tools/blender/rooftop_tech.py`), placed by `web/src/rooftech.js` on about 30% of towers of 8+ floors and on the signature towers. They are designed for a 10 m roof and scaled to each roof (a reactor's housing to about 60% of its shorter side), so they still fit buildings whose size comes from the snapshot. The parts that tie a reactor into its building (containment crown, buttresses, corner ribs, conduits down the facade) depend on the roof's size, so they are built in code from boxes in the same materials.
- Every part maps onto the same few materials (dark steels, one animated core material per kind, one seam glow, the city's red warning light), so they add almost no draw calls. Each model is 450 to 1,250 always-drawn triangles.
- Measured on the local snapshot at the opening view, same pane size: 8.1M triangles per frame from 7.6M (shadows draw each one twice), 943 draw calls from 940, frame time 46.4 ms against 44.1 ms. A first pass with more, smaller reactors (on about 45% of towers) cost about the same; building the city took about 50 ms longer then. About 0.5 MB more to download.
- Profiled afterwards on the same view (774 x 690, alternating configurations, medians): at full resolution (1.25 pixels per CSS pixel) a frame takes about 50 ms, half resolution about 31 ms, so the frame is bound by shading pixels, not by triangles, draw calls (the CPU submits a frame in about 5 ms) or memory bandwidth (MSAA 0, 2 or 4 samples cost the same). The reactors are a negligible share. The reflection environment (`scene.environment`, used by every lit material) costs about 3.5 ms in all (a first, noisier reading said 7). Keeping it only on facades, glass, the wet street and smooth or metallic materials saves about 2.4 ms (38.6 to 36.2 ms, five alternating rounds) but leaves the frame about 3.5% darker: rough concrete and steel lose the map's red-tinted, directional fill, and a stronger hemisphere fill brings the brightness back without the tint (the image moves further from the original). A 64 px map instead of 256 px saves nothing. So the environment stays as it is for now. The facade shader now skips tracing the fake room behind dark panes (most of them; no visible change).
