"""Build the modules of an enclosed industrial skybridge between two towers, in Blender (an
original design).

In Blender: REPO = r"<repo root>"; exec(open(REPO + "/tools/blender/skybridge.py").read())
Builds each module into its own scene (with a studio for review renders). CITY = True before exec
writes the city's copies (web/assets/models/skybridge_<module>).

The renderer (web/src/city.js skybridges) lines the modules up along x across a main street, at a
floor of both towers: a span is whole bays, stretched a little to fit, between an end portal at
each tower face. Corridor floor on y = 0, centred on z = 0.
- bay: a 4 m length of corridor: a heavy steel frame ring at its -x end, graphite wall panels,
  a roof of corrugated steel, an exposed truss under the floor, two utility pipes and a cable
  tray along the outside;
- window: the same bay with a small lit window in each side;
- end: the portal at a tower face (the tower is on its -x side): a deeper collar with a hazard
  edge, a doorway, a service hatch, and two raking struts down to brackets on the facade.
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
kit.ROLES.setdefault("sheet", (0x2F3648, 0.4, 0.6, None, 0, 1, "rust"))  # corrugated steel
from kit import at, block, clear, join, parts, studio, tube  # noqa: E402

BAY, W, HT = 4.0, 3.6, 3.0  # bay length, corridor width and height (outside)
ID = Matrix()


def ring(x, grow=0.0, role="steel"):
    """A frame ring round the corridor's section at x."""
    w, h, t = W + grow, HT + grow, 0.32
    block(role, t, t, w + t, at(ID, x, -grow / 2, 0))
    block(role, t, t, w + t, at(ID, x, h - grow / 2, 0))
    for s in (-1, 1):
        block(role, t, h, t, at(ID, x, h / 2 - grow / 2, s * w / 2))


def corridor(window):
    x0, x1 = -BAY / 2, BAY / 2
    block("steel", BAY, 0.3, W, at(ID, 0, 0.15, 0))  # floor slab
    block("sheet", BAY, 0.15, W + 0.3, at(ID, 0, HT + 0.07, 0))  # roof
    for s in (-1, 1):  # wall panels, one with a small window
        z = s * (W / 2 - 0.05)
        if window:
            block("graphite", BAY, 1.0, 0.12, at(ID, 0, 0.8, z))
            block("graphite", BAY, 1.1, 0.12, at(ID, 0, HT - 0.55, z))
            block("graphite", 1.6, 0.9, 0.12, at(ID, -1.2, 1.75, z))
            block("graphite", 1.0, 0.9, 0.12, at(ID, 1.5, 1.75, z))
            block("interior", 1.4, 0.7, 0.04, at(ID, 0.3, 1.75, z - s * 0.04))
            block("steel", 1.5, 0.08, 0.2, at(ID, 0.3, 1.36, z + s * 0.05))  # sill
        else:
            block("graphite", BAY, HT - 0.4, 0.12, at(ID, 0, HT / 2 + 0.05, z))
        block("olive", BAY - 0.6, 0.6, 0.06, at(ID, 0, 1.0, z + s * 0.08), True)  # cladding plate
    ring(x0)
    for s in (-1, 1):  # truss under the floor: chords and a diagonal
        block("steel", BAY, 0.2, 0.2, at(ID, 0, -1.1, s * (W / 2 - 0.3)))
        tube("steel", (x0, -1.1, s * (W / 2 - 0.3)), (x1, -0.05, s * (W / 2 - 0.3)), 0.08, False, 6)
        block("steel", 0.16, 1.0, 0.16, at(ID, x0, -0.55, s * (W / 2 - 0.3)))
    block("steel", 0.16, 0.16, W - 0.6, at(ID, x0, -1.1, 0))
    z = W / 2 + 0.35  # pipes and a cable tray on the +z side
    tube("titanium", (x0, 0.6, z), (x1, 0.6, z), 0.2, False, 8)
    tube("hazard", (x0, 1.05, z - 0.05), (x1, 1.05, z - 0.05), 0.12, False, 8)
    block("steel", 0.12, 1.3, 0.5, at(ID, x0 + 0.3, 0.8, z - 0.15), True)  # pipe bracket
    block("steel", BAY, 0.12, 0.5, at(ID, 0, HT + 0.25, -0.6))  # cable tray on the roof
    block("dark", BAY, 0.12, 0.3, at(ID, 0, HT + 0.36, -0.6), True)


def end():
    """The portal at a tower face, the tower on -x: the collar, buried 1.5 m into the tower."""
    block("graphite", 2.3, HT + 0.8, W + 0.8, at(ID, -0.35, HT / 2, 0))  # collar
    ring(0.9, 0.8)
    ring(-1.3, 0.8)  # flush with the tower face, a little inside
    for s in (-1, 1):
        block("hazard", 2.3, 0.2, 0.05, at(ID, -0.35, HT + 0.32, s * (W / 2 + 0.42)), True)
        block("dark", 1.0, 1.2, 0.05, at(ID, 0.2, 1.4, s * (W / 2 + 0.42)))  # service hatch
        block("glow_amber", 0.16, 0.1, 0.03, at(ID, 0.55, 2.2, s * (W / 2 + 0.44)), True)
        # raking struts from under the collar down to a bracket on the facade
        tube(
            "steel", (0.6, -0.2, s * (W / 2 - 0.2)), (-0.9, -4.5, s * (W / 2 - 0.2)), 0.14, False, 8
        )
        block("steel", 0.4, 0.8, 0.8, at(ID, -1.0, -4.6, s * (W / 2 - 0.2)))
    block("steel", 2.3, 0.4, W + 0.8, at(ID, -0.35, -0.3, 0))  # collar floor
    block("dark", 0.06, 2.3, 1.6, at(ID, 1.06, 1.2, 0))  # the doorway, seen down the corridor
    block("lamp", 0.1, 0.12, 1.2, at(ID, 1.1, 2.5, 0), True)
    tube("titanium", (1.2, 0.6, W / 2 + 0.35), (-1.3, 0.6, W / 2 + 0.35), 0.2, False, 8)
    tube("titanium", (-0.4, 0.6, W / 2 + 0.35), (-0.4, -2.5, W / 2 + 0.35), 0.2, False, 8)  # riser


MODULES = {"bay": lambda: corridor(False), "window": lambda: corridor(True), "end": end}

for module, make in MODULES.items():
    name = "skybridge_" + module
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
