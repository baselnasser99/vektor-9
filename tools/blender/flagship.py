"""Build the flagship tower's add-on modules, in Blender (original designs).

In Blender: REPO = r"<repo root>"; exec(open(REPO + "/tools/blender/flagship.py").read())
Builds each module into its own scene "flagship_<kind>" (with a studio for review renders).
CITY = True before exec writes the city's copies (web/assets/models/flagship_<kind>).

One tower by the central plaza is rebuilt as a corporate machine (web/src/landmarks.js flagship):
these modules are bolted onto its shaft by code, which picks the faces and heights. Each hangs on
a wall: the wall is the plane z = 0, the module faces +z (out), y = 0 is the height it is placed
at (the roof for the crown, the podium for the first lift segment). Fixed sizes (ADR-0005):
- extension: a four-storey industrial cooling and power-distribution assembly, a wedge in plan
  (6.5 m out at one end, 3 m at the other) in three levels: a power deck with an angled soffit, a
  cooling level set back a metre with two louvred bays recessed between armoured fins and an open
  bay of transformer coils, and an upper level whose top rakes back to the wall; layered armour
  plates, a grated maintenance walkway with a rail and a ladder, a big grille recessed in the deep
  end, two flanged pipes running back into the tower, fans on a plinth; carried on three knee
  brackets with gussets, two transfer beams and hanger rods tied back to the tower above;
- lift: one 12 m segment of an external lift shaft (3.6 x 3.2), stacked by code, set into the
  facade between two deep structural fins over a dark recess: corner posts, ring beams, X-bracing,
  a dark core with a smoked glass strip;
- lift_top: the shaft's machine room, angled, with a cable drum and a vent;
- conduit: one 12 m segment of a utility riser, stacked by code: three thick pipes on clamps;
- vent: a large industrial cooling unit (6 x 7 m): a louvred face, side fins, a hood, two fans;
- armor: one 12 m segment of an armoured column, stacked by code: three chamfered plates at
  staggered depths on a backing frame, ledges and side ribs;
- crown: rooftop equipment (on a 9 x 7 roof, scaled to fit): an angular machine housing off one
  side, a gantry arm cantilevered over the edge, and a communications assembly: a faceted pylon
  twisting as it tapers, tilted sector antennas, dishes and a raking boom; fans;
- ad: a vertical corporate display (4 x 18 m face, UVs 0..1, drawn by the renderer: a muted
  crimson mark and white name, web/src/textures.js corpTexture) in a heavy frame on standoff
  brackets, with crimson-painted edges, an info strip, a lamp hood and a caged ladder.
Light is the two displays, two small hood lamps and red indicators; everything else is unlit
painted steel and composite, so the shapes read as cyberpunk with every light off.
Conventions: tools/blender/kit.py.
"""

import importlib
import math
import os
import sys

import bpy
from mathutils import Matrix

sys.path.insert(0, os.path.join(REPO, "tools", "blender"))  # noqa: F821
import kit  # noqa: E402

importlib.reload(kit)  # Blender keeps modules between runs
kit.ROLES.setdefault("face", kit.ROLES["ad"])
kit.ROLES.setdefault("info", (0x0B0F17, 0.0, 0.4, 0xE09A45, 1.6, 1, None))
kit.ROLES.setdefault("grate", kit.ROLES["dark"])  # the walkway; the renderer gives it a grating
from kit import (  # noqa: E402
    at,
    bar,
    block,
    clear,
    dish,
    fan,
    grille,
    join,
    lamp,
    loft,
    parts,
    rail,
    screen,
    studio,
    tube,
)

ID = Matrix()


def rot(axis, a, x, y, z):
    return Matrix.Translation((x, y, z)) @ Matrix.Rotation(a, 4, axis)


def prism(role, x0, x1, levels, detail=False):
    """A solid across x0..x1 standing off the wall (z = 0): levels is [(y, depth), ...] bottom
    to top, the front edge chamfered by a fifth of the depth, so its sides read as angular."""
    rings = []
    for y, d in levels:
        c = min(d * 0.2, (x1 - x0) * 0.2)
        rings.append(
            [(x0, y, 0), (x1, y, 0), (x1, y, d - c), (x1 - c, y, d), (x0 + c, y, d), (x0, y, d - c)]
        )
    return loft(role, rings, detail, smooth_angle=20)


