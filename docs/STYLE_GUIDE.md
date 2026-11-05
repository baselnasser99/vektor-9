# Style guide | Vektor-9

The source of truth for every visual decision. When code and this guide disagree, fix one of them on purpose and note it here.

## 1. Mood

**Neon cyberpunk night, richly detailed** (changed 2026-11-03; was daylight anime cyberpunk). Dark gunmetal and charcoal structure (steel cages, trusses, ribbed metal, dark concrete, pipes, cables) lit warm first: sodium street lamps, amber LED edges, warm lit windows, red and pink neon; cyan and violet only as accents. Deep blue night sky with blue haze glowing in the distance; near buildings stay dark navy so the lights pop. Streets are wet, with warm lights smearing into soft streaks, but surfaces are not chrome. Most windows are dark at night; lit rooms are a mix of dim, moderate and a few bright (see Windows). Edges are rounded, never knife-sharp. No building is a plain colored block. The daylight palette below stays for a possible day theme.

The reference for level of detail is the dense, hand-built look of modern city-builder games. Only the level of detail and technique are borrowed: no names, logos, characters, specific building designs, or screenshots from any existing show, game, or film appear in the project or the repo. Sign text is always invented.

## 2. Palette

Sampled from reference stills, then curated. Every color used in code comes from a single palette module (e.g. `web/src/palette.js`) that mirrors this table.

| Role | Hex | Use |
| --- | --- | --- |
| Sky top | `#439ac2` | Upper sky gradient |
| Sky mid | `#72d3ec` | Main sky |
| Sky low | `#d6eef5` | Near horizon |
| Glare white | `#f5f6f6` | Horizon, sun glare, highlights |
| Haze | `#d3e8ef` | Fog color; distant blocks fade to this |
| Glass | `#67a7c0` | Glass towers, base |
| Glass band | `#466e85` | Floor bands, mullions |
| Glass highlight | `#97ced9` | Reflections, roof tops of glass towers |
| Deep steel | `#3f687e` | Shadowed glass |
| Navy | `#263d4c` | Navy glass, window slits, figures' trousers |
| Deep navy | `#161c29` | Darkest accents only; never large areas |
| Cream concrete | `#e8dcd3` | Concrete towers, sidewalks |
| Sand | `#e4d6c8` | Sidewalks, monorail beam |
| Warm grey | `#ccc6c2` | Ground |
| Dusty rose grey | `#b6a59f` | Weathered concrete, rails |
| Road | `#5e6d79` | Roads |
| Teal | `#3aa592` | Panel-block frames, accents |
| Brick red | `#b0473d` | Panel infill, awnings, cars |
| Salmon | `#f08c8c` / `#e98a8f` | Stripes, awnings, sign frames |
| Lamp amber | `#f2a43a` | Street lamp heads, construction hoarding, crane |
| Signal red | `#e2453c` | Antenna lights, warnings |
| Lime | `#9be15d` | Small accents on clothing and signs |
| Cyan accent | `#72d3ec` | UI accent, holograms |

