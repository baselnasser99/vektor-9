"""Build one street front of a cyberpunk shop for the corner buildings at the city's busiest
crossing (web/src/city.js storefrontTiles), in Blender (an original design).

In Blender: REPO = r"<repo root>"; exec(open(REPO + "/tools/blender/storefront.py").read())
Builds into its own scene "storefront" (with a studio for review renders). CITY = True before
exec writes the city's copy (web/assets/models/storefront); EXPORT = r"<folder>" a .glb there.

It replaces the plain one-storey shop strip on each street side of the lot, on the same footprint:
a 14 m front (a whole tile), 3 m deep, 4.5 m tall, front face on z = 0 and +z the street. A shop
in a dense megacity rather than a modern one with a neon strip: the front is a wall of graphite
steel, not glass. A recessed mechanical entrance (a heavy lintel, braced titanium jambs, a
segmented shutter half up under its drum, hydraulic arms, an access panel), a display window
behind steel bars and an armour plate, vending terminals and a parcel locker set into the wall,
two layered canopies on struts with small work lamps under them, conduits along the top, a
camera, AC units and a fan on the roof. Light is small and dim: the shop's interior, amber and
cyan screens, a few red indicators. The shop's name and mark are blank lit panels ("sign" over
the door, "blade" sticking out beside it) the renderer fills from web/src/world.js SHOPS.
Everything sits in the first 10.6 m; the last 3.4 m (+x) is a plain armoured end, the part that
goes into the corner where two fronts meet. A mirrored copy ("storefront_l", faces flipped, so it
merges like any other part) puts that end on the other side. Same conventions as the other
models (tools/blender/kit.py).
"""

import importlib
import math
import os
import sys

import bpy
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.join(REPO, "tools", "blender"))  # noqa: F821
import kit  # noqa: E402

importlib.reload(kit)  # Blender keeps modules between runs
from kit import at, bar, block, clear, join, loft, parts, screen, studio, tube  # noqa: E402

NAME = "storefront"
L, D, H = 14.0, 3.0, 4.5  # front length, depth, height
FRONT = 0.4  # the front wall's thickness, ahead of the shop's body
DOOR = (-2.0, 0.6, 1.6)  # entrance: x from, x to, recess depth
SHOW = (-6.4, -2.6)  # display window
VEND = (0.6, 3.6)  # vending wall
ID = Matrix()


def plate(role, w, h, d, m, cut=0.3, detail=False):
    """An armour plate w x h, d thick, facing local +z from m, two opposite corners cut at 45
    degrees so it reads angular, not boxy (as in market_hall.py)."""
    c = min(cut, w / 3, h / 3)
    outline = [(-w / 2 + c, -h / 2), (w / 2, -h / 2), (w / 2, h / 2 - c), (w / 2 - c, h / 2)]
    outline += [(-w / 2, h / 2), (-w / 2, -h / 2 + c)]
    rings = [[tuple(m @ Vector((x, y, z))) for x, y in outline] for z in (0, d)]
    return loft(role, rings, detail, smooth_angle=20)


def pitch(m, a):
    """m tipped by a about local x (positive lifts the +z edge)."""
    return m @ Matrix.Rotation(-a, 4, "X")


def build_shell():
    """The shop's body, and the front wall round the window, the entrance and the vending wall."""
    x0, x1, depth = DOOR
    zb = -FRONT  # the body's face
    for a, b in ((-L / 2, x0), (x1, L / 2)):  # body either side of the entrance
        block("graphite", b - a, H, D - FRONT, at(ID, (a + b) / 2, H / 2, (zb - D) / 2))
    block("graphite", x1 - x0, H, D - depth, at(ID, (x0 + x1) / 2, H / 2, (-depth - D) / 2))
    # Front wall: solid ends, piers between the openings, a kick plate and head over the window.
    for a, b in ((-L / 2, SHOW[0]), (SHOW[1], x0), (VEND[1], L / 2)):
        block("graphite", b - a, H, FRONT, at(ID, (a + b) / 2, H / 2, -FRONT / 2), bevel=0.03)
    for y0, y1 in ((0, 0.8), (3.0, H)):
        block(
            "graphite",
            SHOW[1] - SHOW[0],
            y1 - y0,
            FRONT,
            at(ID, sum(SHOW) / 2, (y0 + y1) / 2, -FRONT / 2),
        )
    block(
        "graphite", VEND[1] - VEND[0], H, FRONT * 0.5, at(ID, sum(VEND) / 2, H / 2, -FRONT * 0.75)
    )
    block("steel", L, 0.25, 0.3, at(ID, 0, H - 0.12, 0.05))  # parapet beam along the top
    block("steel", L, 0.2, D, at(ID, 0, H + 0.1, -D / 2))  # roof deck
    for s, x in ((-1, -L / 2 + 0.3), (1, 4.3), (1, 5.4)):  # armour plates on the solid ends
        plate("olive", 1.0, 2.2, 0.08, at(ID, x, 1.9, 0.02), 0.3)
        plate("titanium", 0.8, 0.9, 0.06, at(ID, x + s * 0.05, 3.55, 0.1), 0.2)
        for y in (1.0, 2.8):
            block("dark", 0.08, 0.08, 0.05, at(ID, x + 0.35, y, 0.11), True)
    for x in (SHOW[0] - 0.3, VEND[1] + 0.3):  # bumpers
        block("steel", 0.3, 0.3, 0.3, at(ID, x, 0.15, 0.05))