def extension():
    x0, x1, d0, d1, h = -5.5, 4.5, 6.5, 3.0, 12.0
    lo, hi = 4.2, 8.8  # the recessed cooling level, between the power deck and the upper level

    def depth(x, s=1.0):  # how far out the full body reaches at x
        return (d0 + (d1 - d0) * (x - x0) / (x1 - x0)) * s

    # The raked front (the wedge's long chamfered face), as a line from a to b, and a point on it.
    ang = math.atan2(d0 - d1, x1 - x0)
    a, b = (x0 + 0.8, d0), (x1 - 0.5, d1)
    run = math.hypot(b[0] - a[0], b[1] - a[1])

    def front(t, y, out, back=0.0):
        """A frame at t (0..1) along the front line, height y, `out` metres off it (negative: in),
        its local x along the front, +z out of it; `back` moves the line itself in."""
        n = (math.sin(ang), math.cos(ang))
        x, z = (
            a[0] + (b[0] - a[0]) * t + n[0] * (out - back),
            a[1] + (b[1] - a[1]) * t + n[1] * (out - back),
        )
        return Matrix.Translation((x, y, z)) @ Matrix.Rotation(ang, 4, "Y")

    # Three stacked volumes: a power deck with an angled soffit, a cooling level set back a metre,
    # an upper level whose top rakes back to the wall.
    wedge("panel", x0, x1, d0, d1, [(0, 0.6), (1.2, 0.95), (lo, 1.0)])
    wedge("dark", x0 + 0.4, x1 - 0.4, d0 - 1.1, d1 - 1.1, [(lo, 1.0), (hi, 1.0)])
    wedge("panel", x0, x1, d0, d1, [(hi, 1.0), (11.0, 1.0), (h, 0.62)])
    # Cooling level: two louvred bays recessed between armoured fins, an open bay of coils.
    for t in (0.04, 0.33, 0.62):  # the fins, flush with the deck's front
        block("armor", 0.5, hi - lo, 1.0, front(t, (lo + hi) / 2, -0.5))
    for t in (0.185, 0.475):
        for k in range(8):  # blades, set back in the bay
            block(
                "steel",
                run * 0.25,
                0.1,
                0.55,
                front(t, lo + 0.6 + k * 0.5, -0.75) @ Matrix.Rotation(-0.5, 4, "X"),
                True,
            )
        block("mech", run * 0.27, 0.35, 0.6, front(t, hi - 0.3, -0.7))  # the bay's head
    for t in (0.72, 0.8, 0.88):  # transformer coils with insulator rings, and busbars over them
        m = front(t, 0, -0.75)
        p = m.to_translation()
        tube("mech", (p.x, lo + 0.2, p.z), (p.x, hi - 0.9, p.z), 0.42, seg=10)
        for y in (lo + 1.0, lo + 2.2, lo + 3.3):
            tube("titanium", (p.x, y, p.z), (p.x, y + 0.18, p.z), 0.55, seg=10)
        tube("steel", (p.x, hi - 0.9, p.z), (p.x, hi - 0.2, p.z), 0.08, True, 6)
    block("steel", run * 0.2, 0.12, 0.12, front(0.8, hi - 0.25, -0.75), True)
    # Layered armour: overlapping plates down the upper front, each lower one further out;
    # two more on the deck.
    for k, y in enumerate((11.0, 10.1, 9.2)):
        block(
            "armor",
            run - 0.4 - k * 0.5,
            1.2,
            0.25,
            front(0.5, y, 0.12 + k * 0.18) @ Matrix.Rotation(0.22, 4, "X"),
        )
    for k, y in enumerate((3.2, 2.0)):
        block(
            "armor",
            run - 1.0 - k * 0.8,
            1.0,
            0.22,
            front(0.46, y, 0.12 + k * 0.15) @ Matrix.Rotation(0.18, 4, "X"),
        )
    block("dark", run, 0.12, 0.3, front(0.5, 1.25, 0.05), True)  # a seam under the plates
    # Maintenance walkway on the deck's ledge: grating, a rail, a ladder down.
    block("grate", run - 0.6, 0.12, 0.9, front(0.5, lo + 0.06, -0.55))
    pts = [front(t, lo + 0.12, -0.12).to_translation() for t in (0.02, 0.98)]
    rail("steel", [tuple(p) for p in pts])
    for k in range(9):
        block("steel", 0.5, 0.05, 0.05, at(ID, x0 - 0.35, 0.3 + k * 0.45, d0 - 1.6), True)
    for z in (d0 - 1.85, d0 - 1.35):
        block("steel", 0.05, lo, 0.05, at(ID, x0 - 0.35, lo / 2, z), True)
    # Deep end wall: a big grille recessed in an armoured frame.
    grille((x0 - 0.05, 0, d0 * 0.5), math.pi, 6.4, 4.0, 5.0)
    for y in (3.65, 9.15):
        block("armor", 0.5, 0.5, 4.8, at(ID, x0 - 0.25, y, d0 * 0.5))
    for z in (d0 * 0.5 - 2.3, d0 * 0.5 + 2.3):
        block("armor", 0.5, 6.0, 0.5, at(ID, x0 - 0.25, 6.4, z))
    # Thick utility connections: two flanged pipes out of the deep end and back into the tower wall.
    for y, r in ((5.6, 0.55), (7.4, 0.42)):
        z = 1.6 if r > 0.5 else 2.9
        tube("steel", (x0 + 0.2, y, z), (x0 - 1.2, y, z), r, seg=10)
        tube("steel", (x0 - 1.2, y, z + r), (x0 - 1.2, y, 0.05), r, seg=10)
        for p, q in (
            ((x0 - 0.05, y, z), (x0 - 0.35, y, z)),
            ((x0 - 1.2, y, 0.35), (x0 - 1.2, y, 0.05)),
        ):
            tube(
                "dark", p, q, r * 1.35, seg=10
            )  # collars where it leaves the module and enters the wall
    # On top: a plinth over the deep end with two exposed fans.
    prism("mech", x0, x0 + 4.2, [(h, 4.4), (h + 0.6, 4.4)])
    for x in (x0 + 1.2, x0 + 3.1):
        fan((x, 0, 2.0), h + 0.6, 0.9)
    # Supports: three knee brackets (charcoal posts and chords, lighter raking struts, gussets),
    # two transfer beams under the soffit, hanger rods from the tower above to the outer top edge.
    for x in (x0 + 1.0, -0.6, x1 - 1.0):
        d = depth(x, 0.6)
        block("dark", 0.9, 7.6, 0.7, at(ID, x, -3.8, 0.35))
        bar("mech", (x, -7.2, 0.8), (x, -0.4, d - 0.4), 0.7, 0.7, 0)
        block("dark", 0.8, 0.8, d, at(ID, x, -0.4, d / 2))
        loft(
            "dark",
            [[(xx, -0.8, 0.7), (xx, -0.8, 2.6), (xx, -3.2, 0.7)] for xx in (x - 0.12, x + 0.12)],
        )  # gusset
        block("steel", 1.5, 1.2, 0.35, at(ID, x, -7.4, 0.17))  # its shoe, bolted to the wall
        for y in (-7.8, -7.0):
            block("steel", 0.2, 0.2, 0.12, at(ID, x - 0.5, y, 0.4), True)
    for z in (1.4, 3.2):
        block("dark", x1 - x0 - 1.2, 0.6, 0.6, at(ID, (x0 + x1) / 2, -0.3, z))
    for x in (x0 + 1.4, 1.2):
        tube("steel", (x, h + 3.5, 0.25), (x, h - 0.2, depth(x, 0.62) - 0.4), 0.14, seg=6)
        block("dark", 0.7, 0.7, 0.35, at(ID, x, h + 3.5, 0.17))  # its anchor on the wall
    for k, x in enumerate((1.4, 2.2, 3.0)):  # the conduit riser's pipes rising into the deck
        tube(
            "steel", (x, 0.6, 0.55 + k * 0.05), (x, -9.0, 0.55 + k * 0.05), 0.28 - k * 0.04, seg=10
        )
    lamp((x0 - 0.2, hi + 0.4, d0 - 0.6), 0.16)


