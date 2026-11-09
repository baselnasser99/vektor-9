"""Build the city's telecom and observation tower in Blender (an original design).

In Blender: REPO = r"<repo root>"; exec(open(REPO + "/tools/blender/telecom_tower.py").read())
(it loads tools/blender/kit.py, the shared modelling helpers).
Builds into its own scene "telecom_tower" (with a studio for review renders), leaving the open
scene alone. EXPORT = r"<folder>" before exec also writes telecom_tower.glb there.

Structure: a tapered concrete core with panel joints; three tapered concrete legs, flared at the
foot, standing on pile caps, grown out of the core on web walls low down and tied back to it by
steel girders higher up; a concrete transfer ring where the legs and core meet under the crown,
and twelve raking steel columns from it out to the crown's floor. The crown: a louvred service
level, the main observation level (outward-raked glass, steel mullions, a transom, a lit ceiling),
a control level, and over it the Reactor Crown: a dark armoured containment crown, wider than
the deck, round a large crimson reactor crater, with eight armour segments and a
short dark mast on one of them. At the foot, a two-level podium round a
glazed lobby.

Decades of retrofits sit on that concrete frame, concentrated at three structural nodes so most of
the shaft stays clean: a lower plant node where the web walls end (housings, fans, radiators, a
steel collar), the main mechanical level (a two-storey drum clamped between the legs, knee braces,
collars, a gantry, comms modules) and an upper equipment node under the transfer ring. Enclosed
steel lift shafts with a lit conduit and maintenance indicators, and two large pipelines feeding
the plant nodes. The crown becomes a command level: angular armour over the legs, a reinforced
control level with slit glazing, one curved display, walkways. The base
becomes a hub: a monumental portal, power yard with transformers, vent towers, garages, an annex
on an enclosed cable bridge. Signage is invented text. build(1) makes a lighter variant (LOD1).

Parts are built in three.js coordinates (y up) and turned to Blender's z up as they are added, so
the glTF comes out in the renderer's frame. UVs are in metres / REPEAT (web/src/geometry.js).
Objects are joined per material and named after a role ("concrete", "glass", ...); the renderer
gives each a palette material. Small parts go under the empty "detail", drawn only near the camera.
"""

import importlib
import math
import os
import sys

import bmesh
import bpy
from mathutils import Matrix

# The shared kit (tools/blender/kit.py). exec() from Blender has no __file__, so REPO is set first.
sys.path.insert(0, os.path.join(REPO, "tools", "blender"))  # noqa: F821
import kit  # noqa: E402

importlib.reload(kit)  # Blender keeps modules between runs
from kit import (  # noqa: E402
    add,
    arc,
    at,
    bar,
    block,
    clear,
    collar,
    facing,
    fan,
    grille,
    join,
    lamp,
    lathe,
    loft,
    offset,
    parts,
    proxy_material,
    radial,
    radiator,
    rail,
    ring,
    section,
    studio,
    text,
    tube,
)

# Proportions, in metres. Tune here; everything else follows.
H = 262.0  # mast tip (the central spire over the reactor)
TOP = 224.0  # sets the core's taper (it stops under the reactor chamber)
CORE = (6.5, 3.4)  # core radius at the ground and at TOP (straight taper)
JOINT = 12.0  # concrete panel joint spacing on core and legs
LEG_R = (18.0, 8.0)  # leg centre radius at the foot and at the top
LEG_D = (6.4, 2.8)  # leg depth (radial) at the foot and top
LEG_W = (4.2, 2.2)  # leg width (tangential) at the foot and top
FOOT, LEG_TOP = 3.5, 188.0  # legs run from the pile caps to inside the transfer ring
TIES = (96.0, 160.0)  # steel girders, legs to core, between the nodes
WEB = (15.0, 40.0, 74.0)  # web walls: from, full depth up to, peeled into the leg at
WEB_T = 1.6  # web wall thickness at its foot
NODES = (78.0, 134.0, 170.0)  # plant nodes: lower, main mechanical level, upper equipment
SIGN = "V9 RELAY"  # operator mark on the crown (invented)
RING = (185.0, 190.0)  # concrete transfer ring under the crown
FLOOR = 196.4  # top of the crown's floor slab
SERVICE, MAIN, UPPER = 4.0, 8.5, 5.0  # storey heights in the crown
CROWN_R = (15.3, 16.1)  # main glass radius at its foot and head (raked out)
UPPER_R = 13.2  # restaurant level glass radius
CS = 1.12  # crown scale: all crown radii below are multiplied by this
# Reactor Crown: outer radius (about 1.25 times the observation deck's), chamber radius, armour
# segments (count, half-width in radians, the first one's angle)
CROWN_OUT, CHAMBER = 24.6, 13.5
SEGMENTS, SEG_W, SEG0 = 8, 0.17, math.pi / 2
LEG_ANGLES = [k * 2 * math.pi / 3 + math.pi / 2 for k in range(3)]
ENTRANCE, SERVICE_SIDE, VENT_SIDE = math.radians(270), math.radians(30), math.radians(150)
LIFTS = (math.radians(270), math.radians(150))  # glazed lift shafts on the core
CONDUITS = math.radians(30)


def core_r(y):
    return CORE[0] + (CORE[1] - CORE[0]) * y / TOP


def leg_s(y):
    return (y - FOOT) / (LEG_TOP - FOOT)


def leg_r(y):
    return LEG_R[1] + (LEG_R[0] - LEG_R[1]) * (1 - leg_s(y)) ** 2.0


def leg_dw(y):
    s = leg_s(y)
    return (
        LEG_D[1] + (LEG_D[0] - LEG_D[1]) * (1 - s) ** 1.3,
        LEG_W[1] + (LEG_W[0] - LEG_W[1]) * (1 - s) ** 1.3,
    )


def leg_out(y):
    """Radius of the legs' outer faces at height y."""
    return leg_r(y) + leg_dw(y)[0] / 2


def gaps():
    """Angles midway between the legs."""
    return [a + math.pi / 3 for a in LEG_ANGLES]


# ---------------------------------------------------------------------------------------------


def build_core():
    """Tapered concrete core in JOINT-high lifts with recessed joints, from the ground up through
    the crown to the reactor chamber's floor. LOD 1: one plain taper."""
    top = crown_levels()[4] - 0.6
    if kit.LOD:
        lathe("concrete", [(core_r(0), 0), (core_r(top), top)], 24)
        return
    y = 0.0
    while y < top - 0.1:
        y1 = min(y + JOINT, top)
        lathe(
            "concrete",
            [
                (core_r(y) - 0.15, y),
                (core_r(y) - 0.15, y + 0.15),
                (core_r(y + 0.3), y + 0.3),
                (core_r(y1 - 0.3), y1 - 0.3),
                (core_r(y1) - 0.15, y1 - 0.15),
                (core_r(y1) - 0.15, y1),
            ],
            48,
        )
        y = y1


