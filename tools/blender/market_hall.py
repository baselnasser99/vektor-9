"""Build the city's market tile as KUROTECH, a cybernetic hardware shop, in Blender (an original
design).

In Blender: REPO = r"<repo root>"; exec(open(REPO + "/tools/blender/market_hall.py").read())
Builds into its own scene "market_hall" (with a studio for review renders); night_review() adds
a "market_night" scene on the kit's night street. CITY = True before exec writes the city's copy
(web/assets/models/market_hall); EXPORT = r"<folder>" a .glb there.

A compact, heavily modified two-storey shop under the old barrel roof, cyberpunk by its
architecture, not its lights: it must read as futuristic in flat daylight with every light off.
Angular off-white and olive armour panels overlap graphite walls and exposed steel sections; the
silhouette is broken by a ventilation tower on one side, a cooling rig and maintenance platform on
the other, a tall corner sign that rises past the eaves, an asymmetric sign frame, a mast and
dishes on the roof. Street level: a deep storefront in a thick angular frame under a layered
armoured canopy on struts, a display window with parts and a product hologram, a sliding
security door with an access panel, payment terminal, scanner and control panel, a vending
terminal and a delivery locker in the armoured wall. Upstairs: a workshop with reinforced
asymmetric windows and shutters, a fan unit, a cooling unit with hoses. Dense but purposeful
detail: cable bundles, conduits, brackets, junction boxes, cameras, hatches, labels.

Light is restrained and kept to three focal areas (the roof sign, the corner sign, the
storefront): white sign light, aged amber screens, red security indicators, a few cold cyan
displays. No pink or purple, no outline strips. The shop's name and mark are blank lit panels
("sign" on the roof, "blade" on the corner) the renderer fills per tile from an invented list
(web/src/world.js SHOPS, KUROTECH first); the trades line is built in. Built at a nominal 10 m
footprint (the renderer scales it to the tile's 9-11 m). Same conventions as the tower
(tools/blender/kit.py): three.js coordinates, parts joined per material role, small parts under
"detail". +z is the street front.
"""

import importlib
import math
import os
import random
import sys

import bpy
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.join(REPO, "tools", "blender"))  # noqa: F821
import kit  # noqa: E402

importlib.reload(kit)  # Blender keeps modules between runs
from kit import (  # noqa: E402
    at,
    bar,
    block,
    clear,
    dish,
    facing,
    join,
    lathe,
    loft,
    parts,
    radiator,
    rail,
    screen,
    studio,
    text,
    tube,
)

NAME = "market_hall"
TRADES = "CYBERNETICS / PARTS / REPAIRS"
W = 10.0  # nominal footprint, square
H = W / 2
BASE = 0.3  # slab top
GF = 4.2  # ground floor height
UF = 3.4  # upper floor height
RISE = 1.7  # barrel vault rise over the upper floor
REC = (-4.7, 1.2, 1.6)  # storefront recess: x from, x to, depth
SETBACK = 0.6  # the upper floor stands back from the street line
ID = Matrix()
FRONT = facing(math.pi / 2)  # local +x out of the street face (for text)
rnd = random.Random(7)


def plate(role, w, h, d, m, cut=0.3, detail=False):
    """An armour plate w x h, d thick, facing local +z from m, with two opposite corners cut
    off at 45 degrees (top right, bottom left) so it reads angular, not boxy."""
    c = min(cut, w / 3, h / 3)
    outline = [(-w / 2 + c, -h / 2), (w / 2, -h / 2), (w / 2, h / 2 - c), (w / 2 - c, h / 2)]
    outline += [(-w / 2, h / 2), (-w / 2, -h / 2 + c)]
    rings = [[tuple(m @ Vector((x, y, z))) for x, y in outline] for z in (0, d)]
    return loft(role, rings, detail, smooth_angle=20)


def tilt(m, yaw=0.0, pitch=0.0):
    """m turned by yaw about local y and pitch about local x (radians)."""
    return m @ Matrix.Rotation(yaw, 4, "Y") @ Matrix.Rotation(pitch, 4, "X")


def label(body, size, m, role="stencil"):
    """Painted identification text facing local +z from m (flat, coarse curves)."""
    text(role, body, size, m @ Matrix.Rotation(-math.pi / 2, 4, "Y"), 0, 2, True)


def light_text(body, size, m, role="glow_white"):
    """Lit sign letters facing local +z from m: flat, on their panel, coarse curves."""
    text(role, body, size, m @ Matrix.Rotation(-math.pi / 2, 4, "Y"), 0, 2)