def lift():
    h, w, d = 12.0, 3.6, 3.2
    for x in (-w / 2 + 0.2, w / 2 - 0.2):  # corner posts
        for z in (0.25, d - 0.2):
            block("steel", 0.42, h, 0.42, at(ID, x, h / 2, z))
    for y in (0.3, 6.0, h - 0.3):  # ring beams
        block("dark", w, 0.5, 0.4, at(ID, 0, y, d - 0.2))
    for y0 in (0.3, 6.0):  # X-bracing on its front, one bay per 6 m
        y1 = y0 + 5.7
        for a, b in (
            ((-w / 2 + 0.2, y0, d - 0.1), (w / 2 - 0.2, y1, d - 0.1)),
            ((w / 2 - 0.2, y0, d - 0.1), (-w / 2 + 0.2, y1, d - 0.1)),
        ):
            tube("titanium", a, b, 0.11, seg=6)
    block("dark", w - 1.0, h, d - 0.9, at(ID, 0, h / 2, (d - 0.5) / 2))  # the shaft's core
    block("glass", 1.1, h - 0.6, 0.1, at(ID, 0, h / 2, d - 0.92))  # smoked glass strip on its front
    # Set into the tower: a dark recess behind it and a deep structural fin either side, standing
    # out past its front, so the shaft reads as cut into the facade rather than hung on it.
    block("dark", w + 0.4, h, 0.15, at(ID, 0, h / 2, 0.08))
    for s in (-1, 1):
        prism(
            "panel",
            s * (w / 2 + 0.15) - 0.4,
            s * (w / 2 + 0.15) + 0.4,
            [(0, d + 0.9), (h, d + 0.9)],
        )
        block("steel", 0.9, 0.5, d + 1.0, at(ID, s * (w / 2 + 0.15), 6.0, (d + 1.0) / 2))  # a tie
        block("deepred", 0.3, h, 0.06, at(ID, s * (w / 2 + 0.15), h / 2, d + 0.93))  # crimson
    for x in (-0.9, 0.9):  # guide rails inside
        block("steel", 0.08, h, 0.08, at(ID, x, h / 2, d - 0.98), True)


