"""Build rooftop energy reactors and communication spires, in Blender (original designs).

In Blender: REPO = r"<repo root>"; exec(open(REPO + "/tools/blender/rooftop_tech.py").read())
Builds each model into its own scene "<name>" (with a studio for review renders). CITY = True
before exec writes the city's copies (web/assets/models/<name>).

The power infrastructure of a vast, dark civilization: massive, armoured, built into the tower.
Every model stands on y = 0 (the roof) with its footprint centred on the origin, designed for a
10 m roof (the renderer, web/src/rooftech.js, scales it to the roof and adds the parts that tie it
into the building). No platform: each housing rises straight out of the roof from a foundation
sunk into it, braced out to the roof by buttress feet. One architectural language: midnight-blue
steel caps and clamps ("steel"), graphite foundations ("graphite"), weathered gunmetal ribs and
masts ("gun"), blackened titanium armour ("plate"). Light comes only from the energy chamber
("core"; "corehot" on landmarks), one large continuous surface drawn by the renderer's core shader
(slow, irregular variation, a slow breath), seen recessed behind ribs, bars and armour and through
the cap's opening; thin blood-red channels ("seam"), small red lamps ("red") and the odd cool
technical light ("ice"). Mostly dark metal; never a glowing sphere, never rows of lit "floors".
- core_mid_a / _b: a broad, low containment housing, about 6 m across the ribs and 4 m high:
  octagonal with chevron armour on alternate faces and beams over the opening / hexagonal, its ribs
  closing in toward a cap with three vent stacks;
- core_industrial: a larger plant for wide roofs (9 x 6 m): a housing standing in a long armoured
  base with sloped walls, coolant drums and heat-exchanger fins at both ends;
- core_landmark: a larger housing whose ribs rise past the cap and close in like claws, a hotter
  chamber and a footing (MAST_Y) where a spire may stand;
- comm_spire_a / _b: a 10 m reinforced communications spire: a heavy base, a tapered mast in
  square sections with collars, braces, directional panels on arms, transmitter arrays, a narrow
  tip and a red aviation beacon (b: a lighter mast with an equipment platform and a dish).
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
kit.ROLES.setdefault("gun", (0x464A51, 0.55, 0.55, None, 0, 1, "rust"))  # weathered gunmetal
kit.ROLES.setdefault("plate", (0x161C29, 0.5, 0.35, None, 0, 1, None))  # blackened titanium
kit.ROLES.setdefault("core", (0x2A0810, 0.0, 0.3, 0xB3122A, 6.0, 1, None))  # the chamber
kit.ROLES.setdefault("corehot", (0x2A0810, 0.0, 0.3, 0xE0202E, 9.0, 1, None))  # a landmark's
kit.ROLES.setdefault("seam", (0x2A0810, 0.0, 0.4, 0x5A0E16, 3.0, 1, None))  # recessed seams
from kit import at, bar, block, clear, join, lamp, lathe, loft, parts, studio, tube  # noqa: E402

ID = Matrix()
TAU = 2 * math.pi


def turn(a):
    """Matrix turning a part about the vertical so its local +x points out along angle a."""
    return Matrix.Rotation(-a, 4, "Y")


def lip(role, r_in, r_out, y0, y1, seg):
    """A flat ring of seg sides from y0 to y1: a seam, a collar."""
    return lathe(
        role, [(r_in, y0), (r_out, y0), (r_out, y1), (r_in, y1), (r_in, y0)], seg, False, 20
    )


def containment(
    R, h, seg=8, closed=(0, 2, 4, 6), lean=0.0, role="core", feet=1.3, oculus=0.62, y=0.0
):
    """A broad, low containment housing round the vertical axis, rising straight out of the roof
    (or deck) at height y: a flush foundation sunk into it, heavy ribs on the corners braced out
    by buttress feet, a large recessed energy chamber behind them, angular armour on the closed
    faces (a low skirt on the open ones, where the chamber shows as one tall panel of light), thin
    energy channels in every other rib and a low cap whose opening shows the chamber from above.
    R: the ribs' radius; h: the housing's height; lean: how much the ribs close in at the top.
    Returns the cap's top."""
    ap = R * math.cos(math.pi / seg)  # apothem: the faces' distance from the axis
    face = 2 * R * math.sin(math.pi / seg)  # one face's width at the ribs
    top = R * (1 - lean)

    def p(a, r, yy):
        return (math.cos(a) * r, y + yy, math.sin(a) * r)

    # The foundation: mostly below the roof, a low chamfered lip above it, a seam at its edge.
    lathe(
        "graphite",
        [
            (0, y - 0.6),
            (R * 1.18, y - 0.6),
            (R * 1.18, y + 0.12),
            (R * 1.08, y + 0.25),
            (0, y + 0.25),
        ],
        seg,
        False,
        20,
    )
    lip("seam", R * 1.12, R * 1.16, y + 0.12, y + 0.17, seg)
    # The chamber: one continuous surface, recessed behind the ribs and armour.
    lathe(
        role,
        [(0, y + 0.25), (R * 0.8, y + 0.25), (top * 0.8, y + h - 0.15), (0, y + h - 0.15)],
        seg,
        False,
        20,
    )
    for k in range(seg):  # ribs, their buttress feet, and an energy channel in every other one
        a = k * TAU / seg
        bar("gun", p(a, R, 0.0), p(a, top, h + 0.15), 0.9, 0.55, a)
        bar("gun", p(a, R * feet, 0.0), p(a, R * 1.02, h * 0.55), 0.5, 0.45, a)
        if k % 2 == 0:
            bar("seam", p(a, R + 0.47, 0.6), p(a, top + 0.47, h - 0.4), 0.05, 0.1, a)
        c = p(a, R + 0.3, 0.45)
        block("steel", 0.6, 0.45, 0.7, at(turn(a), *c), True)  # clamps
    for k in range(seg):  # armour between the ribs
        a = (k + 0.5) * TAU / seg
        w = face * 0.9 - 0.5
        if k in closed:  # a chevron of two angled plates, its fold standing out
            mid, ut = h * 0.48, ap * (1 - lean * 0.9)
            bar("plate", p(a, ap * 0.97, 0.25), p(a, ap * 1.06, mid), 0.16, w, a)
            w1 = w * (1 - lean * 0.5)
            bar("plate", p(a, ap * 1.06, mid), p(a, ut * 0.96, h - 0.05), 0.16, w1, a)
        else:  # a low skirt; above it the chamber shows, behind two heavy vertical bars
            bar("plate", p(a, ap, 0.25), p(a, ap * 0.96, h * 0.26), 0.16, w, a)
            tx, tz = -math.sin(a), math.cos(a)  # along the face
            for t in (-w / 6, w / 6):
                b0, b1 = p(a, ap * 0.93, h * 0.2), p(a, ap * 0.93 * (1 - lean * 0.9), h - 0.1)
                b0 = (b0[0] + tx * t, b0[1], b0[2] + tz * t)
                b1 = (b1[0] + tx * t * (1 - lean), b1[1], b1[2] + tz * t * (1 - lean))
                bar("gun", b0, b1, 0.22, 0.2, a)
    # The low cap: a heavy ring closing over the ribs, open in the middle onto the chamber.
    rc, ro = top * 1.12, top * oculus
    lathe(
        "steel",
        [
            (ro, y + h - 0.15),
            (rc, y + h - 0.15),
            (rc, y + h + 0.25),
            (rc * 0.82, y + h + 0.65),
            (ro, y + h + 0.65),
            (ro, y + h - 0.15),
        ],
        seg,
        False,
        20,
    )
    lip("seam", ro - 0.02, ro + 0.05, y + h + 0.6, y + h + 0.66, seg)
    return y + h + 0.65