def build_legs():
    """Three concrete legs: a chamfered section, deep at the foot and slim at the top, on a
    concave curve in towards the core; recessed panel joints every JOINT metres."""
    joints = set() if kit.LOD else set(range(int(JOINT), int(LEG_TOP), int(JOINT)))
    levels = sorted(
        {FOOT + (LEG_TOP - FOOT) * (i / 16) ** 1.3 for i in range(17)}
        | {j + d for j in joints for d in (-0.2, 0.2)}
        | joints
    )
    for a in LEG_ANGLES:
        rings = []
        for y in levels:
            d, w = leg_dw(y)
            k = 0.97 if y in joints else 1.0
            pts = [
                (d / 2, w * 0.2),
                (d * 0.28, w / 2),
                (-d * 0.36, w / 2),
                (-d / 2, w * 0.3),
                (-d / 2, -w * 0.3),
                (-d * 0.36, -w / 2),
                (d * 0.28, -w / 2),
                (d / 2, -w * 0.2),
            ]
            rings.append(section(radial(a, leg_r(y), y), a, [(u * k, v * k) for u, v in pts]))
        loft("concrete", rings, smooth_angle=30)


def build_webs():
    """Concrete web walls in each leg's plane, core to leg, from the podium roof up the lower
    shaft. Above WEB[1] the web peels off the core on a curve and runs into the leg, so the legs
    read as growing out of the core rather than standing apart from it."""
    y0, y1, top = WEB
    levels = [y0 + (top - y0) * i / 24 for i in range(25)]
    for a in LEG_ANGLES:
        rings = []
        for y in levels:
            inner, outer = core_r(y) - 0.3, leg_r(y) - leg_dw(y)[0] * 0.3
            if y > y1:
                inner += (outer - 0.6 - inner) * ((y - y1) / (top - y1)) ** 1.6
            t = WEB_T * (1 - 0.35 * (y - y0) / (top - y0))
            rings.append(
                section(
                    radial(a, (inner + outer) / 2, y),
                    a,
                    [
                        ((outer - inner) / 2, t / 2),
                        (-(outer - inner) / 2, t / 2),
                        (-(outer - inner) / 2, -t / 2),
                        ((outer - inner) / 2, -t / 2),
                    ],
                )
            )
        loft("concrete", rings, smooth_angle=30)


def build_ties():
    """Steel box girders from the core to each leg's inner face at every tie level, with bolted
    connection plates at both ends."""
    for y in TIES:
        for a in LEG_ANGLES:
            r0, r1 = core_r(y), leg_r(y) - leg_dw(y)[0] / 2 + 0.1
            mid = (r0 + r1) / 2
            block("steel", r1 - r0, 1.8, 1.2, at(facing(a), *radial(a, mid, y)))
            for r in (r0 + 0.15, r1 - 0.15):
                block("steel", 0.3, 2.6, 2.0, at(facing(a), *radial(a, r, y)))


def build_lifts():
    """Enclosed lift shafts (a steel frame clad in composite panels, a narrow glass strip up the
    front) riding up the core; one carries a lit service conduit, the other a column of
    segmented maintenance indicators. Two large pipelines up the third face, feeding the plant
    nodes, clamped at each node and every 24 m, with a cable tray beside them."""
    for a in LIFTS:
        y0, y1 = 9.6, RING[0]
        d = 3.0
        c0, c1 = radial(a, core_r(y0) + d / 2 - 0.2, y0), radial(a, core_r(y1) + d / 2 - 0.2, y1)
        bar("mech", c0, c1, d, 4.2, a)
        f0, f1 = radial(a, core_r(y0) + d - 0.15, y0), radial(a, core_r(y1) + d - 0.15, y1)
        bar("glass", f0, f1, 0.12, 0.8, a)
        for side in (-2.15, 2.15):  # steel corner posts
            bar("steel", offset(c0, a, side), offset(c1, a, side), d + 0.3, 0.25, a)
        for y in range(int(JOINT), int(y1), int(JOINT)):  # frame bands, an indicator at each
            block(
                "steel", d + 0.3, 0.35, 4.6, at(facing(a), *radial(a, core_r(y) + d / 2 - 0.2, y))
            )
            if a == LIFTS[1]:
                p = offset(radial(a, core_r(y + 3) + d - 0.05, y + 3), a, 1.6)
                block("white", 0.12, 1.2, 0.35, at(facing(a), *p))
        if a == LIFTS[0]:  # the lit conduit, up one front edge
            g0, g1 = (offset(radial(a, core_r(y) + d - 0.05, y), a, -1.7) for y in (y0, y1))
            bar("cyan", g0, g1, 0.14, 0.14, a)
    a = CONDUITS
    for side in (-0.85, 0.85):
        lo, hi = (offset(radial(a, core_r(y) + 1.0, y), a, side) for y in (14.6, NODES[2]))
        tube("mech", lo, hi, 0.62, seg=12)
    tray0, tray1 = (offset(radial(a, core_r(y) + 0.25, y), a, 2.2) for y in (14.6, RING[0]))
    bar("steel", tray0, tray1, 0.5, 0.9, a)
    for y in sorted({*NODES, *range(36, int(NODES[2]), 24)}):
        if y < NODES[2]:
            block("steel", 1.6, 0.5, 3.4, at(facing(a), *radial(a, core_r(y) + 1.0, y)))