def build_window():
    """The display window: the lit shop behind, shelving in silhouette, steel bars and rails over
    the opening, an angled armour plate across one top corner."""
    a, b = SHOW
    w, mid = b - a, (a + b) / 2
    block("interior", w, 2.2, 0.04, at(ID, mid, 1.9, -FRONT - 0.01))
    for y in (1.35, 2.15):  # shelves with stock
        block("dark", w - 0.2, 0.06, 0.3, at(ID, mid, y, -FRONT + 0.05))
        for k in range(int(w / 0.5)):
            block(
                "titanium" if k % 2 else "olive",
                0.3,
                0.3,
                0.2,
                at(ID, a + 0.35 + k * 0.5, y + 0.18, -FRONT + 0.05),
                True,
            )
    for k in range(int(w / 0.55) + 1):  # bars
        block("steel", 0.07, 2.2, 0.07, at(ID, a + 0.15 + k * (w - 0.3) / int(w / 0.55), 1.9, 0.02))
    for y in (0.95, 2.85):
        block("steel", w, 0.12, 0.12, at(ID, mid, y, 0.06))
    plate("titanium", 1.6, 0.9, 0.08, pitch(at(ID, b - 0.8, 2.6, 0.12), 0.1), 0.35)
    block("steel", w + 0.2, 0.14, 0.4, at(ID, mid, 0.8, 0.1))  # sill


def build_entrance():
    """The recessed entrance: a heavy lintel with a hazard band, braced titanium jambs, the
    doorway lit within, a segmented shutter half up under its drum, hydraulic arms, controls."""
    x0, x1, depth = DOOR
    mid, w, back = (x0 + x1) / 2, x1 - x0, -depth
    for s, x in ((-1, x0), (1, x1)):  # jambs: angular plates on steel posts
        block("steel", 0.3, 3.1, 0.4, at(ID, x, 1.55, 0.05))
        plate("titanium", 0.5, 2.6, 0.1, at(ID, x - s * 0.05, 1.5, 0.25), 0.25)
        block("hazard", 0.32, 0.3, 0.42, at(ID, x, 0.25, 0.05))
    block("steel", w + 0.8, H - 3.1, FRONT + 0.3, at(ID, mid, 3.1 + (H - 3.1) / 2, -0.05))  # lintel
    for k in range(6):  # hazard band across the lintel's foot
        block(
            "hazard" if k % 2 else "dark",
            (w + 0.6) / 6,
            0.12,
            0.04,
            at(ID, x0 - 0.3 + (k + 0.5) * (w + 0.6) / 6, 3.2, 0.31),
        )
    block("dark", w, 3.1, 0.06, at(ID, mid, 1.55, back + 0.03))  # the doorway
    block("interior", w - 0.6, 1.6, 0.03, at(ID, mid, 0.8, back + 0.07))
    for k in range(6):  # shutter slats, the shutter half up
        block("steel", w - 0.15, 0.2, 0.06, at(ID, mid, 1.7 + k * 0.22, back + 0.12))
    block("steel", w - 0.05, 0.45, 0.45, at(ID, mid, 3.0, back + 0.28))  # its drum
    for s, x in ((-1, x0 + 0.25), (1, x1 - 0.25)):  # hydraulic arms from the jambs to the drum
        tube("titanium", (x, 1.3, -0.25), (x - s * 0.3, 2.8, back + 0.35), 0.06, False, 8)
        tube("steel", (x, 1.3, -0.25), (x - s * 0.12, 2.0, -0.9), 0.09, False, 8)
    panel = at(ID, x1 + 0.4, 1.35, 0.02)  # access panel on the pier beside the door
    block("graphite", 0.35, 0.5, 0.08, panel)
    block("glow_cyan", 0.22, 0.16, 0.02, panel @ Matrix.Translation((0, 0.08, 0.05)))
    block("red", 0.05, 0.05, 0.02, panel @ Matrix.Translation((0.1, -0.15, 0.05)), True)
    arm = at(ID, x0 - 0.2, 3.15, 0.25)  # camera on an arm under the lintel
    block("steel", 0.06, 0.06, 0.3, arm, True)
    block("graphite", 0.2, 0.18, 0.4, pitch(arm @ Matrix.Translation((0, -0.1, 0.25)), -0.4), True)
    block("red", 0.04, 0.04, 0.02, arm @ Matrix.Translation((0.05, -0.08, 0.47)), True)


