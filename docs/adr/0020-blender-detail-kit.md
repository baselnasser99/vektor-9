# ADR-0020: A Blender detail kit for plants and halls

**Status:** Accepted (2026-11-25)

## Context
ADR-0018 and ADR-0019 moved power plants and market halls from single Blender models into code, for variety, blackouts and cost. The code-built versions read well as masses but their small machinery was boxes: a transformer was one box with three fins a side, a cooling tower stood on six lintel blocks, a stack's ladder was a flat bar, a stall was a counter box under a tilted slab. Those parts repeat many times across the city (on v4 seed 7, tick 4032: 21 plants, 66 halls), which suits a few well-made shared meshes better than more boxes per building.

ADR-0019 asked for a stable Blender LTS build before any new kit piece; Blender 5.2.5 LTS is now installed.

## Decision
- Six parts are made in Blender, one script each: `tools/blender/detail_stall.py`, `detail_shutter.py`, `detail_transformer.py`, `detail_tower_base.py`, `detail_dock.py`, `detail_stack_head.py`, sharing `tools/blender/detail.py`. They export glTF (`.gltf` + `.bin`) to `web/assets/models/kit-detail/`.
- **Deterministic.** A script run twice gives byte-identical files. `web/assets/models/kit-detail/manifest.json` lists each file's SHA-256 and the Blender build that made it (5.2.5 LTS); the scripts stop on any other build and never write the manifest. `tests/js/kit_manifest.test.mjs` fails when the files and the manifest disagree, so a regeneration updates the manifest on purpose.
- **No colours in the files.** Each glTF material is only a slot name (`frame`, `tank`, `awning`, ...). `plant.js` and `market.js` fill every slot from `palette.js` materials through `kit.model`, which throws on a slot with no material. The same part takes different colours on different buildings (a stall's awning, a shutter's frame).
- **A separate lit slot.** Lamps, indicators and the menu board are in the `lit` slot, which the builder fills with dark steel when the tile is dark, so blackouts keep working.
- **Instanced, inside settled lots.** `parts.js` `kitPart` places a part and marks it `userData.instanced`; `merge.js` draws every mesh sharing a part's geometry and material as one `InstancedMesh` for the whole city instead of merging it. Instances are not warped: they must sit under a rigid group (a lot settled by `city.js`), which `mergeByMaterial` asserts. Parts are drawn at every distance (no detail group).
- The code-built stand-ins they replace are removed: the transformer boxes, fins and insulators, the towers' leg lintels (the shell now stands on the leg ring), the stack ladders' upper part, the gate panel and lintel, the stall counters, goods, awnings and lamps, the shutter panels and the loading bay.
- Each building's variety is unchanged: parts are placed with the draws the builders already made.
- No sim or snapshot change.

## Alternatives considered
- **More code-built boxes:** each extra fin or rung is more merged triangles in every building and more code; bevels and lathes are awkward in code.
- **Whole buildings back in Blender:** gives up the variety and blackouts ADR-0018 and ADR-0019 won.
- **Colours baked into the glTF:** a second copy per colourway, and lit parts that cannot go dark.

## Consequences
- About 175,000 kit triangles across v4 seed 7, in 27 instanced meshes; 188,684 bytes of files. Draw calls rise by 14 to 20 at views 01, 34 and 35, frame time by about 1 ms; city triangles on v4 seed 7 by about 146,000 net, the first visit by about 191 KB (39 KB gzip). Numbers in the PR.
- The geometry checks cover every kit part as exported (`mesh_geometry.test.mjs`); the plant and market tests build with the real parts, so blackout checks include their lit slots.
- An instanced part with a negative scale would show its back faces; `kitPart` documents that parts are never mirrored.
- Changing a part means editing its script, running it in Blender 5.2.5 LTS and updating the manifest.

## Amendment (2026-11-26): the court's security kiosk
Renderer only; no sim, snapshot or lane change (`tests/fixtures/lane-moves-seed7.json` unchanged).
- **A seventh part,** `tools/blender/detail_kiosk.py` (`kit-detail/kiosk`, 1,110 triangles): a glazed booth with a canopy and a sign board, under the same rules (byte-identical reruns, the manifest, slot names only). `tiles.js` `securityKiosk` places it on the headquarters' court tiles that drew a kiosk before (the same first draw), replacing the code-built box there. The plaza kiosks keep the code-built box.
- **Removable slots.** The part carries a door on each side (`door_l`, `door_r`) and a barrier arm (`boom`, `stripe`). The builder removes one door, and the arm unless the kiosk stands on the avenue kerb, from the instance's own copy before merging. What remains of each slot is still instanced across the city.
- **Two lit slots.** `lit` (the service slot and the canopy downlight) and `lamp` (the ceiling light and the monitor, softer) both go to dark steel in a blackout, as does the glass's warm emissive cast (`kit.veil` takes an optional glow colour and intensity).
- **Each sign text and canopy colour is its own material,** so its own instanced draw call: the court's five kiosks on v4 seed 7 add about 15 draw calls. Six post names and four canopy colours would cost up to 24 calls on their own on a plaza rollout (278 kiosks on v4 seed 7, 978 on v3 seed 3), plus the lit and dark variants. **A rollout to the plaza kiosks must first put the sign texts in one shared atlas** (one sign material, each instance's word picked by UV offset or an instance attribute), and should keep the canopy colours to the few already used.