def build_nodes():
    """The plant nodes, at structural transitions only; the shaft between them stays clean.
    Each breaks the shaft's outline, so it reads from across the city."""
    gs = gaps()
    # Lower plant node, where the web walls end: three heavy housings between the legs, reaching
    # out past them (fans on top, a radiator bank on one, grilles on the others), and a collar.
    y = NODES[0]
    for k, a in enumerate(gs):
        r0, r1 = core_r(y) - 0.3, leg_out(y) + 2.6
        mid = (r0 + r1) / 2
        block("mech", r1 - r0, 10.0, 8.0, at(facing(a), *radial(a, mid, y)), bevel=0.2)
        block("steel", r1 - r0 + 0.5, 0.7, 8.5, at(facing(a), *radial(a, mid, y + 5.2)))
        block("steel", r1 - r0 + 0.5, 0.7, 8.5, at(facing(a), *radial(a, mid, y - 5.2)))
        for side in (-2.0, 2.0):
            fan(offset(radial(a, r1 - 2.4, 0), a, side), y + 5.5, 1.5)
        for side in (-2.6, 2.6):  # lit plant-room windows on the side faces
            for sgn in (-1, 1):
                p = offset(radial(a, mid + side, y + 2.4), a, sgn * 4.03)
                block("interior", 1.6, 0.9, 0.08, at(facing(a), *p))
        if k == 0:
            radiator(radial(a, r1, y), a, y, 14, 6.4, 7.0, 1.0)
        else:
            grille(radial(a, r1 + 0.05, 0), a, y + 1.5, 5.0, 3.6)
            block(
                "dark",
                0.12,
                2.4,
                1.6,
                at(facing(a), *offset(radial(a, r1 + 0.05, y - 3.2), a, 2.6)),
            )
    collar(y + 6.2, leg_out(y + 6.2) - 1.6, leg_out(y + 6.2) + 0.8, 2.6)

    # Main mechanical level: a faceted two-storey plant drum wrapped round core and legs, on
    # steel corbels from the legs; a louvred band with radiator banks, collars top and bottom,
    # comms modules and a gantry on the roof ring.
    y0, y1 = NODES[1] - 7.0, NODES[1] + 7.0
    rd = leg_out(NODES[1]) + 2.6
    lathe(
        "mech",
        [
            (core_r(y0), y0),
            (rd - 1.0, y0),
            (rd, y0 + 1.6),
            (rd, y1 - 1.0),
            (rd - 0.6, y1),
            (core_r(y1), y1),
        ],
        12,
        smooth_angle=20,
    )
    lathe("dark", [(rd + 0.03, NODES[1] - 1.2), (rd + 0.03, NODES[1] + 2.6)], 12, smooth_angle=20)
    collar(y0 + 1.2, rd - 0.4, rd + 0.5, 1.2)
    collar(y1 - 0.5, rd - 0.4, rd + 0.6, 1.0)
    for k in range(12):  # louvre fins on each facet, radiator banks on three
        b = (k + 0.5) * 2 * math.pi / 12
        apo = rd * math.cos(math.pi / 12)
        for i in range(5):
            p = offset(radial(b, apo + 0.15, NODES[1] + 0.7), b, (i - 2) * 1.2)
            block("steel", 0.45, 3.4, 0.08, at(facing(b) @ Matrix.Rotation(0.4, 4, "Y"), *p))
        if k % 4 == 1:
            radiator(radial(b, apo + 0.5, 0), b, y0 + 3.6, 10, 5.0, 3.2, 0.8)
        elif k % 2:  # lit control-room windows on some facets
            p = radial(b, apo + 0.06, NODES[1] + 4.4)
            block("interior", 0.08, 1.0, 3.2, at(facing(b), *p))
    for a in LEG_ANGLES:  # corbels: raking steel from the leg's outer face to the drum's edge
        for side in (-1.2, 1.2):
            foot = offset(radial(a, leg_out(y0 - 6) - 0.3, y0 - 6), a, side)
            head = offset(radial(a, rd - 1.2, y0 + 0.2), a, side)
            tube("steel", foot, head, 0.65, seg=10)
    for a in gs:  # comms modules on the roof ring
        for side in (-1.4, 1.4):
            p = offset(radial(a, rd - 1.6, y1 + 1.7), a, side)
            block("steel", 0.5, 3.4, 1.3, at(facing(a), *p))
    a = gs[0]  # service gantry off the roof ring, safety-orange rails
    block("steel", 3.0, 0.25, 4.2, at(facing(a), *radial(a, rd + 1.3, y1 - 0.2)))
    for side in (-1.9, 1.9):
        rail(
            "orange",
            [
                offset(radial(a, rd - 0.2, y1 - 0.05), a, side),
                offset(radial(a, rd + 2.7, y1 - 0.05), a, side),
            ],
        )
    rail("orange", [offset(radial(a, rd + 2.7, y1 - 0.05), a, s2) for s2 in (-1.9, 1.9)])
    p = radial(gs[1], rd - 2.6, y1 + 1.6)  # a roof plant room
    block("mech", 3.6, 3.2, 4.6, at(facing(gs[1]), *p), bevel=0.1)

    # Upper equipment node under the transfer ring: enclosures between the legs, out past them,
    # radiator banks on two, a grille on the third, a collar, a sensor dome.
    y = NODES[2]
    for k, a in enumerate(gs):
        r0, r1 = core_r(y) - 0.3, leg_out(y) + 1.8
        block("mech", r1 - r0, 7.0, 5.4, at(facing(a), *radial(a, (r0 + r1) / 2, y)), bevel=0.15)
        block("steel", r1 - r0 + 0.4, 0.5, 5.8, at(facing(a), *radial(a, (r0 + r1) / 2, y + 3.7)))
        if k < 2:
            radiator(radial(a, r1, y), a, y, 9, 4.2, 5.0, 0.8)
        else:
            grille(radial(a, r1 + 0.05, 0), a, y + 0.6, 3.6, 2.6)
    collar(y + 5.0, leg_out(y + 5.0) - 1.5, leg_out(y + 5.0) + 0.6, 2.0)
    a = gs[2]
    dome = radial(a, leg_out(y) + 0.2, y + 3.95)
    lathe(
        "mech",
        [(0, dome[1]), (0.9, dome[1]), (0.9, dome[1] + 0.6), (0, dome[1] + 0.6)],
        12,
        center=(dome[0], dome[2]),
    )
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=16 if not kit.LOD else 8, v_segments=8, radius=1.4)
    add(bm, "mech", Matrix.Translation((dome[0], dome[1] + 1.6, dome[2])), smooth_angle=80)


def build_transfer():
    """Where the structure gathers under the crown: a concrete transfer ring round the core that
    the legs run into, faceted and with a recessed joint; twelve raking steel columns from bearing
    plates on its face out to the crown floor's edge, and radial steel beams under the floor
    from each column head back to the core, so the load path reads. The steel is its own role
    ("strut"): a medium steel-blue between the dark drum above and the concrete below."""
    y0, y1 = RING
    mid = (y0 + y1) / 2
    lathe(
        "concrete",
        [
            (core_r(y0) - 0.2, y0),
            (8.6, y0),
            (9.8, y0 + 1.0),
            (9.8, mid - 0.2),
            (9.55, mid),
            (9.8, mid + 0.2),
            (9.8, y1 - 0.6),
            (9.2, y1),
            (core_r(y1) - 0.2, y1),
        ],
        24,
        smooth_angle=20,
    )
    head_r, beam_y = 15.0 * CS, FLOOR - 1.2 - 0.45
    for k in range(12):
        a = k * math.pi / 6 + LEG_ANGLES[0]
        bar("strut", radial(a, 9.9, y0 + 1.9), radial(a, head_r, FLOOR - 1.1), 1.0, 0.8, a)
        block("strut", 0.3, 2.2, 1.6, at(facing(a), *radial(a, 9.95, y0 + 2.1)))
        r0 = core_r(beam_y)
        block("strut", head_r - r0, 0.9, 0.55, at(facing(a), *radial(a, (head_r + r0) / 2, beam_y)))


