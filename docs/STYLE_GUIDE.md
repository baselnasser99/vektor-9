# Style guide | Vektor-9

The source of truth for every visual decision. When code and this guide disagree, fix one of them on purpose and note it here.

## 1. Mood

Bright **daylight anime cyberpunk**: a dense, sunlit, hazy megacity with painted-looking detail and lots of small life. Think high-key and airy, not dark and neon-soaked.

Inspiration stays at the level of palette and technique (cel shading, painted backgrounds, atmospheric haze). No names, logos, characters, specific building designs, or screenshots from any existing show, game, or film appear in the project or the repo.

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

**UI chrome:** panels `#142130`, borders `#466e85`, text `#f5f6f6`, muted text `#a9c6d3`, accent `#72d3ec`, live indicator `#f08c8c`.

**Avoid:** pure black, large areas of saturated neon, heavy purple-magenta night palettes (a night palette may come later as a separate, deliberate theme).

## 3. Lighting and rendering

- **Cel shading:** toon materials with a 3-step gradient map (shadow, mid, light). No glossy PBR look.
- **Sun:** warm white directional light from high up, casting soft shadows. A sun-glare sprite and a few drifting sparkles sit in the sun's direction.
- **Shadows:** cool, slightly blue (hemisphere light with warm sky / dusty ground, plus a bluish ambient).
- **Atmosphere:** exponential fog in the haze color; distance should visibly fade to pale blue-white. This is a large part of the look.
- **Bloom:** restrained. Only the sun and the very brightest elements glow.
- **Outlines:** thin, low-opacity navy lines on architecture. Bold dark lines are reserved for small focal objects, if used at all.

## 4. Detail (the current sketch is far too plain)

Plain boxes in flat colors are the main gap. Priorities, roughly in order:

1. **Facade textures** generated in code: floor banding, panel grids, window rows, mullions, balconies, ad screens, plus grime, streaks, and weathering. Several variants per facade family.
2. **Silhouettes:** setbacks, podium plus tower, stepped tops, cylinders wrapped in banded ad screens, bridges between towers, stacked billboard frames, overhangs.
3. **Rooftops:** water tanks, AC units, antennas, vents, railings, helipads, small gardens, rooftop signs.
4. **Street level:** awnings, shop signs, kiosks, lamps, railings, crosswalks, parked vehicles.
5. **Signage:** invented brands and words only; preset sign set for visitor marks.

Facade families (initial): banded glass, teal-framed panel blocks with brick infill, cream concrete with window rows, navy glass, salmon-banded mid-rises. Each tile's style seed picks the family, variant, silhouette, and props, so the same tile always looks the same.

Detail should scale with distance (level of detail): full detail near the camera, simplified far away where the haze hides it anyway.

## 5. Ambient life

Generated in the browser, never simulated on the server, always consistent with the snapshot:

- Pedestrians on sidewalks (white jackets with colored accents are a good default), denser near markets.
- Rooftop people: smokers (ember and drifting smoke), sitters on edges, pairs talking. None in blacked-out districts.
- Cars in lanes, an elevated monorail, a few flying vehicles at altitude.
- Construction sites: scaffolding, hoarding, work lights, and a tower crane that swings and lowers loads.
- Steam from vents and power plants.

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