def build_shell():
    """Slab, the ground-floor shell with its storefront recess, exposed steel sections, and the
    upper floor set back above it."""
    x0, x1, depth = REC
    block("soot", W + 1.2, BASE, W + 1.2, at(ID, 0, BASE / 2, 0), bevel=0.04)
    block("graphite", W, GF, W - depth, at(ID, 0, BASE + GF / 2, -depth / 2))
    block("graphite", H - x1, GF, depth, at(ID, (x1 + H) / 2, BASE + GF / 2, H - depth / 2))
    block("graphite", x0 + H, GF, depth, at(ID, (x0 - H) / 2, BASE + GF / 2, H - depth / 2))
    for x in (-H + 0.15, x1, H - 0.15):  # exposed steel sections on the street line
        block("steel", 0.32, GF, 0.32, at(ID, x, BASE + GF / 2, H + 0.05))
        for y in (BASE + 0.6, BASE + GF - 0.6):  # bolted plates
            block("titanium", 0.45, 0.3, 0.06, at(ID, x, y, H + 0.23), True)
    block("steel", W + 0.2, 0.35, 0.4, at(ID, 0, BASE + GF + 0.02, H))  # floor beam
    y0, zc = BASE + GF, -SETBACK / 2
    block("graphite", W - 0.3, UF, W - SETBACK, at(ID, 0, y0 + UF / 2, zc))
    for s in (-1, 1):  # side walls: olive cladding over the graphite, a hatch with a lock
        block("olive", 0.08, GF - 0.8, W - 2.0, at(ID, s * (H + 0.04), BASE + GF / 2 + 0.2, -0.6))
        hatch = at(Matrix.Rotation(s * math.pi / 2, 4, "Y"), s * (H + 0.1), BASE + 1.4, -3.2)
        plate("titanium", 0.9, 1.0, 0.06, hatch, 0.15)
        block("dark", 0.12, 0.12, 0.08, hatch @ Matrix.Translation((0.3, 0, 0.08)), True)


def build_storefront():
    """The recessed storefront: a thick angular frame round the mouth, a display window with
    shelves of parts and a product hologram behind it, a sliding security door at the back with
    an access panel, and beside the door a payment terminal, scanner and control panel."""
    x0, x1, depth = REC
    zf, y0 = H, BASE
    mid = -1.5  # the frame's mullion: window to the left, door bay to the right
    for x, w in ((x0 + 0.2, 0.7), (mid, 0.5), (x1 - 0.25, 0.6)):  # jambs, chamfered
        plate("graphite", w, GF - 0.3, 0.5, at(ID, x, y0 + (GF - 0.3) / 2, zf - 0.35), 0.25)
    plate("graphite", x1 - x0, 0.75, 0.55, at(ID, (x0 + x1) / 2, y0 + GF - 0.45, zf - 0.38), 0.3)
    # Display window: glass at the mouth, a sill, shelves of parts and the hologram behind.
    wx, ww = (x0 + 0.55 + mid - 0.25) / 2, mid - 0.25 - x0 - 0.55
    block("glass", ww, GF - 1.6, 0.05, at(ID, wx, y0 + 0.8 + (GF - 1.6) / 2, zf - 0.2))
    block("steel", ww + 0.1, 0.12, 0.45, at(ID, wx, y0 + 0.8, zf - 0.3))
    back = zf - depth + 0.05
    for y in (y0 + 1.2, y0 + 2.2):
        block("dark", ww, 0.05, 0.4, at(ID, wx, y, back + 0.2))
        for k in range(int(ww / 0.45)):  # parts: limbs, housings, boards
            x = wx - ww / 2 + 0.3 + k * 0.45
            role = rnd.choice(("armor", "titanium", "graphite", "olive"))
            if k % 3 == 1:
                tube(role, (x, y + 0.05, back + 0.2), (x, y + 0.5, back + 0.2), 0.08, True, 6)
            else:
                block(
                    role, 0.28, rnd.uniform(0.15, 0.35), 0.25, at(ID, x, y + 0.2, back + 0.2), True
                )
    block("graphite", ww - 0.4, 0.12, 0.3, at(ID, wx, y0 + 0.86, zf - 0.75))  # hologram emitter
    block("glow_cyan", ww - 0.5, 0.03, 0.06, at(ID, wx, y0 + 0.93, zf - 0.75))
    screen("holo", ww - 0.9, 0.7, at(ID, wx, y0 + 1.4, zf - 0.75))
    # Door bay: segmented sliding security door, half open, with its access panel.
    dx, dw = (mid + 0.25 + x1 - 0.3) / 2, x1 - 0.3 - mid - 0.25
    block("dark", dw, GF - 0.9, 0.08, at(ID, dx, y0 + (GF - 0.9) / 2, back))  # the doorway
    for k, x in enumerate((dx - dw / 4 - 0.35, dx + dw / 4)):  # two leaves, one slid aside
        leaf = at(ID, x, y0 + (GF - 1.0) / 2, back + 0.08 + 0.06 * k)
        block("steel", dw / 2, GF - 1.0, 0.08, leaf)
        for j in range(4):
            block(
                "graphite",
                dw / 2 - 0.1,
                0.05,
                0.03,
                leaf @ Matrix.Translation((0, -1.2 + j * 0.8, 0.055)),
                True,
            )
        block("yellow", 0.06, GF - 1.0, 0.1, leaf @ Matrix.Translation((dw / 4 - 0.03, 0, 0)))
    panel = at(ID, x1 - 0.65, y0 + 1.4, back + 0.06)
    block("graphite", 0.32, 0.45, 0.08, panel)
    block("glow_cyan", 0.2, 0.14, 0.02, panel @ Matrix.Translation((0, 0.08, 0.05)))
    block("red", 0.04, 0.04, 0.02, panel @ Matrix.Translation((0.08, -0.12, 0.05)), True)
    # On the right jamb's face: payment terminal, scanner over the door, control panel.
    jx = x1 - 0.25
    pay = at(ID, jx, y0 + 1.3, zf - 0.08)
    block("graphite", 0.3, 0.42, 0.14, pay)
    block("glow_cyan", 0.18, 0.12, 0.02, pay @ Matrix.Translation((0, 0.08, 0.08)))
    block("dark", 0.2, 0.1, 0.03, pay @ Matrix.Translation((0, -0.1, 0.08)), True)
    scan = at(ID, dx, y0 + GF - 0.95, zf - 0.15)
    block("graphite", 0.5, 0.16, 0.2, scan)
    block("red", 0.3, 0.03, 0.02, scan @ Matrix.Translation((0, -0.07, 0.1)))
    ctrl = at(ID, jx, y0 + 2.1, zf - 0.06)
    plate("olive", 0.36, 0.5, 0.1, ctrl, 0.08)
    for k in range(3):
        block(
            "deepred" if k else "yellow",
            0.06,
            0.06,
            0.04,
            ctrl @ Matrix.Translation((-0.1 + k * 0.1, -0.1, 0.11)),
            True,
        )


