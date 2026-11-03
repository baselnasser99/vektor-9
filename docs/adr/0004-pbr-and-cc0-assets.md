# ADR-0004: Realistic materials and CC0 assets

**Status:** Accepted (2026-11-03)

## Context
Plain and procedurally textured boxes looked artificial. The goal is now a dense, detailed, weathered cyberpunk city: buildings with real shape (cages, trusses, pipes, glass, signs) and realistic surfaces. The site stays static and self-hosted (ADR-0001).

## Decision
- Use physically based materials with CC0 texture sets and a few CC0 glTF models from Poly Haven, vendored in `web/assets/` (list and licence in `web/assets/LICENSE.md`).
- Build buildings from a code kit (`web/src/kit.js`): primitives and parts assembled per building, using those materials. Downloaded models are props, not whole buildings. Concrete is drawn in code instead, because the downloaded concrete sets tiled visibly.
- Post-processing: bloom for emissive parts, then tone mapping in an output pass. Vendored from the same Three.js release (r170).
- Replaces the cel-shaded, anime look in the style guide.

## Alternatives considered
- **Procedural canvas textures only:** no downloads, but stayed flat and artificial.
- **Keep cel shading, add shape detail:** cheaper, but not the look wanted.
- **Hand-modelled buildings in Blender:** best quality, far more time.

## Consequences
- About 25 MB of assets at 1k. Before going public they should be downsized and compressed (e.g. 512 px, KTX2) to keep page weight reasonable.
- Each detailed building is dozens of meshes, so the city builds lighter variants and merges every part that shares a material into one mesh at load. Measured 2026-11-03 on the dev machine with `?bench`, seed 7 day 14: 284 draw calls, about 9.1 M triangles per frame including the shadow pass, 3.0 ms per frame. After the optimization pass (thin parts as plain boxes, fewer segments on lamps and rings, no detailed CC0 props in city plants), with the desert, traffic and mist: 410 draw calls and about 5.8 M triangles on the bench frame (down from 11.9 M), 3.8 to 4.1 ms per frame on the dev machine, where triangles were not the bottleneck; weaker GPUs are not measured yet. Shadows are drawn once, not every frame. Merging per grid cell for culling was tried and dropped: it raised draw calls to about 2,900 and cost more than it saved. Simpler buildings in the distance (level of detail) are still the next step for phones.
- Every asset must be CC0 or similarly permissive, and listed in `web/assets/LICENSE.md`.
