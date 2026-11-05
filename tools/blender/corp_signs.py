"""Build a modular kit of large corporate signs for tower walls, in Blender (original designs).

In Blender: REPO = r"<repo root>"; exec(open(REPO + "/tools/blender/corp_signs.py").read())
Builds each module into its own scene "corp_<kind>" (with a studio for review renders).
CITY = True before exec writes the city's copies (web/assets/models/corp_<kind>).

Each module hangs on a wall: the wall is the plane z = 0, the sign faces +z (the street), y = 0 is
the height it is placed at (the roof line for the crown). Two blank panels carry the renderer's
textures: "face" (UVs 0..1, the corporation's dark red mark and cold-white name, web/src/textures.js
corpTexture) and "info" (a muted amber dot-matrix display, messageTexture). The rest is heavy,
weathered equipment bolted to the building, so the signs read as corporate infrastructure, not
entertainment:
- pylon: a tall vertical sign (3.6 x 15 m) with an info display under it, in a box-section frame
  on a standoff truss with wall brackets, a caged service ladder, a lamp hood, a cable riser;
- band: a long fascia (9 x 2.6 m) across a wall at mid height, on raking brackets, with a low
  info strip in its own housing, vent boxes on its ends and a lamp hood;
- crown: a sign (8 x 4 m) standing on the roof line on four legs bracketed down the wall, with
  truss bracing behind, a catwalk, an info strip and red aviation lamps on its top corners.
Light: the two displays, small amber lamps, red indicators. Conventions: tools/blender/kit.py.
"""

import importlib
import os
import sys

import bpy
from mathutils import Matrix

sys.path.insert(0, os.path.join(REPO, "tools", "blender"))  # noqa: F821
import kit  # noqa: E402

importlib.reload(kit)  # Blender keeps modules between runs
kit.ROLES.setdefault("face", kit.ROLES["ad"])
kit.ROLES.setdefault("info", (0x0B0F17, 0.0, 0.4, 0xE09A45, 1.6, 1, None))
from kit import at, block, clear, join, parts, rail, screen, studio, tube  # noqa: E402

ID = Matrix()


def frame(w, h, y0, z, t=0.3):
    """A box-section frame round a w x h display whose face is at z from y0, with bolted corner
    plates and a weathered panel back box with service seams."""
    for y in (y0, y0 + h):
        block("steel", w + 2 * t, t, t + 0.15, at(ID, 0, y, z - 0.05))
    for s in (-1, 1):
        block("steel", t, h, t + 0.15, at(ID, s * (w + t) / 2, y0 + h / 2, z - 0.05))
        for y in (y0 + 0.3, y0 + h - 0.3):
            block("graphite", 0.5, 0.5, 0.08, at(ID, s * (w / 2 - 0.1), y, z + 0.08), True)
    block("panel", w + 0.2, h + 0.2, 0.5, at(ID, 0, y0 + h / 2, z - 0.35))  # the electronics box
    for k in range(1, max(2, int(h / 2.5))):  # seams round the box's sides
        block(
            "dark",
            w + 0.24,
            0.06,
            0.4,
            at(ID, 0, y0 + k * h / max(2, int(h / 2.5)), z - 0.35),
            True,
        )


def hood(w, y, z, lamps=2):
    """A lamp hood over a display's top edge at y, its lamps lighting the face from above."""
    block("graphite", w + 0.8, 0.3, 1.0, at(ID, 0, y + 0.35, z + 0.25))
    for k in range(lamps):
        x = (k - (lamps - 1) / 2) * (w / lamps)
        block("lamp", 0.5, 0.06, 0.25, at(ID, x, y + 0.18, z + 0.6))


def bracket(x, y, depth):
    """A wall bracket: a plate on the wall and an arm out to the frame."""
    block("graphite", 0.7, 0.7, 0.08, at(ID, x, y, 0.04))
    block("steel", 0.25, 0.25, depth, at(ID, x, y, depth / 2))


def riser(x, y0, y1):
    """A cable riser up the wall with a junction box at its foot and a red status light."""
    tube("dark", (x, y0 + 0.8, 0.22), (x, y1, 0.22), 0.07, False, 6)
    block("olive", 0.6, 0.8, 0.35, at(ID, x, y0 + 0.4, 0.2))
    block("red", 0.1, 0.1, 0.05, at(ID, x + 0.15, y0 + 0.65, 0.4), True)