def build_crown():
    """The observation crown, from its floor slab up to the control level's roof, in the darker
    support band under the Reactor Crown: worn gunmetal slabs (role "deck", not the shaft's
    concrete) with cool-grey trim on their lips, dark panel breaks, thin crimson seams, and a
    warm line of light under the upper slab."""
    f = FLOOR
    lathe(
        "deck",
        [
            (core_r(f) - 0.2, f - 1.2),
            (15.5 * CS, f - 1.2),
            (15.9 * CS, f - 0.8),
            (15.9 * CS, f),
            (core_r(f) - 0.2, f),
        ],
        64,
    )
    ring("shell", 15.85 * CS, 0.07, f - 0.05, 96, 4)  # trim on the floor slab's lip
    ring("rim", 15.92 * CS, 0.06, f - 0.45, 96, 4)  # orange line round its face
    # Service level: set back, louvred.
    s1 = f + SERVICE
    lathe("dark", [(13.6 * CS, f), (13.6 * CS, s1)], 64)
    for k in range(64):
        a = k * 2 * math.pi / 64
        fin = at(facing(a) @ Matrix.Rotation(0.35, 4, "Y"), *radial(a, 13.95 * CS, (f + s1) / 2))
        block("steel", 0.7, SERVICE - 0.3, 0.1, fin)
    # Main floor slab, the observation level's glass, mullions, a transom, the lit ceiling.
    m0 = s1 + 0.8
    lathe(
        "deck",
        [
            (core_r(s1), s1),
            (16.1 * CS, s1),
            (16.3 * CS, s1 + 0.3),
            (16.3 * CS, m0 - 0.1),
            (15.3 * CS, m0),
            (core_r(m0), m0),
        ],
        64,
    )
    m1 = m0 + MAIN
    lathe("glass", [(CROWN_R[0] * CS, m0), (CROWN_R[1] * CS, m1)], 64)
    for k in range(60):
        a = k * 2 * math.pi / 60
        foot, head = radial(a, CROWN_R[0] * CS + 0.05, m0), radial(a, CROWN_R[1] * CS + 0.05, m1)
        bar("mech", foot, head, 0.32, 0.16, a)  # slate, so the frame reads against the dark drum
    ring("shell", (CROWN_R[0] + CROWN_R[1]) / 2 * CS + 0.12, 0.1, m0 + MAIN * 0.5, 96, 4)
    ring("shell", 16.25 * CS, 0.07, m0 - 0.1, 96, 4)  # trim on the main slab's lip
    lathe("interior", [(4.2 * CS, m1 - 0.05), (15.6 * CS, m1 - 0.05)], 64)  # ceiling, facing down
    for k in range(12):  # interior columns, and a few silhouettes: counters, seating
        a = k * math.pi / 6 + 0.13
        tube("deck", radial(a, 10.5 * CS, m0), radial(a, 10.5 * CS, m1), 0.45, seg=10)
        if k % 2:
            p = radial(a + 0.25, 13.2 * CS, m0 + 0.55)
            block("dark", 2.4, 1.1, 0.8, at(facing(a + 0.25), *p), True)
    # Upper slab with a thin overhang, and a warm line of light under its edge.
    u0 = m1 + 1.0
    lathe(
        "deck",
        [
            (core_r(m1), m1),
            (16.8 * CS, m1),
            (17.1 * CS, m1 + 0.35),
            (17.1 * CS, u0 - 0.3),
            (16.8 * CS, u0),
            (core_r(u0), u0),
        ],
        64,
    )
    ring("interior", 16.95 * CS, 0.05, m1 - 0.03, 96, 4)
    ring("shell", 16.95 * CS, 0.07, u0 - 0.05, 96, 4)  # trim on its top lip
    ring("rim", 17.12 * CS, 0.06, (m1 + u0) / 2, 96, 4)  # orange line round its face
    for k in range(48):  # dark panel breaks across its face
        a = k * 2 * math.pi / 48
        bar(
            "dark",
            radial(a, 17.1 * CS + 0.02, m1 + 0.4),
            radial(a, 17.1 * CS + 0.02, u0 - 0.35),
            0.1,
            0.18,
            a,
            True,  # near the camera only
        )
    # Control level: reinforced. A composite wall to sill height, a band of slit glazing behind
    # steel fins, and a visor-like upper wall leaning out over it; the lit ceiling shows through.
    u1 = u0 + UPPER
    U = UPPER_R * CS
    sill, head = u0 + 1.5, u0 + 3.0
    lathe("panel", [(U - 0.2, u0), (U + 0.5, u0), (U + 0.5, sill), (U - 0.2, sill)], 64)
    lathe("glass", [(U + 0.05, sill), (U + 0.05, head)], 64)
    lathe("panel", [(U - 0.2, head), (U + 0.5, head), (U + 1.0, u1), (U - 0.2, u1)], 64)
    for k in range(48):
        a = k * 2 * math.pi / 48
        bar("steel", radial(a, U + 0.3, sill), radial(a, U + 0.3, head), 0.5, 0.14, a)
    lathe("interior", [(5.0 * CS, u1 - 0.05), (U - 0.3, u1 - 0.05)], 64)
    for k in range(16):
        a = k * math.pi / 8
        block("dark", 1.2, 0.9, 1.2, at(facing(a), *radial(a, 11.4 * CS, u0 + 0.45)), True)


def crown_levels():
    s1 = FLOOR + SERVICE
    m0 = s1 + 0.8
    m1 = m0 + MAIN
    u0 = m1 + 1.0
    return s1, m0, m1, u0, u0 + UPPER