def cap_details(top, R, a0):
    """Two vents and a hatch on the cap (top: its height), a pipe down one rib (detail); a red
    lamp on the cap's edge."""
    for k, a in enumerate((a0, a0 + 2.4)):
        c = (math.cos(a) * R * 0.75, top, math.sin(a) * R * 0.75)
        block("steel", 0.7, 0.5, 0.5, at(turn(a), c[0], c[1] + 0.25, c[2]), True)
        if k == 0:
            tube(
                "gun",
                (c[0] * 1.35, top - 1.0, c[2] * 1.35),
                (c[0] * 1.6, 0.3, c[2] * 1.6),
                0.15,
                True,
                6,
            )
    lamp((math.cos(a0 + 1.2) * R * 0.95, top + 0.1, math.sin(a0 + 1.2) * R * 0.95), 0.18)


# ---- reactors -------------------------------------------------------------------------------
# Designed for a 10 m roof: housings about 6 m across the ribs, feet to about 8 m, 4 m high.


def core_mid_a():
    top = containment(3.0, 3.6, 8, closed=(0, 2, 4, 6))
    for k in range(1):  # a beam across the cap's opening
        a = k * TAU / 4 + TAU / 16
        block("gun", 2.7, 0.25, 0.3, at(turn(a), 0, top - 0.15, 0))
    cap_details(top, 3.0, 0.4)


