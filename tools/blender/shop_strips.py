"""Build four kinds of street-level shop strip for ordinary buildings, in Blender (original
designs).

In Blender: REPO = r"<repo root>"; exec(open(REPO + "/tools/blender/shop_strips.py").read())
Builds each into its own scene "shop_<kind>" (with a studio for review renders). CITY = True
before exec writes the city's copies (web/assets/models/shop_<kind>).

The renderer (web/src/city.js shopfronts) puts one strip on each street side of a lot: a 14 m
front (a whole tile, so neighbouring strips join into a street wall), 3 m deep, 4.5 m tall, front
face on z = 0 and +z the street. These give the ground floors variety without a neon strip:
- stalls: three roll-up shutter bays, one down, one half up, one open, a flat steel overhang;
- counter: a street-food counter under a sloping olive awning, a menu screen, an exhaust duct;
- frame: a glazed front behind an exposed steel frame with braces, a corrugated canopy, a box sign;
- arcade: the shop set back behind a colonnade, small lamps in the soffit, screens on the beam.
"shopwall" is the renderer's lit shop facade (web/src/facade.js), laid out by the UVs in metres.
"sign" is a lit sign whose word the renderer picks. They are kept light (a few hundred triangles
each), since most of the city's ground floors use them. Same conventions as the other models
(tools/blender/kit.py).
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
kit.ROLES.setdefault("shopwall", (0x4B5569, 0.0, 0.8, 0xFFC46B, 0.4, 1, None))  # preview only
kit.ROLES.setdefault("sheet", (0x2F3648, 0.4, 0.6, None, 0, 1, "rust"))  # corrugated steel
from kit import at, bar, block, clear, join, parts, screen, studio, tube  # noqa: E402

L, D, H = 14.0, 3.0, 4.5
ID = Matrix()
KINDS = ("stalls", "counter", "frame", "arcade")


def pitch(m, a):
    """m tipped by a about local x (positive lifts the +z edge)."""
    return m @ Matrix.Rotation(-a, 4, "X")


def body(front=-0.3):
    """The strip's body behind its front, and the roof slab."""
    block("graphite", L, H, D + front, at(ID, 0, H / 2, (front - D) / 2))
    block("steel", L, 0.18, D, at(ID, 0, H + 0.09, -D / 2))


def stalls():
    body(-0.4)
    bay = (L - 0.8) / 3
    for k in range(4):  # piers
        block("steel", 0.4, H, 0.5, at(ID, -L / 2 + 0.2 + k * (bay + 0.4 / 3), H / 2, -0.15))
    for k, up in enumerate((0.0, 0.5, 1.0)):  # shutters: down, half up, open
        x = -L / 2 + 0.4 + bay / 2 + k * (bay + 0.4 / 3)
        if up > 0:
            block("shopwall", bay - 0.1, 3.3, 0.05, at(ID, x, 1.65, -0.42))
        drop = 3.3 * (1 - up)
        if drop > 0:
            block("sheet", bay - 0.1, drop, 0.08, at(ID, x, 3.3 - drop / 2, -0.3))
        block("steel", bay - 0.05, 0.4, 0.45, at(ID, x, 3.5, -0.15))  # shutter drum
        block("hazard", bay - 0.1, 0.1, 0.06, at(ID, x, 3.3 - drop, -0.24), True)
    block("steel", L - 0.4, 0.15, 1.3, at(ID, 0, 3.85, 0.6))  # flat overhang
    block("graphite", L - 0.4, 0.3, 0.08, at(ID, 0, 3.8, 1.25))
    for x in (-5.0, 0.0, 5.0):
        bar("steel", (x, 3.0, 0.05), (x, 3.78, 1.1), 0.1, 0.1, math.pi / 2, True)
    block("dark", 3.0, 0.5, 0.06, at(ID, 2.4, 4.2, 0.03))
    screen("sign", 2.8, 0.38, at(ID, 2.4, 4.2, 0.07))
    block("titanium", 1.0, 0.6, 0.7, at(ID, -4.0, H + 0.48, -1.2))  # AC unit