def build_reactor():
    """The Reactor Crown: a dark armoured containment crown about 1.25 times the observation
    deck's width over the control level. Steel-blue knee brackets and a dark underside carry it
    out from the control level; a thick graphite containment ring with crimson viewing slots in
    its face; inside, a recessed chamber about 27 m across: a wide glowing ring crossed by dark
    ribs between concentric containment rings, and in the middle the reactor sunk into a
    crater (glowing terraces stepping down to a molten pool). Eight massive bevelled graphite
    armour segments stand on the ring round it, rising to their inner edge, with crimson seams;
    glowing power conduits in every other gap between them;
    cool-grey only on the ring's top edge."""
    u0, u1 = crown_levels()[3:]
    U = UPPER_R * CS
    R, C = CROWN_OUT, CHAMBER
    lathe(  # underside, containment ring and deck, in one dark section (charcoal)
        "panel",
        [
            (U + 0.6, u1),
            (U + 1.2, u1),
            (R - 3.6, u1 + 3.6),
            (R - 1.0, u1 + 4.4),
            (R, u1 + 5.2),
            (R, u1 + 8.4),
            (R - 0.6, u1 + 9.4),
            (R - 2.8, u1 + 9.6),
            (R - 3.4, u1 + 9.0),
            (R - 3.4, u1 + 5.6),
            (C, u1 + 5.4),
            (C, u1 + 4.2),
            (C - 0.4, u1 + 4.2),
        ],
        96,
        smooth_angle=35,
    )
    ring("shell", R - 0.3, 0.12, u1 + 9.45, 96, 4)  # cool-grey highlight on the ring's top edge
    lathe(
        "mech",
        [(R - 2.2, u1 + 4.0), (R + 0.1, u1 + 4.9), (R + 0.1, u1 + 5.3), (R - 2.2, u1 + 4.4)],
        96,
    )
    for k in range(SEGMENTS):  # knee brackets under the segments, clear of the display
        a = SEG0 + k * 2 * math.pi / SEGMENTS
        if abs((a - ENTRANCE + math.pi) % (2 * math.pi) - math.pi) < 0.65:
            continue
        knee = [(U + 0.9, u0 + 0.4), (U + 2.4, u0 + 0.4), (R - 1.6, u1 + 4.3), (U + 0.9, u1 + 0.6)]
        arc("mech", knee, a - 0.04, a + 0.04, 1)
    for k in range(SEGMENTS):  # viewing slots between the segments: a crimson glow behind lips
        a = SEG0 + (k + 0.5) * 2 * math.pi / SEGMENTS
        slot = [
            (R - 0.3, u1 + 6.1),
            (R + 0.05, u1 + 6.1),
            (R + 0.05, u1 + 7.7),
            (R - 0.3, u1 + 7.7),
        ]
        arc("halo", slot, a - 0.12, a + 0.12, 4)
        for y in (u1 + 5.9, u1 + 7.9):
            lip = [(R - 0.1, y - 0.2), (R + 0.4, y - 0.2), (R + 0.4, y + 0.2), (R - 0.1, y + 0.2)]
            arc("mech", lip, a - 0.14, a + 0.14, 4)
    # The chamber: a halo wall, the luminous ring between containment rings, dark ribs over it.
    lathe("halo", [(C - 0.05, u1 + 5.35), (C - 0.05, u1 + 4.3)], 96)
    ring("mech", C - 0.8, 0.5, u1 + 4.9, 96, 6)
    lathe("corering", [(C - 1.2, u1 + 4.8), (C - 2.6, u1 + 4.45), (9.6, u1 + 4.8)], 96)
    ring("mech", 9.3, 0.45, u1 + 5.1, 96, 6)
    rib = [(C - 0.9, u1 + 4.7), (9.4, u1 + 4.7), (9.4, u1 + 5.2), (C - 0.9, u1 + 5.2)]
    for k in range(24):
        a = k * math.pi / 12
        arc("dark", rib, a - 0.018, a + 0.018, 1)
    # The reactor: a crater sunk into the crown, like looking down into a volcano. Concentric
    # terraces step down from the chamber ring, risers raked so they show, all in flowing lava
    # (the renderer's reactor shader, kind 3: crust and bright cracks running in to the vent,
    # hotter toward the centre), slate lips on each step, eight thin dark ribs across them; at
    # the bottom a molten pool with an orange-hot collar where the spire rises out of it.
    steps = [(9.6, 4.8), (7.9, 3.9), (6.2, 3.0), (4.5, 2.1)]
    for i, (r, y) in enumerate(steps):
        lathe("lava", [(r, u1 + y), (r - 0.5, u1 + y - 0.9)], 96)  # riser, raked so it shows
        nxt = steps[i + 1][0] if i + 1 < len(steps) else None
        if nxt:
            lathe("lava", [(r - 0.5, u1 + y - 0.9), (nxt, u1 + y - 0.9)], 96)
        ring("mech", r + 0.05, 0.14, u1 + y + 0.02, 96, 4)  # slate lip on each step
    lathe("lava", [(4.0, u1 + 1.2), (2.4, u1 + 1.0), (0, u1 + 0.9)], 48)  # the molten pool
    ring("rim", 2.3, 0.55, u1 + 1.3, 48, 8)
    for k in range(8):
        a = k * math.pi / 4 + math.pi / 8
        beam = [(9.6, u1 + 5.0), (4.4, u1 + 2.25), (4.4, u1 + 2.6), (9.6, u1 + 5.35)]
        arc("dark", beam, a - 0.012, a + 0.012, 1)

    # Power conduits in every other gap between the segments, on the deck from the ring to the
    # chamber's lip, between two slate rails; the renderer runs slow pulses along them inward.
    def deck(r, dy):
        return u1 + 5.4 + (r - C) / (R - 3.4 - C) * 0.2 + dy

    for k in range(0, SEGMENTS, 2):
        a = SEG0 + (k + 0.5) * 2 * math.pi / SEGMENTS
        lit = [
            (C + 0.1, deck(C, 0.05)),
            (R - 3.5, deck(R, 0.05)),
            (R - 3.5, deck(R, 0.15)),
            (C + 0.1, deck(C, 0.15)),
        ]
        arc("conduit", lit, a - 0.016, a + 0.016, 1)
        rail = [
            (C + 0.1, deck(C, 0)),
            (R - 3.5, deck(R, 0)),
            (R - 3.5, deck(R, 0.4)),
            (C + 0.1, deck(C, 0.4)),
        ]
        for side in (-1, 1):
            arc("mech", rail, a + side * 0.022, a + side * 0.034, 1)
    # Armour segments: bevelled, rising to the inner edge, a gunmetal plate stepped on the slope,
    # a steel-blue ridge, a crimson seam along the slope and one round the inner face.
    w = SEG_W
    body = [
        (C + 0.1, u1 + 5.2),
        (R - 1.4, u1 + 5.2),
        (R - 1.4, u1 + 9.8),
        (R - 3.1, u1 + 10.4),
        (C + 2.5, u1 + 11.6),
        (C + 0.9, u1 + 11.4),
        (C + 0.1, u1 + 10.2),
    ]
    plate = [
        (R - 3.3, u1 + 10.45),
        (C + 2.6, u1 + 11.62),
        (C + 2.6, u1 + 11.95),
        (R - 3.3, u1 + 10.75),
    ]
    ridge = [
        (C + 2.5, u1 + 11.6),
        (C + 2.5, u1 + 11.75),
        (C + 0.9, u1 + 11.55),
        (C + 0.9, u1 + 11.4),
    ]
    seam = [
        (R - 3.2, u1 + 10.8),
        (C + 2.7, u1 + 11.97),
        (C + 2.7, u1 + 12.05),
        (R - 3.2, u1 + 10.88),
    ]
    inner = [(C, u1 + 9.4), (C + 0.12, u1 + 9.4), (C + 0.12, u1 + 9.8), (C, u1 + 9.8)]
    for k in range(SEGMENTS):
        a = SEG0 + k * 2 * math.pi / SEGMENTS
        arc("graphite", body, a - w, a + w, 4)
        arc("steel", plate, a - w + 0.035, a + w - 0.035, 4)
        arc("mech", ridge, a - w, a + w, 4)
        arc("halo", seam, a - 0.006, a + 0.006, 1)
        arc("halo", inner, a - w + 0.02, a + w - 0.02, 4)
    for a in LEG_ANGLES:  # aviation lamps on the ring
        lamp(radial(a + math.pi / 3, R - 0.4, u1 + 9.75), 0.3)
    # Four horn fins: tall armour blades on alternate segments, leaning out past the ring, an
    # orange edge up their outer face and a red lamp at the tip.
    fin = [
        (R - 6.0, u1 + 10.2),
        (R - 1.4, u1 + 9.8),
        (R + 1.2, u1 + 18.0),
        (R + 0.4, u1 + 21.5),
        (R - 1.8, u1 + 20.6),
        (R - 5.0, u1 + 12.6),
    ]
    edge = [(R - 1.3, u1 + 10.0), (R + 1.3, u1 + 18.0), (R + 1.1, u1 + 18.2), (R - 1.5, u1 + 10.2)]
    for k in range(1, SEGMENTS, 2):
        a = SEG0 + k * 2 * math.pi / SEGMENTS
        arc("graphite", fin, a - 0.1, a + 0.1, 4, smooth_angle=20)
        arc("rim", edge, a - 0.012, a + 0.012, 1)
        lamp(radial(a, R + 0.4, u1 + 21.7), 0.3)
    # The halo: a thin orange ring floating clear of the crown's face, on slender radial arms.
    hr, hy = R + 3.2, u1 + 7.0
    ring("rim", hr, 0.2, hy, 128, 6)
    for k in range(SEGMENTS):
        a = SEG0 + k * 2 * math.pi / SEGMENTS
        bar("mech", radial(a, R - 0.2, hy), radial(a, hr - 0.15, hy), 0.18, 0.18, a)


