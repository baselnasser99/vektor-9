"""Build the IKARO headquarters' modules, in Blender (original design).

In Blender: REPO = r"<repo root>"; exec(open(REPO + "/tools/blender/headquarters.py").read())
Builds each module into its own scene "hq_<kind>" (with a studio for review renders). CITY = True
before exec writes the city's copies (web/assets/models/hq_<kind>).

The seat of the corporation that runs the city (web/src/headquarters.js): two black monoliths on a
block of 6 x 4 tiles that straddles a sector's service alley (89 x 56 m), the alley the gap
between them, a glass skybridge across the gap and a holographic eye above it (web/src/eye.js),
behind one formal plaza. Three.js coordinates, y up, front +z. Tower modules are in the tower's
own frame (its centre on the origin, 30 x 36 m, front face at z = 18); each comes in an "l"
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
  a landing terrace cantilevered 11 m over the plaza at its foot: the car's outline, a landing
  ring, chevrons, crimson edges, white landing lights, barriers, a wide canopied door, struts;
  the left tower (administration) has more office glass, the right (security) more lit armour;
- link (12 m): the bridge level: a recessed crimson division round the tower, and on the inner
  face the portal where the skybridge meets it, with a short corridor into the tower;
- hangar (24 m): two recessed vehicle bays in the outer face, landing aprons out on struts
  (4 m on the left tower, 7.5 m on the right), crimson perimeters, white landing lights,
  guidance lines, assigned boxes, bay numbers, glass doors at the back;
- roof (14 m + crown): a solid armoured band; an armoured crown with chamfered corner towers and
  a sunken command deck crossed by crimson channels; on the left a formal glazed pavilion, on the
  right an armoured command enclosure with flat sector panels and an array slab;
- plaza: dark stone panels and light lines over the whole frontage, security gates before each
  gateway, planters, benches, totems, bollards, a guard booth at the alley's mouth;
- bridge: the skybridge, 18 m long, 12 m wide and 7 m tall at 77 m: a deck on deep edge girders
  and open cross beams with struts to the towers, panoramic glass walls and roof between few
  heavy frames and ribs, crimson floor edges, cool lanes, soft light under the ribs, portals.
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
    "lobby": (0x9AA8B2, 0.0, 0.6, 0xC8DCE8, 0.5, 1, None),  # a lobby's softly lit back wall
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
TW, TD = 30.0, 36.0  # a tower, in its own frame: x across (+x inner on the left tower), z front
TC = (24.0, -8.0)  # a tower's centre in the site's frame: (|u|, w); fronts at w = 10, gap |u| < 9
RAISE = 1.2  # the entrance terraces, gateways and lobbies stand this far above the forecourt
DECK = 77.0  # the skybridge's floor (site frame); the link module starts at 76
BRIDGE_W = (-9.0, 3.0)  # its sides, across the site (w)
BRIDGE_H = 7.0  # its glass walls, floor to roof
INNER = 1  # +1: building the left tower (inner face +x); -1: the right one


def rot(a):
    return Matrix.Rotation(a, 4, "Y")


def faces(w, d):
    """Frames for a w x d plan's four faces (+z out of each, its plane at z = 0), front, +x, back,
    -x: (frame, face width)."""
    sides = ((0, d / 2, w), (math.pi / 2, w / 2, d), (math.pi, d / 2, w), (-math.pi / 2, w / 2, d))
    return [(rot(a) @ Matrix.Translation((0, 0, dist)), width) for a, dist, width in sides]


def admin():
    """The left tower is corporate administration; the right one security and transport."""
    return INNER > 0


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


FRONT_BAYS = {"a": [(-13.6, -4.6), (-3.6, 3.6), (4.6, 13.6)], "b": [(-13.6, -3.0), (3.0, 13.6)]}
SIDE_BAYS = [(-16.6, -6.2), (-5.2, 5.2), (6.2, 16.6)]
PIERS = (-14.0, -7.0, 0.0, 7.0, 14.0)


def spine(y0, h):
    """The structural spine up the inner face under and over the skybridge's portal: a broad proud
    armour mass between two deep titanium piers, crimson along its edges."""
    f, _ = faces(TW, TD)[inner_face()]
    zc = (BRIDGE_W[0] + BRIDGE_W[1]) / 2 - TC[1]
    uc, half = -zc * INNER, (BRIDGE_W[1] - BRIDGE_W[0]) / 2 + 1.5
    put("hull", f, uc, y0 + h / 2, 2 * half, h, 1.4, -0.4)
    for s in (-1, 1):
        put("fin", f, uc + s * (half + 0.5), y0 + h / 2, 1.0, h, 2.2, -0.4)
        put("crimson", f, uc + s * (half - 0.4), y0 + h / 2, 0.1, h, 0.05, 1.0)


def bastions(y0, h, a=4.0, out=0.8):
    """Heavy corner masses, proud of both faces they turn, a graphite cap band, a crimson line."""
    for sx in (-1, 1):
        for sz in (-1, 1):
            x, z = sx * (TW / 2 - a / 2 + out), sz * (TD / 2 - a / 2 + out)
            block("hull", a, h, a, at(M, x, y0 + h / 2, z), bevel=0.1)
            block("graphite", a + 0.3, 0.6, a + 0.3, at(M, x, y0 + h - 0.3, z))
            block(
                "crimson",
                0.1,
                h - 3.0,
                0.05,
                at(M, x + sx * (a / 2 - 0.5), y0 + h / 2, z + sz * (a / 2 + 0.02)),
            )


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
            put("facade", f, 0, y0 + h / 2, 5.4, h, 0.1, -0.45)
            for u in (-2.95, 2.95):
                put("crimson", f, u, y0 + h / 2, 0.12, h, 0.05, -0.42)
        elif (
            k % 2 == 0
        ):  # the admin tower (left) carries more office glass, the security one more light
            bands = [(4, 7.5), (17, 20.5)] if admin() else [(17, 20.5)]
            armored(
                f,
                width,
                y0,
                h,
                FRONT_BAYS["a"],
                bands=bands,
                lit=(0, 1) if k == 0 or not admin() else (),
            )
        elif admin():  # office floors along the sides
            bands = [(5, 8.5), (15, 18.5)] if variant == "b" else [(11, 14.5)]
            armored(f, width, y0, h, SIDE_BAYS, bands=bands)
        else:  # the security tower's sides: solid armour, both channels lit
            armored(f, width, y0, h, SIDE_BAYS, lit=(0, 1))


GATE = (18.0, 22.0, 8.0)  # the gateway: width, height (from the raised floor), depth of its recess
LOBBY = (12.0, 6.0)  # the lobby behind its glass: height, depth


def plinth():
    """A stepped plinth round the base, broken only for the gateway and its columns."""
    gw = GATE[0]
    for k, (f, width) in enumerate(faces(TW, TD)):
        if k == 0:
            spans = [(-width / 2 - 1.6, -gw / 2 - 2.2), (gw / 2 + 2.2, width / 2 + 1.6)]
        else:
            spans = [(-width / 2 - 1.6, width / 2 + 1.6)]
        for a, b in spans:
            put("hull", f, (a + b) / 2, 0.6, b - a, 1.2, 1.6, 0.0)
            put("graphite", f, (a + b) / 2, 1.9, b - a - 1.6, 1.4, 0.8, 0.0)
            put("crimson", f, (a + b) / 2, 1.22, b - a, 0.05, 0.08, 1.45)


def base():
    """The gateway, lobby and plinth: a tall recess between the front masses, its floor raised a
    step above the forecourt, glass with three security doors, the lit lobby behind it, the name
    (left) or the eye (right) on the lintel, leaning titanium columns at its mouth."""
    H, F = 28.0, TD / 2
    (gw, gh, gd), (lh, ld) = GATE, LOBBY
    zg = F - gd  # the glass wall
    lz = zg - ld  # the lobby's back wall
    side = (TW - gw) / 2
    block("panel", TW, H, lz + TD / 2, at(M, 0, H / 2, (lz - TD / 2) / 2))
    for s in (-1, 1):
        xm = s * (gw / 2 + side / 2)
        block("panel", side, H, F - lz, at(M, xm, H / 2, (F + lz) / 2))
        for r in range(4):  # the front masses' armour plates
            if admin() and s == INNER and r == 0:
                continue  # the delivery bay, below
            block("hull", side - 0.8, 6.4, 0.5, at(M, xm, 3.6 + r * 6.8, F + 0.25))
    block("panel", gw, H - lh - RAISE, ld, at(M, 0, (H + lh + RAISE) / 2, (zg + lz) / 2))
    block("hull", gw, H - gh - RAISE, gd, at(M, 0, (H + gh + RAISE) / 2, (F + zg) / 2))
    # The floors, raised: the gateway's (a crimson edge at its lip) and the lobby's.
    block("stone", gw, RAISE, gd, at(M, 0, RAISE / 2, (F + zg) / 2))
    block("crimson", gw, 0.05, 0.08, at(M, 0, RAISE + 0.01, F - 0.1))
    block("stone", gw - 0.2, RAISE, ld, at(M, 0, RAISE / 2, (zg + lz) / 2))
    # The glass: the lobby's wall, dark glass above it, tall titanium fins up the whole recess.
    block("glass", gw - 0.2, lh, 0.2, at(M, 0, RAISE + lh / 2, zg))
    block("glass", gw - 0.2, gh - lh, 0.2, at(M, 0, RAISE + lh + (gh - lh) / 2, zg))
    for x in (-6.5, -2.0, 2.0, 6.5):
        block("fin", 0.5, gh, 1.2, at(M, x, RAISE + gh / 2, zg + 0.6))
    block("fin", gw, 0.5, 1.2, at(M, 0, RAISE + lh + 0.25, zg + 0.6))  # a transom over the lobby
    for x in (-4.5, 0.0, 4.5):  # the soffit's light, the frame's crimson
        block("white", 0.3, 0.04, gd - 1, at(M, x, RAISE + gh - 0.03, (F + zg) / 2))
    for s in (-1, 1):
        block("crimson", 0.12, gh, 0.12, at(M, s * (gw / 2 - 0.1), RAISE + gh / 2, F - 0.3))
    block("crimson", gw - 0.2, 0.12, 0.12, at(M, 0, RAISE + gh - 0.1, F - 0.3))
    # Three tall security doors, scan panels, indicators.
    for u in (-4.0, 0.0, 4.0):
        block("hull", 2.6, 7.0, 0.25, at(M, u, RAISE + 3.5, zg + 0.15))
        block("white", 2.6, 0.05, 0.05, at(M, u, RAISE + 7.05, zg + 0.3))
        block("white", 0.25, 1.1, 0.06, at(M, u + 1.65, RAISE + 1.6, zg + 0.2), detail=True)
        lamp((u + 1.65, RAISE + 2.35, zg + 0.25), 0.06)
    # The lobby: lit back wall, cool ceiling strips, reception, a display.
    block("lobby", gw - 0.4, lh - 0.4, 0.1, at(M, 0, RAISE + lh / 2, lz + 0.06))
    for k in range(3):
        block("white", gw - 2, 0.05, 0.3, at(M, 0, RAISE + lh - 0.1, zg - 1.2 - k * 1.8))
    block("fin", 6, 1.05, 1.1, at(M, 0, RAISE + 0.53, lz + 2.0))
    block("white", 6, 0.04, 0.04, at(M, 0, RAISE + 1.07, lz + 2.56))
    screen("face", 6, 3.4, at(M, 0, RAISE + 6.0, lz + 0.12))
    # Over the opening: the name on the left tower, an eye on the right one.
    top = RAISE + gh + (H - RAISE - gh) / 2
    if INNER > 0:
        text("white", NAME, 2.4, at(facing(math.pi / 2), 0, top, F + 0.05), depth=0.25)
    else:
        eye(7.0, 2.6, at(M, 0, top, F + 0.05))
    # Wayfinding on the outer front bastion: the tower's letter and its role.
    x, zf = -INNER * (TW / 2 - 4.5 / 2 + 1.0), TD / 2 + 1.0 + 0.05
    text("white", "A" if admin() else "B", 2.2, at(facing(math.pi / 2), x, 12.5, zf), 0.1)
    text(
        "white", "ADMIN" if admin() else "SECURITY", 0.5, at(facing(math.pi / 2), x, 10.6, zf), 0.05
    )
    # The columns at the gateway's mouth, leaning in; cameras near their tops.
    for s in (-1, 1):
        foot, head = (s * (gw / 2 + 0.9), 0, F + 2.0), (s * (gw / 2 + 0.2), H - 0.5, F + 0.4)
        bar("fin", foot, head, 2.4, 1.8, math.pi / 2)
        block("crimson", 0.1, 10, 0.06, at(M, s * (gw / 2 + 0.75), 6.5, F + 2.25))
        block(
            "dark", 0.4, 0.3, 0.6, at(M, s * (gw / 2 - 1.2), RAISE + gh - 3, F - 0.3), detail=True
        )
        lamp((s * (gw / 2 - 1.2), RAISE + gh - 3.1, F + 0.05), 0.05)
    if admin():  # the delivery bay, in the left tower's inner front mass, at street level
        x = INNER * (gw / 2 + side / 2)
        block("dark", 3.0, 4.2, 0.2, at(M, x, 2.1, F + 0.1))
        block("white", 3.0, 0.06, 0.06, at(M, x, 4.5, F + 0.25))
        lamp((x + 1.4, 3.6, F + 0.25), 0.08)
    plinth()
    bastions(0, H, 4.5, 1.0)
    for k, (f, width) in enumerate(faces(TW, TD)):
        if k == inner_face():
            curtain(f, width, 0, H, PIERS, lit=(2,))
        elif k:
            armored(
                f, width, 0, H, SIDE_BAYS if k % 2 else FRONT_BAYS["b"], lit=(0,) if k % 2 else ()
            )
    spine(0, H)


def shaft(variant):
    H = 24.0
    tower_faces(0, H, variant)
    corner_blades(0, H)
    spine(0, H)
    if variant == "b":
        terrace()


TERRACE = (24.0, 11.0)  # the landing terrace: across the front, out from it
PAD = 5.5  # the pad's centre, out from the front face


def ring(role, r, y, cx, cz, n, dash, w=0.14, detail=False):
    """A dashed ring of n marks on the floor at height y round (cx, cz)."""
    for i in range(n):
        t = 2 * math.pi * i / n
        m = at(rot(-t), cx + r * math.cos(t), y, cz + r * math.sin(t))
        block(role, w, 0.02, dash, m, detail)


def edge_lights(pts, y, step, detail=True):
    """Small white landing lights along a polyline of (x, z) floor points, `step` apart."""
    for (x0, z0), (x1, z1) in zip(pts, pts[1:], strict=False):
        n = max(1, round(math.hypot(x1 - x0, z1 - z0) / step))
        for i in range(n + 1):
            x, z = x0 + (x1 - x0) * i / n, z0 + (z1 - z0) * i / n
            block("white", 0.2, 0.08, 0.2, at(M, x, y + 0.04, z), detail)


def terrace():
    """The landing terrace at the foot of shaft_b, cantilevered out over the plaza: a thick deck on
    a deep fascia and raking struts, a pad with its outline, a dashed landing ring and chevrons
    toward the open front, crimson edges, small white landing lights, side barriers, the bay's
    number and a wide canopied door into the tower."""
    F, (tw, td) = TD / 2, TERRACE
    zc, top = F + td / 2, 0.86
    block("hull", tw, 1.4, td, at(M, 0, top - 0.74, zc), bevel=0.08)
    block("graphite", tw + 0.4, 2.2, 0.6, at(M, 0, top - 1.2, F + td + 0.1))  # the deep fascia
    block("stone", tw - 0.4, 0.04, td - 0.4, at(M, 0, top - 0.02, zc))
    for x in (-tw / 2 + 0.3, tw / 2 - 0.3):  # barriers on the sides, low, dark glass on steel
        block("fin", 0.14, 1.2, td - 0.4, at(M, x, top + 0.6, zc))
        block("glass", 0.05, 1.0, td - 0.4, at(M, x, top + 0.6, zc))
    block("crimson", tw - 0.2, 0.06, 0.1, at(M, 0, top + 0.02, F + td - 0.1))
    block("crimson", tw + 0.4, 0.1, 0.06, at(M, 0, top - 0.5, F + td + 0.42))  # along the fascia
    for x in (-tw / 2 + 0.55, tw / 2 - 0.55):
        block("crimson", 0.1, 0.06, td - 0.6, at(M, x, top + 0.02, zc))
    edge_lights([(-tw / 2 + 0.8, F + td - 0.45), (tw / 2 - 0.8, F + td - 0.45)], top, 1.2)
    for x in (-tw / 2 + 0.9, tw / 2 - 0.9):
        edge_lights([(x, F + 1.2), (x, F + td - 1.2)], top, 1.6)
    # The pad: the car's outline (side-on), a dashed ring round it, chevrons toward the open front.
    pz = F + PAD
    for z in (pz - 2.0, pz + 2.0):
        block("white", 7.6, 0.02, 0.14, at(M, 0, top, z))
    for x in (-3.8, 3.8):
        block("white", 0.14, 0.02, 4.0, at(M, x, top, pz))
    ring("white", 5.0, top, 0, pz, 28, 0.7)
    for k, z in enumerate((F + td - 1.4, F + td - 2.3)):
        for s in (-1, 1):
            block("crimson" if k else "white", 1.1, 0.02, 0.16, at(rot(0.6 * s), -0.45 * s, top, z))
    for x in (-tw / 2 + 2.2, tw / 2 - 2.2):  # the bay's assigned corner marks
        block("white", 1.2, 0.02, 0.14, at(M, x, top, F + 1.0))
    text(
        "white",
        "01" if admin() else "02",
        1.2,
        at(facing(math.pi / 2), 8.6, 2.2, F + 0.05),
        0.05,
    )
    # The door into the tower: wide, framed, lit over it, under a deep canopy.
    block("hull", 6.4, 4.4, 0.5, at(M, 0, top + 2.2, F + 0.1))
    block("glass", 5.2, 3.4, 0.12, at(M, 0, top + 1.7, F + 0.38))
    block("white", 5.2, 0.06, 0.06, at(M, 0, top + 3.5, F + 0.45))
    block("hull", 8, 0.45, 3.0, at(M, 0, top + 4.6, F + 1.5))
    block("white", 6.5, 0.04, 0.2, at(M, 0, top + 4.36, F + 2.2))
    block("white", 0.25, 0.9, 0.06, at(M, 3.1, top + 1.5, F + 0.4), detail=True)
    for x in (-2.95, 2.95):  # the facade's crimson channels carried out across the deck to the pad
        block("crimson", 0.1, 0.03, PAD - 4.6, at(M, x, top, F + (PAD - 4.6) / 2 + 0.3))
    # Underneath: two deep girders out from the tower and raking struts to the fascia.
    for x in (-8.0, 8.0):
        block("hull", 1.0, 1.6, td, at(M, x, top - 2.1, zc))
        bar("fin", (x, -11.0, F + 0.3), (x, top - 2.6, F + td - 0.8), 1.0, 0.8, math.pi / 2)


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
    top = y_deck + BRIDGE_H + 0.6
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
        block("dark", depth, BRIDGE_H, 0.2, at(M, xc, y_deck + BRIDGE_H / 2, z))
    block("dark", depth, 0.2, 2 * half, at(M, xc, y_deck + BRIDGE_H + 0.1, zc))
    for dz in (-2.5, 2.5):
        block("white", depth - 1, 0.04, 0.3, at(M, xc, y_deck + BRIDGE_H - 0.02, zc + dz))
    block("glass", 0.15, 3.6, 7.0, at(M, x_face - INNER * depth, y_deck + 1.8, zc))
    block("white", 0.08, 0.05, 7.0, at(M, x_face - INNER * (depth - 0.1), y_deck + 3.65, zc))
    corner_blades(1.2, H - 1.2)


HANGARS = (-8.0, 8.0)  # the bays' centres along the outer face (z)
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
    for a, b in ((-width / 2 + 0.6, -14.0), (-2.0, 2.0), (14.0, width / 2 - 0.6)):
        put("panel", f, (a + b) / 2, y0 + bh / 2, b - a, bh, 0.2, -0.6)
    put("hull", f, 0, y0 / 2, width - 1.2, y0 - 0.12, 0.75, -0.4)
    put("hull", f, 0, (y0 + bh + H) / 2 + 0.3, width - 1.2, H - y0 - bh - 0.6, 0.75, -0.4)
    for a, b in ((-width / 2 + 0.6, -14.0), (-2.0, 2.0), (14.0, width / 2 - 0.6)):
        put("hull", f, (a + b) / 2, y0 + bh / 2, b - a, bh, 0.75, -0.4)
    apron = 4.0 if admin() else 7.5  # how far each bay's landing apron reaches out of the face
    for zc in HANGARS:
        u = zc if INNER > 0 else -zc  # the outer face's u runs with the tower's z on the left
        # The bay: floor out to its apron, walls, ceiling with cool strips, a glass door at back.
        block(
            "hull",
            bd + apron,
            0.8,
            bw + 1.0,
            f @ Matrix.Translation((u, y0 - 0.4, (apron - bd) / 2)) @ rot(math.pi / 2),
        )
        put("stone", f, u, y0 + 0.01, bw - 0.6, 0.02, bd + apron - 0.4, -bd + 0.2)
        put("dark", f, u, y0 + bh + 0.1, bw, 0.2, bd, -bd)
        for s in (-1, 1):
            put("dark", f, u + s * (bw / 2 + 0.1), y0 + bh / 2, 0.2, bh, bd, -bd)
        put("glass", f, u, y0 + 1.8, 5.0, 3.4, 0.12, -bd)  # the door into the tower
        put("hull", f, u, y0 + 4.0, 6.2, 0.6, 0.3, -bd + 0.1)
        put("white", f, u, y0 + 3.55, 5.0, 0.05, 0.05, -bd + 0.12)
        put("dark", f, u, y0 + bh / 2, bw, bh, 0.2, -bd - 0.2)
        for k in (-1, 0, 1):
            put("white", f, u + k * 3.5, y0 + bh - 0.08, 0.25, 0.04, bd - 1, -bd + 0.5)
        # The landing surface: crimson perimeter, white landing lights, guidance lines, the car's
        # assigned box and a chevron pointing in.
        put("crimson", f, u, y0 + 0.03, bw + 0.6, 0.06, 0.1, apron - 0.15)
        for s in (-1, 1):
            put(
                "crimson",
                f,
                u + s * (bw / 2 + 0.25),
                y0 + 0.03,
                0.1,
                0.06,
                bd + apron - 0.3,
                -bd + 0.15,
            )
            put("white", f, u + s * 2.2, y0 + 0.02, 0.12, 0.02, bd + apron - 1.5, -bd + 1)
            put("fin", f, u + s * 4.5, y0 - 2.6, 0.6, 4.4, 0.8, 0.4)  # brackets under the face
            bar(
                "fin",
                tuple(f @ Matrix.Translation((u + s * 4.5, y0 - 7.0, 0.3)).translation),
                tuple(f @ Matrix.Translation((u + s * 4.5, y0 - 0.9, apron - 0.5)).translation),
                0.7,
                0.6,
                0.0,
            )
        for k in range(int(apron / 1.25) + 1):
            for s in (-1, 1):
                put(
                    "white",
                    f,
                    u + s * (bw / 2 - 0.1),
                    y0 + 0.06,
                    0.2,
                    0.08,
                    0.2,
                    k * 1.25,
                    detail=True,
                )
        box0 = -bd + 1.5 if admin() else 0.55  # the car box: in the bay, or on the long apron
        for x in (-1.3, 1.3):
            put("white", f, u + x, y0 + 0.02, 0.12, 0.02, 5.4, box0)
        for z in (box0, box0 + 5.3):
            put("white", f, u, y0 + 0.02, 2.7, 0.02, 0.12, z)
        for s in (-1, 1):
            chevron = apron - 1.6 if admin() else -1.4
            m = f @ Matrix.Translation((u + s * 0.45, y0 + 0.02, chevron)) @ rot(-0.6 * s)
            block("white", 1.0, 0.02, 0.16, m)
        if not admin():  # the security tower lights each bay's mouth in crimson
            for s in (-1, 1):
                put("crimson", f, u + s * (bw / 2 + 0.3), y0 + bh / 2, 0.1, bh, 0.06, 0.1)
            put("crimson", f, u, y0 + bh + 0.3, bw + 0.6, 0.1, 0.06, 0.1)
        label = (
            f @ Matrix.Translation((u - bw / 2 + 1.2, y0 + bh - 0.9, 0.02)) @ facing(math.pi / 2)
        )
        text(
            "white",
            ("H1" if zc < 0 else "H2") if admin() else ("H3" if zc < 0 else "H4"),
            0.8,
            label,
            0.05,
        )
    # The shoulders: heavy corner masses and a broad band round the top of the module.
    bastions(0, H, 4.0, 1.2)
    for f, width in faces(TW, TD):
        put("graphite", f, 0, H - 1.25, width + 2.4, 2.5, 1.8, -0.4)
        put("crimson", f, 0, H - 2.6, width - 2.0, 0.08, 0.05, 1.4)
    spine(0, H)


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
            for u in (-5.0, 5.0):
                put("fin", f, u, 7.0, 1.0, 14.0, 1.4, -0.4)
    corner_blades(0, 10)
    block("panel", TW - 1.2, 0.5, TD - 1.2, at(M, 0, 10.0, 0))  # the roof deck
    # The crown: a thick armoured parapet with a sloped graphite cap and a crimson channel in it.
    for f, width in faces(TW - 0.6, TD - 0.6):
        put("hull", f, 0, 12.6, width, 5.2, 2.4, -2.4)
        put("graphite", f, 0, 15.35, width + 0.2, 0.3, 2.8, -2.6)
        put("crimson", f, 0, 14.2, width - 8.0, 0.1, 0.05, 0.0)
    # Angular corner structures: chamfered towers rising past the crown, a crimson channel up each
    # chamfer, a red warning light on top.
    for sx in (-1, 1):
        for sz in (-1, 1):
            cx, cz, a = sx * (TW / 2 - 3.4), sz * (TD / 2 - 3.4), 3.4
            pts = [(-a, -a), (a, -a), (a, a * 0.2), (a * 0.2, a), (-a, a)]
            foot = [(cx + x * sx, cz + y * sz) for x, y in pts]
            prism("hull", foot, 7.6, at(Matrix.Rotation(math.pi / 2, 4, "X"), 0, 10.25, 0))
            top = [(cx + x * sx * 0.8, cz + y * sz * 0.8) for x, y in pts]
            prism("graphite", top, 0.6, at(Matrix.Rotation(math.pi / 2, 4, "X"), 0, 17.85, 0))
            m = at(rot(-math.pi / 4 * sx * sz), cx + sx * a * 0.62, 14.0, cz + sz * a * 0.62)
            block("crimson", 0.12, 6.4, 0.06, m)
            lamp((cx, 18.55, cz), 0.16)
    # The command deck, sunk inside the crown: dark, crossed by crimson-lit channels between ribs.
    block("dark", TW - 6.0, 0.3, TD - 6.0, at(M, 0, 10.1, 0))
    for k in range(7):
        block("graphite", TW - 6.4, 0.25, 0.35, at(M, 0, 10.35, -(TD - 8) / 2 + k * (TD - 8) / 6))
    for x in (-4.5, 0.0, 4.5):
        block("crimson", 0.1, 0.04, TD - 7.0, at(M, x, 10.28, 0))
    if admin():  # administration: a formal low pavilion, office glass round it, a broad flat cap
        block("hull", 9.0, 5.6, 11.0, at(M, 0, 13.05, -3.0))
        for f, width in faces(9.0, 11.0):
            put("facade", f, 0, 13.6, width - 1.4, 3.2, 0.1, 0.0)
        block("graphite", 10.4, 0.5, 12.4, at(M, 0, 16.1, -3.0), bevel=0.05)
        block("white", 10.0, 0.04, 0.12, at(M, 0, 15.82, 3.15))
        block("graphite", 6.0, 1.2, 4.0, at(M, 0, 10.85, 8.5), bevel=0.08)  # a low plant housing
    else:  # security: an armoured command enclosure with a raked front and integrated arrays
        block("hull", 10.0, 6.6, 10.0, at(M, 0, 13.55, -4.0), bevel=0.08)
        wedge = [(-1.0, 0.0), (-4.6, 0.0), (-1.0, 6.6)]  # the raked front, in profile (-z, y)
        prism("hull", wedge, 10.0, at(rot(math.pi / 2), 5.0, 10.25, 0))
        block("crimson", 9.0, 0.08, 0.06, at(Matrix.Rotation(-0.5, 4, "X"), 0, 13.55, 2.85))
        block("graphite", 10.6, 0.4, 10.6, at(M, 0, 17.05, -4.0))
        for x in (-3.2, 0.0, 3.2):  # flat sector panels, tilted out over the crown
            m = at(Matrix.Rotation(-0.35, 4, "X"), x, 18.8, -8.4)
            block("graphite", 2.2, 3.0, 0.3, m, bevel=0.03)
            block("crimson", 1.6, 0.06, 0.05, m @ Matrix.Translation((0, 1.2, 0.17)))
        m = at(Matrix.Rotation(-0.6, 4, "X"), 0, 17.6, 1.5)  # a flat array slab facing the street
        block("graphite", 5.0, 0.35, 3.2, m, bevel=0.03)
        block("crimson", 4.6, 0.04, 0.06, m @ Matrix.Translation((0, 0.2, 1.45)))


DOORS = (-4.0, 0.0, 4.0)  # each tower's security doors, across its gateway (from its centre)
DELIVERY = TC[0] - (TW - GATE[0]) / 4 - GATE[0] / 2  # the delivery bay's |u|, in the left tower


def plaza():
    """The forecourt, in the site's frame: the towers' fronts at w = 10, the street edge at 28, the
    site 89 m across. Dark stone over the whole campus; before each gateway a raised entrance
    terrace with steps down its front and three security gates in line with the doors; between
    them a drop-off lane and a black monolith in a dark pool; crimson strips running on from the
    gateways' frames to the street, one across the foot of the steps; planters, benches and
    wayfinding totems at the sides; bollards along the street edge, open where people walk."""
    fw, edge, hu = TC[1] + TD / 2, 28.0, 44.5
    for i in range(15):  # the forecourt's stone panels; their joints show between them
        for j in range(3):
            x, z = -hu + (i + 0.5) * 2 * hu / 15, fw + (j + 0.5) * (edge - fw) / 3
            block("stone", 2 * hu / 15 - 0.08, 0.06, (edge - fw) / 3 - 0.08, at(M, x, 0.03, z))
    block("stone", 18, 0.06, edge + fw - 2 * 0, at(M, 0, 0.03, (fw - edge) / 2))  # the gap
    for s in (-1, 1):  # beside and behind the towers
        block("stone", hu - 39, 0.06, edge + fw, at(M, s * (39 + hu) / 2, 0.03, (fw - edge) / 2))
        block("stone", 30, 0.06, 2, at(M, s * TC[0], 0.03, -edge + 1))
    gw, step = GATE[0], 0.45
    front = fw + 7.0  # the entrance terraces' front edge
    for s in (-1, 1):
        tc, tx = (
            s * TC[0],
            s * (TC[0] + 1.0),
        )  # the terrace sits 1 m outward, clear of the delivery bay
        # The raised entrance terrace, its stone top, a crimson lip, steps down its front.
        block("hull", 22, RAISE, front - fw, at(M, tx, RAISE / 2, (fw + front) / 2))
        block("stone", 21.8, 0.04, front - fw - 0.2, at(M, tx, RAISE + 0.02, (fw + front) / 2))
        block("crimson", 22, 0.05, 0.08, at(M, tx, RAISE + 0.03, front - 0.1))
        for k in range(3):
            h = RAISE * (3 - k) / 4
            block("hull", 22, h, step, at(M, tx, h / 2, front + step * (k + 0.5)))
            block("white", 22, 0.02, 0.06, at(M, tx, h + 0.01, front + step * k + 0.05), True)
        # Security gates on the terrace, one before each door, an eye on each lintel.
        for u in DOORS:
            for g in (-1, 1):
                block("fin", 0.3, 2.6, 0.5, at(M, tc + u + g * 1.35, RAISE + 1.3, fw + 4.0))
                block(
                    "white", 0.05, 1.8, 0.06, at(M, tc + u + g * 1.2, RAISE + 1.3, fw + 4.0), True
                )
            block("fin", 3.0, 0.3, 0.5, at(M, tc + u, RAISE + 2.75, fw + 4.0))
            eye(0.6, 0.26, at(M, tc + u, RAISE + 2.75, fw + 4.26), detail=True, lit=False)
        # Crimson strips: on from the gateway's frame across the terrace, down the forecourt.
        for x in (-gw / 2 + 0.1, gw / 2 - 0.1):
            block("crimson", 0.12, 0.03, front - fw, at(M, tc + x, RAISE + 0.03, (fw + front) / 2))
            run = edge - 0.8 - (front + 3 * step)
            block("crimson", 0.12, 0.03, run, at(M, tc + x, 0.07, front + 3 * step + run / 2))
        # The outer side: a long planter, a bench facing in, a wayfinding totem.
        block("hull", 5.0, 1.1, 12.0, at(M, s * 40.5, 0.55, 20.0), bevel=0.05)
        block("olive", 4.6, 0.4, 11.6, at(M, s * 40.5, 1.25, 20.0), detail=True)
        block("stone", 0.8, 0.45, 3.2, at(M, s * 37.4, 0.225, 22.0))
        block("fin", 0.6, 3.4, 0.4, at(M, s * 37.4, 1.7, 26.4))
        screen("face", 0.5, 1.4, at(M, s * 37.4, 2.2, 26.62), detail=True)
        text(
            "white", "A" if s < 0 else "B", 0.5, at(facing(math.pi / 2), s * 37.4, 3.1, 26.62), 0.04
        )
    # The cross strip at the foot of the steps, the centre line to the street.
    block("crimson", 2 * hu - 2, 0.03, 0.12, at(M, 0, 0.07, front + 3 * step + 0.4))
    block("crimson", 0.12, 0.03, edge - 0.8 - fw - 9.0, at(M, 0, 0.07, (fw + 9.0 + edge - 0.8) / 2))
    # The drop-off: a dark lane across the middle of the forecourt, crimson edges, chevrons.
    block("graphite", 22, 0.02, 4.6, at(M, 0, 0.07, 23.6))
    for z in (21.3, 25.9):
        block("crimson", 22, 0.03, 0.1, at(M, 0, 0.08, z))
    for x in (-6.0, 0.0, 6.0):
        for g in (-1, 1):
            block("white", 1.0, 0.02, 0.14, at(rot(0.6 * g), x + 0.4, 0.085, 23.6 + g * 0.35), True)
    # The monolith in its dark pool, before the gap: black, crimson-edged, the eye on its face.
    block("hull", 9.0, 0.35, 5.0, at(M, 0, 0.175, 15.5))
    block("glass", 8.4, 0.05, 4.4, at(M, 0, 0.36, 15.5))
    block("crimson", 9.0, 0.04, 0.08, at(M, 0, 0.37, 18.0))
    block("hull", 2.4, 9.0, 1.0, at(M, 0, 4.85, 15.5), bevel=0.06)
    for x in (-1.21, 1.21):
        block("crimson", 0.06, 8.0, 0.06, at(M, x, 4.85, 16.0))
    eye(1.8, 0.8, at(M, 0, 7.4, 16.02))
    text("white", NAME, 0.42, at(facing(math.pi / 2), 0, 5.8, 16.02), 0.03)
    # The guard booth at the gap's mouth, behind the monolith.
    block("hull", 2.2, 2.7, 1.8, at(M, 0, 1.35, 11.5), bevel=0.06)
    block("glass", 2.0, 1.0, 1.82, at(M, 0, 1.9, 11.5))
    block("white", 2.2, 0.05, 1.8, at(M, 0, 2.72, 11.5))
    # Bollards along the street edge, open where people walk (the doors' lines, the delivery bay)
    # and where cars turn into the drop-off.
    walks = [s * TC[0] + u for s in (-1, 1) for u in DOORS] + [-DELIVERY]
    x = -hu + 0.8
    while x < hu:
        if all(abs(x - w) > 1.6 for w in walks) and not 11.5 > abs(x) > 2.0:
            tube("fin", (x, 0, edge - 0.6), (x, 0.95, edge - 0.6), 0.14, True)
            tube("white", (x, 0.95, edge - 0.6), (x, 1.0, edge - 0.6), 0.15, True)
        x += 2.6


def bridge():
    """The skybridge, in the site's frame: from the left tower's inner face (u = -9) across. A deck
    on deep edge girders and open cross beams, struts back to both towers, tall panoramic glass
    walls and a glass roof between few heavy dark frames, crimson strips along the floor's edges,
    cool lanes down it, soft light under the roof's ribs, heavy portals at both ends."""
    w0, w1 = BRIDGE_W
    wc, width, span, H = (w0 + w1) / 2, w1 - w0, 2 * (TC[0] - TW / 2), BRIDGE_H
    block("hull", span, 0.8, width + 0.6, at(M, 0, DECK - 0.4, wc))  # the deck
    block("stone", span, 0.04, width - 0.2, at(M, 0, DECK + 0.02, wc))
    for w in (w0 - 0.2, w1 + 0.2):  # deep edge girders, struts back to the towers
        block("hull", span, 2.4, 1.0, at(M, 0, DECK - 1.9, w))
        block(
            "crimson", span - 1, 0.08, 0.05, at(M, 0, DECK - 2.6, w + (-0.53 if w < wc else 0.53))
        )
        for s in (-1, 1):
            bar(
                "fin",
                (s * span / 2, DECK - 11, w),
                (s * (span / 2 - 5), DECK - 3.0, w),
                0.9,
                0.9,
                math.pi / 2,
            )
    for k in range(7):  # cross beams under the deck, seen from below
        block(
            "graphite", 0.5, 1.2, width, at(M, -span / 2 + 1.5 + k * (span - 3) / 6, DECK - 1.4, wc)
        )
    # The floor's light: crimson along both edges, two cool lanes down the middle.
    for w in (w0 + 0.3, w1 - 0.3):
        block("crimson", span, 0.05, 0.08, at(M, 0, DECK + 0.06, w))
    for w in (wc - 1.6, wc + 1.6):
        block("white", span - 2, 0.03, 0.08, at(M, 0, DECK + 0.05, w))
    # The walls: tall glass between few heavy frames, rails top and bottom.
    frames = [-span / 2 + 0.4 + k * (span - 0.8) / 4 for k in range(5)]
    for w in (w0, w1):
        block("skyglass", span, H, 0.06, at(M, 0, DECK + H / 2, w))
        block("graphite", span, 0.5, 0.4, at(M, 0, DECK + 0.25, w))
        block("graphite", span, 0.6, 0.5, at(M, 0, DECK + H + 0.1, w))
        for u in frames:
            block("fin", 0.35, H, 0.5, at(M, u, DECK + H / 2, w))
        block(
            "crimson", span, 0.05, 0.05, at(M, 0, DECK + H + 0.45, w + (-0.27 if w == w0 else 0.27))
        )
    # The roof: glass over heavy ribs across, soft light strips under them.
    block("skyglass", span, 0.05, width, at(M, 0, DECK + H + 0.35, wc))
    for u in frames:
        block("graphite", 0.4, 0.6, width, at(M, u, DECK + H + 0.1, wc))
    block("graphite", span, 0.4, 0.4, at(M, 0, DECK + H + 0.2, wc))  # the ridge beam
    for w in (wc - 2.5, wc + 2.5):
        block("white", span - 1, 0.04, 0.3, at(M, 0, DECK + H - 0.25, w))
    for s in (-1, 1):  # heavy portals where it meets the towers
        u = s * (span / 2 - 0.4)
        for w in (w0 - 0.6, w1 + 0.6):
            block("hull", 1.0, H + 1.6, 1.2, at(M, u, DECK + (H + 1.6) / 2 - 0.8, w))
        block("hull", 1.0, 1.2, width + 2.4, at(M, u, DECK + H + 0.6, wc))
        block("crimson", 0.06, 0.06, width, at(M, u - s * 0.52, DECK + H + 0.2, wc))


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
