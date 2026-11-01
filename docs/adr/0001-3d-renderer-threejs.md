# ADR-0001: 3D bird's-eye renderer with Three.js

**Status:** Accepted (2026-11-02)

## Context
The city should be explorable in 3D from above, look like a stylized anime city, run in any modern browser, and be hosted as static files on S3 + CloudFront. The developer's frontend experience is HTML/CSS/JS without frameworks.

## Decision
Use Three.js, vendored into the repo at a pinned version and loaded as ES modules through an import map. No bundler or UI framework. Canvas/WebGL rendering with toon materials and post-processing as described in `docs/STYLE_GUIDE.md`.

## Alternatives considered
- **2D Canvas (top-down or skyline):** simplest, but loses the bird's-eye 3D look that motivates the project.
- **Babylon.js / PlayCanvas:** capable, but heavier and less common in tutorials and examples.
- **Game engine export (Unity/Godot web):** large downloads, harder to host and inspect, overkill.
- **React Three Fiber:** good ergonomics, but adds React and a build step.

## Consequences
- One new library to learn; examples and community help are plentiful.
- Vendoring avoids runtime dependence on third-party CDNs and keeps the site fully static.
- Performance work (instancing, LOD, atlases) is our responsibility.