def core_mid_b():
    top = containment(3.1, 3.4, 6, closed=(0, 2, 4), lean=0.18, feet=1.35, oculus=0.62)
    for k in range(3):  # three short vent stacks round the opening
        a = k * TAU / 3 + 0.5
        c = (math.cos(a) * 1.9, top, math.sin(a) * 1.9)
        tube("gun", c, (c[0], c[1] + 0.8, c[2]), 0.28, False, 6)
        tube("graphite", (c[0], c[1] + 0.8, c[2]), (c[0], c[1] + 0.95, c[2]), 0.34, False, 6)
    cap_details(top, 2.6, 1.6)


def core_industrial():
    """A larger plant for wide roofs (9 x 6 m): one big containment housing standing in a long
    armoured base with sloped walls, coolant drums and heat-exchanger fins at both ends."""
    L, D, hb = 9.0, 6.0, 1.6
    for s in (-1, 1):  # the long sloped walls, in four armoured bays with ribs between
        for k in range(4):
            x = -L / 2 + (k + 0.5) * L / 4
            bar(
                "plate",
                (x, 0.0, s * D / 2),
                (x, hb, s * (D / 2 - 0.7)),
                0.18,
                L / 4 - 0.4,
                s * math.pi / 2,
            )
        for k in range(5):
            x = -L / 2 + k * L / 4
            bar(
                "gun",
                (x, 0.0, s * (D / 2 + 0.25)),
                (x, hb + 0.1, s * (D / 2 - 0.6)),
                0.5,
                0.4,
                s * math.pi / 2,
            )
        block("seam", L - 0.6, 0.05, 0.06, at(ID, 0, hb + 0.02, s * (D / 2 - 0.72)))
    for s in (-1, 1):  # the ends: heavy walls with fins, a coolant drum each
        block("plate", 0.5, hb, D - 1.2, at(ID, s * (L / 2 - 0.05), hb / 2, 0))
        for k in range(6):
            block(
                "gun",
                0.12,
                hb * 0.8,
                0.5,
                at(ID, s * (L / 2 + 0.25), hb * 0.45, -1.6 + k * 0.64),
                True,
            )
        tube("gun", (s * 3.6, 0.0, 1.7), (s * 3.6, hb + 1.3, 1.7), 0.55, False, 8)
        tube("graphite", (s * 3.6, hb + 1.3, 1.7), (s * 3.6, hb + 1.45, 1.7), 0.62, False, 8)
        tube(
            "gun", (s * 3.6, hb + 0.9, 1.6), (s * 2.0, hb + 1.4, 0.9), 0.16, True, 6
        )  # coolant feed
    block("graphite", L - 1.0, 0.25, D - 1.4, at(ID, 0, hb + 0.12, 0))  # the base's deck
    containment(2.4, 3.0, 8, closed=(1, 3, 5, 7), feet=1.15, oculus=0.6, y=hb + 0.25)
    lamp((L / 2 - 0.4, hb + 0.4, -D / 2 + 0.9), 0.16)


MAST_Y = (
    7.6  # core_landmark: the top of its mast footing, where a spire stands (web/src/rooftech.js)
)