def build_canopy():
    """An asymmetric armoured canopy over the storefront: two layered dark steel plates at
    different heights and angles on exposed struts, an armour fascia, downlights under it."""
    x0, x1, _ = REC
    y = BASE + GF - 0.15
    main = tilt(at(ID, (x0 + x1) / 2 - 0.3, y, H + 0.9), 0.0, -0.12)
    plate("graphite", x1 - x0 + 0.8, 1.9, 0.12, main @ Matrix.Rotation(-math.pi / 2, 4, "X"), 0.5)
    upper = tilt(at(ID, 0.4, y + 0.35, H + 1.1), -0.08, -0.2)
    plate("steel", 3.6, 2.3, 0.1, upper @ Matrix.Rotation(-math.pi / 2, 4, "X"), 0.6)
    plate(
        "armor", 3.0, 0.32, 0.08, tilt(at(ID, -2.0, y - 0.05, H + 1.82), 0.0, 0.25), 0.12
    )  # fascia
    for x in (x0 + 0.4, -1.5, x1 - 0.2):  # struts from wall brackets up under the plates
        block("steel", 0.3, 0.4, 0.18, at(ID, x, y - 1.3, H + 0.08))
        bar("steel", (x, y - 1.3, H + 0.15), (x, y - 0.12, H + 1.6), 0.12, 0.14, math.pi / 2)
    for x in (-3.4, -1.0, 0.8):  # downlights
        block("glow_white", 0.5, 0.04, 0.12, at(ID, x, y - 0.12, H + 0.8))


