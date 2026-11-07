# ADR-0007: One corporate headquarters drawn over a block of twelve tiles

**Status:** Accepted (2026-11-07; revised the same day from one tower on four tiles to two towers on twelve)

## Context
The city needed one building that reads as the seat of power: far bigger than any tower, with a grand entrance people use, its own air traffic and a signature visible across the city. Every tile is one building at most 12.5 m across, and the snapshot has no notion of a building spanning tiles. A single tower on four tiles (28 m) stayed too narrow however it was shaped.

## Decision
- The renderer picks a site from the snapshot each time it draws (`web/src/headquarters.js` hqSite): on one of a sector's four sides, the 4 x 3 block of tiles that straddles the sector's middle service alley (two tiles either side of it, three deep from the main street), if all twelve are houses, outside the old town and off the tower's plaza and the busiest crossing; the one nearest the centre, then with the most floors. Its twelve buildings are not drawn; the headquarters stands in their place, 61 x 42 m: two monoliths of 21 x 31.5 m and 150 m either side of the alley, which becomes the gap between them, behind one plaza.
- The towers, the plaza and the skybridge are modelled in Blender from a script (`tools/blender/headquarters.py`, ADR-0005) as modules the renderer stacks: each tower's base (its gateway), two shaft segments (one with a landing terrace), the link level (the skybridge's portal and corridor), a hangar level (two vehicle bays), the roof; left and right versions mirrored so their inner faces meet the gap. Windows use the facade shader (corporate blue), only in the glass; everything else is palette materials, nearly all near-black armour, crimson light embedded in it.
- The eye floating in the gap (`web/src/eye.js`) is additive light in one shader with a time-driven, deterministic gaze; the hovercars (`web/src/aircars.js`) fly fixed corridors with a small state machine. Both are ambient and browser-only (ADR-0002).
- People (`web/src/people.js`) use the doors, the bridge (elevated walkers with a floor of their own), the terraces and the hangars.
- Nothing else lands on its tiles: no skybridges, billboards, corporate signs or retrofits. The hangar aprons reach 2 m past the site at 94 m, above its neighbours (84 m at most at the current site).

## Alternatives considered
- **A sim building type spanning tiles:** the honest model, but it needs a schema change, sim rules and tests for something the simulation does not need to know.
- **One tower on four tiles:** built first; too narrow to read as the city's power, however its crown was shaped.

## Consequences
- The renderer draws one complex where the snapshot has twelve buildings. If the snapshot changes so the block no longer qualifies, the headquarters moves to the next best block (or disappears) on the next load.
- The hangar corridors assume the neighbours stay below the bays; a much taller neighbour would need the bays raised.
- Rolling back: hqSite returning null brings the twelve buildings back.
