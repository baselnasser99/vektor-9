"""Build the city's fusion plant, SECTOR 07, in Blender (an original design), for a 14 m tile.

In Blender: REPO = r"<repo root>"; exec(open(REPO + "/tools/blender/power_plant.py").read())
Builds into its own scene "power_plant" (with a studio for review renders); night_review() adds
a "plant_night" scene: wet street, haze, steam, stand-in towers round it. CITY = True before
exec writes the city's copy (web/assets/models/power_plant); EXPORT = r"<folder>" a .glb there.

A compact, aging power-generation block in a dense district, read as machinery, not neon. The
reactor is the focal point: a blackened concrete drum with buttresses and support frames, an
armoured band with inspection slots behind grilles, a tall segmented gunmetal shell with bands
of coil blocks and bolted armour, exposed coolant pipes, hatches, gauges and radiation warnings.
The two discharge towers come second: welded collars, a painted hazard band, vents, sooted
heads, struts, maintenance platforms, steady red aviation lamps. Round them: heavy headers and a
pipe bridge, a windowless two-storey control block (roll shutter, restricted access door,
control panel, conduits, junction boxes, a meter, a duct, camera, roof fans, a small worn
"SECTOR 07" plate), transformers with high-voltage plates and armoured ducts. Light is only
small dim amber lamps, cold-white indicators and red. Signage is invented text.

The lot is fixed by the city (12 m, about a metre to the neighbours), so size comes from height:
the big masses are set by the heights below, while doors, rails and fittings keep human scale.
Same conventions as the tower (tools/blender/kit.py): three.js coordinates, parts joined per
material role, small parts under "detail". +z is the plant's street front.
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
from kit import (  # noqa: E402
    around,
    at,
    bar,
    block,
    clear,
    facing,
    fan,
    grille,
    join,
    lamp,
    lathe,
    offset,
    parts,
    radiator,
    radius_at,
    rail,
    ring,
    studio,
    text,
    tube,
)

NAME = "power_plant"
SIGN = "SECTOR 07"  # facility mark (invented)
LOT = 12.0  # plinth width; the city leaves about a metre to the neighbours
EDGE = LOT / 2 - 0.3  # nothing reaches past this from the lot centre
PLINTH = 1.0  # plinth top
# Reactor: axis, drum and armoured band heights, shell height above them, base radius.
REACTOR = (-2.3, -0.4)
DRUM_H, BAND_H, SHELL_H = 3.6, 4.0, 12.0
DRUM_R = 3.6
# Discharge towers: foot (x, z), height; radius at the foot and the head.
STACKS = ((4.55, -4.55, 34.0), (1.75, -4.6, 28.0))
STACK_R = (1.25, 0.9)
HALL = (3.4, 0.4, 4.6, 7.0, 5.6)  # control block: centre x, z; width (x), height, depth (z)
SEG = 32  # segments round the big turned shapes
STACK_SEG = 16  # and round the towers' slimmer ones
ID = Matrix()


def on_lot(v):
    return min(EDGE, max(-EDGE, v))


def stripes(n, size, m, vertical=False):
    """A painted hazard band of n alternating stripes, each size long, centred on m: along local
    x (flat on a face looking +z), or up local y."""
    for k in range(n):
        u = (k - (n - 1) / 2) * size
        role = "hazard" if k % 2 else "dark"
        if vertical:
            block(role, 0.15, size, 0.05, m @ Matrix.Translation((0, u, 0)))
        else:
            block(role, size, 0.25, 0.05, m @ Matrix.Translation((u, 0, 0)))


def gauge(m):
    """Pressure gauge facing local +x: a steel bezel, a pale face, a needle. Detail only."""
    block("titanium", 0.06, 0.26, 0.26, m, True)
    block("stencil", 0.02, 0.2, 0.2, m @ Matrix.Translation((0.04, 0, 0)), True)
    needle = m @ Matrix.Translation((0.05, 0.03, 0.02)) @ Matrix.Rotation(0.7, 4, "X")
    block("dark", 0.02, 0.1, 0.02, needle, True)


def trefoil(m, size=0.5):
    """Radiation warning facing local +x: a yellow plate, three dark blades round a dot."""
    k = size / 0.5
    block("yellow", 0.03, size, size, m)
    block("dark", 0.02, 0.07 * k, 0.07 * k, m @ Matrix.Translation((0.02, 0, 0)))
    for i in range(3):
        t = Matrix.Rotation(i * 2 * math.pi / 3, 4, "X")
        block("dark", 0.02, 0.13 * k, 0.12 * k, m @ t @ Matrix.Translation((0.02, 0.12 * k, 0)))


def build_plinth():
    """Blackened concrete plinth on the whole lot, a dark recessed base course, hazard stripes
    painted on the apron in front of the access door."""
    block("soot", LOT, PLINTH - 0.25, LOT, at(ID, 0, (PLINTH + 0.25) / 2, 0), bevel=0.05)
    block("dark", LOT - 0.2, 0.25, LOT - 0.2, at(ID, 0, 0.125, 0))
    hx, hz, _, _, d = HALL
    for k in range(9):
        x = hx - 2.4 + k * 0.3
        block(
            "hazard" if k % 2 else "dark",
            0.3,
            0.02,
            0.6,
            at(ID, x, PLINTH + 0.01, hz + d / 2 + 0.6),
        )


def build_reactor():
    """The focal point. Blackened concrete drum with buttresses, hatches, gauges, warnings; an
    armoured band with inspection slots behind grilles (a few dim indicators); a tall gunmetal
    shell with coil-block bands, bolted armour bands, plate seams and ribs; coolant pipes down
    to the plinth; support frames; a sooted vent cap and a red lamp."""
    c, y0 = REACTOR, PLINTH
    b0 = y0 + DRUM_H
    b1 = b0 + BAND_H
    top = b1 + SHELL_H
    drum = [(DRUM_R, y0), (DRUM_R, y0 + 0.8), (3.25, y0 + 1.4), (3.2, b0)]
    lathe("soot", [(0, y0), *drum, (0, b0)], SEG, center=c)
    lathe("steel", [(0, b0), (3.15, b0), (3.15, b1), (0, b1)], SEG, center=c)
    slot = BAND_H - 0.8
    for k in range(12):  # inspection slots behind grilles; every third shows a dim indicator
        a = k * math.pi / 6
        m = at(facing(a), *around(c, a, 3.16, (b0 + b1) / 2))
        block("dark", 0.12, slot, 0.42, m)
        if k % 3 == 0:
            block("ice", 0.1, 0.6, 0.14, m @ Matrix.Translation((0, slot * 0.2, 0)))
        n = int(slot / 0.36)
        for j in range(n):
            y = (j - (n - 1) / 2) * 0.36
            block("steel", 0.06, 0.07, 0.44, m @ Matrix.Translation((0.06, y, 0)), True)
        plate = at(facing(a + math.pi / 12), *around(c, a + math.pi / 12, 3.2, (b0 + b1) / 2))
        block("titanium", 0.12, slot + 0.2, 1.05, plate)
    for y in (b0 + 0.05, b1 - 0.05):
        ring("dark", 3.2, 0.09, y, SEG, 4, center=c)

    shell = [(3.25, b1), (3.15, b1 + 0.32 * SHELL_H), (2.85, b1 + 0.62 * SHELL_H)]
    shell += [(2.25, b1 + 0.84 * SHELL_H), (1.45, b1 + 0.97 * SHELL_H), (0, top)]
    lathe("steel", [(0, b1), *shell], SEG, center=c)

    def level(f):  # height a fraction f up the shell, and the shell radius there
        y = b1 + f * SHELL_H
        return y, radius_at(shell, y)

    for f in (0.06, 0.78, 0.88):  # plate seams
        y, r = level(f)
        ring("dark", r + 0.01, 0.04, y, SEG, 3, center=c)
    for f in (0.12, 0.33, 0.54):  # coil-block bands
        y, r = level(f)
        ring("dark", r + 0.05, 0.16, y, SEG, 4, center=c)
        for k in range(16):
            a = k * math.pi / 8
            block("mech", 0.5, 0.75, 0.7, at(facing(a), *around(c, a, r + 0.25, y)))
    for f in (0.22, 0.43, 0.66):  # bolted armour bands between them
        y, r = level(f)
        ring("steel", r + 0.08, 0.16, y, SEG, 4, center=c)
        for k in range(24):
            a = k * math.pi / 12
            block("titanium", 0.08, 0.12, 0.12, at(facing(a), *around(c, a, r + 0.24, y)), True)
    yc, rc = level(0.12)
    for a in (math.pi / 2 + 0.95, 3 * math.pi / 2):  # support frames (no room on the -x side)
        lo, hi = around(c, a, DRUM_R + 0.35, y0), around(c, a, rc + 0.5, yc)
        for s in (-0.5, 0.5):
            bar("steel", offset(lo, a, s), offset(hi, a, s * 0.6), 0.3, 0.25, a)
        block("titanium", 0.7, 0.25, 1.4, at(facing(a), lo[0], y0 + 0.12, lo[2]))
    yr, rr = level(0.8)
    for k in range(8):  # vertical ribs
        a = k * math.pi / 4 + math.pi / 8
        bar("steel", around(c, a, 3.3, b1), around(c, a, rr + 0.1, yr), 0.25, 0.3, a)
    yp, rp = level(0.6)
    for k in range(6):  # coolant pipes, clamped, down the side to the plinth
        a = k * math.pi / 3 + math.pi / 6
        pts = [
            around(c, a, rp + 0.3, yp),
            around(c, a, 3.85, b1 - 0.4),
            around(c, a, 3.85, y0 + 0.2),
        ]
        for p, q in zip(pts, pts[1:], strict=False):
            tube("titanium", p, q, 0.2, seg=10)
        for y in (y0 + 1.4, b0 + 1.4, b1 - 1.0):
            x, _, z = around(c, a, 3.85, y)
            tube("dark", (x, y - 0.12, z), (x, y + 0.12, z), 0.27, seg=10)
    lathe(
        "steel",
        [(0, top - 0.2), (0.95, top - 0.2), (0.95, top + 1.1), (0, top + 1.1)],
        16,
        center=c,
    )
    for k in range(8):  # vent slots round the cap
        a = k * math.pi / 4
        block("dark", 0.06, 0.6, 0.25, at(facing(a), *around(c, a, 0.96, top + 0.5)))
    lathe(
        "scorch",
        [(0, top + 1.1), (0.97, top + 1.1), (0.97, top + 1.15), (0, top + 1.15)],
        16,
        center=c,
    )
    lamp((c[0], top + 1.4, c[1]), 0.25)
    for k in range(4):  # buttresses up onto the drum
        a = k * math.pi / 2 + math.pi / 4
        bar("soot", around(c, a, 4.3, y0), around(c, a, 3.35, b0 - 0.2), 0.8, 0.7, a)
    for i, a in enumerate((math.pi / 2 - 0.45, math.pi / 2 + 0.45, -0.6)):  # maintenance hatches
        m = at(facing(a), *around(c, a, 3.25, y0 + 1.5))
        block("titanium", 0.12, 1.0, 0.8, m, bevel=0.03)
        if i == 0:
            block("lamp", 0.14, 0.06, 0.2, m @ Matrix.Translation((0, 0.62, 0)), True)
        gauge(m @ Matrix.Translation((0.06, 0.05, 0.62)))
    front = math.pi / 2
    mark = front + 0.5  # between the coolant pipes
    text("stencil", "09", 0.9, at(facing(mark), *around(c, mark, 3.26, y0 + 2.8)), 0, 3)
    for a in (front - 1.0, front + 1.0):  # radiation warnings
        trefoil(at(facing(a), *around(c, a, 3.25, y0 + 2.6)), 0.6)


def build_stacks():
    """Secondary focal point: two discharge towers with welded collars, a painted hazard band,
    vents and a sooted head, a dark cable conduit, struts, a maintenance platform each, a ladder,
    steady red lamps; braced to each other."""
    r_foot, r_head = STACK_R
    for i, (x, z, h) in enumerate(STACKS):
        c = (x, z)
        profile = [(r_foot, PLINTH), (r_head, h)]
        lathe("steel", [(0, PLINTH), *profile, (0, h)], STACK_SEG, center=c)

        def r_at(y, profile=profile):
            return radius_at(profile, y)

        y = PLINTH + 2.0
        while y < h - 4.0:  # heavy welded collars, a bead each side
            r = r_at(y)
            collar = [(r, y), (r + 0.16, y), (r + 0.18, y + 0.05), (r + 0.18, y + 0.4)]
            collar += [(r + 0.16, y + 0.45), (r, y + 0.45)]
            lathe("steel", collar, STACK_SEG, center=c)
            y += 3.4
        hb = h - 3.0  # painted hazard band
        rb = r_at(hb) + 0.04
        for k in range(16):
            a = k * math.pi / 8
            w = 2 * math.pi * rb / 16 + 0.02
            block("hazard" if k % 2 else "dark", 0.06, 0.9, w, at(facing(a), *around(c, a, rb, hb)))
        for k in range(6):  # vents
            a = k * math.pi / 3
            block(
                "dark", 0.08, 0.8, 0.4, at(facing(a), *around(c, a, r_at(h - 1.4) + 0.02, h - 1.4))
            )
        lathe(
            "scorch",
            [(r_at(h - 2.2) + 0.015, h - 2.2), (r_head + 0.015, h - 0.1)],
            STACK_SEG,
            center=c,
        )
        lip = [(r_head - 0.3, h - 0.1), (r_head + 0.14, h - 0.1), (r_head + 0.14, h + 0.6)]
        lathe("dark", [*lip, (r_head - 0.3, h + 0.6)], STACK_SEG, center=c)
        lathe("scorch", [(0, h + 0.25), (r_head - 0.3, h + 0.25)], 16, center=c)  # sooted throat
        lamp((x, h + 0.85, z), 0.22)
        ca = math.pi / 2 - 0.7  # cable conduit, beside the ladder
        lo, hi = PLINTH + 1.5, hb - 0.7
        bar(
            "dark",
            around(c, ca, r_at(lo) + 0.05, lo),
            around(c, ca, r_at(hi) + 0.05, hi),
            0.1,
            0.14,
            ca,
        )
        for k in range(3):  # struts, feet kept on the lot
            a = k * 2 * math.pi / 3 + (0.3 if i else 1.2)
            fx, _, fz = around(c, a, 2.1, PLINTH)
            fx, fz = on_lot(fx), on_lot(fz)
            ys = PLINTH + 6.5
            bar("steel", (fx, PLINTH, fz), around(c, a, r_at(ys) + 0.05, ys), 0.24, 0.24, a)
            block("titanium", 0.55, 0.2, 0.55, at(ID, fx, PLINTH + 0.1, fz))
        for s in (-0.22, 0.22):  # ladder up the street side
            lo, hi = (
                (x + s, PLINTH + 0.5, z + r_foot + 0.05),
                (x + s, hb - 0.6, z + r_at(hb) + 0.05),
            )
            tube("steel", lo, hi, 0.03, True, 4)
        py = h * (0.78 if i == 0 else 0.66)  # maintenance platform
        pr = min(r_at(py) + 0.75, EDGE - x, z + EDGE)
        lathe(
            "dark",
            [(r_at(py), py), (pr, py), (pr, py + 0.15), (r_at(py), py + 0.15)],
            STACK_SEG,
            center=c,
        )
        for k in range(4):  # brackets under the grating
            a = k * math.pi / 2 + 0.4
            bar(
                "steel",
                around(c, a, r_at(py - 1.0) + 0.05, py - 1.0),
                around(c, a, pr - 0.1, py),
                0.1,
                0.1,
                a,
            )
        angles = [k * math.pi / 6 for k in range(13)]
        rail("hazard", [around(c, t, pr - 0.05, py + 0.15) for t in angles])
        block("lamp", 0.15, 0.1, 0.15, at(ID, x, py + 1.2, z + r_at(py + 1.2) + 0.08), True)
    (ax, az, _), (bx, bz, _) = STACKS
    for y in (PLINTH + 9.0, PLINTH + 15.0):  # braces between the towers
        tube("steel", (ax, y, az), (bx, y, bz), 0.13, seg=8)
    tube("steel", (ax, PLINTH + 9.0, az), (bx, PLINTH + 15.0, bz), 0.1, seg=6)


def build_hall():
    """Two-storey control block, no glass: ribbed gunmetal walls with a louvre band upstairs, an
    armoured roll shutter, a restricted access door in a hazard frame, a control panel, a small
    worn sign, conduits into junction boxes, a meter, a duct up the back, a louvred side with
    air-con units, a camera, roof fans and a heat exchanger."""
    hx, hz, w, h, d = HALL
    y0 = PLINTH
    front, side, back = hz + d / 2, hx + w / 2, hz - d / 2
    block("steel", w, h, d, at(ID, hx, y0 + h / 2, hz), bevel=0.06)
    block("dark", w + 0.3, 0.35, d + 0.3, at(ID, hx, y0 + h + 0.17, hz))  # roof edge
    block("dark", w + 0.1, 0.2, d + 0.1, at(ID, hx, y0 + 4.0, hz))  # floor line
    for k in range(7):  # vertical ribs on the front and the street side
        x = hx - w / 2 + 0.3 + k * (w - 0.6) / 6
        block("titanium", 0.1, h - 0.4, 0.08, at(ID, x, y0 + h / 2, front + 0.04))
        zz = back + 0.3 + k * (d - 0.6) / 6
        block("titanium", 0.08, h - 0.4, 0.1, at(ID, side + 0.04, y0 + h / 2, zz))
    grille((hx, 0, front + 0.06), math.pi / 2, y0 + 5.4, w - 0.8, 1.2)  # upstairs louvre band
    sx = hx + 1.0  # armoured roll shutter in a dark frame, under its roller box
    block("dark", 2.0, 2.8, 0.14, at(ID, sx, y0 + 1.4, front + 0.09))
    for k in range(12):  # shutter slats: near the camera only
        block("titanium", 1.8, 0.16, 0.06, at(ID, sx, y0 + 0.15 + k * 0.22, front + 0.17), True)
    block("steel", 2.2, 0.4, 0.3, at(ID, sx, y0 + 2.95, front + 0.2))
    dx = hx - 1.2  # restricted access door in a hazard frame
    block("dark", 1.5, 2.5, 0.16, at(ID, dx, y0 + 1.25, front + 0.1))
    block("titanium", 1.2, 2.25, 0.08, at(ID, dx, y0 + 1.13, front + 0.2), bevel=0.02)
    for fx in (dx - 0.68, dx + 0.68):
        stripes(8, 0.3, at(ID, fx, y0 + 1.2, front + 0.2), vertical=True)
    block("lamp", 0.2, 0.1, 0.1, at(ID, dx, y0 + 2.65, front + 0.24))  # warning lamp
    block("yellow", 0.5, 0.3, 0.02, at(ID, dx, y0 + 1.7, front + 0.25))  # restricted-entry plate
    text("dark", "NO ENTRY", 0.09, at(facing(math.pi / 2), dx, y0 + 1.7, front + 0.27), 0, 2, True)
    block("dark", 0.45, 0.6, 0.12, at(ID, dx - 1.15, y0 + 1.4, front + 0.12))  # control panel
    block("ice", 0.32, 0.22, 0.03, at(ID, dx - 1.15, y0 + 1.52, front + 0.19))
    block("lamp", 0.05, 0.05, 0.03, at(ID, dx - 1.27, y0 + 1.27, front + 0.19), True)
    block("red", 0.05, 0.05, 0.03, at(ID, dx - 1.15, y0 + 1.27, front + 0.19), True)
    # The sign: small, worn painted letters on a steel plate, one lamp over it.
    block("dark", 2.0, 0.42, 0.06, at(ID, hx - 1.0, y0 + 3.6, front + 0.11))
    text("stencil", SIGN, 0.26, at(facing(math.pi / 2), hx - 1.0, y0 + 3.6, front + 0.15), 0, 3)
    block("steel", 0.06, 0.06, 0.4, at(ID, hx - 1.0, y0 + 4.0, front + 0.3), True)
    block("lamp", 0.25, 0.06, 0.12, at(ID, hx - 1.0, y0 + 3.97, front + 0.5))
    # Conduits along the front into junction boxes, and a meter by the shutter.
    for y in (y0 + 3.3, y0 + 3.42):
        tube(
            "dark",
            (hx - w / 2 + 0.1, y, front + 0.14),
            (hx + w / 2 - 0.1, y, front + 0.14),
            0.05,
            seg=6,
        )
    for x, bh in ((hx + 2.1, 0.7), (hx - 2.05, 0.5)):
        block("mech", 0.4, bh, 0.22, at(ID, x, y0 + 3.0, front + 0.2), bevel=0.02)
        tube("dark", (x, y0 + 3.0 - bh / 2, front + 0.2), (x, y0, front + 0.2), 0.05, seg=6)
    block("titanium", 0.35, 0.5, 0.18, at(ID, hx + 2.1, y0 + 1.6, front + 0.15), bevel=0.02)
    block("stencil", 0.2, 0.14, 0.02, at(ID, hx + 2.1, y0 + 1.7, front + 0.25), True)
    # A ventilation duct up the back wall and over onto the roof.
    bz = back - 0.35
    block("titanium", 0.8, h + 0.3, 0.6, at(ID, hx + 1.2, y0 + (h + 0.3) / 2, bz), bevel=0.03)
    block("titanium", 0.8, 0.6, 1.5, at(ID, hx + 1.2, y0 + h + 0.6, bz + 0.5), bevel=0.03)
    for y in (y0 + 1.5, y0 + 3.5, y0 + 5.5):
        block("steel", 0.9, 0.08, 0.7, at(ID, hx + 1.2, y, bz), True)
    # Street side: louvred vent, air-con units with cables, a camera on the corner.
    grille((side + 0.1, 0, hz - 0.8), 0, y0 + 2.2, 2.6, 2.4)
    for k in range(3):
        y = y0 + 1.0 + k * 1.1
        block("mech", 0.45, 0.6, 0.8, at(ID, side + 0.3, y, hz + 1.9), bevel=0.03)
        block("dark", 0.05, 0.42, 0.42, at(ID, side + 0.53, y, hz + 1.9), True)
        tube("dark", (side + 0.35, y - 0.3, hz + 2.3), (side + 0.15, y0, hz + 2.6), 0.03, True, 4)
    cam_at = (side + 0.35, y0 + h - 0.4, front + 0.35)
    tube("steel", (side, y0 + h - 0.3, front), cam_at, 0.04, True, 6)
    block("mech", 0.22, 0.2, 0.45, at(facing(math.pi / 4), *cam_at), True)
    # Roof: two fans, a heat exchanger, a hatch, a safety rail along the front.
    ry = y0 + h + 0.35
    for x in (hx - 1.1, hx + 1.1):
        block("mech", 1.6, 0.3, 1.6, at(ID, x, ry + 0.15, hz - 1.3))
        fan((x, 0, hz - 1.3), ry + 0.3, 0.7)
    block("mech", w - 1.0, 1.0, 1.2, at(ID, hx, ry + 0.5, hz + 1.2), bevel=0.04)
    radiator((hx, 0, hz + 1.8), math.pi / 2, ry + 0.5, 10, w - 1.4, 0.8, 0.12)
    block("titanium", 0.8, 0.12, 0.8, at(ID, hx + 1.4, ry + 0.06, back + 0.2), True)
    rail("hazard", [(hx - w / 2 + 0.2, ry, front - 0.2), (hx + w / 2 - 0.2, ry, front - 0.2)])


def build_pipes():
    """Heavy pipework: a bridge from the vessel to the control block's upper floor with a
    catwalk and a gauge, a feed down into the plinth, and two headers from the vessel back to
    the discharge towers with flanges and supports."""
    hx, hz, w, _, _ = HALL
    x0, x1 = REACTOR[0] + 3.3, hx - w / 2
    yb = PLINTH + 4.6
    for z, r, y in ((hz - 0.7, 0.32, yb), (hz + 0.2, 0.24, yb), (hz - 0.7, 0.2, PLINTH + 2.2)):
        tube("titanium", (x0, y, z), (x1, y, z), r, seg=8)
        mid = (x0 + x1) / 2
        tube("dark", (mid - 0.1, y, z), (mid + 0.1, y, z), r + 0.08, seg=8)
    tube("mech", (x1 - 0.6, yb, hz + 1.2), (x1 - 0.6, PLINTH, hz + 1.2), 0.22, seg=10)
    tube("mech", (x0, yb, hz + 1.2), (x1 - 0.6, yb, hz + 1.2), 0.22, seg=10)
    y = yb + 0.45
    block("dark", x1 - x0, 0.1, 1.4, at(ID, (x0 + x1) / 2, y, hz - 0.2))
    for z in (hz - 0.85, hz + 0.45):
        rail("hazard", [(x0, y, z), (x1, y, z)])
    gauge(at(facing(math.pi / 2), (x0 + x1) / 2 + 0.6, yb, hz + 0.47))
    for x in (x0 + 0.3, x1 - 0.3):  # bridge posts
        block("steel", 0.2, yb - PLINTH, 0.2, at(ID, x, (yb + PLINTH) / 2, hz - 0.2))
    # Headers back to the towers, behind the control block.
    a = -1.05
    sx, _, sz = around(REACTOR, a, 3.45, 0)
    zl = -3.25
    for y, r in ((PLINTH + 2.2, 0.34), (PLINTH + 3.0, 0.26)):
        tube("titanium", (sx, y, sz), (sx, y, zl), r, seg=8)
        tube("titanium", (sx, y, zl), (STACKS[0][0], y, zl), r, seg=8)
        for tx, tz, _ in STACKS:  # risers into each tower
            tube("titanium", (tx, y, zl), (tx, y, tz + STACK_R[0] - 0.2), r * 0.8, seg=8)
        xx = sx + 0.6
        while xx < STACKS[0][0] - 0.3:  # flanges
            tube("dark", (xx - 0.07, y, zl), (xx + 0.07, y, zl), r + 0.07, seg=8)
            xx += 1.1
    for x in (sx + 0.3, 3.0):  # pipe supports
        block("steel", 0.2, 2.6, 0.2, at(ID, x, PLINTH + 1.3, zl))
        block("steel", 0.9, 0.15, 0.25, at(ID, x, PLINTH + 2.6, zl))


def build_yard():
    """Street side: two transformers (tanks, radiator fins, insulators, high-voltage plates, a
    status light) behind a fence, armoured ducts and cable bundles into the drum, a fan unit on
    the back corner, bollards with painted bands along the kerb."""
    rx, rz = REACTOR
    for x in (-4.4, -1.1):
        z = 4.6
        block("mech", 1.6, 1.5, 1.1, at(ID, x, PLINTH + 0.75, z), bevel=0.05)
        radiator((x, 0, z + 0.55), math.pi / 2, PLINTH + 0.75, 6, 1.2, 1.0, 0.35)
        for k in (-0.5, 0, 0.5):
            tube("mech", (x + k, PLINTH + 1.5, z), (x + k, PLINTH + 2.1, z), 0.07, True, 6)
            for y in (PLINTH + 1.65, PLINTH + 1.85):
                tube("dark", (x + k, y - 0.03, z), (x + k, y + 0.03, z), 0.12, True, 6)
        block("yellow", 0.45, 0.32, 0.03, at(ID, x, PLINTH + 1.0, z - 0.57))  # high-voltage plate
        text("dark", "HV", 0.16, at(facing(-math.pi / 2), x, PLINTH + 1.0, z - 0.6), 0, 2, True)
        block("ice", 0.06, 0.06, 0.03, at(ID, x + 0.65, PLINTH + 1.3, z - 0.57), True)  # status
        zd = rz + math.sqrt(max(0.0, DRUM_R**2 - (x + 0.5 - rx) ** 2)) + 0.05  # drum face
        length, mid = z - 0.55 - zd, (z - 0.55 + zd) / 2
        block("dark", 0.36, 0.3, length, at(ID, x + 0.5, PLINTH + 0.15, mid))  # armoured duct
        for k, dz in enumerate((-0.05, 0.05, 0.15)):  # cable bundle up to the drum
            lo, hi = (x + 0.5, PLINTH + 2.1, z + dz), (x + 0.1 * k, PLINTH + 2.3, zd + 0.1)
            tube("dark", lo, hi, 0.04, True, 4)
    fence = [(-5.7, PLINTH, 3.6), (-5.7, PLINTH, 5.7), (0.4, PLINTH, 5.7), (0.4, PLINTH, 3.6)]
    rail("steel", fence, 1.6)
    block("titanium", 1.8, 0.9, 1.8, at(ID, -5.0, PLINTH + 0.45, -5.0), bevel=0.04)  # fan unit
    fan((-5.0, 0, -5.0), PLINTH + 0.9, 0.75)
    for x in (1.4, 2.6, 3.8, 5.0):  # bollards
        post = [(0, PLINTH), (0.12, PLINTH), (0.12, PLINTH + 0.8), (0, PLINTH + 0.8)]
        lathe("steel", post, 8, center=(x, 5.7))
        ring("hazard", 0.12, 0.03, PLINTH + 0.6, 8, 4, True, center=(x, 5.7))


def build():
    scene = bpy.data.scenes.get(NAME) or bpy.data.scenes.new(NAME)
    bpy.context.window.scene = scene
    clear(scene)
    parts.clear()
    for step in (build_plinth, build_reactor, build_stacks, build_hall, build_pipes, build_yard):
        step()
    join(scene, NAME)
    studio(scene)
    return scene


def night_review(seed=4):
    """Review scene "plant_night": the plant on the kit's night street (low sheds behind, so the
    towers read against the sky), with cold work lights on poles and steam over the vents."""
    scene, cube, light = kit.night_street(NAME, "plant_night", (12, -28, 4), (0, 0, 13), 18, seed)
    hx, hz, _, hh, _ = HALL
    for loc, target, energy in (  # cold-white work lights on poles, one up the towers
        ((4.8, -6.4, 8.5), (2.5, -3.5, 1.0), 900),
        ((-6.2, -6.4, 11.0), (-2.3, 0.4, 4.0), 1500),
        ((1.0, -1.5, PLINTH + hh + 2.5), (3.0, 4.6, 24.0), 2500),
    ):
        spot = light("SPOT", "night_work", loc, energy, (0.86, 0.92, 1.0), target).data
        spot.spot_size, spot.spot_blend = math.radians(70), 0.6
    # Review only: in the city, steam is ambient life drawn by the browser (ADR-0002).
    steam = kit.steam_material()
    for x, z, h in STACKS:
        cube("night_steam", 2.6, 2.6, 7.0, x + 0.4, -z, h + 0.6, steam)
    cube("night_steam", 2.6, 1.4, 2.0, hx, -(hz - 1.3), PLINTH + hh + 0.8, steam)
    return scene


build()
if globals().get("CITY"):  # the city's copy: .gltf + .bin, loaded by web/src/plant.js
    print(kit.export(NAME, os.path.join(REPO, "web", "assets", "models", NAME), "GLTF_SEPARATE"))  # noqa: F821
if globals().get("EXPORT"):
    print(kit.export(NAME, EXPORT))  # noqa: F821