def lift_top():
    w, d = 4.4, 3.8
    prism(
        "mech", -w / 2, w / 2, [(0, d), (3.2, d), (4.4, d * 0.55)]
    )  # the machine room, its roof raked
    block("dark", 1.8, 1.4, 0.1, at(ID, 1.0, 1.6, d + 0.02))  # vent
    for k in range(3):
        block("steel", 1.7, 0.08, 0.25, rot("X", -0.5, 1.0, 1.15 + k * 0.42, d + 0.1), True)
    tube(
        "steel", (-w / 2 - 0.1, 2.3, d * 0.45), (-w / 2 + 1.2, 2.3, d * 0.45), 0.6, seg=12
    )  # cable drum
    block("steel", 0.4, 6.0, 0.4, at(ID, w / 2 - 0.4, 3.0 + 2.0, 0.6))  # a short mast at the back
    lamp((w / 2 - 0.4, 8.2, 0.6), 0.2)


def armor():
    h, w = 12.0, 3.8  # one segment of an armoured column, stacked by code up a face
    block("dark", w + 0.6, h, 0.4, at(ID, 0, h / 2, 0.2))  # its backing frame
    for k, (y, d) in enumerate(
        ((0.2, 1.1), (4.2, 1.45), (8.2, 1.1))
    ):  # three plates, staggered depth
        prism(
            "armor" if k != 1 else "panel",
            -w / 2,
            w / 2,
            [(y, d * 0.5), (y + 0.6, d), (y + 3.0, d), (y + 3.6, d * 0.5)],
        )
        block("steel", w + 0.4, 0.3, d + 0.25, at(ID, 0, y + 3.75, (d + 0.25) / 2))  # ledge over it
    for s in (-1, 1):  # side ribs tying it to the wall
        block("panel", 0.3, h, 1.7, at(ID, s * (w / 2 + 0.3), h / 2, 0.85))
    block("deepred", 0.14, 3.0, 0.08, at(ID, -w / 2 + 0.35, 6.0, 1.5))


