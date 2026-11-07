# ADR-0007: One corporate headquarters drawn over a block of 24 tiles

**Status:** Accepted (2026-11-07; revised the same day from one tower on four tiles to two towers on twelve, then to a 24-tile campus)

## Context
The city needed one building that reads as the seat of power: far bigger than any tower, with a grand entrance people use, its own air traffic and a signature visible across the city. Every tile is one building at most 12.5 m across, and the snapshot has no notion of a building spanning tiles. A single tower on four tiles (28 m) stayed too narrow however it was shaped.

## Decision
- The renderer picks a site from the snapshot each time it draws (`web/src/headquarters.js` hqSite): on one of a sector's four sides, the 6 x 4 block of tiles that straddles the sector's middle service alley (three tiles either side of it, four deep from the main street to the cross alley), if every one is a house, an empty lot or a building site (never a market, plant, park, rail or works), outside the old town and off the tower's plaza and the busiest crossing; the one nearest the centre, then with the most floors. Its buildings are not drawn; the headquarters stands in their place, 89 x 56 m: two monoliths of 30 x 36 m and 150 m either side of the alley, which becomes the 18 m gap between them, behind a 18 m deep forecourt with raised entrance terraces and a drop-off.
- The towers, the plaza and the skybridge are modelled in Blender from a script (`tools/blender/headquarters.py`, ADR-0005) as modules the renderer stacks: each tower's base (its gateway), two shaft segments (one with a landing terrace), the link level (the skybridge's portal and corridor), a hangar level (two vehicle bays), the roof; left and right versions mirrored so their inner faces meet the gap. Windows use the facade shader (corporate blue), only in the glass; everything else is palette materials, nearly all near-black armour, crimson light embedded in it.
- The eye floating in the gap (`web/src/eye.js`) is additive light in one shader with a time-driven, deterministic gaze; the hovercars (`web/src/aircars.js`) fly fixed corridors with a small state machine. Both are ambient and browser-only (ADR-0002).
- People (`web/src/people.js`) use the doors, the bridge (elevated walkers with a floor of their own), the terraces and the hangars.
- Nothing else lands on its tiles: no skybridges, billboards, corporate signs or retrofits. The security tower's hangar aprons reach 2 m past the site at 94 m, above its neighbours.

## Alternatives considered
- **A sim building type spanning tiles:** the honest model, but it needs a schema change, sim rules and tests for something the simulation does not need to know.
- **One tower on four tiles:** built first; too narrow to read as the city's power, however its crown was shaped.
- **Two towers on 4 x 3 tiles (61 x 42 m):** built second; each tower could be only 21 m wide and the forecourt 10 m deep, so the towers read as slabs and the base had no presence. No 4 x 3 block near the centre grows to 6 x 4 without covering a market or the power plant, so the campus moved one ring out (about 140 m from the centre at seed 7).

## Consequences
- The renderer draws one complex where the snapshot has twelve buildings. If the snapshot changes so the block no longer qualifies, the headquarters moves to the next best block (or disappears) on the next load.
- The hangar corridors assume the neighbours stay below the bays; a much taller neighbour would need the bays raised.
- With no qualifying 6 x 4 block (another seed, a later snapshot) there is no headquarters; the 24 buildings stay.
- Rolling back: hqSite returning null brings the buildings back.
