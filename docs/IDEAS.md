# Ideas | Vektor-9

A running list of things that could make the city more fun to watch. One line each, with why it's interesting. When an idea gets built, it moves to a PR (and an ADR if it's a real decision) and comes off this list.

Features can show up in the city two ways: **right away** when deployed, or **at a milestone** (the code ships, but switches on when the city reaches some point, like a population number).

## Next simulation update (agreed, not built yet)

- **Start small, grow outward.** The city begins as a small powered core in the center and spreads district by district. Visitors watch it take shape instead of seeing noise.
- **New power when needed.** When plants get close to their limit, the city builds a new one at its edge. Overload pauses growth instead of cutting power, so there's no flicker.
- **Three blackouts a day.** 30 minutes each, at least 2 hours apart, hitting whichever plant is under the most strain. Rare enough to be an event.
- **Grow upward once the land is used.** Low housing gets replaced by taller towers, so the skyline keeps changing for months after the map fills (target: map full in about two weeks).
- **District waves.** Each district slowly moves through boom, peak, decline, and rebuild over days, so there's always a hot spot and a district in trouble.

## Later

- **Corporate towers** that buy up neighboring blocks. Gives the skyline landmarks and a slow takeover story.
- **Monorail and transit lines** that grow with the city. Movement, and a reason districts connect.
- **District names.** Makes the event feed read like news ("Blackout in Lantern Row").
- **Weather and seasons.** Rain, fog, heat haze; the same city looks different week to week.
- **Day and night** driven by simulated time. Neon matters more after dark.
- **Rare events and disasters.** Fires, floods, a festival. Something to talk about, used sparingly.
- **Milestone moments.** "First megatower topped out", "population passed 100,000". News for returning visitors.
- **Visitor signs.** Preset words and symbols hung on rooftops; people come back to find theirs.
- **Flying cars.** Traffic lanes in the sky between towers, busier over booming districts. Browser-only ambient life, like pedestrians.
- **Billboards with ads inspired by today's news.** Makes the city feel current, like it lives alongside our world. Needs care: turn headlines into invented in-world ads (no real brands, logos, or people, per the project rules), filter what gets through, and fetch the news outside `sim/`.

## Notes for when we deploy

- Snapshots should record which version of the rules made them, since replaying a tick only matches with the code from that time.