def crown():
    W, D = 9.0, 7.0  # the roof it is drawn for; code scales x and z to the real one
    block("dark", W, 0.8, D, at(ID, 0, 0.4, 0))  # deck
    # The machine housing off the -x side, tapering as it rises, its top raked.
    loft(
        "panel",
        [
            [
                (-W / 2 + 0.3, 0.8, -D / 2 + 0.3),
                (1.0, 0.8, -D / 2 + 0.3),
                (1.0, 0.8, D / 2 - 0.3),
                (-W / 2 + 0.3, 0.8, D / 2 - 0.3),
            ],
            [
                (-W / 2 + 0.6, 6.5, -D / 2 + 0.8),
                (0.4, 6.5, -D / 2 + 0.8),
                (0.4, 6.5, D / 2 - 0.8),
                (-W / 2 + 0.6, 6.5, D / 2 - 0.8),
            ],
            [
                (-W / 2 + 0.9, 8.6, -D / 2 + 1.4),
                (-1.2, 7.4, -D / 2 + 1.4),
                (-1.2, 7.4, D / 2 - 1.4),
                (-W / 2 + 0.9, 8.6, D / 2 - 1.4),
            ],
        ],
        smooth_angle=20,
    )
    block("armor", 0.35, 4.2, D - 1.2, rot("Z", -0.3, 1.25, 4.0, 0))  # armour visor on its face
    block("deepred", 0.36, 0.5, D - 1.4, rot("Z", -0.3, 1.45, 5.7, 0))  # crimson band on the visor
    # The gantry: a box beam from the housing out over the +x edge, a trolley and a hoist block.
    block("steel", 11.0, 0.7, 0.9, at(ID, 1.5, 8.0, -1.0))
    block("mech", 1.2, 0.9, 1.4, at(ID, W / 2 + 1.8, 7.4, -1.0))
    tube("steel", (W / 2 + 1.8, 6.9, -1.0), (W / 2 + 1.8, 4.6, -1.0), 0.05, True, 4)
    block("dark", 0.7, 0.7, 0.7, at(ID, W / 2 + 1.8, 4.3, -1.0))
    tube("dark", (0.6, 6.4, -1.0), (4.6, 7.7, -1.0), 0.2, seg=6)  # its back stay
    # The communications assembly on the +x+z corner: a faceted pylon twisting as it tapers,
    # three tilted sector antennas round it, two dishes, and an angled boom with a third dish.
    mx, mz, top = W / 2 - 1.7, D / 2 - 1.7, 15.5

    def sq(r, a):  # a square of half-diagonal r, turned by a
        return [
            (math.cos(a + k * math.pi / 2) * r, math.sin(a + k * math.pi / 2) * r) for k in range(4)
        ]

    loft(
        "panel",
        [
            [(mx + u, y, mz + v) for u, v in sq(r, a)]
            for y, r, a in (
                (0.8, 1.9, 0.78),
                (6.0, 1.3, 0.98),
                (11.0, 0.8, 1.18),
                (top, 0.45, 1.38),
            )
        ],
        smooth_angle=20,
    )
    block("deepred", 2.4, 0.4, 2.4, at(ID, mx, 2.0, mz))  # a crimson collar near its foot
    for a in (0.3, 0.3 + 2 * math.pi / 3, 0.3 + 4 * math.pi / 3):
        for y in (9.0, 12.4):
            p = (mx + math.sin(a) * 1.15, y, mz + math.cos(a) * 1.15)
            m = Matrix.Translation(p) @ Matrix.Rotation(a, 4, "Y") @ Matrix.Rotation(-0.22, 4, "X")
            block("mech", 0.8, 2.6, 0.3, m)
    for a, y in ((-1.3, 5.2), (2.2, 7.0)):
        dish(
            1.2,
            Matrix.Translation((mx + math.sin(a) * 1.6, y, mz + math.cos(a) * 1.6))
            @ Matrix.Rotation(a, 4, "Y")
            @ Matrix.Rotation(-0.35, 4, "X"),
        )
    tube(
        "steel", (mx, 12.0, mz), (mx - 4.0, 15.0, mz - 1.0), 0.16, seg=6
    )  # the boom, raking back over the roof
    dish(
        0.8,
        Matrix.Translation((mx - 4.0, 15.0, mz - 1.0))
        @ Matrix.Rotation(-2.2, 4, "Y")
        @ Matrix.Rotation(-0.5, 4, "X"),
    )
    lamp((mx, top + 0.4, mz), 0.22)
    for x, z in ((2.6, -2.0), (0.2, -2.0)):  # fans on the open half of the deck
        fan((x, 0, z), 0.8, 1.0)


def wedge(role, x0, x1, d0, d1, levels):
    """A solid across x0..x1 off the wall whose plan is a wedge, d0 deep at x0 and d1 at x1, with
    chamfered front corners; levels is [(y, s), ...] bottom to top, s scaling the depth there."""
    rings = []
    for y, s in levels:
        a, b = d0 * s, d1 * s
        rings.append(
            [
                (x0, y, 0),
                (x1, y, 0),
                (x1, y, b - 0.5),
                (x1 - 0.5, y, b),
                (x0 + 0.8, y, a),
                (x0, y, a - 0.8),
            ]
        )
    return loft(role, rings, smooth_angle=20)


def conduit():
    h = 12.0  # one segment of a utility riser, stacked by code: three thick pipes on clamps
    pipes = ((-0.65, 0.45), (0.35, 0.36), (1.15, 0.28))
    for x, r in pipes:
        tube("steel", (x, 0, r + 0.2), (x, h, r + 0.2), r, seg=10)
        for y in (0.4, h / 2):  # flanges
            tube("dark", (x, y - 0.15, r + 0.2), (x, y + 0.15, r + 0.2), r * 1.3, seg=10)
    for y in (2.0, 5.0, 8.0, 11.0):  # clamp bands on wall brackets
        block("dark", 2.7, 0.35, 1.25, at(ID, 0.25, y, 0.62))
        block("steel", 2.9, 0.6, 0.3, at(ID, 0.25, y, 0.15))


