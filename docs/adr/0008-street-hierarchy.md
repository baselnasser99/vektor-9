# ADR-0008: A street hierarchy inside fixed street widths

**Status:** Superseded by ADR-0009 (2026-11-08): the street widths and grid now change too

## Context
Every main street had the same build: 4 m sidewalks and a roadway as wide as the rest of its width allowed, so most streets read as four- or six-lane arterials and crossings as large empty squares. The zebras sat about 4 m past the sidewalks rather than in line with them. Traffic lights existed only as timing in `life.js`, and when they were first drawn there was one head per lane, which read as rows of three.

A street's total width also places every tile (`cityLayout` in `city.js`): the tiles sit between the streets. Changing any width moves every building, the headquarters and the landmarks.

## Decision
- Total widths stay as they are. What changes is how each width is divided (`STREETS` in `world.js`: `side`, `lanes`, `edge`, `median`):
  - **Local** (type A): the ring road, one lane each way, with parking and loading bays between the lanes and 6 m sidewalks. The 16 m lanes are also local, with no bays.
  - **Main** (type B): the two inner streets, two lanes each way and a painted double centre line.
  - **Boulevard** (type C): the central one only, three lanes each way and a 4 m median.
  - Of the eleven street directions that carry cars, five are local, four main and two boulevard. A seven-line grid cannot hit the 60/30/10 split exactly.
- Each street has its own sidewalk width. The kerbs, the walking network (`people.js`), the signal poles and the street props all read it from the line.
- Crossings: `zebraAt` and `stopAt` in `streets.js` are the single source for where the zebra (in line with the sidewalk) and the stop line sit. Cars, lane paint, the median's end and walkers all use them. Corners are rounded. Lane paint ends at the stop line.
- Signals: there is one controller per crossing (`own` and `goLeft` in `life.js`): green, amber, then 2 s of all-red, with the walk phase taken from the same clock. Signal heads go per approach, sized by street type, plus walk signals at both ends of every controlled zebra. All of them are instanced.
- Cars still drive straight through every crossing, so no turning paths or turn lanes are needed. Arrows painted on the road point straight ahead.

## Alternatives considered
- **Narrowing the street widths themselves:** this would give more compact blocks, but it moves every building. That is a schema-scale change to the city's look, not a street change.
- **Turning traffic:** needs routing, turn phases and conflict checks in `life.js`. It is left for later; nothing drawn now implies turns.
- **Stop signs at minor crossings:** the car logic avoids collisions only through the lights, so local crossings keep a single pole-mounted signal instead.

## Consequences
- Buildings, the headquarters and the landmarks keep their places. Sidewalks are wider, and roadways narrower on local and main streets.
- A future street kind needs `side`, `lanes`, `edge` and `median` set, and has to keep `side` equal across both directions of a line (`cityLayout` assumes it).
- `streetProps` assumes the boulevard's and the main streets' sidewalks are the same width. It is marked as a shortcut in the code.
- With the new densities there are about 700 cars in total, most of them out of town. They are still instanced.