def build_wall_equipment():
    """The armoured wall right of the storefront: a vending terminal set into it, a robotic
    delivery locker, a narrow advertising screen in a recess, a junction box, armour plates."""
    zf = H
    vend = at(ID, 1.9, BASE + 1.3, zf)
    plate("graphite", 0.9, 2.1, 0.22, vend, 0.2)
    block("glow_amber", 0.6, 0.5, 0.02, vend @ Matrix.Translation((0, 0.55, 0.23)))
    block("dark", 0.5, 0.12, 0.04, vend @ Matrix.Translation((0, -0.15, 0.23)))
    block("dark", 0.55, 0.3, 0.06, vend @ Matrix.Translation((0, -0.6, 0.22)))
    block("glow_cyan", 0.12, 0.08, 0.02, vend @ Matrix.Translation((0.3, 0.05, 0.23)), True)
    lock = at(ID, 3.8, BASE + 1.75, zf)  # delivery locker: 3 x 4 compartments
    plate("titanium", 1.8, 2.7, 0.3, lock, 0.25)
    for r in range(4):
        for c in range(3):
            m = lock @ Matrix.Translation((-0.55 + c * 0.55, -0.95 + r * 0.62, 0.3))
            block("olive", 0.48, 0.55, 0.04, m)
            role = ("red", "glow_amber", "glow_cyan")[(r * 3 + c) % 5 % 3]
            block(role, 0.05, 0.05, 0.02, m @ Matrix.Translation((0.17, 0.2, 0.03)), True)
    label("B4", 0.18, lock @ Matrix.Translation((-0.6, 1.25, 0.31)))
    ad = at(ID, 2.75, BASE + 3.3, zf + 0.02)  # a narrow screen in a recess
    block("dark", 0.5, 1.4, 0.06, ad)
    screen("glow_amber", 0.38, 1.25, ad @ Matrix.Translation((0, 0, 0.04)))
    for k, (w, hh, y) in enumerate(((2.6, 0.9, 3.75), (1.6, 0.6, 3.4))):  # armour over it
        plate(
            "armor",
            w,
            hh,
            0.1,
            tilt(at(ID, 3.6 - k * 0.3, BASE + y, zf + 0.06 + k * 0.08), 0.05, 0.0),
            0.3,
        )
    label("KT-07", 0.22, at(ID, 3.4, BASE + 3.95, zf + 0.17))
    jb = at(ID, 4.75, BASE + 2.9, zf + 0.05)  # junction boxes, layered
    block("olive", 0.4, 0.55, 0.2, jb)
    block("graphite", 0.3, 0.35, 0.15, jb @ Matrix.Translation((0, -0.5, 0.0)))


