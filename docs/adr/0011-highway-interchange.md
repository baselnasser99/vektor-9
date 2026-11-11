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

## Amendment (2026-11-10): the expressway goes on west, slip roads, the land filled
Renderer only; the sim and the snapshot are unchanged.
- **Median ramps:** the expressway no longer dead-ends at the loops. Its inner lanes carry on west as two one-lane ramps side by side in the avenue's 10 m median, down to the ground 22 m short of the crossing at x = 150, where they run on as the boulevard's inner lanes. The middle lanes, which now reach nothing, end in the hatching instead. Inbound, a second lane from the haze feeds the inner lane; outbound, the inner lane fans out with the rest.
- **The crossing under them** (the mid street at x = 219.5) has the ramps about 5 m overhead, too low for signal arms. Its median is closed and it is right in, right out only: the avenue goes straight on without lights and the mid street turns right after waiting for a gap (a new node type, `priority`). No zebras or stop lines across the avenue there.
- **Lane matching at x = 150:** lanes go straight on by their place across the road, not their number, so the avenue's lanes keep their line and the ramps meet the inner lanes. The inner lanes there go straight or left; the avenue's inner lane goes straight only, since a left from it would cut across the ramp lane. Lanes carry these rules (`may`, from `turnsAt`), and the painted arrows follow the same function.
- **Slip roads:** one off each ramp down onto the cross street beyond it (a right turn onto its near lane heading out), and one off that street onto each ramp up. Each is left out on a seed where that street has no lane the right way there. They split and merge at `free` nodes; a third of the cars on a ramp down take its slip, a quarter of the cars on the street take the slip up.
- **Land:** inside each loop a small park: the pond, a path round it and two out to the mid street's sidewalk (under the loop where it is high), benches, two lamps, trees. On each outer block a highway service yard in the corner the slip road leaves free (a depot shed, a stock of spare barriers and cable drums) and sound walls along the edges toward the neighbours, open wherever a deck passes low. Two sign gantries over the expressway. The yard props, walls and gantries are Blender models (`tools/blender/interchange_props.py`).
- **Forks:** a slip road keeps level with its ramp while it still lies across it, so the two read as one deck that widens and splits, and only then climbs or drops on its own. The pieces either side of a fork are a point apart: a zero-length way through a node (the first version) stopped every car that reached it, and the queue backed up the ramps to the expressway. `life.js` now checks for zero-length ways at load.
- **Road level:** ramps are surfaced in the streets' asphalt. Where a ramp is at road level on a carriageway nothing of it is drawn (the street is the road there); over a sidewalk it is a raised apron, like a driveway. Barriers stop at a street's corridor when at its level.
- **Landmark:** in each loop's pond, on a stepped island, two faceted graphite blades (22 and 16.5 m) lean toward each other with a cold-cyan seam up their inner edges, a tie across the gap with a light under it and a steady red lamp on each tip (`ix_monument`, Blender).
- **The crossing under the ramps:** the side street waits only for the lanes it turns into, and only for cars still moving; a first version also waited for the other way and never went.
- **Barriers** are left out where a deck is at road level on any street, and where two decks part or meet.
- **What could break:** merges onto ramps and the cross streets still don't look for a gap. Walkers pass through a slip road's low end where it crosses a cross street's sidewalk, as at the main street. The expressway's inbound traffic grows by one lane.

## Amendment (2026-11-11): merges take turns, ramps give way to walkers
Renderer only; no geometry, sim or snapshot change. Both "what could break" items above were reproduced headless (`tests/js/interchange.test.mjs`) before being fixed.
- **Merges** (a `free` node with two lanes in): each lane's cars wait their turn at a line far enough back that a car there clears the other lane by its width (the lanes run into one, so close to the node they overlap). One car at a time goes in, the first let go first, and of two waiting the one there longer. A ramp or slip also waits for a gap in the other lane's moving cars, for 4 s at most, then zips in. On seed 7 over ten minutes, the frames with two cars' bodies overlapping at a merge went from 1,289 to 0 (seeds 3 and 11: 740 and 290 to 0).
- **Walkers at the ramps' low ends:** where a ramp crosses the main street's sidewalk (`sidewalkCrossings`), walkers wait until no car is on it, then cross; cars short of it stop a metre before it while a walker is on it. A car held there by walkers alone for 5 s goes next: walkers not yet on the crossing let it pass, so a steady stream of them never stops a ramp for good. Slip roads cross only mid-street sidewalks, which nobody walks along yet.
- **Turn order never overrides safety:** patience and who waited longer decide only who goes first. A car goes only into an empty merge with room in the lane out, and the other lane's cars always stop at their own wait line, which clears its path. Tests cover simultaneous arrival, a blocked lane out and its release, sustained congestion and a heavy walker stream.

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