def core_landmark():
    """Rare, on major skyscrapers and the signature towers: a larger housing whose ribs rise past
    the cap and close in like claws over it, a hotter chamber, a footing for a central mast."""
    R, h = 3.7, 4.4
    top = containment(R, h, 8, closed=(0, 2, 4, 6), role="corehot", feet=1.38, oculus=0.6)
    rt = R * 0.62
    for k in range(8):  # the claws
        a = k * TAU / 8
        c0, c1 = (
            (math.cos(a) * R, h + 0.1, math.sin(a) * R),
            (math.cos(a) * rt, h + 2.6, math.sin(a) * rt),
        )
        bar("gun", c0, c1, 0.6, 0.45, a)
        if k % 2:
            s0 = (math.cos(a) * (R + 0.32), h + 0.4, math.sin(a) * (R + 0.32))
            s1 = (math.cos(a) * (rt + 0.3), h + 2.3, math.sin(a) * (rt + 0.3))
            bar("seam", s0, s1, 0.05, 0.1, a)
    ring = [
        (rt - 0.3, h + 2.3),
        (rt + 0.35, h + 2.3),
        (rt + 0.35, h + 2.7),
        (rt - 0.3, h + 2.7),
        (rt - 0.3, h + 2.3),
    ]
    lathe("gun", ring, 8, False, 20)  # the claws' collar
    lathe(
        "graphite", [(0, top - 0.3), (0.9, top - 0.3), (0.75, MAST_Y), (0, MAST_Y)], 8, False, 20
    )  # mast footing
    for k in range(4):  # beams from the cap to the footing
        a = k * TAU / 4
        block(
            "gun",
            R * 0.55,
            0.3,
            0.3,
            at(turn(a), math.cos(a) * R * 0.48, top - 0.1, math.sin(a) * R * 0.48),
        )
    cap_details(top, R, 0.9)


# ---- communication spires ---------------------------------------------------------------------


def square(w, y):
    """A square section w wide at height y, sides along x and z."""
    return [(w / 2, y, w / 2), (-w / 2, y, w / 2), (-w / 2, y, -w / 2), (w / 2, y, -w / 2)]


def mast(sections, y, w):
    """Stacked tapered square sections with collars; returns the top and its width, and the
    (y, width) at each collar."""
    collars = []
    for h in sections:
        wt = w * 0.74
        loft("gun", [square(w, y), square(wt, y + h)])
        block("steel", wt + 0.2, 0.2, wt + 0.2, at(ID, 0, y + h, 0))
        collars.append((y + h, wt))
        y, w = y + h, wt
    return y, w, collars


def comm_spire_a():
    block("gun", 2.6, 0.35, 2.6, at(ID, 0, 0.17, 0))
    block("graphite", 1.7, 0.85, 1.7, at(ID, 0, 0.77, 0))
    y0, w0 = 1.2, 0.9
    top, w, collars = mast((3.0, 2.3, 1.6, 1.1), y0, w0)
    for sx, sz in ((-1, -1), (1, -1), (-1, 1), (1, 1)):  # braces from the base corners
        tube("gun", (sx * 1.0, y0, sz * 1.0), (sx * 0.32, y0 + 2.5, sz * 0.32), 0.07, False, 6)
    for (ya, wa), (yb, wb) in zip([(y0, w0), *collars[:1]], collars[:2], strict=True):
        # A thin red seam set into one edge of the two lower sections, following the taper.
        e0, e1 = (wa / 2 - 0.02, ya + 0.15), (wb / 2 - 0.02, yb - 0.15)
        bar("seam", (e0[0], e0[1], e0[0]), (e1[0], e1[1], e1[0]), 0.06, 0.06, math.pi / 4)
    for k, a in enumerate((0.3, 0.3 + TAU / 3, 0.3 + 2 * TAU / 3)):  # directional panels on arms
        yy = collars[0][0] + 1.0
        tube(
            "gun",
            (math.cos(a) * 0.3, yy, math.sin(a) * 0.3),
            (math.cos(a) * 0.85, yy, math.sin(a) * 0.85),
            0.05,
            False,
            6,
        )
        block("plate", 0.1, 1.3, 0.62, at(turn(a), math.cos(a) * 0.9, yy, math.sin(a) * 0.9))
        if k == 0:
            block(
                "ice",
                0.03,
                0.04,
                0.4,
                at(turn(a), math.cos(a) * 0.96, yy - 0.55, math.sin(a) * 0.96),
            )
    for k in range(4):  # transmitter array round the third section
        a = k * TAU / 4 + TAU / 8
        yy, ww = collars[1][0] + 0.8, collars[1][1]
        block(
            "steel",
            0.14,
            0.6,
            0.14,
            at(ID, math.cos(a) * (ww * 0.5 + 0.12), yy, math.sin(a) * (ww * 0.5 + 0.12)),
            True,
        )
    for yy, ww in collars[:3:2]:  # navigation lamps on two collars
        lamp((ww / 2 + 0.12, yy + 0.05, 0), 0.08)
    tube("gun", (0, top, 0), (0, 10.0, 0), 0.05, False, 6)  # the narrow tip
    lamp((0, 10.05, 0), 0.14)  # aviation beacon