def build_upper():
    """The workshop upstairs: reinforced asymmetric windows (a wide slit with a segmented
    shutter half down, a small square one), armour plates, a fan unit on the -x wall, a cooling
    unit with hoses on the +x wall, a maintenance platform on the front right."""
    y0, zf = BASE + GF, H - SETBACK
    slit = at(ID, -2.6, y0 + 1.9, zf)
    plate("graphite", 3.6, 1.1, 0.25, slit, 0.25)
    block("glass", 3.1, 0.6, 0.05, slit @ Matrix.Translation((0, 0, 0.26)))
    for k in range(3):  # segmented shutter, half down
        block(
            "titanium", 3.1, 0.1, 0.05, slit @ Matrix.Translation((0, 0.25 - k * 0.11, 0.3)), True
        )
    block("glow_cyan", 2.6, 0.03, 0.02, slit @ Matrix.Translation((0, -0.26, 0.3)), True)
    sq = at(ID, 2.7, y0 + 1.7, zf)
    plate("graphite", 1.3, 1.3, 0.3, sq, 0.3)
    block("glass", 0.8, 0.8, 0.05, sq @ Matrix.Translation((0, 0, 0.31)))
    plate("armor", 2.4, 1.6, 0.12, tilt(at(ID, 0.2, y0 + 1.6, zf + 0.05), -0.06), 0.45)
    label("K-07", 0.32, tilt(at(ID, 0.2, y0 + 1.75, zf + 0.2), -0.06))
    plate("olive", 1.6, 0.9, 0.1, at(ID, -2.4, y0 + 0.65, zf + 0.04), 0.2)
    plate("armor", 1.2, 2.4, 0.1, tilt(at(ID, 4.1, y0 + 1.6, zf + 0.05), 0.1), 0.35)
    # Fan unit on the -x wall: a housing with two fans, ducts up into the wall.
    fx, fz = -H - 0.55, 0.8
    block("graphite", 0.9, 1.3, 2.2, at(ID, fx, y0 + 1.5, fz))
    for z in (fz - 0.5, fz + 0.5):
        tube("dark", (fx - 0.46, y0 + 1.5, z), (fx - 0.5, y0 + 1.5, z), 0.45, seg=8)
        tube("steel", (fx - 0.5, y0 + 1.5, z), (fx - 0.56, y0 + 1.5, z), 0.1, seg=8)
        for k in range(3):  # blades
            a = k * 2 * math.pi / 3
            m = at(ID, fx - 0.53, y0 + 1.5, z) @ Matrix.Rotation(a, 4, "X")
            block("steel", 0.03, 0.75, 0.14, m @ Matrix.Translation((0, 0.2, 0)), True)
    for z in (fz - 0.6, fz + 0.6):
        tube("titanium", (fx, y0 + 2.15, z), (fx, y0 + 2.9, z), 0.16, seg=8)
        tube("titanium", (fx, y0 + 2.9, z), (-H, y0 + 2.9, z), 0.16, seg=8)
    # Cooling unit on the +x wall with large hoses feeding in, armoured connectors.
    cx, cz = H + 0.6, -2.0
    block("olive", 1.0, 1.6, 2.4, at(ID, cx, y0 + 1.4, cz))
    radiator((cx + 0.5, 0, cz), 0, y0 + 1.4, 6, 2.0, 1.2, 0.08, True)
    for k, z in enumerate((cz - 0.7, cz, cz + 0.7)):
        pts = [(cx - 0.3, y0 + 2.25, z), (cx - 0.3, y0 + 2.7, z), (H, y0 + 2.7, z + 0.1 * k)]
        for p, q in zip(pts, pts[1:], strict=False):
            tube("graphite", p, q, 0.12, seg=8)
        tube("titanium", (cx - 0.3, y0 + 2.38, z), (cx - 0.3, y0 + 2.5, z), 0.17, True, 8)
    for z in (cz - 1.0, cz + 1.0):  # brackets
        bar("steel", (H, y0 + 0.2, z), (cx + 0.3, y0 + 0.6, z), 0.12, 0.12, 0)
    # Maintenance platform along the front right of the upper floor.
    px0, px1 = 0.9, H + 0.4
    py, pz = y0, zf + 0.55
    block("dark", px1 - px0, 0.12, 1.1, at(ID, (px0 + px1) / 2, py + 0.06, pz))
    rail(
        "steel",
        [(px0, py + 0.12, pz + 0.5), (px1, py + 0.12, pz + 0.5), (px1, py + 0.12, pz - 0.5)],
    )
    for x in (px0 + 0.3, px1 - 0.3):
        bar("steel", (x, py - 1.1, zf + 0.05), (x, py - 0.05, pz + 0.45), 0.1, 0.1, math.pi / 2)
    block("glow_amber", 0.2, 0.08, 0.1, at(ID, px1 - 0.2, py + 1.6, zf + 0.1), True)  # work lamp


def build_corner_sign():
    """The tall vertical sign on the front-left corner of the upper floor, rising past the
    eaves: a graphite blade turned off the facade, armour caps, white letters, a small amber
    number, brackets back to the wall."""
    bx, by, bz = -H + 0.2, BASE + GF + 2.6, H + 0.4
    bh = 5.4
    m = tilt(at(ID, bx, by, bz), -0.2)
    block("graphite", 0.3, bh, 1.15, m)
    for s in (1, -1):
        face = m @ Matrix.Rotation(s * math.pi / 2, 4, "Y") @ Matrix.Translation((0, 0.3, 0.16))
        screen("blade", 0.95, 3.8, face)  # the shop's mark: the renderer's, per tile
        light_text("07", 0.3, face @ Matrix.Translation((0, -bh / 2 + 0.5, 0.01)), "glow_amber")
    for y in (-bh / 2 - 0.12, bh / 2 + 0.12):
        plate(
            "armor",
            1.3,
            0.25,
            0.4,
            m @ Matrix.Translation((0, y, 0)) @ Matrix.Rotation(math.pi / 2, 4, "Y"),
            0.12,
        )
    for y in (-1.6, 1.2):
        bar("steel", (-H - 0.02, by + y, bz - 0.9), tuple(m @ Vector((0, y, -0.4))), 0.1, 0.1, 0)