def build_vending():
    """Two vending terminals and a parcel locker set into the wall right of the entrance."""
    for x, role in ((1.15, "glow_amber"), (2.15, "glow_cyan")):
        m = at(ID, x, 1.05, -0.1)
        plate("graphite", 0.85, 2.1, 0.45, m, 0.2)
        block(role, 0.55, 0.55, 0.02, m @ Matrix.Translation((0, 0.5, 0.46)))
        block(
            "dark", 0.5, 0.14, 0.05, m @ Matrix.Translation((0, -0.15, 0.46))
        )  # card and coin slots
        block("dark", 0.55, 0.32, 0.08, m @ Matrix.Translation((0, -0.62, 0.44)))  # dispenser
        plate("olive", 0.95, 0.12, 0.6, m @ Matrix.Translation((0, 1.1, 0.05)), 0.05)  # hood
        block("red", 0.05, 0.05, 0.02, m @ Matrix.Translation((0.3, 0.05, 0.46)), True)
    lock = at(ID, 3.1, 1.4, -0.15)
    plate("titanium", 1.0, 2.5, 0.3, lock, 0.2)
    for r in range(4):
        for c in range(2):
            m = lock @ Matrix.Translation((-0.22 + c * 0.44, -0.85 + r * 0.58, 0.3))
            block("olive", 0.4, 0.5, 0.04, m)
            block(
                "glow_amber" if (r + c) % 3 else "red",
                0.04,
                0.04,
                0.02,
                m @ Matrix.Translation((0.14, 0.18, 0.03)),
                True,
            )
    block(
        "glow_amber", 0.7, 0.9, 0.02, at(ID, 1.65, 3.0, -0.18)
    )  # a small screen over the terminals
    block("dark", 0.85, 1.05, 0.04, at(ID, 1.65, 3.0, -0.21))


def build_canopies():
    """Two layered canopies: a long steel one tipped up on diagonal struts, and over the entrance
    a shorter olive one stepped above it and tipped the other way; lamps under the first."""
    y = 3.3
    main = pitch(at(ID, 0, y, 0.85), 0.06)
    block("steel", L - 0.6, 0.14, 1.7, main)
    block("graphite", L - 0.6, 0.32, 0.08, at(ID, 0, y - 0.05, 1.72))  # front lip
    for x in (-6.0, -3.2, 1.6, 4.6):  # struts from brackets on the wall
        block("steel", 0.25, 0.35, 0.18, at(ID, x, y - 1.0, 0.09))
        bar("steel", (x, y - 1.0, 0.15), (x, y - 0.1, 1.55), 0.12, 0.12, math.pi / 2)
    for x in (-4.6, -0.7, 2.2):  # work lamps
        block("lamp", 0.45, 0.06, 0.2, at(ID, x, y - 0.1, 0.9))
    upper = pitch(at(ID, -1.2, 4.05, 0.6), -0.1)
    plate("olive", 5.6, 1.2, 0.1, upper @ Matrix.Rotation(-math.pi / 2, 4, "X"), 0.4)
    for x in (-3.6, 1.2):  # hangers from the parapet
        tube("steel", (x, H - 0.1, 0.1), (x, 4.1, 1.05), 0.04, True, 6)
    # The shop's name over the door, between the canopies, in a steel frame.
    block("steel", 3.5, 0.6, 0.08, at(ID, -0.7, 3.62, 0.17))
    screen("sign", 3.3, 0.45, at(ID, -0.7, 3.62, 0.22))


def build_blade():
    """The shop's mark on a vertical sign sticking out beside the entrance, above the canopy."""
    x, y, z = -2.4, 5.3, 0.75
    block("graphite", 0.18, 2.6, 1.2, at(ID, x, y, z))
    for s in (-1, 1):  # a lit panel on each face, looking along the street
        screen("blade", 1.0, 2.3, at(Matrix.Rotation(s * math.pi / 2, 4, "Y"), x + s * 0.1, y, z))
    block("steel", 0.1, 0.1, 1.5, at(ID, x, y + 1.35, 0.75))  # bracket
    tube("steel", (x, y - 1.3, 1.3), (x, H, 0.1), 0.04, True, 6)


