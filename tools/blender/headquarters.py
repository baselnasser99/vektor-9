"""Build the IKARO headquarters' modules, in Blender (original design).

In Blender: REPO = r"<repo root>"; exec(open(REPO + "/tools/blender/headquarters.py").read())
Builds each module into its own scene "hq_<kind>" (with a studio for review renders). CITY = True
before exec writes the city's copies (web/assets/models/hq_<kind>).

The seat of the corporation that runs the city (web/src/headquarters.js): two black monoliths on a
block of 4 x 3 tiles that straddles a sector's service alley (61 x 42 m), the alley the gap
between them, a glass skybridge across the gap and a holographic eye above it (web/src/eye.js),
behind one formal plaza. Three.js coordinates, y up, front +z. Tower modules are in the tower's
own frame (its centre on the origin, 21 x 31.5 m, front face at z = 15.75); each comes in an "l"
and an "r" version, mirrored so the inner face (toward the gap) is +x on the left tower and -x on
the right. The plaza and the bridge are in the site's frame (its centre on the origin).
Monumental, angular, finished: proud armoured panels split by deep recessed channels, controlled
glass, chamfered corners carried up as titanium blades, light embedded: thin crimson channels,
rare crimson divisions, cool white only where people are. No exposed structure, no spires.
- base (28 m): the gateway (an 18 m recess between leaning titanium columns, a dark glass wall
  with three tall security doors, the lobby behind it); the left tower carries the name over it,
  the right one an eye; a delivery bay on the left;
- shaft_a / shaft_b (24 m): armoured faces, a glass ribbon (a) or a curtain wall up the front (b);
  the inner face mostly curtain wall between deep piers, framing the gap; shaft_b also carries
  a landing terrace cantilevered over the plaza at its foot: pad markings, crimson edge, barriers,
  a canopied glass door into the tower, struts under it;
- link (12 m): the bridge level: a recessed crimson division round the tower, and on the inner
  face the portal where the skybridge meets it, with a short corridor into the tower;
- hangar (24 m): two recessed vehicle bays in the outer face, aprons out, lit floors and
  guidance lines, bay numbers, glass doors at the back;
- roof (14 m): a solid armoured band, a thick parapet with raised corner caps, a recessed
  mechanical well with louvres, low communications plant and red warning lights;
- plaza: dark stone panels and light lines over the whole frontage, security gates before each
  gateway, planters, benches, totems, bollards, a guard booth at the alley's mouth;
- bridge: the skybridge, 18 m long and 8 m wide at 77 m: a solid deck on deep edge girders and
  cross beams with struts to the towers, glass walls and roof between dark mullions and ribs,
  crimson strips along the floor, cool light under the roof, portal frames at both ends.
Conventions: tools/blender/kit.py.
"""

import importlib
import math
import os
import sys

import bmesh
import bpy
from mathutils import Matrix

sys.path.insert(0, os.path.join(REPO, "tools", "blender"))  # noqa: F821
import kit  # noqa: E402

importlib.reload(kit)  # Blender keeps modules between runs
for role, value in {
    "facade": kit.ROLES["glass"],  # the renderer's facade shader draws the windows
    "hull": (0x161C29, 0.5, 0.35, None, 0, 1, None),  # midnight blue-black armour
    "fin": (0x3A3F45, 0.6, 0.4, None, 0, 1, None),  # dark titanium blades and columns
    "stone": (0x1E2128, 0.0, 0.7, None, 0, 1, None),  # dark stone paving
    "crimson": (0x5A0E16, 0.0, 0.5, 0xB3122A, 2.5, 1, None),  # embedded crimson light
    "eye": (0x5A0E16, 0.0, 0.5, 0xD0182E, 3.5, 1, None),  # the eye's iris
    "pupil": (0x6A1018, 0.0, 0.5, 0xFF3A3A, 6.0, 1, None),  # its pupil, brightest
    "face": kit.ROLES["ad"],  # a small corporate display, UVs 0..1
    "skyglass": (0x8FA3AE, 0.2, 0.08, None, 0, 0.25, None),  # the skybridge's glass
}.items():
    kit.ROLES.setdefault(role, value)
from kit import (  # noqa: E402
    add,
    at,
    bar,
    block,
    clear,
    facing,
    join,
    lamp,
    parts,
    screen,
    studio,
    text,
    tube,
)