def build_bands():
    """Light on the shaft: thin orange bands round the core every two panel lifts, clear of the
    plant nodes, and narrow white light slits up the core either side of each lift and conduit."""
    for y in range(int(WEB[2]) + 10, int(RING[0]) - 4, int(2 * JOINT)):
        if all(abs(y - n) > 8 for n in NODES):
            ring("rim", core_r(y) + 0.08, 0.1, y, 48, 4)
    spans = [(WEB[2] + 6, NODES[1] - 8), (NODES[1] + 10, NODES[2] - 6)]
    for g in gaps():
        for side in (-0.42, 0.42):
            a = g + side
            for y0, y1 in spans:
                foot, head = radial(a, core_r(y0) + 0.04, y0), radial(a, core_r(y1) + 0.04, y1)
                bar("white", foot, head, 0.3, 0.08, a)


def build_command():
    """The crown as a command complex: angular armour over each leg on the observation level,
    the operator's mark on one, one curved display on the control level over the entrance,
    walkways round two stretches of the glass."""
    s1, m0, m1, u0, u1 = crown_levels()
    g0, g1 = CROWN_R[0] * CS, CROWN_R[1] * CS
    for k, a in enumerate(LEG_ANGLES):  # faceted armour, wide at the waist, steel capped
        prof = [
            (g0 - 0.2, m0 - 1.0),
            (g0 + 1.9, m0 + 0.6),
            (g1 + 1.9, m0 + MAIN * 0.55),
            (g1 + 1.4, m1 + 0.4),
            (g1 - 0.2, m1 + 0.4),
        ]
        arc("deck", prof, a - 0.28, a + 0.28, 4)
        seam = [(r + 0.08, y) for r, y in prof[1:4]] + [(r + 0.02, y) for r, y in prof[3:0:-1]]
        arc("halo", seam, a - 0.012, a + 0.012, 1)  # a crimson seam down the middle of each
        U = UPPER_R * CS  # the fin carries on up the control level, raked back at the top
        arc(
            "steel",
            [(U + 0.4, u0 - 0.1), (g1 + 0.9, u0 - 0.1), (U + 2.2, u1 + 0.5), (U + 0.4, u1 + 0.5)],
            a - 0.12,
            a + 0.12,
            2,
        )
        if k == 2:
            y = m0 + MAIN * 0.55
            text("white", SIGN, 1.5, at(facing(a), *radial(a, g1 + 2.0, y)))
    U = UPPER_R * CS
    a0, a1 = ENTRANCE - 0.6, ENTRANCE + 0.6  # the display, framed in steel
    arc(
        "ad",
        [(U + 1.05, u0 + 0.4), (U + 1.3, u0 + 0.4), (U + 1.3, u1 - 0.4), (U + 1.05, u1 - 0.4)],
        a0,
        a1,
        16,
        uv01=True,
    )
    for y in (u0 + 0.25, u1 - 0.25):
        arc(
            "steel",
            [(U + 0.9, y - 0.15), (U + 1.45, y - 0.15), (U + 1.45, y + 0.15), (U + 0.9, y + 0.15)],
            a0 - 0.02,
            a1 + 0.02,
            16,
        )
    for a in (a0 - 0.02, a1 + 0.02):
        block("steel", 0.6, UPPER, 0.3, at(facing(a), *radial(a, U + 1.15, (u0 + u1) / 2)))
    slab = 16.3 * CS
    for c in (gaps()[0], gaps()[1]):  # walkways off the slab edge, orange rails
        arc(
            "steel",
            [
                (slab - 0.1, m0 - 0.35),
                (slab + 1.6, m0 - 0.35),
                (slab + 1.6, m0 - 0.15),
                (slab - 0.1, m0 - 0.15),
            ],
            c - 0.55,
            c + 0.55,
            12,
        )
        pts = [radial(c - 0.55 + 1.1 * i / 10, slab + 1.5, m0 - 0.15) for i in range(11)]
        rail("orange", pts)


