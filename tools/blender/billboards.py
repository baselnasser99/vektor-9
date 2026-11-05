"""Build a modular kit of cyberpunk billboards for tower walls, in Blender (original designs).

In Blender: REPO = r"<repo root>"; exec(open(REPO + "/tools/blender/billboards.py").read())
Builds each module into its own scene "billboard_<kind>" (with a studio for review renders).
CITY = True before exec writes the city's copies (web/assets/models/billboard_<kind>).

Each module hangs on a wall: the wall is the plane z = 0, the sign faces +z (the street), y = 0 is
its lowest point. The display is a blank panel ("ad", UVs 0..1 across it) the renderer fills
with an advertisement (web/src/textures.js posterTexture); the rest is the industrial frame that
carries it, in dark steel, so it reads as heavy equipment bolted to the building:
- tower: a tall vertical display (3 x 12 m) in a box-section frame on a standoff truss with wall
  brackets, a caged ladder up one side, a service platform at its foot, a lamp hood on top;
- wide: a landscape display (6 x 3.4 m) in two halves on raking brackets over a catwalk with
  a railing, two spotlights on arms, a cable riser;
- blade: a double-sided vertical display (1.4 x 7 m) sticking straight out from the wall on two
  bracket arms, its edges capped, a red beacon on top.
Light: the display itself, small amber lamps, a red indicator. Same conventions as the other
models (tools/blender/kit.py).
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
kit.ROLES.setdefault("ad2", kit.ROLES["ad"])  # the wide board's second display
from kit import at, block, clear, join, parts, rail, screen, studio, tube  # noqa: E402

ID = Matrix()


def frame(w, h, z, t=0.3):
    """A box-section frame round a w x h display whose face is at z, with corner gussets."""
    for y in (0.0, h):
        block("steel", w + 2 * t, t, t + 0.1, at(ID, 0, y, z - 0.05))
    for s in (-1, 1):
        block("steel", t, h, t + 0.1, at(ID, s * (w + t) / 2, h / 2, z - 0.05))
        for y in (0.0, h):
            block(
                "graphite",
                0.5,
                0.5,
                0.08,
                at(ID, s * (w / 2 - 0.15), y + (0.3 if y == 0 else -0.3), z + 0.06),
                True,
            )
    block("dark", w, h, 0.2, at(ID, 0, h / 2, z - 0.15))  # the display's back box


def tower():
    w, h, z = 3.0, 12.0, 1.0
    frame(w, h, z)
    screen("ad", w, h, at(ID, 0, h / 2, z + 0.01))
    for s in (-1, 1):  # standoff truss: two posts, wall brackets, cross ties
        x = s * (w / 2 - 0.3)
        block("steel", 0.25, h + 0.6, 0.25, at(ID, x, h / 2, 0.45))
        for y in (0.6, h / 2, h - 0.6):
            block("steel", 0.2, 0.2, 0.9, at(ID, x, y, 0.45))
            block("graphite", 0.6, 0.6, 0.08, at(ID, x, y, 0.04))  # bracket plate on the wall
        for k in range(4):  # zig-zag ties between post and frame
            y0, y1 = 0.6 + k * (h - 1.2) / 4, 0.6 + (k + 1) * (h - 1.2) / 4
            tube("steel", (x, y0, 0.45), (x, y1, z - 0.2), 0.05, True, 6)
    tube("steel", (-w / 2 + 0.3, 1.5, 0.45), (w / 2 - 0.3, h - 1.5, 0.45), 0.06, True, 6)
    xl = w / 2 + 0.55  # caged ladder up the +x side
    for s in (-0.22, 0.22):
        block("steel", 0.06, h, 0.06, at(ID, xl + s, h / 2, 0.6))
    for k in range(int(h / 0.6)):
        block("steel", 0.5, 0.04, 0.04, at(ID, xl, 0.3 + k * 0.6, 0.6), True)
    for k in range(int((h - 2.5) / 1.5) + 1):
        y = 2.5 + k * 1.5
        tube("steel", (xl - 0.35, y, 0.6), (xl, y, 1.05), 0.03, True, 4)
        tube("steel", (xl, y, 1.05), (xl + 0.35, y, 0.6), 0.03, True, 4)
    block("steel", w + 1.8, 0.12, 1.6, at(ID, 0.4, -0.25, 0.8))  # service platform at the foot
    rail("steel", [(-w / 2 - 0.4, -0.2, 1.55), (w / 2 + 1.2, -0.2, 1.55)])
    for s in (-1, 1):
        tube(
            "steel",
            (s * (w / 2 - 0.3), -0.25, 0.1),
            (s * (w / 2 - 0.3), -1.6, 0.05),
            0.08,
            False,
            6,
        )
    block("graphite", w + 0.8, 0.3, 1.2, at(ID, 0, h + 0.35, z + 0.3))  # lamp hood
    for x in (-0.9, 0.9):
        block("lamp", 0.5, 0.06, 0.3, at(ID, x, h + 0.17, z + 0.7))
    block("red", 0.12, 0.12, 0.12, at(ID, -w / 2 - 0.2, h + 0.6, z), True)
    block("olive", 0.6, 0.8, 0.35, at(ID, -w / 2 - 0.5, 1.0, 0.2))  # junction box
    tube("dark", (-w / 2 - 0.5, 1.4, 0.2), (-w / 2 - 0.5, h, 0.2), 0.06, False, 6)


def wide():
    w, h, z, y0 = 6.0, 3.4, 1.4, 1.2
    m = at(ID, 0, y0, 0)
    for y in (0.0, h):  # frame
        block("steel", w + 0.6, 0.3, 0.4, m @ Matrix.Translation((0, y, z - 0.05)))
    for x in (-(w + 0.3) / 2, 0, (w + 0.3) / 2):
        block("steel", 0.3, h, 0.4, m @ Matrix.Translation((x, h / 2, z - 0.05)))
    block("dark", w, h, 0.2, m @ Matrix.Translation((0, h / 2, z - 0.2)))
    screen("ad", w / 2 - 0.15, h - 0.1, m @ Matrix.Translation((-w / 4 - 0.05, h / 2, z + 0.16)))
    screen("ad2", w / 2 - 0.15, h - 0.1, m @ Matrix.Translation((w / 4 + 0.05, h / 2, z + 0.16)))
    for x in (-2.4, -0.8, 0.8, 2.4):  # raking brackets from the wall
        block("graphite", 0.6, 0.9, 0.08, at(ID, x, y0 + 0.6, 0.04))
        tube("steel", (x, y0 + 0.6, 0.05), (x, y0 + 0.2, z - 0.2), 0.08, False, 6)
        tube("steel", (x, y0 + h - 0.4, 0.05), (x, y0 + h, z - 0.2), 0.08, False, 6)
        tube("steel", (x, y0 + 0.6, 0.05), (x, y0 + h, z - 0.2), 0.05, True, 6)
    block("steel", w + 1.0, 0.12, 1.3, at(ID, 0, 0.6, z + 0.2))  # catwalk
    rail("steel", [(-w / 2 - 0.4, 0.62, z + 0.8), (w / 2 + 0.4, 0.62, z + 0.8)])
    for x in (-w / 2, w / 2):
        tube("steel", (x, 0.6, z + 0.8), (x, 0.0, 0.05), 0.07, False, 6)
    for s in (-1, 1):  # spotlights on arms over the top
        x = s * 1.8
        tube("steel", (x, y0 + h + 0.15, z), (x, y0 + h + 0.9, z + 1.3), 0.05, False, 6)
        block("graphite", 0.45, 0.3, 0.4, tilt(at(ID, x, y0 + h + 0.9, z + 1.35), 0.6))
        block("lamp", 0.35, 0.04, 0.3, tilt(at(ID, x, y0 + h + 0.74, z + 1.4), 0.6))
    tube("dark", (w / 2 + 0.6, 0.0, 0.2), (w / 2 + 0.6, y0 + h, 0.2), 0.07, False, 6)
    block("olive", 0.5, 0.7, 0.3, at(ID, w / 2 + 0.6, 1.6, 0.2))
    block("red", 0.08, 0.08, 0.04, at(ID, w / 2 + 0.6, 1.8, 0.37), True)


def tilt(m, a):
    """m tipped by a about local x (positive faces it down toward +z)."""
    return m @ Matrix.Rotation(a, 4, "X")


def blade():
    d, h, t = 1.4, 7.0, 0.35  # out from the wall, tall, thick
    z = 0.9 + d / 2  # its centre, clear of the wall
    block("dark", t, h, d, at(ID, 0, h / 2, z))
    for s in (-1, 1):
        screen(
            "ad",
            d - 0.1,
            h - 0.2,
            at(Matrix.Rotation(s * math.pi / 2, 4, "Y"), s * (t / 2 + 0.01), h / 2, z),
        )
    block("steel", t + 0.12, h + 0.2, 0.18, at(ID, 0, h / 2, z + d / 2 + 0.05))  # outer edge cap
    block("steel", t + 0.12, 0.2, d + 0.2, at(ID, 0, h + 0.05, z))
    block("steel", t + 0.12, 0.2, d + 0.2, at(ID, 0, -0.05, z))
    for y in (0.8, h - 0.8):  # bracket arms to the wall
        block("steel", 0.25, 0.3, 1.0, at(ID, 0, y, 0.5))
        block("graphite", 0.7, 0.8, 0.08, at(ID, 0, y, 0.04))
        tube("steel", (0, y - 0.9, 0.05), (0, y - 0.15, 0.95), 0.05, False, 6)
    block("red", 0.14, 0.14, 0.14, at(ID, 0, h + 0.25, z + d / 2 - 0.1), True)
    tube("dark", (0.25, 0.8, 0.1), (0.25, h - 0.8, 0.1), 0.05, False, 6)


MODULES = {"tower": tower, "wide": wide, "blade": blade}

for kind, make in MODULES.items():
    name = "billboard_" + kind
    scene = bpy.data.scenes.get(name) or bpy.data.scenes.new(name)
    bpy.context.window.scene = scene
    clear(scene)
    parts.clear()
    make()
    join(scene, name)
    studio(scene)
    if globals().get("CITY"):  # the city's copies: .gltf + .bin, loaded by web/src/city.js
        folder = os.path.join(REPO, "web", "assets", "models", name)  # noqa: F821
        print(kit.export(name, folder, "GLTF_SEPARATE"))