M = Matrix()
NAME = "IKARO"  # the corporation (web/src/world.js CORPS)
TW, TD = 21.0, 31.5  # a tower, in its own frame: x across (+x inner on the left tower), z front
TC = (19.5, -4.75)  # a tower's centre in the site's frame: (|u|, w)
DECK = 77.0  # the skybridge's floor (site frame); the link module starts at 76
BRIDGE_W = (-7.0, 1.0)  # its sides, across the site (w)
INNER = 1  # +1: building the left tower (inner face +x); -1: the right one


def rot(a):
    return Matrix.Rotation(a, 4, "Y")


def faces(w, d):
    """Frames for a w x d plan's four faces (+z out of each, its plane at z = 0), front, +x, back,
    -x: (frame, face width)."""
    sides = ((0, d / 2, w), (math.pi / 2, w / 2, d), (math.pi, d / 2, w), (-math.pi / 2, w / 2, d))
    return [(rot(a) @ Matrix.Translation((0, 0, dist)), width) for a, dist, width in sides]


def inner_face():
    """The index (in faces()) of the face toward the gap."""
    return 1 if INNER > 0 else 3


def put(role, f, u, y, w, h, depth, out=0.0, detail=False):
    """A box on face frame f: u across, centred at height y, its back `out` from the face plane."""
    return block(role, w, h, depth, f @ Matrix.Translation((u, y, out + depth / 2)), detail)