def build_mast():
    """An antenna cluster rising out of the reactor crater's molten pool: a tall tapered graphite
    spire with a sensor housing, ringed by six thinner upright masts of differing heights tied to
    it by two collars, red lamps on every tip."""
    u1 = crown_levels()[4]
    y0 = u1 + 0.9
    pole = [(1.3, y0), (1.3, y0 + 1.8), (0.8, y0 + 2.6), (0.22, H - 1.0), (0, H - 1.0)]
    lathe("graphite", pole, 16)
    lathe("steel", [(0.1, H - 1.0), (0.1, H), (0, H)], 8)
    sensor = [(0.9, H - 14.0), (1.2, H - 13.6), (1.2, H - 12.2), (0.8, H - 11.8), (0, H - 11.8)]
    lathe("mech", sensor, 16)
    lamp((0, H + 0.15, 0), 0.28)
    lamp((0, H - 11.6, 0), 0.22)
    tops = (H - 9.0, H - 17.0, H - 12.0, H - 20.0, H - 14.0, H - 18.0)
    for k, top in enumerate(tops):
        a = k * math.pi / 3 + 0.3
        foot, head = radial(a, 2.2, y0), radial(a, 2.2, top)
        tube("graphite", foot, head, 0.22, seg=8)
        lamp((head[0], top + 0.15, head[2]), 0.2)
    for y in (y0 + 18.0, y0 + 26.0):  # collars tying the masts to the spire, above the armour
        ring("mech", 2.2, 0.12, y, 32, 4)


def build_base():
    """Industrial-civic hub at the foot, inside the legs' reach: pile caps with steel shoes and
    gussets under the legs; the glazed lobby ring and its upper drum; a monumental portal at the
    entrance with the operator's name and info panels; maintenance garages with an apron; a power
    yard (transformers with radiators, a switchgear house) linked to the drum by an enclosed
    cable bridge; two ventilation towers."""
    for a in LEG_ANGLES:
        d, w = leg_dw(FOOT)
        c = radial(a, leg_r(FOOT), 0)
        block("concrete", d + 4.0, 1.2, w + 4.0, at(facing(a), c[0], 0.6, c[2]), bevel=0.2)
        block(
            "concrete",
            d + 3.0,
            FOOT - 1.2,
            w + 3.0,
            at(facing(a), c[0], 1.2 + (FOOT - 1.2) / 2, c[2]),
            bevel=0.2,
        )
        block("steel", d + 0.6, 0.5, w + 0.6, at(facing(a), c[0], FOOT + 0.05, c[2]))
        for side in (-1, 1):  # gusset plates either side of the foot
            p = offset((c[0], FOOT + 1.2, c[2]), a, side * (w / 2 + 0.15))
            block("steel", d + 0.4, 2.0, 0.25, at(facing(a), *p))
    g0, g1 = 0.8, 8.8
    lathe("concrete", [(0, 0), (12.6, 0), (12.6, g0), (0, g0)], 64)  # plinth
    lathe("glass", [(11.6, g0), (11.6, g1)], 64)
    for k in range(40):
        a = k * 2 * math.pi / 40
        bar("steel", radial(a, 11.65, g0), radial(a, 11.65, g1), 0.3, 0.16, a)
    lathe("interior", [(7.2, g1 - 0.05), (11.5, g1 - 0.05)], 64)
    lathe(
        "concrete",
        [
            (core_r(g1), g1),
            (12.8, g1),
            (13.0, g1 + 0.3),
            (13.0, g1 + 0.9),
            (12.4, g1 + 0.9),
            (12.6, g1 + 1.2),
            (12.6, 22.0),
            (13.2, 22.2),
            (13.2, 23.0),
            (core_r(23.0), 23.0),
        ],
        64,
    )
    # The podium's upper plant level: a louvred band with fins round the drum.
    lathe("dark", [(12.63, 14.0), (12.63, 19.0)], 64)
    for k in range(48):
        b = k * 2 * math.pi / 48
        fin = at(facing(b) @ Matrix.Rotation(0.45, 4, "Y"), *radial(b, 12.85, 16.5))
        block("steel", 0.5, 4.6, 0.08, fin)
    for k in range(4):  # lobby silhouettes
        a = ENTRANCE + math.pi + (k - 1.5) * 0.5
        block("dark", 2.8, 1.1, 0.9, at(facing(a + math.pi / 2), *radial(a, 9.0, g0 + 0.55)), True)
    # Portal: two concrete pylons and a lintel carrying the name, over the doors and canopy.
    a = ENTRANCE
    block("dark", 0.4, 4.4, 6.0, at(facing(a), *radial(a, 11.7, g0 + 2.2)))
    block("steel", 9.0, 0.45, 10.0, at(facing(a), *radial(a, 16.2, 6.0)), bevel=0.1)
    block("glass", 8.6, 0.1, 9.6, at(facing(a), *radial(a, 16.2, 6.28)))
    for side in (-6.4, 6.4):
        p = offset(radial(a, 19.6, 6.8), a, side)
        block("concrete", 3.0, 13.6, 2.6, at(facing(a), *p), bevel=0.15)
        block("cyan", 0.12, 2.2, 1.3, at(facing(a), *offset(radial(a, 21.15, 3.2), a, side)))
    block("concrete", 3.2, 2.8, 15.4, at(facing(a), *radial(a, 19.6, 15.0)), bevel=0.15)
    text("white", "RELAY TOWER", 1.3, at(facing(a), *radial(a, 21.25, 15.0)))
    # Garages: three bays, steel headers, an apron, roof vents.
    a = SERVICE_SIDE
    block("concrete", 8.0, 6.5, 16.0, at(facing(a), *radial(a, 17.5, 3.25)), bevel=0.15)
    for side in (-5.0, 0.0, 5.0):
        block("dark", 0.2, 4.6, 4.0, at(facing(a), *offset(radial(a, 21.55, 2.3), a, side)))
        block("orange", 0.25, 0.3, 4.3, at(facing(a), *offset(radial(a, 21.6, 4.75), a, side)))
        if side:
            fan(offset(radial(a, 17.5, 0), a, side), 6.5, 1.1)
    block("concrete", 4.0, 0.2, 17.0, at(facing(a), *radial(a, 23.5, 0.1)))
    # Power yard: a pad, three transformers with radiator banks, a switchgear house, and the
    # enclosed cable bridge up to the drum.
    a = VENT_SIDE
    block("concrete", 7.0, 0.4, 15.0, at(facing(a), *radial(a, 20.0, 0.2)))
    for side in (-4.8, 0.0, 4.8):
        c = offset(radial(a, 20.0, 0), a, side)
        block("mech", 2.4, 3.0, 3.2, at(facing(a), c[0], 1.9, c[2]), bevel=0.08)
        radiator(offset(radial(a, 21.2, 0), a, side), a, 1.9, 6, 2.4, 2.4, 0.6)
        for b in (-0.8, 0.0, 0.8):
            bush = offset((c[0], 3.4, c[2]), a, b)
            tube("dark", bush, (bush[0], 4.4, bush[2]), 0.12, True, 6)
    house = radial(a, 14.6, 0)
    block("mech", 4.0, 5.0, 7.0, at(facing(a), house[0], 2.5, house[2]), bevel=0.1)
    bar("mech", radial(a, 14.6, 5.0), radial(a, 12.9, 11.0), 2.2, 2.4, a)
    # Ventilation towers either side of the power yard, louvred, fans on top.
    for b in (a - 0.42, a + 0.42):
        c = radial(b, 14.2, 0)
        block("concrete", 4.2, 18.0, 4.2, at(facing(b), c[0], 9.0, c[2]), bevel=0.12)
        grille(radial(b, 16.35, 0), b, 13.0, 3.0, 5.0)
        fan(c, 18.0, 1.6)
    for a in LEG_ANGLES:  # downpipes on the upper drum
        tube("steel", radial(a + 1.0, 12.75, g1 + 1.4), radial(a + 1.0, 12.75, 22.0), 0.15, seg=6)


