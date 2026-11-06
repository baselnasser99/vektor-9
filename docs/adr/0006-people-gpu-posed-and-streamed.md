# ADR-0006: People drawn as modular figures, posed on the GPU and streamed by sector

**Status:** Accepted (2026-11-07)

## Context
The streets need people (ADR-0002: ambient, browser-only), enough to feel inhabited at street level and from low aerial views, in a city that already costs most of the frame. Animating thousands of characters on the CPU, or one skinned glTF per person, would cost too many draw calls and too much per-frame work.

## Decision
- **Figures in code** (`web/src/figures.js`): a shared body plus one top, one head and a few extras, each a module of tapered boxes and short tubes. Every vertex carries its bone and colour slot. Each module is one instanced draw per level of detail (three levels), so the crowd is a few dozen draws however many people are out.
- **Posed on the GPU:** the vertex shader bends the limbs (walk, fast walk, turning on the spot, idle weight shift, phone, talking, looking round and up, sitting) from a handful of numbers per person in one float texture, rewritten each frame. The CPU only moves people and smooths their states.
- **Navigation from the street layout** (`web/src/people.js`): sector corners are nodes, sidewalks and zebra crossings are links (only where cars have lights, or on pedestrian walks), with a plaza walk round the roundabout. Routes come from shortest paths worked out once. People cross on the walk phase of the cars' own light cycle (`life.js walkLight`), and cars now stop short of the zebra.
- **Streaming:** sectors near the camera are live, with a margin and hysteresis so they switch out of sight; each sector has a seeded list of people and a prefix of it is live (density x district factor, within a global budget, nearest first). People are culled to the view one by one, step less often far away, and fade in and out by size beyond the crowd's distance.

## Alternatives considered
- **Skinned glTF characters from Blender:** better close-ups, but a skeleton per person and many more draws; the city is never seen closer than a few metres.
- **CPU-animated limbs (a matrix per limb per person):** simple, but around a dozen matrices per person per frame, uploaded every frame.
- **Billboards/impostors:** cheapest far away, but wrong at street level; the far level of detail is already a few hundred vertices.

## Consequences
- People do not cast shadows (the shadow pass would need the posing shader too).
- Who stands where depends only on the seed and the snapshot; walkers' positions after a sector comes back into range are new (it happens out of sight).
- The traffic change (stop lines moved back about 3.6 m) is visible: queues start a car length further back.