def build_roof():
    """The old barrel vault with angular armour at its front edge and exposed truss arches over
    it; the main sign on an asymmetric steel frame, layered; a mast with antennas and dishes,
    two turbines, a cooling unit, a braced pressure tank; conduits down the sides."""
    y0 = BASE + GF + UF
    half, n = (W - SETBACK) / 2 + 0.2, 12
    zc = -SETBACK / 2

    def arch(x, lift=0.0):
        return [
            (x, y0 + lift + RISE * (1 - ((2 * k / n) - 1) ** 2), zc + half * ((2 * k / n) - 1))
            for k in range(n + 1)
        ]

    loft("steel", [arch(-W / 2 + 0.15), arch(W / 2 - 0.15)], smooth_angle=25)
    for x in (-3.2, 1.6):  # truss arches over the vault, braced
        top, low = arch(x, 0.45), arch(x, 0.08)
        for p, q in zip(top, top[1:], strict=False):
            tube("steel", p, q, 0.06, seg=4)
        for k in range(0, n, 4):  # braces every other bay
            tube("steel", low[k], top[k + 1], 0.04, True, 4)
    for k, x in enumerate((-3.6, -0.6, 2.6)):  # angular armour along the front eave
        m = tilt(at(ID, x, y0 + 0.2 + 0.15 * k, zc + half + 0.05), 0.0, -0.35)
        plate("armor" if k != 1 else "olive", 2.8, 0.9, 0.12, m, 0.3)
    wedge = [
        (2.2, y0, -half + zc - 0.1),
        (H - 0.1, y0, -half + zc - 0.1),
        (H - 0.1, y0, zc - 0.5),
        (2.2, y0, zc - 0.5),
    ]
    loft(
        "olive", [wedge, [(x, y0 + 1.6 - 0.6 * (x > 3), z) for x, _, z in wedge]]
    )  # equipment housing
    radiator((3.6, 0, zc - 0.45), math.pi / 2, y0 + 0.8, 5, 2.2, 1.0, 0.1, True)
    # The main sign, on its own steel frame, turned off the facade; a smaller panel in front.
    sx, sy, sz = 0.7, y0 + RISE + 1.9, zc + 1.0
    sign = tilt(at(ID, sx, sy, sz), -0.14, -0.06)
    for x in (-2.6, 2.6):
        foot = sign @ Vector((x, -1.3, -0.5))
        bar(
            "steel",
            (foot.x, y0 + RISE * 0.7, foot.z - 0.3),
            tuple(sign @ Vector((x, 0.6, -0.15))),
            0.16,
            0.16,
            0,
        )
        bar(
            "steel",
            (foot.x + 0.8, y0 + RISE * 0.5, foot.z - 1.2),
            tuple(sign @ Vector((x, -0.4, -0.15))),
            0.1,
            0.1,
            0,
        )
    plate("graphite", 6.4, 1.9, 0.25, sign, 0.45)
    screen(
        "sign", 5.9, 1.45, sign @ Matrix.Translation((0, 0.05, 0.26))
    )  # the shop's name, per tile
    sub = tilt(at(ID, sx - 0.9, sy - 1.25, sz + 0.55), -0.05, 0.0)
    plate("graphite", 4.6, 0.5, 0.12, sub, 0.15)
    light_text(TRADES, 0.24, sub @ Matrix.Translation((0, 0, 0.13)), "glow_amber")
    for x in (-1.8, 1.8):
        bar(
            "steel",
            tuple(sub @ Vector((x, 0.2, -0.05))),
            tuple(sign @ Vector((x - 0.9, -0.9, -0.05))),
            0.06,
            0.06,
            0,
        )
    info = tilt(at(ID, sx + 3.6, sy + 0.4, sz - 0.2), -0.35)  # a small info panel, angled
    block("graphite", 0.9, 1.3, 0.1, info)
    screen("glow_white", 0.75, 1.15, info @ Matrix.Translation((0, 0, 0.06)))
    # Mast with antenna panels and dishes, at the back left.
    mx, mz = -3.6, zc - 1.8
    tube("steel", (mx, y0 + 0.8, mz), (mx, y0 + 7.0, mz), 0.08, seg=8)
    for y, r in ((y0 + 3.5, 0.6), (y0 + 5.0, 0.45), (y0 + 6.2, 0.3)):
        tube("steel", (mx - r, y, mz), (mx + r, y, mz), 0.03, True, 4)
        for s in (-1, 1):
            block("armor", 0.12, 0.6, 0.18, at(ID, mx + s * r, y + 0.3, mz), True)
    dish(0.55, tilt(at(ID, mx + 0.4, y0 + 2.6, mz + 0.2), 0.5, -0.4), True)
    dish(0.4, tilt(at(ID, mx - 0.4, y0 + 4.2, mz + 0.1), -0.6, -0.3), True)
    block("red", 0.1, 0.1, 0.1, at(ID, mx, y0 + 7.08, mz))
    # Turbines and the pressure tank.
    for tx, tz in ((-1.4, zc - 2.6), (-0.2, zc - 2.9)):
        ty = y0 + RISE * (1 - ((tz - zc) / half) ** 2)
        lathe(
            "titanium",
            [(0, ty), (0.45, ty), (0.45, ty + 0.5), (0.3, ty + 0.85), (0, ty + 0.9)],
            12,
            center=(tx, tz),
        )
        for k in range(6):
            a = k * math.pi / 3
            block(
                "steel",
                0.04,
                0.5,
                0.12,
                at(facing(a), tx + 0.47 * math.cos(a), ty + 0.3, tz + 0.47 * math.sin(a)),
                True,
            )
    ky, kz = y0 + RISE * 0.55 + 0.5, zc - 2.4
    tube("titanium", (-4.3, ky, kz), (-2.5, ky, kz), 0.5, seg=8)
    for x in (-4.4, -2.4):
        tube("titanium", (x - 0.1, ky, kz), (x + 0.1, ky, kz), 0.35, seg=8)
    for x in (-4.0, -3.4, -2.8):
        tube("steel", (x - 0.06, ky, kz), (x + 0.06, ky, kz), 0.56, True, 8)
    block("yellow", 0.6, 0.12, 0.04, at(ID, -3.4, ky, kz + 0.52))
    for x in (-4.0, -2.8):
        block("steel", 0.25, 0.6, 1.1, at(ID, x, ky - 0.55, kz))
    # Power conduits down the sides, bracketed.
    for x, z in ((H + 0.12, 2.6), (-H - 0.12, -1.6)):
        for dz in (0, 0.25):
            tube("graphite", (x, y0 + 0.5, z + dz), (x, BASE + 0.3, z + dz), 0.1, seg=8)
        for y in (BASE + 1.0, BASE + 3.0, BASE + 5.0, BASE + 7.0):
            block("steel", 0.25, 0.12, 0.6, at(ID, x, y, z + 0.12), True)


