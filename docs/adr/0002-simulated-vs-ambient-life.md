# ADR-0002: Simulated life on the server, ambient life in the browser

**Status:** Accepted (2026-11-02)

## Context
The city should feel alive (pedestrians, rooftop people, traffic, cranes, steam), but simulating every person and car on AWS would multiply complexity, storage, and cost for something visitors can't distinguish from decoration.

## Decision
- The server simulates only state that matters and must be shared: tiles, heights, construction progress, power, blackouts, events, visitor marks.
- The browser generates ambient life locally from the snapshot plus randomness. Ambient life reacts to simulated state but is never stored or sent back.

## Alternatives considered
- **Simulate agents server-side:** consistent across visitors, but far more compute, larger snapshots, and no visible benefit.
- **No ambient life:** simplest, but the city feels static.

## Consequences
- Two visitors may see different pedestrians; that's acceptable and stated in the README.
- Snapshots stay small and the tick stays fast.
- Ambient behavior must be derived only from snapshot fields, never invent simulated facts (e.g. no crane where there's no construction).