def prism(role, pts, depth, m, detail=False):
    """A flat convex shape (x, y points) facing +z, front at z = 0, `depth` thick, moved by m."""
    bm = bmesh.new()
    front = [bm.verts.new((x, y, 0)) for x, y in pts]
    back = [bm.verts.new((x, y, -depth)) for x, y in pts]
    bm.faces.new(front)
    bm.faces.new(back[::-1])
    for i in range(len(pts)):
        j = (i + 1) % len(pts)
        bm.faces.new((back[i], back[j], front[j], front[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    return add(bm, role, m, detail, smooth_angle=30)


def almond(w, h, n=28):
    ts = [math.pi * i / n for i in range(n + 1)]
    top = [(w / 2 * math.cos(t), h / 2 * math.sin(t) ** 0.8) for t in ts]
    return top + [(x, -y) for x, y in top[-2:0:-1]]


def disc(r, n=24):
    return [
        (r * math.cos(2 * math.pi * i / n), r * math.sin(2 * math.pi * i / n)) for i in range(n)
    ]


def eye(w, h, m, detail=False, lit=True):
    """The IKARO eye, built into a wall facing +z at m: a crimson almond rim round a dark eye, a
    crimson iris and a brighter pupil. lit False: embossed in dark metal, only its rim lit."""
    prism("crimson", almond(w, h), 0.3, m, detail)
    prism("hull", almond(w * 0.86, h * 0.72), 0.3, m @ Matrix.Translation((0, 0, 0.05)), detail)
    prism("eye" if lit else "fin", disc(h * 0.3), 0.3, m @ Matrix.Translation((0, 0, 0.12)), detail)
    if lit:
        prism("pupil", disc(h * 0.11, 16), 0.3, m @ Matrix.Translation((0, 0, 0.2)), detail)


def corner_blades(y0, h):
    """Titanium blades across the tower's four chamfered corners, uninterrupted up a module."""
    for sx in (-1, 1):
        for sz in (-1, 1):
            m = at(rot(math.pi / 4 * sx * sz), sx * (TW / 2 - 1.1), y0 + h / 2, sz * (TD / 2 - 1.1))
            block("fin", 2.6, h, 0.7, m)


def armored(f, width, y0, h, bays, bands=(), lit=(), joint=6.0, skin=True):
    """A face of proud armour panels in vertical bays (u0, u1), split into rows `joint` apart, with
    recessed horizontal glass bands (y0, y1) through them; the channels between bays are deep and
    dark, those numbered in `lit` with a thin crimson line in them."""
    if skin:
        put("panel", f, 0, y0 + h / 2, width - 1.2, h, 0.2, -0.6)  # the recessed skin behind it all
    for y_a, y_b in bands:
        put("facade", f, 0, y0 + (y_a + y_b) / 2, width - 1.4, y_b - y_a, 0.1, -0.45)
        put("fin", f, 0, y0 + y_a - 0.15, width - 1.2, 0.3, 0.9, -0.5)  # a sill under each band
    edges = sorted([0, h, *[y for band in bands for y in band]])
    spans = [(a, b) for a, b in zip(edges[::2], edges[1::2], strict=False) if b - a > 0.5]
    for u0, u1 in bays:
        for a, b in spans:
            rows = max(1, round((b - a) / joint))
            for r in range(rows):
                ya, yb = a + (b - a) * r / rows, a + (b - a) * (r + 1) / rows
                put(
                    "hull",
                    f,
                    (u0 + u1) / 2,
                    y0 + (ya + yb) / 2,
                    u1 - u0,
                    yb - ya - 0.12,
                    0.75,
                    -0.4,
                )
    for k, ((_, u1), (u2, _)) in enumerate(zip(bays, bays[1:], strict=False)):
        if k in lit:
            put("crimson", f, (u1 + u2) / 2, y0 + h / 2, 0.14, h, 0.05, -0.42)


def curtain(f, width, y0, h, piers, lit=()):
    """A recessed curtain wall between deep titanium piers (the inner face, toward the gap)."""
    put("panel", f, 0, y0 + h / 2, width - 1.2, h, 0.2, -0.6)
    put("facade", f, 0, y0 + h / 2, width - 1.4, h, 0.1, -0.45)
    for k, u in enumerate(piers):
        put("fin", f, u, y0 + h / 2, 0.8, h, 1.5, -0.4)
        if k in lit:
            put("crimson", f, u + 0.7, y0 + h / 2, 0.1, h, 0.05, -0.42)


FRONT_BAYS = {"a": [(-9.6, -3.2), (-2.4, 2.4), (3.2, 9.6)], "b": [(-9.6, -2.4), (2.4, 9.6)]}
SIDE_BAYS = [(-14.6, -5.4), (-4.6, 4.6), (5.4, 14.6)]
PIERS = (-12.0, -6.0, 0.0, 6.0, 12.0)


def tower_faces(y0, h, variant, skip=()):
    """The four faces of a tower module, front composition by variant; faces in `skip` are left
    to the caller."""
    for k, (f, width) in enumerate(faces(TW, TD)):
        if k in skip:
            continue
        if k == inner_face():
            curtain(f, width, y0, h, PIERS, lit=(1, 3) if variant == "a" else (2,))
        elif k % 2 == 0 and variant == "b":
            armored(f, width, y0, h, FRONT_BAYS["b"])
            put("facade", f, 0, y0 + h / 2, 4.0, h, 0.1, -0.45)
            for u in (-2.25, 2.25):
                put("crimson", f, u, y0 + h / 2, 0.12, h, 0.05, -0.42)
        elif k % 2 == 0:
            armored(
                f, width, y0, h, FRONT_BAYS["a"], bands=[(17, 20.5)], lit=(0, 1) if k == 0 else ()
            )
        else:
            armored(f, width, y0, h, SIDE_BAYS, bands=[(5, 8.5)] if variant == "b" else ())


def base():
    H, F = 28.0, TD / 2  # F: the front face
    # The body: a lobby hollow (x +-6, z 1.75 to 9.75, 9.4 m high) behind the gateway's glass.
    block("panel", TW, H, 17.5, at(M, 0, H / 2, -7.0))
    for s in (-1, 1):
        block("panel", 4.5, H, 8.0, at(M, s * 8.25, H / 2, 5.75))
    block("panel", 12, H - 9.4, 8.0, at(M, 0, 9.4 + (H - 9.4) / 2, 5.75))
    # The front masses either side of the gateway, and the lintel over it.
    for s in (-1, 1):
        block("hull", 4.5, H, 6, at(M, s * 8.25, H / 2, F - 3))
        for r in range(4):
            block("hull", 3.8, 6.8, 0.5, at(M, s * 8.25, 3.5 + r * 7, F + 0.25))
    block("hull", 12, 10, 6, at(M, 0, 23, F - 3))
    # The gateway: 18 m high, lit from its ceiling, crimson at the inner frame.
    for x in (-3.5, 0, 3.5):
        block("white", 0.25, 0.04, 5.4, at(M, x, 17.97, F - 3))
    for s in (-1, 1):
        block("crimson", 0.12, 18, 0.12, at(M, s * 5.9, 9, 9.85))
    block("crimson", 11.8, 0.12, 0.12, at(M, 0, 17.9, 9.85))
    block("panel", 12, 9, 0.4, at(M, 0, 13.5, 9.55))
    # The inner wall: dark glass, three tall security doors, scan panels and indicators.
    block("glass", 11.8, 9, 0.2, at(M, 0, 4.5, 9.65))
    for u in (-3.2, 0.0, 3.2):
        block("hull", 2.4, 6.6, 0.25, at(M, u, 3.3, 9.83))
        block("white", 2.4, 0.05, 0.05, at(M, u, 6.65, 9.97))
        block("white", 0.25, 1.1, 0.06, at(M, u + 1.55, 1.6, 9.8), detail=True)
        lamp((u + 1.55, 2.35, 9.85), 0.06)
    # The lobby: pale floor, cool ceiling strips, reception, a display.
    block("stone", 11.6, 0.06, 7.6, at(M, 0, 0.03, 5.75))
    for k in range(4):
        block("white", 10, 0.05, 0.3, at(M, 0, 8.7, 8.6 - k * 1.9))
    block("fin", 5, 1.05, 1.1, at(M, 0, 0.53, 4.6))
    block("white", 5, 0.04, 0.04, at(M, 0, 1.07, 5.16))
    screen("face", 5, 3, at(M, 0, 4.5, 1.97))
    # Over the opening: the name on the left tower, an eye on the right one.
    if INNER > 0:
        text("white", NAME, 2.0, at(facing(math.pi / 2), 0, 22.5, F + 0.05), depth=0.25)
    else:
        eye(6.0, 2.6, at(M, 0, 22.5, F + 0.05))
    # The columns at the gateway's mouth, leaning in; cameras near their tops.
    for s in (-1, 1):
        bar("fin", (s * 6.9, 0, F + 1.6), (s * 6.3, H - 0.5, F + 0.4), 1.9, 1.4, math.pi / 2)
        block("crimson", 0.1, 8, 0.06, at(M, s * 6.55, 4.5, F + 1.9))
        block("dark", 0.4, 0.3, 0.6, at(M, s * 5.4, 16.5, F - 0.3), detail=True)
        lamp((s * 5.4, 16.4, F + 0.05), 0.05)
    if INNER > 0:  # the delivery bay, in the left tower's inner mass
        block("dark", 3.0, 4.2, 0.2, at(M, 8.5, 2.1, F + 0.1))
        block("white", 3.0, 0.06, 0.06, at(M, 8.5, 4.5, F + 0.25))
        lamp((9.9, 3.6, F + 0.25), 0.08)
    corner_blades(0, H)
    for k, (f, width) in enumerate(faces(TW, TD)):
        if k == inner_face():
            curtain(f, width, 0, H, PIERS, lit=(2,))
        elif k:
            armored(
                f, width, 0, H, SIDE_BAYS if k % 2 else FRONT_BAYS["b"], lit=(0,) if k % 2 else ()
            )


def shaft(variant):
    H = 24.0
    tower_faces(0, H, variant)
    corner_blades(0, H)
    if variant == "b":  # the landing terrace at its foot, out over the plaza
        F = TD / 2
        block("hull", 18, 0.8, 7.2, at(M, 0, 0.4, F + 3.6), bevel=0.08)
        block("stone", 17.6, 0.04, 6.8, at(M, 0, 0.82, F + 3.6))
        for x in (-8.9, 8.9):  # barriers on the sides, low, dark glass on steel
            block("fin", 0.12, 1.1, 7.0, at(M, x, 1.35, F + 3.6))
            block("glass", 0.05, 0.9, 7.0, at(M, x, 1.35, F + 3.6))
        block("crimson", 17.8, 0.06, 0.08, at(M, 0, 0.86, F + 7.15))
        for x in (-8.85, 8.85):
            block("crimson", 0.08, 0.06, 7.0, at(M, x, 0.86, F + 3.6))
        for z in (F + 1.8, F + 5.6):  # the pad's outline
            block("white", 7.2, 0.02, 0.1, at(M, 0, 0.85, z))
        for x in (-3.6, 3.6):
            block("white", 0.1, 0.02, 3.8, at(M, x, 0.85, F + 3.7))
        for z in (F + 6.6, F + 6.0):  # guidance chevrons at the open front
            block("white", 0.7, 0.02, 0.12, at(rot(0.6), -0.3, 0.85, z), detail=True)
            block("white", 0.7, 0.02, 0.12, at(rot(-0.6), 0.3, 0.85, z), detail=True)
        text(
            "white",
            "01" if INNER > 0 else "02",
            0.9,
            at(facing(math.pi / 2), 6.2, 1.4, F + 0.05),
            0.05,
        )
        # The door into the tower, under a short canopy; struts under the terrace.
        block("glass", 3.6, 3.2, 0.12, at(M, 0, 2.4, F + 0.02))
        block("white", 3.6, 0.05, 0.05, at(M, 0, 4.05, F + 0.1))
        block("hull", 6, 0.35, 2.2, at(M, 0, 4.6, F + 1.1))
        block("white", 0.25, 0.9, 0.06, at(M, 2.2, 1.9, F + 0.06), detail=True)
        for x in (-7.0, 7.0):
            bar("fin", (x, -7.0, F + 0.3), (x, 0.0, F + 6.0), 0.8, 0.6, math.pi / 2)


def link():
    """The bridge level: a recessed crimson division round the tower, and the bridge's portal with
    its corridor on the inner face."""
    H, y_deck = 12.0, DECK - 76.0
    zc, half = (BRIDGE_W[0] + BRIDGE_W[1]) / 2 - TC[1], (BRIDGE_W[1] - BRIDGE_W[0]) / 2
    for k, (f, width) in enumerate(faces(TW, TD)):
        put("graphite", f, 0, 0.6, width - 1.0, 1.2, 0.3, -0.5)
        put("crimson", f, 0, 0.6, width - 2.6, 0.1, 0.05, -0.2)
        if k == inner_face():
            continue
        armored(
            f,
            width,
            1.2,
            H - 1.2,
            SIDE_BAYS if k % 2 else FRONT_BAYS["a"],
            lit=(1,) if k == 0 else (),
        )
    # The inner face, round the portal: armour above it, piers either side.
    f, width = faces(TW, TD)[inner_face()]
    u0, u1 = -zc * INNER - half - 0.6, -zc * INNER + half + 0.6  # the portal across this face
    top = y_deck + 5.2
    put("panel", f, 0, (top + H) / 2, width - 1.2, H - top, 0.2, -0.6)
    put("hull", f, 0, (top + H) / 2, width - 1.2, H - top - 0.2, 0.75, -0.4)
    for a, b in ((-width / 2 + 0.6, u0), (u1, width / 2 - 0.6)):
        put("panel", f, (a + b) / 2, (1.2 + top) / 2, b - a, top - 1.2, 0.2, -0.6)
        put("facade", f, (a + b) / 2, (1.2 + top) / 2, b - a, top - 1.4, 0.1, -0.45)
    for u in (u0, u1):  # the portal's frame, proud, a crimson line over it
        put("hull", f, u, (y_deck + top) / 2, 1.2, top - y_deck + 0.6, 1.6, -0.2)
    put("hull", f, (u0 + u1) / 2, top + 0.4, u1 - u0 + 1.2, 0.8, 1.6, -0.2)
    put("crimson", f, (u0 + u1) / 2, top - 0.1, u1 - u0 - 1.0, 0.08, 0.05, 1.4)
    # The corridor in: floor, walls, ceiling light, a glass door at its end, 6 m in.
    x_face, depth = INNER * TW / 2, 6.0
    xc = x_face - INNER * depth / 2
    block("graphite", depth, 0.2, 2 * half, at(M, xc, y_deck - 0.1, zc))
    for z in (zc - half, zc + half):
        block("dark", depth, 5.2, 0.2, at(M, xc, y_deck + 2.6, z))
    block("dark", depth, 0.2, 2 * half, at(M, xc, y_deck + 5.3, zc))
    block("white", depth - 1, 0.04, 0.3, at(M, xc, y_deck + 5.18, zc))
    block("glass", 0.15, 3.4, 4.0, at(M, x_face - INNER * depth, y_deck + 1.7, zc))
    block("white", 0.08, 0.05, 4.0, at(M, x_face - INNER * (depth - 0.1), y_deck + 3.45, zc))
    corner_blades(1.2, H - 1.2)


HANGARS = (-7.5, 7.5)  # the bays' centres along the outer face (z)
BAY = (6.0, 7.0, 12.0, 9.0)  # their floor (above the module's foot), height, width, depth


def hangar():
    H = 24.0
    outer = 3 if INNER > 0 else 1
    tower_faces(0, H, "a", skip=(outer,))
    f, width = faces(TW, TD)[outer]
    y0, bh, bw, bd = BAY
    # The skin and armour round the bays (never over them): below, above, between and beside them.
    put("panel", f, 0, y0 / 2, width - 1.2, y0, 0.2, -0.6)
    put("panel", f, 0, (y0 + bh + H) / 2, width - 1.2, H - y0 - bh, 0.2, -0.6)
    for a, b in ((-width / 2 + 0.6, -13.5), (-1.5, 1.5), (13.5, width / 2 - 0.6)):
        put("panel", f, (a + b) / 2, y0 + bh / 2, b - a, bh, 0.2, -0.6)
    put("hull", f, 0, y0 / 2, width - 1.2, y0 - 0.12, 0.75, -0.4)
    put("hull", f, 0, (y0 + bh + H) / 2 + 0.3, width - 1.2, H - y0 - bh - 0.6, 0.75, -0.4)
    for a, b in ((-width / 2 + 0.6, -13.5), (-1.5, 1.5), (13.5, width / 2 - 0.6)):
        put("hull", f, (a + b) / 2, y0 + bh / 2, b - a, bh, 0.75, -0.4)
    for zc in HANGARS:
        u = zc if INNER > 0 else -zc  # the outer face's u runs with the tower's z on the left
        # The bay: floor out to an apron, walls, ceiling with cool strips, a glass door at the back.
        block(
            "hull",
            bd + 2.5,
            0.6,
            bw,
            f @ Matrix.Translation((u, y0 - 0.3, -bd / 2 + 1.25)) @ rot(math.pi / 2),
        )
        put("dark", f, u, y0 + bh + 0.1, bw, 0.2, bd, -bd)
        for s in (-1, 1):
            put("dark", f, u + s * (bw / 2 + 0.1), y0 + bh / 2, 0.2, bh, bd, -bd)
        put("glass", f, u, y0 + 1.8, 4.0, 3.4, 0.12, -bd)
        put("white", f, u, y0 + 3.55, 4.0, 0.05, 0.05, -bd + 0.12)
        put("dark", f, u, y0 + bh / 2, bw, bh, 0.2, -bd - 0.2)
        for k in (-1, 0, 1):
            put("white", f, u + k * 3.5, y0 + bh - 0.08, 0.25, 0.04, bd - 1, -bd + 0.5)
        put("crimson", f, u, y0 + 0.02, bw - 0.4, 0.06, 0.08, 2.4)  # the apron's lit edge
        for s in (-1, 1):
            put("crimson", f, u + s * (bw / 2 - 0.25), y0 + 0.02, 0.08, 0.06, bd + 2.4, -bd + 0.05)
            put("white", f, u + s * 2.2, y0 + 0.01, 0.12, 0.02, bd + 1.5, -bd + 1)  # guidance lines
            put("fin", f, u + s * 4.5, y0 - 2.2, 0.5, 3.8, 0.6, 0.6)  # brackets under the apron
        label = (
            f @ Matrix.Translation((u - bw / 2 + 1.2, y0 + bh - 0.9, 0.02)) @ facing(math.pi / 2)
        )
        text("white", "H1" if zc < 0 else "H2", 0.8, label, 0.05)
    corner_blades(0, H)


def roof():
    for k, (f, width) in enumerate(faces(TW, TD)):  # a solid band, a crimson division in it
        put("panel", f, 0, 5, width - 1.2, 10, 0.2, -0.6)
        put("hull", f, 0, 3, width - 1.2, 5.8, 0.75, -0.4)
        put("graphite", f, 0, 6.3, width - 1.0, 0.6, 0.3, -0.5)
        put("crimson", f, 0, 6.3, width - 3.0, 0.08, 0.05, -0.2)
        put("hull", f, 0, 8.4, width - 1.2, 3.6, 0.75, -0.4)
        if (
            k == inner_face()
        ):  # the gap's side: a deep fin either side of centre, rising past the parapet
            for u in (-4.0, 4.0):
                put("fin", f, u, 7.0, 1.0, 14.0, 1.4, -0.4)
    corner_blades(0, 10)
    block("panel", TW - 1.2, 0.5, TD - 1.2, at(M, 0, 10.0, 0))  # the roof deck
    # The parapet: thick, its corners capped higher; the mechanical well sunk in the middle.
    for f, width in faces(TW - 0.6, TD - 0.6):
        put("hull", f, 0, 11.5, width, 3.0, 1.5, -1.5)
        put("graphite", f, 0, 13.1, width + 0.2, 0.25, 1.8, -1.6)
    for sx in (-1, 1):
        for sz in (-1, 1):
            block(
                "hull",
                3.4,
                4.4,
                3.4,
                at(M, sx * (TW / 2 - 1.9), 12.2, sz * (TD / 2 - 1.9)),
                bevel=0.1,
            )
            lamp((sx * (TW / 2 - 1.9), 14.55, sz * (TD / 2 - 1.9)), 0.16)
    block("dark", 10, 0.3, 16, at(M, 0, 9.9, 0))
    for k in range(6):
        block("graphite", 9.6, 0.25, 0.3, at(M, 0, 10.35, -7 + k * 2.8))
    block("graphite", 4.5, 1.8, 3.5, at(M, -INNER * 4, 11.15, -10), bevel=0.1)
    block("graphite", 3.0, 1.4, 2.5, at(M, -INNER * 4.5, 10.95, 10), bevel=0.1)
    tube("fin", (INNER * 5.5, 10.25, 9), (INNER * 5.5, 13.6, 9), 0.12, seg=8)
    lamp((INNER * 5.5, 13.75, 9), 0.18)
    tube("graphite", (INNER * 5.5, 10.25, -11), (INNER * 5.5, 11.0, -11), 0.9, seg=16)


def plaza():
    """The site's frontage, in its frame: the towers' fronts at w = 11, the sidewalk at 21."""
    for i in range(20):
        for j in range(3):
            block("stone", 3.0, 0.06, 3.2, at(M, -28.5 + i * 3.0, 0.03, 12.6 + j * 3.25))
    for tc in (-TC[0], TC[0]):
        for x in (-4.8, 4.8):
            block("white", 0.08, 0.02, 9.8, at(M, tc + x, 0.065, 16))
        for u in (-3.2, 0.0, 3.2):  # three security gates before each gateway
            for s in (-1, 1):
                block("fin", 0.3, 2.6, 0.5, at(M, tc + u + s * 1.35, 1.3, 15.5))
                block("white", 0.05, 1.8, 0.06, at(M, tc + u + s * 1.2, 1.3, 15.5), detail=True)
            block("fin", 3.0, 0.3, 0.5, at(M, tc + u, 2.75, 15.5))
            eye(0.6, 0.26, at(M, tc + u, 2.75, 15.76), detail=True, lit=False)
        s = -1 if tc < 0 else 1  # the outer side: a planter; the inner side: a bench and a totem
        block("hull", 2.0, 1.1, 5.4, at(M, tc + s * 7.6, 0.55, 17.0), bevel=0.05)
        block("olive", 1.7, 0.4, 5.0, at(M, tc + s * 7.6, 1.25, 17.0), detail=True)
        block("stone", 0.8, 0.45, 3.2, at(M, tc - s * 6.6, 0.225, 18.2))
        block("fin", 0.5, 2.3, 0.3, at(M, tc - s * 5.6, 1.15, 20.2))
        screen("face", 0.42, 0.9, at(M, tc - s * 5.6, 1.5, 20.36), detail=True)
    block("white", 61, 0.02, 0.08, at(M, 0, 0.065, 13.6))
    # The alley's mouth: a guard booth, bollards across it.
    block("hull", 2.2, 2.7, 1.8, at(M, 0, 1.35, 16.5), bevel=0.06)
    block("glass", 2.0, 1.0, 1.82, at(M, 0, 1.9, 16.5))
    block("white", 2.2, 0.05, 1.8, at(M, 0, 2.72, 16.5))
    for x in (-29.6, -27.0, -24.4, -13.6, -8.6, -5.2, -3.0, 3.0, 5.2, 8.6, 13.6, 24.4, 27.0, 29.6):
        tube("fin", (x, 0, 20.6), (x, 0.95, 20.6), 0.14, True)
        tube("white", (x, 0.95, 20.6), (x, 1.0, 20.6), 0.15, True)


def bridge():
    """The skybridge, in the site's frame: from the left tower's inner face (u = -9) across."""
    w0, w1 = BRIDGE_W
    wc, width, span = (w0 + w1) / 2, w1 - w0, 2 * (TC[0] - TW / 2)
    block("hull", span, 0.7, width + 0.4, at(M, 0, DECK - 0.35, wc))  # the deck
    block("stone", span, 0.04, width - 0.2, at(M, 0, DECK + 0.02, wc))
    for w in (w0, w1):  # deep edge girders, struts back to the towers
        block("hull", span, 1.8, 0.8, at(M, 0, DECK - 1.6, w))
        for s in (-1, 1):
            bar(
                "fin",
                (s * span / 2, DECK - 9, w),
                (s * (span / 2 - 4), DECK - 2.4, w),
                0.7,
                0.7,
                math.pi / 2,
            )
    for k in range(5):
        block(
            "graphite", 0.5, 0.9, width, at(M, -span / 2 + 2 + k * (span - 4) / 4, DECK - 1.1, wc)
        )
    # Glass walls and roof between dark mullions and ribs; rails top and bottom.
    H = 4.6
    for w in (w0, w1):
        block("skyglass", span, H, 0.06, at(M, 0, DECK + H / 2, w))
        block("graphite", span, 0.35, 0.3, at(M, 0, DECK + 0.17, w))
        block("graphite", span, 0.3, 0.3, at(M, 0, DECK + H, w))
        for k in range(10):
            block(
                "fin", 0.14, H, 0.2, at(M, -span / 2 + 0.9 + k * (span - 1.8) / 9, DECK + H / 2, w)
            )
        block("crimson", span, 0.05, 0.06, at(M, 0, DECK + 0.06, w + (0.2 if w == w0 else -0.2)))
        block(
            "crimson", span, 0.05, 0.05, at(M, 0, DECK + H + 0.18, w + (-0.17 if w == w0 else 0.17))
        )
    block("skyglass", span, 0.05, width, at(M, 0, DECK + H + 0.1, wc))
    for k in range(10):
        block(
            "fin",
            0.14,
            0.2,
            width,
            at(M, -span / 2 + 0.9 + k * (span - 1.8) / 9, DECK + H + 0.05, wc),
        )
    for w in (wc - 1.2, wc + 1.2):
        block("white", span - 1, 0.04, 0.25, at(M, 0, DECK + H - 0.1, w))
    for s in (-1, 1):  # portal frames where it meets the towers
        u = s * (span / 2 - 0.3)
        for w in (w0 - 0.4, w1 + 0.4):
            block("hull", 0.8, H + 1.2, 0.8, at(M, u, DECK + (H + 1.2) / 2 - 0.6, w))
        block("hull", 0.8, 0.8, width + 1.6, at(M, u, DECK + H + 0.6, wc))


def both(make):
    """The left (inner +x) and right (inner -x) versions of a tower module."""

    def build(inner):
        global INNER
        INNER = inner
        make()

    return {"l": lambda: build(1), "r": lambda: build(-1)}


MODELS = {"hq_plaza": plaza, "hq_bridge": bridge}
for kind, make in {
    "base": base,
    "shaft_a": lambda: shaft("a"),
    "shaft_b": lambda: shaft("b"),
    "link": link,
    "hangar": hangar,
    "roof": roof,
}.items():
    for side, build in both(make).items():
        MODELS[f"hq_{kind}_{side}"] = build

for name, make in MODELS.items():
    scene = bpy.data.scenes.get(name) or bpy.data.scenes.new(name)
    bpy.context.window.scene = scene
    clear(scene)
    parts.clear()
    make()
    join(scene, name)
    studio(scene)
    print(name, kit.stats(name))
    if globals().get("CITY"):  # the city's copies: .gltf + .bin, loaded by web/src/headquarters.js
        folder = os.path.join(REPO, "web", "assets", "models", name)  # noqa: F821
        print(kit.export(name, folder, "GLTF_SEPARATE"))