def build_vent_tower():
    """A heavy ventilation tower on the back left corner, from the street up past the roof:
    a square duct in armoured sections, two fan housings on its side, a louvred head."""
    vx, vz = -H - 0.25, -H + 0.9  # half set into the wall, so it stays on the lot
    top = BASE + GF + UF + RISE + 2.6
    block("graphite", 1.0, top - BASE, 1.0, at(ID, vx, (top + BASE) / 2, vz))
    y = BASE + 1.5
    while y < top - 1.0:  # sections, with armour collars
        plate("olive", 1.2, 0.35, 1.2, at(ID, vx, y, vz - 0.6), 0.15)
        y += 2.4
    for y in (BASE + GF + 0.8, BASE + GF + UF - 0.4):
        block(
            "steel", 0.9, 0.9, 0.5, at(ID, vx, y, vz + 0.7), bevel=0.03
        )  # fan housing, facing out
        tube("dark", (vx, y, vz + 0.95), (vx, y, vz + 1.0), 0.36, seg=6)
        for k in range(3):
            m = at(ID, vx, y, vz + 0.98) @ Matrix.Rotation(k * 2 * math.pi / 3, 4, "Z")
            block("steel", 0.1, 0.6, 0.03, m @ Matrix.Translation((0, 0.16, 0)), True)
    plate("armor", 1.4, 0.9, 1.4, at(ID, vx, top + 0.2, vz - 0.7), 0.2)  # louvred head
    for k in range(4):
        block("dark", 1.42, 0.08, 0.06, at(ID, vx, top - 0.05 + k * 0.17, vz + 0.71))
    block("red", 0.1, 0.1, 0.1, at(ID, vx, top + 0.7, vz))
    for y in (BASE + 2.0, BASE + GF + 1.5, BASE + GF + UF):  # ties back to the wall
        block("steel", 0.5, 0.15, 0.3, at(ID, -H - 0.1, y, vz + 0.6))


