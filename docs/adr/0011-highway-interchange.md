# ADR-0011: The highway comes into the city through an interchange

**Status:** Accepted (2026-11-09).

## Context
The four highways stopped at the city edge: each climbed straight off the ring road onto a causeway. The city had no grade-separated roads, the multi-level ramps and loops that big cities show from the air. The user asked for one inside the city, not out on the dirt, and chose to reserve land for it in the simulation rather than squeeze a flyover into a street.

Loops need about 50 m across, and the city's blocks are full of buildings the sim tracks. The renderer must not hide simulated buildings (ADR-0002), so the land has to come from the sim.

## Decision
- **Land (sim, schema 4):** a new terrain kind, `road`.
  - `new_city` keeps the four blocks round one crossing as road: the central street along x crossing the outermost main street on the +x side (`interchange()` in `sim/state.py`, `INTERCHANGE_BLOCK` in `sim/rules.py`).
  - That is 64 tiles at the same place on every seed. They are clear of the core, the plaza and every railway the seed can lay.
  - Like all terrain, nothing is ever built on it and it never changes. Parks and the industrial site are laid after it, so they never take it. The renderer never puts the old town over it.
- **Expressway (renderer, `interchange.js`):**
  - The +x highway no longer ramps down at the edge. It comes in on a viaduct over the boulevard, at 8.4 m, which clears the traffic-light arms and lamps below.
  - It crosses the ring road and that main street and ends where the two loops peel off, with a short wall between them. Only its outer lanes reach the ramps, so the inner ones end in painted hatching over the last 40 m.
  - It has three lanes each way, barriers with faint glowing strips, lane lines, and single piers with caps in the boulevard's median, clear of every crossing.
  - Out of town, the highway carries on level with it. The boulevard below is unchanged, except that it no longer leads out of town on that side.
- **Ramps:** four one-lane ramps down to the main street and up from it:
  - two sweeping right turns (55 m radius) on the outer blocks;
  - two 270° loops (27 m) on the inner blocks.
  - Each ramp is one continuous deck, narrowing to one lane's width where it meets a road, so it runs into that lane.
  - Its barriers are left out only where they would stand on the road it joins. The expressway's edge barriers open where a ramp peels off or joins.
  - Street lamps and shuttle stops keep off the places where a ramp comes down.
- **Land round the ramps:** a small urban forest on dark verge. Inside each loop there's a dark pond with a faintly glowing cold rim. Trees grow as tall as fits under the ramp above them, down to shrubs, and none stand on a ramp's low end or under the expressway.
- **Traffic:**
  - Coming in, one lane carries cars from the haze onto the expressway's outer lane, because the two ramps down are its only way off. Going out, cars fan out to the highway's three lanes.
  - Inbound, the lane splits evenly between the right turn and the down loop, which ends the expressway. Outbound, it starts at the up loop and takes in the other right turn.
  - The ramps split off and join the main street's outer lanes.
  - Every split and merge is a new node type, `free`: cars go on without lights or stopping, waiting only for room ahead. Ramps are links that carry their own points (`pts`).

## Alternatives considered
- **Out on the dirt past the edge:** built first, as a bypass with a cloverleaf. Dropped: the user wanted it inside the city.
- **A flyover inside one street's corridor:** no building moves and no schema change, but no loops.
- **Clearing tiles in the renderer only:** hides buildings the sim simulates, against ADR-0002.

## Consequences
- **Map:** every seed's map changes. 64 tiles are never built on, and with fewer buildings, the default view went from 51.4 to about 46–49 ms per frame on the same machine (45.5 with the grove and the lighter inbound traffic).
- **Schema:** goes from 3 to 4, and the renderer refuses older snapshots. Nothing is deployed yet, so nothing stored needs migrating.
- **Walkers:** they keep their sidewalks. Where a ramp comes down across the main street's sidewalk, they walk through its low end.
- **Merges:** they don't look for a gap beside them, so cars can bunch up briefly. A first version fed three lanes into the down loop, which joins the street just before a traffic light, and it queued all the way round. With one lane in and an even split, no queue built up over a minute and a half of watching.
- **Rollback:** revert the change and regenerate snapshots.
