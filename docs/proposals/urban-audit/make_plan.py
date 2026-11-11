# ruff: noqa: E501  (a one-off diagram helper: SVG strings and plan tables read better unwrapped)
"""Annotated aerial planning diagram for the urban audit (read-only; changes nothing in the city).

Draws seed 7, tick 4032 from snapshots/004032.json plus the street plan and interchange decks exported from the
running renderer (cityLayout, kindAt with the headquarters' cut, interchange.js plan; captured 2026-11-11). The
plan is unwarped: the old town's streets are drawn straight. World x is to the right and world -z is up, as in
the viewer's top-down view.

Run from the repo root: uv run python docs/proposals/urban-audit/make_plan.py  ->  docs/proposals/URBAN_PLAN.svg
"""

import json
from pathlib import Path

ROOT = Path.cwd()
OUT = Path(__file__).resolve().parent.parent  # docs/proposals
snap = json.loads((ROOT / "snapshots/004032.json").read_text())
T, n = snap["tiles"], snap["size"]
assert snap["seed"] == 7 and snap["tick"] == 4032, "the street plan below is seed 7's"

# Corridors in order (cityLayout cross): width; and, per tile along it, the street kind on each axis (x: the
# corridor runs along x; z: along z). Corridor 5 along x is built over at cols 24-27 (a T-junction closure) and
# paved over by the headquarters' campus at cols 28-31.
W = [16, 6, 21, 13, 14, 13, 36, 13, 14, 13, 21, 6, 16]
KINDS = [
    ("R" * 48, "R" * 48),
    ("a" * 48, "a" * 48),
    ("S" * 48, "S" * 48),
    ("l" * 8 + "W" * 16 + "l" * 24, "o" * 8 + "W" * 16 + "o" * 24),
    ("W" * 48, "W" * 48),
    ("l" * 8 + "W" * 16 + "-" * 8 + "l" * 16, "l" * 8 + "W" * 16 + "-" * 4 + "l" * 20),
    (
        "B" * 8 + "A" * 8 + "B" * 16 + "A" * 8 + "B" * 8,
        "B" * 8 + "A" * 8 + "B" * 16 + "A" * 8 + "B" * 8,
    ),
    ("l" * 48, "o" * 48),
    ("W" * 48, "L" * 48),
    ("l" * 28 + "-" * 4 + "l" * 16, "o" * 48),
    ("S" * 48, "S" * 48),
    ("a" * 48, "a" * 48),
    ("R" * 48, "R" * 48),
]
# Interchange decks (x, height, z), every other point (interchange.js plan: ramps, slips, median ramps).
RAMPS = [
    [
        (352.5, 8, -10),
        (337, 8, -12),
        (323, 6, -18.5),
        (311, 4, -29),
        (302.5, 2, -42),
        (298, 0, -57),
        (297.5, 0, -65),
    ],
    [
        (260.5, 8, -10),
        (245.5, 8, -14.5),
        (235.5, 7, -26.5),
        (234, 6, -42),
        (241.5, 4, -56),
        (255, 3, -63.5),
        (270.5, 1, -62),
        (283, 0, -52),
        (287.5, 0, -37),
    ],
    [
        (287.5, 0, 37),
        (283, 0, 52),
        (270.5, 1, 62),
        (255, 3, 63.5),
        (241.5, 4, 56),
        (234, 6, 42),
        (235.5, 7, 26.5),
        (245.5, 8, 14.5),
        (260.5, 8, 10),
    ],
    [
        (297.5, 0, 65),
        (298, 0, 57),
        (302.5, 2, 42),
        (311, 4, 29),
        (323, 6, 18.5),
        (337, 8, 12),
        (352.5, 8, 10),
    ],
    [
        (326.5, 6, -16.5),
        (316.5, 5, -24.5),
        (309.5, 2, -38.5),
        (309.5, 2, -54),
        (317, 1, -68),
        (330, 0, -77),
        (341.5, 0, -79),
    ],
    [(233.5, 6, -38), (234, 5, -54), (236.5, 3, -67), (247, 0, -77.5), (254.5, 0, -79)],
    [(267, 0, 79), (252.5, 2, 74.5), (244, 4, 63.5), (236.5, 5, 49.5)],
    [
        (341.5, 0, 79),
        (326.5, 0, 75),
        (314.5, 1, 65),
        (309, 2, 50),
        (310.5, 3, 34.5),
        (319.5, 5, 21.5),
        (326.5, 6, 16.5),
    ],
    [(264.5, 8, -3.5), (240.5, 7, -3.5), (216.5, 4, -3.5), (192.5, 1, -3.5), (158.5, 0, -3.5)],
    [(158.5, 0, 3.5), (188.5, 1, 3.5), (212.5, 4, 3.5), (236.5, 7, 3.5), (264.5, 8, 3.5)],
]

