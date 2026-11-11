# ADR-0012: A masterplan table derived from the snapshot

**Status:** Accepted (2026-11-11) for its first step only: the table is computed, nothing reads it yet.

## Context
The urban audit (2026-11-11) found that most of the city's coherence problems have one cause: the renderer dresses
every sector the same way, whatever the sector is for. The frontier of empty lots is drawn as fully lit parking,
the headquarters has no relationship with its streets, and districts outside the old town don't read. Fixing each
finding where it lives would spread district logic across five files as special cases. Moving districts into the
simulation would need a schema change and new rules for something the simulation doesn't need to know (as with
streets in ADR-0009 and the headquarters in ADR-0007).

## Decision
- **One module, `web/src/masterplan.js`,** computes once per load what each of the 36 sectors is for, from the
  snapshot, the street layout and the headquarters' site. It has no randomness and stores nothing. It never hides,
  moves or changes a tile (ADR-0002).
- **Where it runs:** `cityPlan` in `city.js` builds the layout, picks the headquarters' site, sets the campus's cut,
  then calls `masterplan` and keeps the result as `layout.plan`. `buildCity` and the headless test harness both use
  `cityPlan`, so the tests see the same plan as the page.
- **What it returns:** `{ roles, matches, approach, hq }`.
  - `roles[s]`: sector s's role, numbered row by row from the north-west (as `hq.sector` and the sim's events).
  - `matches[s]`: every role whose rule sector s meets, in precedence order. `roles[s]` is the first.
  - `approach`: a description of the stretch behind the headquarters (below), or null with no headquarters.
  - `hq`: the site it was given, or null.
- **Roles and precedence.** A sector takes the first role whose rule it meets. All rules count whole tiles of the
  sector's 64, so there are no ties.

  | # | Role | Rule | Changes while the city runs? |
  |---|---|---|---|
  | 1 | old | in the old town's quarter (`layout.town`) | no |
  | 2 | corporate | the headquarters' sector | yes, with the site |
  | 3 | centre | holds tiles of the tower's plaza (sectors 14, 15, 20, 21) | no |
  | 4 | gateway | holds interchange land (`road`; sectors 16, 17, 22, 23 on every seed) | no |
  | 5 | industry | 8 or more `rail` and `works` tiles | no |
  | 6 | park | 16 or more `park` tiles off the tower's plaza | no |
  | 7 | frontier | more than half its buildable tiles are empty lots (building sites count as built) | yes, as lots fill |
  | 8 | residential | everything else | yes |

  - The old town comes first because it is already a district, with its own warp. The headquarters is never
    placed in it.
  - Corporate comes next so the headquarters' sector is always corporate. On every seed checked it is one of the
    centre sectors.
  - The fixed roles come before frontier, so a sector with a fixed role never changes role as the city grows.
  - Industry always exists: the railway's 16 tiles span at most two sectors.
  - A park sector needs a quarter of its tiles to be park. With an eighth, a sector of empty lots with a corner of
    park read as a park.
- **Seed 7 at tick 4032:** old 7, 8, 13, 14; corporate 15; centre 20, 21; gateway 16, 17, 22, 23; industry 1;
  park 19; frontier 2, 3, 4, 5 and 30 (the audit's frontier); the other 18 residential. Two sectors meet more than
  one rule: 14 (old over centre) and 15 (corporate over centre).
- **The approach, described only.** `approach` is the other half of the mid street the campus cuts, in the campus's
  sector, from the campus's back to the next main corridor: `{ j, axis, v0, v1, kind, closable }`. `kind` is what the
  streets draw there today. `closable` says whether building it over would leave the sector's middle crossing a
  straight run of the crossing mid street, rather than a dead end. Nothing applies it: the streets stay as they are.
  A stretch that is built over (`none`) is not a promenade or an entrance. A real approach to the headquarters needs
  its own design: walkers' access, the building's entrances, vehicle access and the traffic network around it.
- **Self-checks at load:** every sector has exactly one known role, and the headquarters' sector is corporate.

## Unresolved: where the headquarters stands
The headquarters' site is still chosen from each snapshot by `hqSite` (ADR-0007), unchanged. Its ranking adds up
the floors of the site's tiles, and floors change every tick. So the headquarters can move between two sites that
both still qualify. Measured, sampling every hour of a two-week run: 7 moves on seed 7 (the last at tick 156), 8 on
seed 3 (as late as tick 3588), 12 on seed 2. On seed 7 it moved to (115, -80.5) when the interchange land arrived
with schema 4, where the default view sees it end-on.

Keeping it in one place for the life of the city is a separate decision, to be made before the masterplan's next
step. The alternatives to compare:
- **A fixed order of sites, no floors:** the nearest qualifying site in a fixed order. Measured, this cuts the moves
  to 1 to 3 per seed, each because a market or power plant took a tile of the old site. It reduces moves but does
  not stop them, and it would turn seed 2's headquarters to face another street.
- **Land reserved for it in the simulation,** like the interchange's: permanent, but a schema change (and the kind
  of sim building type ADR-0007 turned down). Not without explicit approval.
- **Anything else that keeps the renderer from hiding tiles the snapshot doesn't let it hide (ADR-0002).**

Until then, the corporate role follows wherever `hqSite` puts the headquarters.

## Follow-ups, not part of this step
- **A second layout in `main.js`.** `cityPlan` is the shared start for `buildCity` and the headless tests. The page
  also builds a layout of its own with `cityLayout`, without the headquarters' cut or the masterplan, and passes it
  to the desert, the traffic leaving town, the walkers and the district glows. The walkers' network reads `kindAt`
  from it, so in the page it doesn't know about the campus's cut, while in the tests (through `cityPlan`) it does.
  The page and its tests should share one layout. Fixing that is its own change, checked in the browser, since it
  can change where walkers go.
- **Frontier turning residential.** When a builder starts dressing sectors by role, a sector that fills up will
  switch from frontier to residential dressing between two snapshots: its empty lots, lamps and signals would all
  change look at once. That switch needs a deliberate visual treatment (for example, dressing by the lot rather
  than only by the sector, or a middle stage), designed with the step that first reads the role.

## Alternatives considered
- **Fixing each finding where it lives:** the smallest changes, but district logic ends up as special cases in
  `tiles.js`, `streets.js`, `terrain.js`, `life.js` and `city.js`.
- **Districts in the simulation:** they'd need a schema change and new rules. A sim-side system would fill the same
  table if the simulation ever gets zoning.

## Consequences
- Nothing in the city looks or behaves differently. A headless fingerprint of `buildCity`'s meshes, parked cars,
  lamps, benches and roads is byte-identical before and after on seeds 7 (ticks 0 and 4032), 3, 11 and 2.
- Later steps switch builders over to the table one at a time, each in its own change: frontier dressing (empty
  lots, lamps, signals), the headquarters' surroundings, parks drawn as connected areas.
- The frontier and residential roles change between snapshots as the sim builds. A builder that reads them must
  treat them as dressing only, so a sector changes look only when the snapshot it is drawn from does. Every load
  reads one snapshot, so nothing changes while someone watches.
- The tests (`tests/js/masterplan.test.mjs`) check one role per sector, precedence, the fixed roles, the
  headquarters with and without a site, determinism with no randomness, that computing the plan changes no street,
  that roles change between ticks only where corporate or frontier did, and that a closable approach, if built
  over, leaves no new dead end and passes the lane and walking self-checks. The existing self-checks don't catch a
  dead end (a stub just carries no cars), so the tests look for one directly.
- **Rollback:** revert the change. Nothing reads the table, and no simulation or snapshot change is involved.