def pylon():
    w, z, info, h = 3.6, 1.1, 1.6, 15.0
    y0 = info + 0.6  # the face starts above the info display
    frame(w, info, 0.3, z)
    screen("info", w, info, at(ID, 0, 0.3 + info / 2, z + 0.02))
    frame(w, h, y0, z)
    screen("face", w, h, at(ID, 0, y0 + h / 2, z + 0.02))
    top = y0 + h
    for s in (-1, 1):  # standoff truss: two posts, brackets, zig-zag ties
        x = s * (w / 2 - 0.4)
        block("steel", 0.28, top, 0.28, at(ID, x, top / 2, 0.5))
        for y in (0.8, top * 0.35, top * 0.65, top - 0.8):
            bracket(x, y, 0.8)
        for k in range(5):
            ya, yb = 0.8 + k * (top - 1.6) / 5, 0.8 + (k + 1) * (top - 1.6) / 5
            tube("steel", (x, ya, 0.5), (x, yb, z - 0.6), 0.05, True, 6)
    hood(w, top, z)
    block("red", 0.14, 0.14, 0.14, at(ID, w / 2 + 0.1, top + 0.65, z), True)
    xl = -w / 2 - 0.55  # caged service ladder up the -x side
    for s in (-0.22, 0.22):
        block("steel", 0.06, top, 0.06, at(ID, xl + s, top / 2, 0.7), True)
    for k in range(int(top / 0.6)):
        block("steel", 0.5, 0.04, 0.04, at(ID, xl, 0.3 + k * 0.6, 0.7), True)
    for k in range(int((top - 2.5) / 1.5) + 1):
        y = 2.5 + k * 1.5
        tube("steel", (xl - 0.35, y, 0.7), (xl, y, 1.15), 0.03, True, 4)
        tube("steel", (xl, y, 1.15), (xl + 0.35, y, 0.7), 0.03, True, 4)
    riser(w / 2 + 0.6, 0.0, top)


def band():
    w, z, info = 9.0, 1.2, 0.8
    y0 = info + 0.5
    h = 2.6
    frame(w, h, y0, z)
    screen("face", w, h, at(ID, 0, y0 + h / 2, z + 0.02))
    block("panel", w * 0.6 + 0.3, info + 0.3, 0.6, at(ID, -w * 0.2, info / 2, z - 0.25))
    screen("info", w * 0.6, info, at(ID, -w * 0.2, info / 2 + 0.05, z + 0.06))
    for x in (-3.0, 0.0, 3.0):  # raking brackets from the wall
        bracket(x, y0 + h - 0.4, z - 0.1)
        tube("steel", (x, y0 - 0.3, 0.05), (x, y0 + 0.3, z - 0.3), 0.08, False, 6)
    for s in (-1, 1):  # titanium end caps with vent boxes and a red end light
        block("titanium", 0.4, h + 0.8, 1.0, at(ID, s * (w / 2 + 0.5), y0 + h / 2, z - 0.1))
        block("dark", 0.5, 0.9, 0.8, at(ID, s * (w / 2 + 0.6), y0 + 0.8, z - 0.1), True)
        for k in range(4):
            block(
                "steel",
                0.55,
                0.05,
                0.85,
                at(ID, s * (w / 2 + 0.6), y0 + 0.45 + k * 0.22, z - 0.1),
                True,
            )
        block("red", 0.14, 0.14, 0.14, at(ID, s * (w / 2 + 0.5), y0 + h + 0.55, z + 0.2), True)
    hood(w, y0 + h, z, 4)
    riser(w / 2 + 1.2, -2.0, y0 + h)


def crown():
    w, h, z, info = 8.0, 4.0, 1.0, 1.0
    y0, low = 2.4, 4.0  # face above the roof line; legs bracketed this far down the wall
    frame(w, h, y0, z)
    screen("face", w, h, at(ID, 0, y0 + h / 2, z + 0.02))
    frame(w * 0.7, info, 0.9, z, 0.2)
    screen("info", w * 0.7, info, at(ID, 0, 0.9 + info / 2, z + 0.02))
    top = y0 + h
    for x in (
        -w / 2 + 0.3,
        -w / 6,
        w / 6,
        w / 2 - 0.3,
    ):  # legs: down the wall, up behind
        block("steel", 0.35, top + low, 0.35, at(ID, x, (top - low) / 2, 0.45))
        for y in (-low + 0.5, -low / 2):
            bracket(x, y, 0.6)
        tube("steel", (x, 0.2, 0.45), (x, top - 0.4, z - 0.5), 0.06, True, 6)
    for k in range(3):  # cross bracing between the legs
        xa, xb = -w / 2 + 0.3 + k * (w - 0.6) / 3, -w / 2 + 0.3 + (k + 1) * (w - 0.6) / 3
        tube("steel", (xa, 0.4, 0.45), (xb, top - 0.4, 0.45), 0.06, True, 6)
    block("steel", w + 1.0, 0.12, 1.2, at(ID, 0, 0.3, z + 0.1))  # catwalk along the foot
    rail("steel", [(-w / 2 - 0.4, 0.32, z + 0.65), (w / 2 + 0.4, 0.32, z + 0.65)])
    hood(w, top, z, 3)
    for s in (-1, 1):  # aviation lamps on the top corners
        block("red", 0.3, 0.3, 0.3, at(ID, s * (w / 2 + 0.2), top + 0.7, z))
    riser(w / 2 + 0.8, -low, 0.0)


MODULES = {"pylon": pylon, "band": band, "crown": crown}

for kind, make in MODULES.items():
    name = "corp_" + kind
    scene = bpy.data.scenes.get(name) or bpy.data.scenes.new(name)
    bpy.context.window.scene = scene
    clear(scene)
    parts.clear()
    make()
    join(scene, name)
    studio(scene)
    print(name, kit.stats(name))
    if globals().get("CITY"):  # the city's copies: .gltf + .bin, loaded by web/src/city.js
        folder = os.path.join(REPO, "web", "assets", "models", name)  # noqa: F821
        print(kit.export(name, folder, "GLTF_SEPARATE"))
