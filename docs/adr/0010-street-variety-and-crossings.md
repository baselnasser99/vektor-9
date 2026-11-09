# ADR-0010: Street variety and crossings that suit the junction

**Status:** Accepted (2026-11-09). Amends ADR-0009 (mid streets and crossings); the rest of ADR-0009 stands.

## Context
Seen from above, the city repeated itself. The four roads out from the tower were the same boulevard from end to end. Every inner mid street was the same two-way local street, every junction was a full four-way crossing, and every arm of every crossing had a zebra, so zebras always came in sets of four. Real cities mix street types, have T-junctions, and paint crossings only where people are meant to cross.

The street network lives only in the renderer (ADR-0009), so all of this can change without touching the simulation or the snapshot.

## Decision
- **Mid streets** (`cityLayout` in `city.js`): each inner mid street, per axis, is either a two-way local street or a **one-way street** (`oneway` in `world.js`: the same 13 m, two lanes in one direction, arrows on every approach). Neighbouring one-way streets run opposite ways. The choice uses its own seed, so the rest of the plan (main streets, walks, the old town) stays as it was. Widths do not change, so no building moves.
- **The boulevard changes along its length:** full boulevard (three lanes each way, a narrow planted median) from the tower to the first main line out, and again in the outermost sector where it meets the highway. In between it is an **avenue** (`avenue`: the same 36 m, two lanes each way either side of a 10 m median with a closer row of trees). Where it narrows, the outer lane merges if it has no turn to take.
- **T-junctions:** in about one inner sector in three, a two-way mid street is built over for half its length in that sector (`kindAt` returns `none`). The built-over stretch is a small paved square with two trees. The street it met becomes a T-junction, and a crossing of two mid streets can become a bend. At most one half per sector is closed, so no stretch is left a dead end. One-way streets are never closed, so none of them leads nowhere.
- **Crossings** (`hasZebra` in `streets.js`), decided per arm from a fixed draw per junction:
  - Where two main lines meet (the boulevard counts as one), all four arms or all but one. Walkers cross there. The boulevard's refuge bollards and road studs stand only where it has a zebra.
  - Across a mid street beside a main street: about three in five arms.
  - Across a main street beside a mid street: rarely (about one in eight).
  - Where two mid streets meet: rarely (one in ten).
- The same rule drives everything that depends on a zebra:
  - the paint (`crossings`);
  - whether turning cars give way and where walk signals stand (`roadNet` sets a link's `zebra` to null where there is none);
  - the walkers' network (`people.js`): an arm without a zebra has no walking link, and walkers go round by the other arms.
  - Where a walker's sidewalk crosses a mid street that has no zebra, they still cross there, with the light, as at an unmarked side street.
- **Lane arrows** show only the moves a car can actually make there (`exits`): no turn arm toward a missing arm of a T, a pedestrian street, or a one-way street running the other way. A turn arm branches off low on the shaft, so it reads apart from the straight-ahead head. The paint and the traffic share the lane rules (`lanesMay`).

## Alternatives considered
- **Narrow inner alleys (6 m):** changes tile positions, and the headquarters' site and its cut mid street are chosen from those positions. Left out. The built-over stretches give the city's interior its breaks instead.
- **Moving streets into the simulation:** would need a schema change and a version bump for a purely visual choice. Rejected, as in ADR-0009.

## Consequences
- On seed 7, of 150 car junctions, 51 have no zebra, 45 one, 31 two, 19 three and only 4 all four (along the boulevard: 7, 6, 1, 9 and 2). 43 are T-junctions (the ring road's and the built-over stretches'). The self-checks for stuck lanes and for a connected walking network pass. Other seeds have not been checked in the browser.
- Every seed's streets look different from before, but buildings stay where they were.
- Walkers crossing a mid street with no zebra still use the light, but no walk signal is drawn there.
- Rolling back means reverting this change. No simulation or snapshot change is involved.
