"""Build a small kit of cyberpunk street props for the sidewalks, in Blender (original designs).

In Blender: REPO = r"<repo root>"; exec(open(REPO + "/tools/blender/street_props.py").read())
Builds each prop into its own scene "prop_<kind>" (with a studio for review renders). CITY = True
before exec writes the city's copies (web/assets/models/prop_<kind>).

Each stands on y = 0 with its footprint centred on the origin and its front toward +z (the
renderer, web/src/city.js streetProps, turns that to face the walkway, or the traffic for the
sign). Functional, industrial and low-poly (a hundred or two triangles each), with restrained
light: small screens, status lights, a red indicator.
- vending: a freestanding machine, a lit product window, a screen, slots and a dispenser;
- sign: an electronic traffic sign on a pole, its panel ("panel", UVs 0..1) drawn by the renderer
  as an amber dot-matrix message, a sensor box and a base cabinet;
- cabinet: an electrical cabinet on a plinth, two doors, vents, status lights, a hazard label;
- camera: a pole with two security cameras on an arm and a dome under it;
- locker: a bank of delivery lockers with a terminal screen under a hood;
- utility: a compact utility pedestal between two bollards, with a charging socket.
Same conventions as the other models (tools/blender/kit.py).
"""

import importlib
import os
import sys

import bpy
from mathutils import Matrix

sys.path.insert(0, os.path.join(REPO, "tools", "blender"))  # noqa: F821
import kit  # noqa: E402

importlib.reload(kit)  # Blender keeps modules between runs
kit.ROLES.setdefault("panel", kit.ROLES["ad"])  # the traffic sign's message, drawn by the renderer
from kit import at, block, clear, join, parts, screen, studio, tube  # noqa: E402

ID = Matrix()


def vending():
    w, h, d = 1.0, 2.0, 0.8
    block("graphite", w, h, d, at(ID, 0, h / 2, 0))
    block("olive", w + 0.04, 0.12, d + 0.04, at(ID, 0, h + 0.06, 0))  # hood
    block("interior", 0.62, 0.95, 0.02, at(ID, -0.1, 1.3, d / 2 + 0.01))  # product window
    for y in (1.0, 1.3, 1.6):
        block("dark", 0.62, 0.04, 0.03, at(ID, -0.1, y, d / 2 + 0.03), True)
    block("glow_amber", 0.18, 0.24, 0.02, at(ID, 0.34, 1.5, d / 2 + 0.01))  # screen
    block("dark", 0.16, 0.06, 0.03, at(ID, 0.34, 1.2, d / 2 + 0.02))  # card slot
    block("dark", 0.6, 0.22, 0.06, at(ID, -0.1, 0.45, d / 2 + 0.02))  # dispenser
    block("red", 0.04, 0.04, 0.02, at(ID, 0.4, 1.05, d / 2 + 0.01), True)
    block("steel", w + 0.1, 0.1, d + 0.1, at(ID, 0, 0.05, 0))  # plinth


def sign():
    tube("steel", (0, 0, 0), (0, 4.6, 0), 0.08, False, 8)
    block("graphite", 1.5, 0.95, 0.16, at(ID, 0, 4.1, 0.12))  # panel housing
    screen("panel", 1.36, 0.8, at(ID, 0, 4.1, 0.21))
    block("steel", 1.6, 0.08, 0.3, at(ID, 0, 4.62, 0.12))  # visor
    block("graphite", 0.3, 0.2, 0.25, at(ID, 0, 3.4, 0.1))  # sensor box
    block("red", 0.05, 0.05, 0.02, at(ID, 0.1, 3.4, 0.23), True)
    block("olive", 0.36, 0.7, 0.28, at(ID, 0, 0.35, -0.05))  # base cabinet
    block("glow_cyan", 0.08, 0.04, 0.02, at(ID, 0.1, 0.55, 0.1), True)