def comm_spire_b():
    block("gun", 2.4, 0.35, 2.4, at(ID, 0, 0.17, 0))
    block("graphite", 1.5, 1.0, 1.5, at(ID, 0, 0.85, 0))
    y0 = 1.35
    top, w, collars = mast((3.6, 2.6, 1.4), y0, 0.75)
    for sx, sz in ((-1, -1), (1, -1), (-1, 1), (1, 1)):
        tube("gun", (sx * 0.9, y0, sz * 0.9), (sx * 0.3, y0 + 2.8, sz * 0.3), 0.07, False, 6)
    py = collars[0][0]  # an equipment platform at the first collar, with a dish and panels
    lathe(
        "graphite",
        [(0.3, py - 0.1), (1.2, py - 0.1), (1.2, py + 0.05), (0.3, py + 0.05), (0.3, py - 0.1)],
        8,
        False,
        20,
    )
    for k in range(4):
        a = k * TAU / 4 + TAU / 8
        tube(
            "gun",
            (math.cos(a) * 0.3, py - 1.2, math.sin(a) * 0.3),
            (math.cos(a) * 1.1, py - 0.1, math.sin(a) * 1.1),
            0.05,
            True,
            6,
        )
    lathe(
        "plate",
        [(0, py + 0.4), (0.55, py + 0.55), (0.6, py + 0.62), (0, py + 0.5)],
        10,
        True,
        40,
        center=(0.9, 0),
    )
    for a in (1.8, 3.6):
        block("plate", 0.1, 1.1, 0.55, at(turn(a), math.cos(a) * 1.0, py + 0.65, math.sin(a) * 1.0))
    (ya, wa), (yb, wb) = (y0, 0.75), collars[0]
    e0, e1 = (wa / 2 - 0.02, ya + 0.15), (wb / 2 - 0.02, yb - 0.15)
    bar("seam", (e0[0], e0[1], -e0[0]), (e1[0], e1[1], -e1[0]), 0.06, 0.06, -math.pi / 4)
    tube("gun", (0.9, py + 0.05, 0), (0.9, py + 0.45, 0), 0.06, True, 6)  # the dish's post
    block("ice", 0.03, 0.05, 0.3, at(ID, 1.21, py, 0), True)
    lamp((collars[1][1] / 2 + 0.1, collars[1][0] + 0.05, 0), 0.08)
    tube("gun", (0, top, 0), (0, 10.0, 0), 0.05, False, 6)
    lamp((0, 10.05, 0), 0.14)


MODELS = {
    "core_mid_a": core_mid_a,
    "core_mid_b": core_mid_b,
    "core_industrial": core_industrial,
    "core_landmark": core_landmark,
    "comm_spire_a": comm_spire_a,
    "comm_spire_b": comm_spire_b,
}

for name, make in MODELS.items():
    scene = bpy.data.scenes.get(name) or bpy.data.scenes.new(name)
    bpy.context.window.scene = scene
    clear(scene)
    parts.clear()
    make()
    join(scene, name)
    studio(scene)
    print(name, kit.stats(name))
    if globals().get("CITY"):  # the city's copies: .gltf + .bin, loaded by web/src/rooftech.js
        folder = os.path.join(REPO, "web", "assets", "models", name)  # noqa: F821
        print(kit.export(name, folder, "GLTF_SEPARATE"))