def counter():
    body(-0.3)
    block("shopwall", 8.0, 2.0, 0.05, at(ID, -1.0, 2.3, -0.32))  # the open kitchen behind
    block("graphite", 8.4, 1.1, 0.3, at(ID, -1.0, 0.55, -0.1))  # counter front
    block("steel", 8.6, 0.1, 0.7, at(ID, -1.0, 1.12, 0.2))  # counter top
    block("dark", 8.2, 0.06, 0.06, at(ID, -1.0, 1.0, 0.56), True)
    for x in (-4.4, -2.6, -0.8, 1.0, 2.8):  # stools
        block("steel", 0.06, 0.7, 0.06, at(ID, x, 0.35, 0.9), True)
        block("olive", 0.35, 0.08, 0.35, at(ID, x, 0.72, 0.9), True)
    block("shopwall", 3.2, 3.2, 0.05, at(ID, 5.2, 1.6, -0.32))  # the door side, glazed
    block("steel", 0.3, 3.4, 0.4, at(ID, 3.4, 1.7, -0.1))
    awning = pitch(at(ID, -1.0, 3.55, 0.8), -0.28)
    block("olive", 9.0, 0.1, 1.8, awning)
    block("dark", 9.0, 0.25, 0.06, at(ID, -1.0, 3.2, 1.65))
    block("dark", 1.6, 0.9, 0.08, at(ID, 5.2, 3.75, 0.04))
    screen("glow_amber", 1.4, 0.75, at(ID, 5.2, 3.75, 0.09))  # menu
    tube("titanium", (-5.8, 3.0, -0.05), (-5.8, H + 0.6, -0.05), 0.28, False, 8)  # exhaust duct
    tube("titanium", (-5.8, H + 0.6, -0.05), (-5.8, H + 0.6, -1.6), 0.28, False, 8)
    block("steel", 0.8, 0.3, 0.8, at(ID, -5.8, H + 0.6, -1.9))
    block("titanium", 1.2, 0.7, 0.8, at(ID, 1.5, H + 0.53, -1.5))  # AC unit
    for x in (-3.0, 1.2):
        block("lamp", 0.4, 0.06, 0.2, at(ID, x, 2.95, 0.6), True)


def frame():
    body(-0.35)
    block("shopwall", L - 0.2, 3.4, 0.05, at(ID, 0, 1.75, -0.37))
    block("graphite", L, 0.6, 0.3, at(ID, 0, 0.3, -0.15))  # kick plate
    xs = [-L / 2 + 0.2 + k * (L - 0.4) / 4 for k in range(5)]
    for x in xs:  # exposed steel frame
        block("steel", 0.25, H, 0.3, at(ID, x, H / 2, 0.0))
    block("steel", L, 0.3, 0.3, at(ID, 0, 3.55, 0.0))
    for a, b in zip(xs[1:3], xs[2:4], strict=True):  # braces in two bays, above the doors' height
        tube("steel", (a, 2.4, 0.08), (b, 3.45, 0.08), 0.05, False, 6)
    canopy = pitch(at(ID, 0, 3.75, 0.7), 0.12)
    block("sheet", L - 0.6, 0.1, 1.4, canopy)
    for x in (xs[1], xs[3]):
        tube("steel", (x, H - 0.2, 0.1), (x, 3.85, 1.35), 0.04, True, 6)
    sign = at(ID, 4.3, 4.0, 0.7)  # box sign out from the front, its faces along the street
    block("dark", 0.3, 0.9, 1.2, sign)
    for s in (-1, 1):
        screen(
            "sign",
            1.05,
            0.75,
            sign @ Matrix.Translation((s * 0.16, 0, 0)) @ Matrix.Rotation(s * math.pi / 2, 4, "Y"),
        )
    tube(
        "dark", (-L / 2 + 0.3, H - 0.3, 0.2), (L / 2 - 0.3, H - 0.3, 0.2), 0.07, False, 6
    )  # cables


def arcade():
    back = -1.4
    block("graphite", L, H, D + back, at(ID, 0, H / 2, (back - D) / 2))  # the shop, set back
    block("shopwall", L - 0.2, 3.3, 0.05, at(ID, 0, 1.65, back - 0.01))
    block("steel", L, 0.18, D, at(ID, 0, H + 0.09, -D / 2))
    block("graphite", L, H - 3.4, -back, at(ID, 0, 3.4 + (H - 3.4) / 2, back / 2))  # over the walk
    for k in range(5):  # colonnade
        x = -L / 2 + 0.35 + k * (L - 0.7) / 4
        block("graphite", 0.55, 3.4, 0.55, at(ID, x, 1.7, -0.3))
        block("hazard", 0.58, 0.25, 0.58, at(ID, x, 0.3, -0.3), True)
    for x in (-5.2, -1.7, 1.7, 5.2):
        block("lamp", 0.5, 0.05, 0.25, at(ID, x, 3.37, back / 2))
    block("steel", L, 0.35, 0.12, at(ID, 0, 3.55, 0.03))  # the beam's face
    for x, role in ((-3.5, "glow_cyan"), (3.5, "glow_amber")):
        block("dark", 1.3, 0.45, 0.05, at(ID, x, 3.95, 0.02))
        screen(role, 1.15, 0.33, at(ID, x, 3.95, 0.05))
    block("dark", 3.0, 0.45, 0.05, at(ID, 0, 3.95, 0.02))
    screen("sign", 2.8, 0.33, at(ID, 0, 3.95, 0.05))
    block("titanium", 1.4, 0.6, 0.9, at(ID, 3.0, H + 0.48, -1.6))  # AC unit


def build(kind):
    name = "shop_" + kind
    scene = bpy.data.scenes.get(name) or bpy.data.scenes.new(name)
    bpy.context.window.scene = scene
    clear(scene)
    parts.clear()
    globals()[kind]()
    join(scene, name)
    studio(scene)


for kind in KINDS:
    build(kind)
    if globals().get("CITY"):  # the city's copies: .gltf + .bin, loaded by web/src/city.js
        folder = os.path.join(REPO, "web", "assets", "models", "shop_" + kind)  # noqa: F821
        print(kit.export("shop_" + kind, folder, "GLTF_SEPARATE"))