def build_back():
    """The back: a rear service door in an armoured frame with a keypad, a loading hatch, an
    air-con cluster on brackets with its duct, armour and olive plates, an identification
    number, conduits."""
    zb = -H
    door = at(Matrix.Rotation(math.pi, 4, "Y"), 1.8, BASE + 1.25, zb)
    plate("graphite", 1.6, 2.7, 0.3, door, 0.3)
    block("steel", 1.1, 2.3, 0.06, door @ Matrix.Translation((0, -0.1, 0.31)))
    block("yellow", 1.1, 0.08, 0.04, door @ Matrix.Translation((0, 1.06, 0.33)))
    block("glow_cyan", 0.12, 0.16, 0.03, door @ Matrix.Translation((0.75, 0.1, 0.32)), True)
    back = Matrix.Rotation(math.pi, 4, "Y")
    plate("olive", W - 1.0, 1.2, 0.08, at(back, 0, BASE + GF - 0.9, zb), 0.4)  # cladding band
    plate("armor", 2.2, 1.6, 0.1, tilt(at(back, -3.6, BASE + 2.0, zb - 0.02), 0.08), 0.4)
    label("07", 0.5, at(back, -3.6, BASE + 2.0, zb - 0.14))
    hatch = at(Matrix.Rotation(math.pi, 4, "Y"), -1.6, BASE + 1.0, zb)
    plate("titanium", 2.4, 1.6, 0.12, hatch, 0.35)
    for k in range(5):
        block("dark", 2.0, 0.05, 0.03, hatch @ Matrix.Translation((0, -0.6 + k * 0.3, 0.13)), True)
    for k, x in enumerate((-2.8, -1.6, -0.4)):  # air-con cluster upstairs
        ac = at(
            Matrix.Rotation(math.pi, 4, "Y"),
            x,
            BASE + GF + 1.2 + 0.2 * (k % 2),
            zb - 0.32,
        )
        block("olive", 1.0, 0.8, 0.6, ac)
        tube(
            "dark", tuple(ac @ Vector((0, 0, 0.3))), tuple(ac @ Vector((0, 0, 0.34))), 0.3, True, 6
        )
        block("steel", 0.9, 0.08, 0.5, ac @ Matrix.Translation((0, -0.46, 0)), True)
    tube(
        "titanium",
        (-2.8, BASE + GF + 1.7, zb - 0.18),
        (1.2, BASE + GF + 1.7, zb - 0.18),
        0.14,
        seg=8,
    )
    for k, (x, w, hh) in enumerate(((3.6, 2.2, 1.4), (0.2, 1.6, 0.9))):
        m = at(
            Matrix.Rotation(math.pi, 4, "Y"),
            x,
            BASE + GF + UF - 0.9 - 0.3 * k,
            zb - 0.01,
        )
        plate("armor" if k == 0 else "olive", w, hh, 0.1, m, 0.3)
    label(
        "SVC-2",
        0.3,
        at(Matrix.Rotation(math.pi, 4, "Y"), 3.6, BASE + GF + UF - 0.9, zb - 0.12),
    )


def build_cables():
    """Bundled power cables across the front under the floor beam and down the right corner,
    cameras on the corners, recessed indicators."""
    y = BASE + GF - 0.2
    for k in range(3):
        tube("dark", (-H, y - k * 0.08, H + 0.32), (H, y - k * 0.08 - 0.05, H + 0.32), 0.035, seg=4)
    for k in range(3):
        tube(
            "dark",
            (H + 0.1, BASE + GF, H - 0.2 - k * 0.08),
            (H + 0.1, BASE, H - 0.2 - k * 0.08),
            0.035,
            seg=4,
        )
    for x, y, a in (
        (H - 0.1, BASE + GF + UF - 0.3, math.pi * 0.75),
        (REC[0], BASE + GF - 0.9, math.pi * 0.3),
    ):
        arm = at(ID, x, y, H + 0.2)
        block("steel", 0.06, 0.06, 0.3, arm, True)
        cam = tilt(arm @ Matrix.Translation((0, -0.05, 0.25)), a - math.pi / 2, -0.3)
        block("graphite", 0.2, 0.18, 0.4, cam, True)
        block("red", 0.04, 0.04, 0.02, cam @ Matrix.Translation((0.05, 0.05, 0.21)), True)


def build():
    scene = bpy.data.scenes.get(NAME) or bpy.data.scenes.new(NAME)
    bpy.context.window.scene = scene
    clear(scene)
    parts.clear()
    rnd.seed(7)
    steps = (build_shell, build_storefront, build_canopy, build_wall_equipment, build_upper)
    for step in (*steps, build_corner_sign, build_roof, build_vent_tower, build_back, build_cables):
        step()
    join(scene, NAME)
    studio(scene)
    return scene


def night_review(seed=6):
    """Review scene "market_night": the shop on the kit's night street, seen from across it."""
    scene, _, _ = kit.night_street(NAME, "market_night", (9, -24, 3), (0, 0, 5.5), 22, seed, False)
    return scene


build()
if globals().get("CITY"):  # the city's copy: .gltf + .bin, loaded by web/src/tiles.js
    print(kit.export(NAME, os.path.join(REPO, "web", "assets", "models", NAME), "GLTF_SEPARATE"))  # noqa: F821
if globals().get("EXPORT"):
    print(kit.export(NAME, EXPORT))  # noqa: F821
