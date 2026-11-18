# Fixed views for visual checks

Every visual PR takes its before and after shots and frame times at the views it touches, from this list, so changes compare like for like. The views were picked on seed 7, tick 4032, SIM_VERSION 4 (`snapshots/004032.json`); see [`docs/proposals/VISUAL_BASELINE.md`](../proposals/VISUAL_BASELINE.md) for what each showed on 2026-11-15.

## How to take them

1. Serve the site from the repo root: `uv run python tools/serve.py`, with `snapshots/004032.json` in place (`uv run python -m sim --ticks 4032 --seed 7 --out snapshots`).
2. Open `http://localhost:8000/web/?bench=1000x625&view=<view>` with `<view>` from the table (`x,y,z` camera, `tx,ty,tz` target).
3. `?bench=1000x625` draws exactly 1000 x 625 pixels at pixel ratio 1, then logs one console line: `bench: median … ms, p90 … ms over 120 frames …`. Use the median.
4. Before and after: run the old and the new code on the same machine, in the same browser, with the same window state (a hidden or background tab runs slower). Take at least three loads of each, alternating old and new, and report the median of the three medians. Flag an increase of more than 2 ms at any view.
5. Screenshots and timings stay local. Never commit them; the PR names the views and gives the numbers.

Low shots are taken over street corridors: on v4 the taller towers put a camera set elsewhere inside a building.

## The views

| # | Subject | `?view=` |
|---|---|---|
| 01 | Centre and tower island | `0,150,130,0,0,0` |
| 02 | IKARO HQ and court across the avenue | `0,100,-120,15,25,-226` |
| 03 | Interchange | `170,230,190,300,0,0` |
| 04 | Frontier, north-east (the most-lot sectors) | `180,210,-180,290,0,-360` |
| 05 | Park cut by a street (north park at x 150, z -292.5) | `150,95,-200,150,0,-292` |
| 06 | Old town market lane (z 80.5) | `-110,18,80.5,-200,2,80.5` |
| 07 | Busy junction, main corner (292.5, -292.5) | `380,55,-292.5,292.5,0,-292.5` |
| 08 | Dead-end stub (x -80.5, z -150 to -80.5) | `-80.5,30,-55,-80.5,0,-150` |
| 09 | Boulevard stretch toward the tower | `16,32,150,0,4,55` |
| 10 | Ordinary local street (z 80.5, east) | `100,22,80.5,200,2,80.5` |
| 11 | Road arrows and left-turn signal heads, main corner (294, -292) | `300,9,-252,294,1,-292` |
| 12 | Edge, grid to outskirts (south-west corner) | `-560,90,520,-400,0,380` |
| 13 | Highway arrival across the outskirts (north) | `60,70,-760,0,0,-440` |
| 14 | Wide shot from outside | `1500,450,1300,0,40,0` |
| 15 | Road arrows on the boulevard heading +x into (150, 0) | `112,10,13,140,0,9` |

Extra views, for the subjects named:

| # | Subject | `?view=` |
|---|---|---|
| 16 | Court paving, close | `2,28,-165,-32,0,-226` |
| 17 | Roundabout north entry (a car-overlap spot) | `0,45,-80,10,0,-30` |
| 18 | Road arrows on the boulevard heading +x into the ring road at (429, 0) | `400,4,15,424,0,4` |
| 19 | Expressway deck, ramps and parapets, from above the outer blocks | `350,26,48,285,6,0` |
| 20 | Road arrows at a driver's eye height (1.6 m), the boulevard heading +x into (150, 0) | `118,1.6,8.3,134,0,9.9` |
| 21 | Deck joins at the expressway's inner end: the median ramps and the loops leave it, parapets meeting across the end | `238,14,12,262,8,0` |
| 22 | Deck join where the inbound sweep ramp comes out from under the expressway (a known level step, capped parapets) | `368,15,-34,338,7,-12` |
| 23 | Low angle at a driver's eye height on the expressway, looking west across its inner end: the median ramps and both loops leaving it (deck and ramp surfaces side by side, the expansion joints) | `272,9.9,-3.4,245,8.2,-3.4` |
| 24 | The inbound sweep ramp's low end, where it meets the main street's kerb lane (an open slab end, ADR-0011) | `300.1,2.2,-69.9,299.7,0.6,-51.2` |

View 18 stays low: the expressway deck runs above the boulevard there, and a camera at 10 m sits on it.

## Which views for which change

- Road surface, markings, arrows: 11, 15, 18, 20, then 07 and 09.
- Expressway decks, ramps and their parapets: 19, 21, 22, then 03 and 18; deck and ramp surfaces at a join: 23; ramp low ends: 24.
- Traffic and junctions: 07, 17, 01.
- Dead ends and street changes: 08, then 05 and 10.
- HQ, court and avenue: 02, 16.
- Outskirts and the city edge: 12, 13, 14.
- Buildings and frame time across the city: 03, 09, 14.