**Neon night theme** (current): sky zenith `#0c1330`, sky `#1b2a57`, horizon glow `#3d528f`, fog `#1d2645`, moonlight `#9fb4ff`; structure charcoal `#1e2333`, gunmetal `#2f3648`, slate `#4b5569`, weathered concrete `#7e8992` (the telecom tower's old frame); for the power plant blackened concrete `#34373b`, weathered titanium `#666d73`, scorched steel `#24201d`, worn hazard paint `#7a5230`, warning yellow `#8e7a3a`, stencil paint `#8f9498`, and its dim lights cold white `#c8dce8` and dirty amber `#d08a3a`; for the market shops armour off-white `#b9b4a8`, olive grey `#5d6157`, graphite `#26282b`, deep red `#6e2723`, and their light aged amber `#e09a45` and cold cyan `#8ccad2`; warm light sodium `#ffa733`, window `#ffc46b`, neon red `#ff3b3b`, pink `#ff5c8a`, magenta `#ff2fb4`, orange `#ff8a2a`; accents violet `#9b5cff`, cyan `#3ff0ff`. Lit windows follow the hour and the building type, mostly warm (see Windows). Neon is for lines, signs and lit windows; large surfaces stay dark.

**UI chrome:** panels `#142130`, borders `#466e85`, text `#f5f6f6`, muted text `#a9c6d3`, accent `#72d3ec`, live indicator `#f08c8c`.

**Avoid:** pure black, large areas of saturated neon (neon is lines and signs, not walls), rust-orange tints on structure.

## 3. Lighting and rendering

- **Materials:** physically based (`MeshStandardMaterial`) with CC0 texture sets from Poly Haven (color, normal, AO/roughness/metalness), tinted with palette colors. Painted steel uses flat palette color plus the worn-metal relief. Textures are mapped in metres (one repeat per 4 m). See ADR-0004.
- **Night lighting:** a cool sky fill with a mauve bounce from the lit streets, strong enough that facade detail reads without looking like day, a soft blue moon for shape and soft shadows, sodium street lamps with real warm lights, and a few point lights at the strongest neon so color spills onto walls and the street. Bloom gives lamps and neon soft halos.
- **Reflections:** low. The environment map is captured once from the finished scene at low intensity; steel and glass are mostly non-metallic and fairly rough (roughness 0.4 or more); window glass is never metallic (a metal pane loses its diffuse and goes black from most angles), and the street is wet but not a mirror (roughness about 0.55).
- **Surfaces:** no visibly tiling patterns. Concrete is a cast-concrete texture drawn in code (soft blotches, rain streaks, faint formwork seams). Round machinery is turned (lathe) geometry with tube supports, not boxes attached to cylinders.
- **Edges:** boxes use rounded geometry (radius up to 0.3 m); the post-processing target is multisampled so edges stay smooth.
- **Sun:** warm white directional light from high up, casting soft shadows. A sun-glare sprite and a few drifting sparkles sit in the sun's direction.
- **Shadows:** cool, slightly blue (hemisphere light with warm sky / dusty ground, plus a bluish ambient).
- **Atmosphere:** exponential fog in the haze color; distance should visibly fade to pale blue-white. This is a large part of the look.
- **Bloom:** restrained; the threshold sits above the sky's brightness, so only emissive parts (signs, LEDs, reactor cores) glow.
- **Contact shading:** from texture AO and shadows for now; a screen-space AO pass washed the frame out and is deferred.
- **Outlines:** thin, low-opacity navy lines on architecture. Bold dark lines are reserved for small focal objects, if used at all.

## 4. Detail (the current sketch is far too plain)

Plain boxes in flat colors are the main gap. Priorities, roughly in order:

1. **Facade textures** generated in code: floor banding, panel grids, window rows, mullions, balconies, ad screens, plus grime, streaks, and weathering. Several variants per facade family.
2. **Silhouettes:** setbacks, podium plus tower, stepped tops, cylinders wrapped in banded ad screens, bridges between towers, stacked billboard frames, overhangs.
3. **Rooftops:** water tanks, AC units, antennas, vents, railings, helipads, small gardens, rooftop signs.
4. **Street level:** awnings, shop signs, kiosks, lamps, railings, crosswalks, parked vehicles.
5. **Signage:** invented brands and words only; preset sign set for visitor marks.

Building families (`web/src/families.js`): every house tile gets one of six by fixed rules, so a building keeps its family while it stands: industrial halls (strip windows, sawtooth roofs, external pipes and frames, stacks) up to 10 floors beside the railway or the old works; old buildings (brick or weathered concrete, small deep windows, cornice, water tank, fire escape) in the old town and among the first generation; luxury towers (glass lobby, setback tiers with planted terraces, tall glass) at 20+ floors near a park or the centre; megastructures (layered off-centre sections with lit seams, an exoskeleton, skybridges to neighbours) for some 16+ floor towers near the centre; offices (lobby, framed curtain wall, a mechanical floor every dozen storeys, setbacks, a louvred plant room) at 10+ floors in glass sectors; apartment towers (slab, L or twin towers on a shop podium, balconies, bay windows, set-back penthouse) everywhere else. The seed varies a building within its family. Balconies, rooftop plant, pipes and planters are drawn only within about 400 m of the camera.

Rooftops (`web/src/roofs.js`): flat and modern, in the facade's own materials, never bright accent colours: parapets, mechanical penthouses set to one side, stepped crowns in the building's own facade, fields of cooling units, communication masts on equipment shelters, planted terraces with a glazed pavilion, utility roofs (tanks on frames, a cooling tower, ducts) and, rarely on tall towers, a distinctive crown (a ring of fins, a halo roof on posts, or a top cut at an angle). Each family has four roof types; neighbours of one family always differ (the type steps through the list by tile position), and the choice stays fixed while the building stands. The only sloped roof is a flat-topped slate mansard on about one old building in nine; no pointed roofs.

Each sector has a dominant family (glass, cream, navy, or pale glass), so districts read as neighborhoods; about one building in four is a teal or salmon accent. Buildings of 20+ floors are drawn as a full-width podium with a slimmer tower on top.

Built so far (`web/src/tiles.js`, `plant.js`, `city.js`): towers get a shop podium (lit shopfront, awning, sign, LED strip), a glass or concrete body with lit rooms, and on 20+ floors a setback crown with pink or cyan edges, antennas and sometimes a drone pad; construction tiles get a concrete core in yellow scaffolding with work lights and sometimes a tower crane; markets are cybernetics shops (below); plants are SECTOR 07 (below). Each tile's style seed picks the variant and turns the building to one of four facings. Streets have sodium lamps every block edge with soft light pools on the wet asphalt. Towers come in four shapes (plain, stepped, round, with a wing), carry vertical banners, rooftop billboards or holograms, and tall neighbours are sometimes joined by skybridges. Empty lots are small plazas with parked cars (some taxis) and kiosks. A blacked-out tile has every room dark and no neon or signs.

**Power plants** (`web/src/plant.js`, modelled in Blender by `tools/blender/power_plant.py`, ADR-0005): every plant tile is SECTOR 07, an invented design for a compact, aging power-generation block that reads as dangerous machinery, not entertainment. Its cyberpunk identity comes from architecture, density of machinery and wear, not neon: at least 85-90% of its surface is unlit worn metal and concrete (measured in Blender: about 0.1% glows). On the 12 m lot it gets its size from height: a reactor about 21 m tall (blackened concrete drum with buttresses and support frames, an armoured band with inspection slots behind grilles, a segmented gunmetal shell with bands of coil blocks and bolted armour, clamped coolant pipes, hatches, gauges, radiation warnings) is the focal point; two discharge towers of 35 and 29 m (welded collars, one painted hazard band each, vents, sooted heads, struts, maintenance platforms, steady red aviation lamps) come second. Round them: heavy headers and a pipe bridge, a windowless two-storey control block (roll shutter, a restricted access door in a hazard frame, control panel, conduits, junction boxes, a meter, a duct, a camera, roof fans, a small worn "SECTOR 07" plate), transformers with high-voltage plates. Light is only small dim amber maintenance lamps, cold-white indicators and red; no pink, no saturated cyan, no glowing outlines. Hazard markings only at the door, the apron, the towers' bands and rails. Steam from its vents is ambient life (browser-only, ADR-0002), not part of the model.

**Market shops** (`web/src/tiles.js` `market`, modelled in Blender by `tools/blender/market_hall.py`, ADR-0005): every market tile is a compact, heavily modified cybernetics and parts shop, two storeys under the old barrel roof, an invented design that reads as futuristic by its architecture even in flat daylight with every light off. Angular off-white and olive armour plates (corners cut at 45 degrees) overlap graphite walls and exposed steel sections; the outline is broken by a ventilation tower rising past the roof, a cooling rig with hoses, a fan unit, a maintenance platform, a tall corner sign turned off the facade, an asymmetric sign frame and a mast with dishes. Street level: a deep storefront in a thick angular frame under a layered armoured canopy on struts, a display of parts with a product hologram, a sliding security door, payment terminal, scanner and control panel, a vending terminal and a delivery locker. Each tile gets a shop from `SHOPS` in `world.js` (invented names, KUROTECH first): its name on the roof sign, its short mark on the corner sign, both white; "CYBERNETICS / PARTS / REPAIRS" in aged amber under the name. Light kept to three focal areas (roof sign, corner sign, storefront): white, aged amber, red indicators, a few cold cyan displays; no pink or purple, no outline strips. A market is its own shop, so it gets no street shopfront strip. Dark in a blackout, with no hologram.

**Street level** (`web/src/streets.js`): main streets between sectors are 24 m: two 4 m raised sidewalks with curbs and a 16 m roadway with two lanes each way, dashed lane lines, a double centre line (a planted median on every other inner street, the avenues) and zebra crossings at every intersection; road paint glows faintly so it reads at night. Each sector is split both ways by 5 m strips, each either a service alley (asphalt, dumpsters) or a paved pedestrian lane with planters. Sodium lamps stand on both curbs about every 55 m with small, faint light pools. Building footprints vary with the style seed (small low-rises, towers filling most of the lot). Perimeter blocks: lots on a street or alley push their building up to it and carry a one-storey strip of shops with lit awnings the full lot wide, so streets have a continuous wall and each quarter-block keeps a courtyard; inner lots sit anywhere on theirs.

**Terrain** (`web/src/terrain.js`, from the snapshot's `rail`, `park` and `works` tiles, which the sim lays out and never builds on): the railway is one straight viaduct about 8 m up along the rail tiles, with two tracks, a sodium-lit edge and piers only on rail tiles, so streets pass under it; it runs from a glass terminus station beside the centre out past the city edge over the dunes, with a train shuttling on each track; parks are dark lawns with a path, trees and a lamp when powered; the old industrial site is corrugated-iron sheds with sawtooth roofs, lit roof glazing and the odd chimney with a warning light.

**Windows** (`web/src/facade.js`, tuned in `FACADE` and `STYLES` there): drawn in the shader, not painted on. Offices are glass curtain walls: 1.5 m bays, dark spandrel glass, a slab band at every floor and a column every four bays; whole floors are lit or dark, in a soft cool white, and most go dark late at night. Homes are punched windows in concrete: wider bays, two panes per window, deep recesses; rooms light irregularly in warm tones, mostly dim, some moderate, a few bright, the odd cool screen. Shopfronts are tall, mostly lit glass. Every pane is set back in its opening (the reveal shows), has dark slightly reflective glass that varies pane to pane, and a fake room behind it (back wall with furniture, side walls, floor, lit ceiling; sometimes a blind). Lights come from a stable hash of each room, follow the snapshot's hour, and about one room in ten fades on or off now and then. Far away each window cell becomes its average, so nothing shimmers. Strong cyan, pink and violet stay on signs and accents.

**Districts and landmarks** (`web/src/city.js`, `streets.js`, `landmarks.js`): the city is not one plan. One old-town quarter beside the centre has winding streets, slightly askew buildings and alleys that dead-end or are built over; the rest is a straight modern grid. Buildings ride the street bends whole and never bend themselves. The boulevards meet at the tower's plaza: a big roundabout (cars circle it, everyone drives on the right) round an island carrying the city's telecom tower, about 260 m to the mast tip, with the corners of the four sectors round it paved and planted (the sim keeps those tiles as park). The tower is modelled in Blender (`tools/blender/telecom_tower.py`, ADR-0005), an invented design read in three layers. A monumental base: a hub with a concrete portal carrying an invented operator name, a glazed lobby, a two-level podium with a louvred plant band, garages, a power yard with transformers, vent towers. A tall shaft: an old weathered blue-grey concrete frame (tapered core, three curved legs grown out of the core on web walls) with dark steel retrofits concentrated at three plant nodes, so about two thirds of the shaft stays clean: heavy housings with fans and radiators, a faceted plant drum clamped round the legs, an upper equipment node; enclosed lift shafts, two large pipelines. A command crown: panoramic glass behind angular concrete armour over each leg, a reinforced control level with slit glazing, one curved display, walkways with safety-orange rails, large dishes and a radome; above it a short lattice mast with steady red lamps. Light is warm first (work-light lines under the steel collars, lit plant rooms, the crown's interiors), cool white for infrastructure, cyan on one conduit and the info panels, magenta only on the display. No searchlights. The three tallest towers, spaced apart, get signature spires and a heavy industrial retrofit on their body (`retrofit` in `landmarks.js`), cyberpunk by architecture rather than light: armoured plate modules at varied depths on one face (one column wrapping a corner), a ribbed mechanical spine with louvred vent units and dull hazard hoods on the next, a machine pod on raking struts with grated maintenance platforms on the most open face, and exposed conduits climbing beside the spine. Asymmetric, in painted gunmetal, weathered titanium and charcoal steel; no neon, only two dim amber work lamps. Size and place are unchanged, and anything deeper than a plate sits above the neighbour's roof on its side (or over a street), so it never runs into another building.

**Beyond the grid** (`web/src/desert.js`, decoration only): no wall. No buildings outside the grid: the city ends at a wasteland of packed dark dirt that fades along a ragged line into moonlit sand (`#7d6a78`), with boulders, dry scrub, abandoned cars along the tracks, a few scrapyards, half-buried containers and the odd steady barrel fire; the asphalt stops at the ring road, whose outer sidewalk is raised and kerbed like the sectors' and open only where a street leaves town; sand drifts onto the ring road; streets carry on as dirt tracks that narrow, wander and break up into the sand, with no boulders on them; no crosswalks on the city's outer side. Four highways climb from the ring road onto causeways with lamps. Every street's traffic carries on out of town (the boulevard's up the ramps and along the highways, the rest along the tracks and over the dunes), so cars come and go in the haze, never at the city edge; mesas stand off those lines. A line of dead pylons and mesas sit further out.

**Light and air** (`web/src/stage.js`, tuned in `LOOK` there): a cool moon is the key light, with shadows, and the sky fill is kept low, so every building shows its form even with its windows dark and lit sides separate from unlit ones; a soft mauve city glow (`#7a5a7e`), low and opposite the moon with no shadows, keeps the sides turned away from the moon from going black (about 2:1 lit to unlit, not 3:1); walls darken towards the street (the canyon gets less sky). Warm windows and lamps play against that cool light. Haze is thickest among the streets and thins with height: near buildings keep full contrast, the middle distance softens, the far city fades into the night, and tall landmarks stay crisp. AgX tone mapping, restrained bloom (only the brightest light blooms), and a light grade that takes a little saturation out of darks and mid-tones while bright signs and neon keep their colour. No dynamic lights besides the moon, the city glow and the sky.

**Sky** (`web/src/atmosphere.js`): a patchy cloud deck lit mauve from below (`#7a5a7e`), stars and a hazy moon showing through the gaps, and two airships circling with lit ads and steady nav lights; a ground mist, pale blue, that thickens smoothly toward the streets (part of the fog, so it never draws a line across a building).

Detail should scale with distance (level of detail): full detail near the camera, simplified far away where the haze hides it anyway.

## 5. Ambient life

Generated in the browser, never simulated on the server, always consistent with the snapshot (`web/src/life.js` for traffic, `atmosphere.js` for rain, mist and clouds):

- Built: cars with head- and taillights in both directions on every street, each keeping its distance from the car ahead and waiting at traffic lights at every crossing (the roundabout included), so no two cars ever overlap; the lights themselves are not drawn; rain in three-hour spells derived from the world seed and tick (dry about three times in four, otherwise a light shower), so every visitor sees the same weather (`?rain=0..1` previews it).
- Planned: pedestrians on sidewalks (denser near markets), rooftop people (none in blacked-out districts), the elevated monorail, flying vehicles, crane motion, steam from vents and plants.
- With `prefers-reduced-motion`, the frame loop does not run: rain, traffic and highway streams stay still and the city is drawn only when the camera moves.

## 6. Motion and accessibility (non-negotiable)

- No flashing above 3 times per second, anywhere. Blinking lights stay at or below 1 per second.
- `prefers-reduced-motion`: no auto-rotate, no ambient movement, no particles in motion; the city remains fully readable.
- UI text meets contrast standards; never place text directly over the busy 3D scene without a panel.
- Meaning never relies on color alone (blackout = dark windows + label; construction = scaffolding + label).
- Orbit, zoom, timeline, and inspector are keyboard-operable. Works on mobile.

## 7. Performance targets

- 60 fps on a typical laptop, 30 fps on a mid-range phone.
- Instanced meshes for repeated objects (buildings, people, cars, props); texture atlases for facades.
- Pixel ratio capped at 2; a "low detail" toggle disables shadows and bloom.

## 8. Typography and copy

- Wordmark and data readouts in a monospace face; UI text in a readable sans.
- Sentence case everywhere. Invented names only.