def vent():
    w, h, d = 6.0, 7.0, 1.8  # a large industrial cooling unit on a wall
    prism("mech", -w / 2, w / 2, [(0, 0.6), (0.8, d), (h - 0.6, d), (h, 1.2)])
    grille((0, 0, d + 0.02), math.pi / 2, h / 2, w - 1.0, h - 2.0)
    for s in (-1, 1):  # side fins
        for k in range(5):
            block("dark", 0.08, h - 1.6, 0.9, at(ID, s * (w / 2 + 0.1 + k * 0.22), h / 2, d * 0.45))
    block("steel", w + 1.2, 0.4, d + 0.8, rot("X", 0.18, 0, h + 0.15, d / 2 + 0.2))  # hood
    fan((-1.4, 0, 0.9), h, 0.75)
    fan((1.4, 0, 0.9), h, 0.75)


def ad():
    w, h, z, y0 = 4.0, 18.0, 1.4, 2.6  # the face, its standoff, its foot above the mounting height
    screen("face", w, h, at(ID, 0, y0 + h / 2, z + 0.02))
    for y in (y0 - 0.2, y0 + h + 0.2):  # box-section frame
        block("steel", w + 0.8, 0.4, 0.5, at(ID, 0, y, z - 0.05))
    for s in (-1, 1):
        block("steel", 0.4, h + 0.8, 0.5, at(ID, s * (w / 2 + 0.2), y0 + h / 2, z - 0.05))
        block(
            "deepred", 0.12, h - 1.0, 0.1, at(ID, s * (w / 2 + 0.2), y0 + h / 2, z + 0.25)
        )  # crimson edges
    block("panel", w + 0.3, h + 0.3, 0.7, at(ID, 0, y0 + h / 2, z - 0.5))  # the electronics box
    for k in range(1, 6):
        block("dark", w + 0.34, 0.06, 0.6, at(ID, 0, y0 + k * h / 6, z - 0.5), True)
    screen("info", w, 1.2, at(ID, 0, y0 - 1.4, z + 0.02))  # info strip under it
    block("steel", w + 0.4, 1.6, 0.4, at(ID, 0, y0 - 1.4, z - 0.25))
    for y in (y0 + 1.0, y0 + h / 2, y0 + h - 1.0):  # standoff brackets to the wall
        for x in (-w / 2 + 0.6, w / 2 - 0.6):
            block("dark", 0.5, 0.6, z - 0.4, at(ID, x, y, (z - 0.4) / 2))
    block("graphite", w + 1.0, 0.5, 1.4, rot("X", 0.25, 0, y0 + h + 0.9, z + 0.2))  # lamp hood
    for x in (-1.0, 1.0):
        block("lamp", 0.5, 0.12, 0.2, at(ID, x, y0 + h + 0.55, z + 0.7))
    lamp((w / 2 + 0.3, y0 + h + 0.6, z), 0.15)
    lx = -w / 2 - 0.8  # caged ladder beside it
    for x in (lx - 0.25, lx + 0.25):
        block("steel", 0.06, h + 2.0, 0.06, at(ID, x, y0 + h / 2 - 1.0, 0.6), True)
    for y in range(int(y0) - 2, int(y0 + h)):
        block("steel", 0.5, 0.05, 0.05, at(ID, lx, y + 0.5, 0.6), True)


MODULES = {
    "extension": extension,
    "lift": lift,
    "lift_top": lift_top,
    "conduit": conduit,
    "vent": vent,
    "armor": armor,
    "crown": crown,
    "ad": ad,
}

for kind, make in MODULES.items():
    name = "flagship_" + kind
    scene = bpy.data.scenes.get(name) or bpy.data.scenes.new(name)
    bpy.context.window.scene = scene
    clear(scene)
    parts.clear()
    make()
    join(scene, name)
    studio(scene)
    print(name, kit.stats(name))
    if globals().get("CITY"):  # the city's copies: .gltf + .bin, loaded by web/src/landmarks.js
        folder = os.path.join(REPO, "web", "assets", "models", name)  # noqa: F821
        print(kit.export(name, folder, "GLTF_SEPARATE"))