def build(lod=0):
    """Build the tower (lod 0, scene "telecom_tower", with the studio) or its light variant
    (lod 1, scene "telecom_tower_lod1", objects prefixed "lod1_")."""
    kit.LOD = lod
    name = "telecom_tower_lod1" if lod else "telecom_tower"
    scene = bpy.data.scenes.get(name) or bpy.data.scenes.new(name)
    bpy.context.window.scene = scene
    clear(scene)
    parts.clear()
    for step in (
        build_core,
        build_legs,
        build_webs,
        build_ties,
        build_lifts,
        build_nodes,
        build_transfer,
        build_bands,
        build_crown,
        build_command,
        build_reactor,
        build_mast,
        build_base,
    ):
        step()
    join(scene, name, "lod1_" if lod else "")
    if not lod:
        studio(scene)
    kit.LOD = 0
    return scene


def night_review(seed=9):
    """Review scene "tower_night": the tower's objects linked in, a field of lit skyscraper
    proxies round it (no tower-sized neighbours), a night sky. Not part of the export."""
    import random

    rnd = random.Random(seed)
    scene = bpy.data.scenes.get("tower_night") or bpy.data.scenes.new("tower_night")
    for o in list(scene.objects):
        if o.name.startswith("proxy") or o.name.startswith("night_"):
            bpy.data.objects.remove(o)
        else:
            scene.collection.objects.unlink(o)
    root = bpy.data.objects["telecom_tower"]
    for o in [root, *root.children_recursive]:
        scene.collection.objects.link(o)
    mat = proxy_material()
    placed = []
    while len(placed) < 110:
        r, t = 120 + rnd.random() ** 0.7 * 700, rnd.random() * 2 * math.pi
        x, y = r * math.cos(t), r * math.sin(t)
        w, d = rnd.uniform(18, 34), rnd.uniform(18, 34)
        if any(
            abs(x - px) < (w + pw) / 2 + 8 and abs(y - py) < (d + pd) / 2 + 8
            for px, py, pw, pd in placed
        ):
            continue
        placed.append((x, y, w, d))
        h = rnd.uniform(25, 75) + (rnd.random() < 0.3) * rnd.uniform(20, 70) * (r < 300)
        for k, (hh, ww, dd) in enumerate(((h, w, d), (h * 0.25, w * 0.7, d * 0.7))):
            if k and rnd.random() < 0.6:
                continue
            bm = bmesh.new()
            bmesh.ops.create_cube(bm, size=1)
            bmesh.ops.scale(bm, vec=(ww, dd, hh), verts=bm.verts)
            z0 = 0 if not k else h
            bmesh.ops.translate(bm, vec=(x, y, z0 + hh / 2), verts=bm.verts)
            me = bpy.data.meshes.new("proxy")
            bm.to_mesh(me)
            bm.free()
            me.materials.append(mat)
            scene.collection.objects.link(bpy.data.objects.new("proxy", me))
    gm = bpy.data.materials.get("night_ground") or bpy.data.materials.new("night_ground")
    gm.use_nodes = True
    gb = next(n for n in gm.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    gb.inputs["Base Color"].default_value = (0.02, 0.022, 0.026, 1)
    gb.inputs["Roughness"].default_value = 0.5
    ground = bpy.data.meshes.new("night_ground")
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=2000)
    bm.to_mesh(ground)
    bm.free()
    ground.materials.append(gm)
    scene.collection.objects.link(bpy.data.objects.new("night_ground", ground))
    world = bpy.data.worlds.get("tower_night") or bpy.data.worlds.new("tower_night")
    world.use_nodes = True
    bg = next(n for n in world.node_tree.nodes if n.type == "BACKGROUND")
    bg.inputs[0].default_value = (0.02, 0.03, 0.07, 1)
    bg.inputs[1].default_value = 1.0
    scene.world = world
    moon = bpy.data.objects.new("night_moon", bpy.data.lights.new("night_moon", "SUN"))
    moon.data.energy, moon.data.color = 0.25, (0.65, 0.72, 1.0)
    moon.rotation_euler = (math.radians(55), 0, math.radians(-40))
    cam = bpy.data.objects.new("night_cam", bpy.data.cameras.new("night_cam"))
    for o in (moon, cam):
        scene.collection.objects.link(o)
    scene.camera = cam
    try:
        scene.eevee.use_raytracing = True
    except AttributeError:
        pass
    return scene


def export(folder, lod=0, fmt="GLB"):
    """telecom_tower.glb (or _lod1). fmt "GLTF_SEPARATE" writes .gltf + .bin, the form
    web/src/materials.js loads (web/assets/models/telecom_tower)."""
    return kit.export("telecom_tower_lod1" if lod else "telecom_tower", folder, fmt)


# exec() from Blender has no __file__, so set REPO (repo root) first. CITY = True writes the
# city's copy (web/assets/models/telecom_tower); EXPORT = r"<folder>" writes GLBs there.
build()
if globals().get("CITY"):
    city = os.path.join(REPO, "web", "assets", "models", "telecom_tower")  # noqa: F821
    print(export(city, 0, "GLTF_SEPARATE"))
if globals().get("WITH_LOD"):
    build(1)
    bpy.context.window.scene = bpy.data.scenes["telecom_tower"]
if globals().get("EXPORT"):
    print(export(EXPORT))  # noqa: F821
    if globals().get("WITH_LOD"):
        print(export(EXPORT, 1))  # noqa: F821