def build_services():
    """Conduits along the top of the front with clamps and a drop to a junction box, and on the
    roof two AC units, a fan housing and a cable tray."""
    for y, z, r, role in ((H - 0.45, 0.18, 0.09, "steel"), (H - 0.62, 0.14, 0.06, "hazard")):
        tube(role, (-L / 2 + 0.3, y, z), (L / 2 - 0.3, y, z), r, False, 8)
    for x in range(-6, 7, 2):
        block("dark", 0.08, 0.3, 0.12, at(ID, x, H - 0.52, 0.2), True)
    tube("steel", (-6.7, H - 0.45, 0.18), (-6.7, 2.6, 0.18), 0.09, False, 8)
    block("olive", 0.5, 0.6, 0.25, at(ID, -6.7, 2.3, 0.15))
    block("red", 0.04, 0.04, 0.02, at(ID, -6.58, 2.45, 0.28), True)
    for x, w in ((-4.5, 1.4), (2.0, 1.1)):  # AC units, their grilles toward the street
        block("titanium", w, 0.8, 0.9, at(ID, x, H + 0.6, -1.0))
        block("dark", w - 0.2, 0.5, 0.04, at(ID, x, H + 0.6, -0.53))
    block("graphite", 1.2, 0.5, 1.2, at(ID, -1.0, H + 0.45, -1.8))  # fan housing
    block("dark", 0.9, 0.04, 0.9, at(ID, -1.0, H + 0.71, -1.8), True)
    block("steel", L - 1.0, 0.1, 0.35, at(ID, 0, H + 0.25, -2.6))  # cable tray


def build_corner():
    """The +x end wall, which is what shows on the street corner where two fronts meet (each
    front's own last 3 m is inside the other): a steel corner post, armour plates, a narrow
    amber screen, a riser of conduits, a hazard band at its foot, a camera."""
    side = Matrix.Rotation(math.pi / 2, 4, "Y")  # local +z out of the end wall (+x)
    x = L / 2
    block("steel", 0.4, H, 0.4, at(ID, x - 0.1, H / 2, -0.1))
    plate("titanium", 2.2, 2.0, 0.1, at(side, x, 1.5, -1.6), 0.35)
    plate("olive", 1.6, 1.1, 0.08, at(side, x + 0.06, 3.45, -1.2), 0.3)
    block("dark", 0.06, 1.8, 0.65, at(ID, x + 0.05, 2.6, -2.55))
    screen("glow_amber", 0.5, 1.6, at(side, x + 0.09, 2.6, -2.55))
    for z, r in ((-0.45, 0.09), (-0.68, 0.06)):
        tube("steel", (x + 0.12, 0.2, z), (x + 0.12, H, z), r, False, 8)
    block("hazard", 0.05, 0.3, 2.6, at(ID, x + 0.03, 0.15, -1.5))
    for y in (0.9, 2.1):
        block("dark", 0.05, 0.08, 0.08, at(ID, x + 0.13, y, -0.9), True)
    cam = at(ID, x + 0.25, H - 0.6, -0.25)
    block("graphite", 0.4, 0.18, 0.2, cam, True)
    block("red", 0.02, 0.04, 0.04, cam @ Matrix.Translation((0.21, 0, 0.05)), True)


def build():
    scene = bpy.data.scenes.get(NAME) or bpy.data.scenes.new(NAME)
    bpy.context.window.scene = scene
    clear(scene)
    parts.clear()
    for step in (
        build_shell,
        build_window,
        build_entrance,
        build_vending,
        build_canopies,
        build_blade,
        build_services,
        build_corner,
    ):
        step()
    join(scene, NAME)
    studio(scene)
    return scene


def mirrored(name=NAME + "_l"):
    """The model mirrored along its front (x to -x) into its own scene `name`, faces flipped."""
    scene = bpy.data.scenes.get(name) or bpy.data.scenes.new(name)
    clear(scene)
    flip = Matrix.Scale(-1, 4, (1, 0, 0))  # Blender x is three.js x
    root = next(o for o in bpy.data.scenes[NAME].objects if o.parent is None and o.type == "EMPTY")
    copies = {}
    for o in [root, *root.children_recursive]:
        c = o.copy()
        if o.type == "MESH":
            c.data = o.data.copy()
            c.data.transform(flip)
            c.data.flip_normals()
            if c.data.materials[0].name in (
                "sign",
                "blade",
            ):  # so their words still read left to right
                for d in c.data.uv_layers[0].data:
                    d.uv.x = 1 - d.uv.x
        scene.collection.objects.link(c)
        copies[o] = c
    for o, c in copies.items():
        c.parent = copies.get(o.parent)
    copies[root].name = name
    return scene


build()
mirrored()
for name in (NAME, NAME + "_l"):
    if globals().get("CITY"):  # the city's copies: .gltf + .bin, loaded by web/src/tiles.js
        folder = os.path.join(REPO, "web", "assets", "models", name)  # noqa: F821
        print(kit.export(name, folder, "GLTF_SEPARATE"))
    if globals().get("EXPORT"):
        print(kit.export(name, EXPORT))  # noqa: F821