def cabinet():
    w, h, d = 1.2, 1.5, 0.5
    block("graphite", w + 0.1, 0.12, d + 0.1, at(ID, 0, 0.06, 0))  # plinth
    block("titanium", w, h, d, at(ID, 0, 0.12 + h / 2, 0))
    block("steel", w + 0.06, 0.08, d + 0.08, at(ID, 0, h + 0.16, 0))  # rain cap
    block(
        "dark", 0.02, h - 0.2, 0.02, at(ID, 0, 0.12 + h / 2, d / 2 + 0.005), True
    )  # the doors' seam
    for x in (-0.3, 0.3):
        block("dark", 0.36, 0.2, 0.02, at(ID, x, 1.3, d / 2 + 0.005), True)  # vents
        block("steel", 0.04, 0.16, 0.04, at(ID, x * 0.2, 0.85, d / 2 + 0.02), True)  # handles
    block("hazard", 0.2, 0.2, 0.01, at(ID, -0.3, 0.9, d / 2 + 0.005))  # label
    for k, role in enumerate(("glow_cyan", "glow_cyan", "red")):
        block(role, 0.04, 0.04, 0.02, at(ID, 0.2 + k * 0.08, 1.1, d / 2 + 0.01))


def camera():
    tube("steel", (0, 0, 0), (0, 5.0, 0), 0.07, False, 8)
    block("steel", 0.1, 0.1, 0.9, at(ID, 0, 4.9, 0.42))  # arm
    for x, turn in ((-0.18, 0.4), (0.18, -0.4)):
        m = at(Matrix.Rotation(turn, 4, "Y") @ Matrix.Rotation(0.35, 4, "X"), x, 4.75, 0.85)
        block("graphite", 0.18, 0.18, 0.42, m)
        block("dark", 0.14, 0.14, 0.02, m @ Matrix.Translation((0, 0, 0.21)))
        block("red", 0.03, 0.03, 0.02, m @ Matrix.Translation((0.06, 0.06, 0.21)), True)
    block("graphite", 0.24, 0.14, 0.24, at(ID, 0, 4.0, 0.12))  # dome
    block("dark", 0.18, 0.1, 0.18, at(ID, 0, 3.9, 0.12))
    block("olive", 0.3, 0.5, 0.22, at(ID, 0, 1.4, -0.12))  # junction box


def locker():
    w, h, d = 2.0, 2.0, 0.7
    block("graphite", w, h, d, at(ID, 0, h / 2, 0))
    block("olive", w + 0.1, 0.1, d + 0.2, at(ID, 0, h + 0.05, 0.05))  # hood
    for r in range(4):
        for c in range(3):
            x, y = -0.62 + c * 0.42, 0.35 + r * 0.42
            if c == 2 and r in (1, 2):
                continue
            block(
                "titanium" if (r + c) % 2 else "olive",
                0.38,
                0.38,
                0.03,
                at(ID, x, y, d / 2 + 0.015),
            )
            role = "glow_amber" if (r * 3 + c) % 4 else "red"
            block(role, 0.03, 0.03, 0.02, at(ID, x + 0.13, y + 0.13, d / 2 + 0.04), True)
    block("dark", 0.42, 0.42, 0.02, at(ID, 0.22, 0.98, d / 2 + 0.01))  # terminal recess
    block("glow_cyan", 0.3, 0.24, 0.02, at(ID, 0.22, 1.02, d / 2 + 0.02))
    block("steel", 0.42, 0.42, 0.02, at(ID, 0.75, 1.6, d / 2 + 0.01))  # parcel hatch


def utility():
    block("graphite", 0.7, 1.0, 0.55, at(ID, 0, 0.5, 0))
    block("steel", 0.76, 0.06, 0.6, at(ID, 0, 1.03, 0))
    block("dark", 0.5, 0.25, 0.02, at(ID, 0, 0.75, 0.28), True)  # vent
    block("glow_cyan", 0.12, 0.08, 0.02, at(ID, 0.18, 0.45, 0.28))  # charging socket
    block("dark", 0.14, 0.14, 0.02, at(ID, -0.15, 0.45, 0.28))
    for x in (-0.75, 0.75):  # bollards
        tube("steel", (x, 0, 0.1), (x, 0.9, 0.1), 0.1, False, 8)
        block("hazard", 0.22, 0.12, 0.22, at(ID, x, 0.75, 0.1))


PROPS = {
    "vending": vending,
    "sign": sign,
    "cabinet": cabinet,
    "camera": camera,
    "locker": locker,
    "utility": utility,
}

for kind, make in PROPS.items():
    name = "prop_" + kind
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