# Tile centres and corridor centres, as cityLayout lays them.
centres, lines, at = [], [], -(n * 14 + sum(W)) / 2
for j, w in enumerate(W):
    lines.append(at + w / 2)
    at += w
    if j < len(W) - 1:
        for _ in range(4):
            centres.append(at + 7)
            at += 14
LO, HI = -(n * 14 + sum(W)) / 2, at
assert centres[0] == -414 and centres[24] == 25 and lines[6] == 0, (
    "layout differs from the renderer's"
)

STREET = {
    "B": "#c2417a",
    "A": "#a8507f",
    "S": "#d7a446",
    "R": "#7f8aa3",
    "L": "#9fb0c8",
    "l": "#5d6a82",
    "o": "#5d6a82",
    "W": "#3fb39a",
    "a": "#3a4050",
    "-": "#2b3140",
}
TILE = {
    "lot": "#3b4252",
    "build": "#6b5a3a",
    "market": "#e0a030",
    "plant": "#e04040",
    "rail": "#8a6fc0",
    "park": "#2f8f5f",
    "works": "#8a5a3a",
    "road": "#2c5560",
}

out = []
add = out.append


def house(f):  # darker low, brighter high
    t = min(f / 31, 1)
    return f"#{int(40 + 150 * t):02x}{int(55 + 120 * t):02x}{int(90 + 130 * t):02x}"


# Ground and streets
add(f'<rect x="{LO}" y="{LO}" width="{HI - LO}" height="{HI - LO}" fill="#20242e"/>')
for j in range(len(W)):
    c, w = lines[j], W[j]
    add(f'<rect x="{LO}" y="{c - w / 2}" width="{HI - LO}" height="{w}" fill="#2b3140"/>')
    add(f'<rect x="{c - w / 2}" y="{LO}" width="{w}" height="{HI - LO}" fill="#2b3140"/>')
for j, (kx, kz) in enumerate(KINDS):
    c, w = lines[j], W[j]
    for t, v in enumerate(centres):
        add(f'<rect x="{v - 7}" y="{c - w / 2}" width="14" height="{w}" fill="{STREET[kx[t]]}"/>')
        add(f'<rect x="{c - w / 2}" y="{v - 7}" width="{w}" height="14" fill="{STREET[kz[t]]}"/>')
# Tiles
for i, tile in enumerate(T):
    x, z, k = centres[i % n], centres[i // n], tile["k"]
    if k == "house":
        add(f'<rect x="{x - 6}" y="{z - 6}" width="12" height="12" fill="{house(tile["f"])}"/>')
    elif k == "lot":
        add(
            f'<rect x="{x - 6}" y="{z - 6}" width="12" height="12" fill="none" stroke="#59627a" stroke-width="1"/>'
        )
    elif (
        k == "park" and 22 <= i % n <= 25 and 22 <= i // n <= 25
    ):  # the hub plaza: paved, not a park
        add(f'<rect x="{x - 7}" y="{z - 7}" width="14" height="14" fill="#5a6278"/>')
    else:
        add(f'<rect x="{x - 6.5}" y="{z - 6.5}" width="13" height="13" fill="{TILE[k]}"/>')
# Hub roundabout and the tower
add(
    '<circle cx="0" cy="0" r="39.6" fill="#c2417a" opacity="0.9"/><circle cx="0" cy="0" r="26" fill="#5a6278"/>'
)
add('<circle cx="0" cy="0" r="7" fill="#f2f2f2"/>')
# Expressway and ramps
add('<rect x="258" y="-15" width="190" height="30" fill="#e8e8f0" opacity="0.85"/>')
for pts in RAMPS:
    d = " ".join(f"{x},{z}" for x, _, z in pts)
    add(
        f'<polyline points="{d}" fill="none" stroke="#e8e8f0" stroke-width="6" stroke-linejoin="round" opacity="0.85"/>'
    )
# Headquarters campus (cols 28-31, rows 17-22) and its front
add(
    '<rect x="87" y="-123" width="56" height="85" fill="#0b0b12" stroke="#ff3050" stroke-width="2.5"/>'
)
add('<polygon points="143,-80.5 153,-88 153,-73" fill="#ff3050"/>')
BASE = len(out)  # the plan so far, before any annotation: the concept crops reuse it


def zone(x0, z0, x1, z1, color, dash="8 5"):
    add(
        f'<rect x="{x0}" y="{z0}" width="{x1 - x0}" height="{z1 - z0}" fill="none" stroke="{color}" '
        f'stroke-width="3" stroke-dasharray="{dash}"/>'
    )


def tag(x, z, text, color="#ffffff", size=13, anchor="start"):
    add(
        f'<text x="{x}" y="{z}" fill="{color}" font-size="{size}" font-family="Segoe UI, Arial" font-weight="600" '
        f'text-anchor="{anchor}" paint-order="stroke" stroke="#101218" stroke-width="3">{text}</text>'
    )


def pin(x, z, label, color):
    add(f'<circle cx="{x}" cy="{z}" r="16" fill="{color}" stroke="#101218" stroke-width="2"/>')
    add(
        f'<text x="{x}" y="{z + 4}" fill="#101218" font-size="11" font-family="Segoe UI, Arial" '
        f'font-weight="700" text-anchor="middle">{label}</text>'
    )


zone(lines[2], lines[2], lines[6], lines[6], "#f0c060")  # old town: sectors 1-2 both ways
tag(lines[2] + 8, lines[2] + 22, "OLD TOWN (warped streets, mostly 12-16 floors)", "#f0c060")
zone(lines[4], LO, HI, lines[2], "#c8cee0", "3 4")  # the empty north-east frontier
tag(lines[4] + 6, LO + 18, "FRONTIER: sectors 62-90% empty lots, drawn as parking", "#c8cee0")
zone(-345, -32, -226, 60, "#60e0a0")
tag(-345, 80, "WEST PARK cut in four", "#60e0a0")
tag(150, -134, "IKARO HQ fronts the 14 m lane", "#ff6070")
tag(160, -36, "expressway + interchange", "#e8e8f0")
tag(-170, -318, "rail terminus + works", "#c8b0ff")
tag(-146, 236, "walk", "#3fb39a")
tag(10, 250, "boulevard / avenue", "#e080b0")
for x, z, f in [(414, -67, 31), (-192, 25, 29), (275, 414, 26)]:
    add(f'<circle cx="{x}" cy="{z}" r="13" fill="none" stroke="#ffffff" stroke-width="2.5"/>')
    tag(
        x + (-16 if x > 300 else 16),
        z - 16,
        f"{f} fl",
        "#ffffff",
        12,
        "end" if x > 300 else "start",
    )
for x, z, label, color in [
    (292.5, -62, "P0-1", "#ff4060"),
    (292.5, 62, "P0-1", "#ff4060"),
    (345, -100, "P0-2", "#ff4060"),
    (60, -380, "P1-1", "#ffb030"),
    (120, -150, "P1-2", "#ffb030"),
    (414, -100, "P1-3", "#ffb030"),
    (0, 62, "P1-4", "#ffb030"),
    (-285, 20, "P1-5", "#ffb030"),
    (-150, 120, "P1-6", "#ffb030"),
    (219.5, 120, "P1-7", "#ffb030"),
    (-210, -250, "P2-1", "#60c0ff"),
    (-240, 330, "P2-2", "#60c0ff"),
    (-190, -340, "P2-3", "#60c0ff"),
    (-415, -40, "P2-4", "#60c0ff"),
    (45, -82, "P2-5", "#60c0ff"),
]:
    pin(x, z, label, color)

# Legend and frame
L = HI + 30
legend = [
    ("house, shade = floors (2 dark ... 31 bright)", house(16)),
    ("empty lot (drawn as a parking plaza)", "#59627a"),
    ("market", TILE["market"]),
    ("power plant", TILE["plant"]),
    ("park", TILE["park"]),
    ("rail", TILE["rail"]),
    ("works", TILE["works"]),
    ("interchange land", TILE["road"]),
    ("boulevard / avenue 36 m", STREET["B"]),
    ("main street 21 m", STREET["S"]),
    ("ring road 16 m", STREET["R"]),
    ("lane 14 m", STREET["L"]),
    ("mid street 13 m (local or one-way)", STREET["l"]),
    ("pedestrian walk 14 m", STREET["W"]),
    ("service alley 6 m", STREET["a"]),
    ("built over / cut", "#2b3140"),
    ("expressway, ramps, slips", "#e8e8f0"),
]
tag(L, LO + 10, "VEKTOR-9 seed 7, tick 4032: urban audit plan", "#ffffff", 18)
tag(L, LO + 32, "measured: snapshot + the renderer's layout (unwarped)", "#aab0c0", 12)
for k, (text, color) in enumerate(legend):
    y = LO + 62 + k * 22
    add(
        f'<rect x="{L}" y="{y - 12}" width="16" height="14" fill="{color}" stroke="#59627a" stroke-width="0.5"/>'
    )
    tag(L + 24, y, text, "#dde2ee", 13)
y = LO + 62 + len(legend) * 22 + 20
for text in [
    "P0 broken circulation or function",
    "P1 major coherence problem",
    "P2 optional, aesthetic",
    "pins: findings in URBAN_AUDIT.md",
    "white rings: the three tallest towers",
    "red arrow: HQ front",
    "up = -z (top of the viewer's plan view)",
]:
    tag(
        L, y, text, {"P0": "#ff4060", "P1": "#ffb030", "P2": "#60c0ff"}.get(text[:2], "#aab0c0"), 13
    )
    y += 20
add(f'<rect x="{L}" y="{HI - 20}" width="100" height="6" fill="#ffffff"/>')
tag(L, HI - 28, "100 m", "#ffffff", 12)

VW, VH = HI - LO + 480, HI - LO + 40
svg = (
    f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{LO - 20} {LO - 20} {VW} {VH}" width="1400" '
    f'height="{round(1400 * VH / VW)}"><rect x="{LO - 20}" y="{LO - 20}" width="{VW}" height="{VH}" fill="#14161c"/>'
    + "".join(out)
    + "</svg>"
)
(OUT / "URBAN_PLAN.svg").write_text(svg)
print("wrote URBAN_PLAN.svg", len(svg) // 1024, "KB")

# Before / after concept crops (URBAN_CONCEPTS.svg): the same measured plan, unannotated, on the left; on the
# right the same crop with the proposal drawn over it. The overlays are concepts, not geometry from the code.
plan = "".join(out[:BASE])
CY, HATCH = "#40e0ff", "#f0e0a0"


def zebra(x, z, w, h):  # stripes across a crossing, w x h, stripes along the longer side
    s, along = [], w > h
    for k in range(int((w if along else h) // 1.6)):
        u = k * 1.6
        s.append(
            f'<rect x="{x + u if along else x}" y="{z if along else z + u}" width="{0.8 if along else w}" '
            f'height="{h if along else 0.8}" fill="#ffffff"/>'
        )
    return "".join(s)


hq_after = (
    # The chance paved square (cols 24-27) made the IKARO approach, kept closed whenever the HQ stands here
    f'<rect x="18" y="-89.5" width="56" height="18" fill="{CY}" opacity="0.35"/>'
    f'<rect x="18" y="-89.5" width="56" height="18" fill="none" stroke="{CY}" stroke-width="1.5" stroke-dasharray="4 3"/>'
    + zebra(
        74, -88, 13, 15
    )  # a raised crossing over the one-way mid street into the gap between the towers
    + f'<line x1="-18" y1="-80.5" x2="143" y2="-80.5" stroke="{CY}" stroke-width="1" stroke-dasharray="2 2"/>'
    # The front lane as a shared forecourt street along the campus
    + f'<rect x="143" y="-123" width="14" height="85" fill="{HATCH}" opacity="0.3"/>'
    # Empty lots across the lane dressed as an open court (they are empty lots in the snapshot)
    + f'<rect x="157" y="-129" width="56" height="97" fill="none" stroke="{HATCH}" stroke-width="1.5" stroke-dasharray="4 3"/>'
)
hub_after = (
    f'<circle cx="0" cy="0" r="26" fill="none" stroke="{CY}" stroke-width="5" opacity="0.6"/>'
    + "".join(
        zebra(*r)
        for r in [(-4, -39.6, 8, 13.6), (-4, 26, 8, 13.6), (-39.6, -4, 13.6, 8), (26, -4, 13.6, 8)]
    )
    + "".join(
        f'<path d="M {sx * 40} {sz * 18} A 44 44 0 0 {1 if sx * sz > 0 else 0} {sx * 18} {sz * 40}" fill="none" '
        f'stroke="{HATCH}" stroke-width="5" opacity="0.6"/>'
        for sx in (1, -1)
        for sz in (1, -1)
    )
)
frontier_after = (
    # The frontier's empty lots (north row of sectors, cols 16-47) as vacant ground instead of parking
    "".join(
        f'<rect x="{centres[c] - 7}" y="{centres[r] - 7}" width="14" height="14" fill="#6a5a40" opacity="0.8"/>'
        for r in range(8)
        for c in range(16, 48)
        if T[r * n + c]["k"] == "lot"
    )
    # Streets with no house on either side: unlit and unsignalled (outlined here, not measured street by street)
    + f'<rect x="-143" y="{LO}" width="{HI + 143}" height="{lines[2] - 10.5 - LO}" fill="none" stroke="{HATCH}" '
    f'stroke-width="2" stroke-dasharray="6 4"/>'
    # A night-market spine along the walk at x = -150, running out into the frontier
     + f'<rect x="-157" y="{LO}" width="14" height="{lines[2] - LO}" fill="{CY}" opacity="0.5"/>'
)
PANELS = [
    (
        "P1-1 frontier: today every empty lot is parking, every street lit",
        "vacant ground, a market spine on the walk; lights only where houses are",
        (-170, LO, 610, 160),
        frontier_after,
    ),
    (
        "P1-2 IKARO HQ: front on the 14 m lane, back to the boulevard",
        "the chance square made the IKARO approach; shared forecourt street; open court",
        (-25, -175, 250, 160),
        hq_after,
    ),
    (
        "P1-4 the centre: a roundabout, the tower out of reach",
        "zebras to the island, a promenade round the tower, the corners joined",
        (-75, -75, 150, 150),
        hub_after,
    ),
]
PW, PH, GAP = 600, 300, 70
parts = [
    f'<defs><g id="plan">{plan}</g></defs>',
    f'<rect width="{2 * PW + 3 * 20}" height="{len(PANELS) * (PH + GAP) + 40}" fill="#14161c"/>',
]
parts.append(
    '<text x="20" y="28" fill="#ffffff" font-size="18" font-family="Segoe UI, Arial" font-weight="600">'
    "Concepts (before: measured plan; after: proposal drawn over it, not built)</text>"
)
for k, (before, after, (vx, vz, vw, vh), overlay) in enumerate(PANELS):
    y = 50 + k * (PH + GAP)
    for col, (title, extra) in enumerate([(before, ""), (after, overlay)]):
        x = 20 + col * (PW + 20)
        parts.append(
            f'<text x="{x}" y="{y + 14}" fill="{"#ffb030" if col == 0 else CY}" font-size="14" '
            f'font-family="Segoe UI, Arial" font-weight="600">{("BEFORE  " if col == 0 else "AFTER  ") + title}</text>'
        )
        parts.append(
            f'<svg x="{x}" y="{y + 22}" width="{PW}" height="{PH}" viewBox="{vx} {vz} {vw} {vh}" '
            f'preserveAspectRatio="xMidYMid meet"><use href="#plan"/>{extra}</svg>'
        )
concepts = (
    f'<svg xmlns="http://www.w3.org/2000/svg" width="{2 * PW + 60}" height="{len(PANELS) * (PH + GAP) + 40}">'
    + "".join(parts)
    + "</svg>"
)
(OUT / "URBAN_CONCEPTS.svg").write_text(concepts)
print("wrote URBAN_CONCEPTS.svg", len(concepts) // 1024, "KB")
