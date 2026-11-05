"""Build hologram projectors for roofs and tower walls, in Blender (original designs).

In Blender: REPO = r"<repo root>"; exec(open(REPO + "/tools/blender/holo_projectors.py").read())
Builds each module into its own scene "holo_<kind>" (with a studio for review renders).
CITY = True before exec writes the city's copies (web/assets/models/holo_<kind>).

The ad is not on a panel: it is light, projected into the air from a piece of industrial hardware.
Three roles carry it, all drawn by the renderer's hologram shader (web/src/materials.js hologram):
"holo", the floating image (UVs 0..1 across it); "beam", the fans of light from the lens to the
image (u across, v from the lens, 0, to the image, 1); "lens", the emitter's glowing slot. The
rest is the projector itself, in dark weathered steel:
- roof: a long emitter housing on a plinth with cooling fins and two angled side heads, throwing
  an 8 x 4.5 m image that floats above the roof, a conduit to a junction box, a red status light;
- wall: an emitter head on a braced arm out from the wall (the plane z = 0, facing +z, y = 0 at the
  head), throwing a 3.6 x 6 m image upward that floats 2.4 m out from the facade.
Conventions: tools/blender/kit.py.
"""

import importlib
import os
import sys

import bmesh
import bpy
from mathutils import Matrix

sys.path.insert(0, os.path.join(REPO, "tools", "blender"))  # noqa: F821
import kit  # noqa: E402

importlib.reload(kit)  # Blender keeps modules between runs
kit.ROLES.setdefault("holo", (0x0B0F17, 0.0, 0.4, 0x8CCAD2, 1.5, 0.6, None))
kit.ROLES.setdefault("beam", (0x0B0F17, 0.0, 0.4, 0x8CCAD2, 0.6, 0.25, None))
kit.ROLES.setdefault("lens", (0x8CCAD2, 0.0, 0.3, 0xC8F0FF, 4.0, 1, None))
from kit import add, at, block, clear, join, parts, studio, tube  # noqa: E402

ID = Matrix()


def quad(role, pts, uvs=((0, 0), (1, 0), (1, 1), (0, 1))):
    """One face through four points (three.js coordinates) with the given UVs, for the shader."""
    bm = bmesh.new()
    uv = bm.loops.layers.uv.verify()
    f = bm.faces.new([bm.verts.new(p) for p in pts])
    for loop, (u, v) in zip(f.loops, uvs, strict=True):
        loop[uv].uv = (u, 1 - v)  # glTF export flips v
    return add(bm, role, ID, False, project=False)


def fan(x0, x1, y0, z0, w1, y1, z1, tilt=0.0):
    """A fan of light from a lens slot (x0..x1 at height y0, depth z0) to an image edge w1 wide at
    (y1, z1); tilt leans it front or back for some volume."""
    quad(
        "beam",
        [(x0, y0, z0), (x1, y0, z0), (w1 / 2, y1, z1 + tilt), (-w1 / 2, y1, z1 + tilt)],
    )


def roof():
    w, h, y0 = 8.0, 4.5, 3.4  # the image, and its bottom edge above the roof
    block("panel", 3.4, 0.5, 1.6, at(ID, 0, 0.25, 0))  # plinth
    block("graphite", 2.8, 0.35, 1.1, at(ID, 0, 0.67, 0))  # emitter housing
    block("lens", 2.4, 0.06, 0.18, at(ID, 0, 0.87, 0))
    for k in range(9):  # cooling fins along the housing
        block("steel", 0.05, 0.3, 1.25, at(ID, -1.3 + k * 0.325, 0.67, 0), True)
    for s in (-1, 1):  # two side heads, angled in, for the image's ends
        head = at(Matrix.Rotation(-s * 0.35, 4, "Z"), s * 1.55, 0.75, 0)
        block("graphite", 0.5, 0.45, 0.7, head)
        block("lens", 0.08, 0.3, 0.5, head @ Matrix.Translation((-s * 0.27, 0, 0)), True)
        block("olive", 0.6, 0.6, 0.4, at(ID, s * 1.4, 0.3, 0.95), True)  # power units
    tube("dark", (1.7, 0.2, -0.6), (2.6, 0.05, -1.4), 0.08, True, 6)  # conduit to the roof
    block("olive", 0.5, 0.7, 0.35, at(ID, 2.8, 0.35, -1.5))
    block("red", 0.12, 0.12, 0.12, at(ID, -1.6, 0.6, 0.82), True)
    quad("holo", [(-w / 2, y0, 0), (w / 2, y0, 0), (w / 2, y0 + h, 0), (-w / 2, y0 + h, 0)])
    for tilt in (-0.25, 0.25):
        fan(-1.2, 1.2, 0.9, 0.0, w, y0, 0.0, tilt)


def wall():
    w, h, z, y0 = 3.6, 6.0, 2.4, 1.0  # the image, its distance out from the wall, its bottom edge
    for y in (-0.15, 0.15):  # braced arm out from the wall
        block("steel", 0.18, 0.18, z, at(ID, 0, y, z / 2))
    tube("steel", (0, -1.4, 0.05), (0, -0.15, z * 0.7), 0.06, False, 6)
    block("graphite", 0.9, 0.9, 0.08, at(ID, 0, 0, 0.04))  # wall plate
    for x in (-0.3, 0.3):
        block("graphite", 0.2, 0.6, 0.06, at(ID, x, -1.4, 0.03), True)
    block("graphite", 1.1, 0.5, 0.7, at(ID, 0, 0.1, z))  # emitter head
    block("lens", 0.8, 0.05, 0.16, at(ID, 0, 0.37, z))
    for k in range(5):
        block("steel", 0.04, 0.4, 0.75, at(ID, -0.44 + k * 0.22, 0.1, z), True)
    block("red", 0.1, 0.1, 0.1, at(ID, 0.5, 0.35, z + 0.36), True)
    tube("dark", (0.35, 0, 0.1), (0.35, -3.0, 0.1), 0.05, True, 6)  # cable down the wall
    quad("holo", [(-w / 2, y0, z), (w / 2, y0, z), (w / 2, y0 + h, z), (-w / 2, y0 + h, z)])
    for tilt in (-0.2, 0.2):
        fan(-0.4, 0.4, 0.4, z, w, y0, z, tilt)


MODULES = {"roof": roof, "wall": wall}

for kind, make in MODULES.items():
    name = "holo_" + kind
    scene = bpy.data.scenes.get(name) or bpy.data.scenes.new(name)
    bpy.context.window.scene = scene
    clear(scene)
    parts.clear()
    make()
    join(scene, name)
    studio(scene)
    print(name, kit.stats(name))
    if globals().get("CITY"):  # the city's copies: .gltf + .bin, loaded by web/src/tiles.js
        folder = os.path.join(REPO, "web", "assets", "models", name)  # noqa: F821
        print(kit.export(name, folder, "GLTF_SEPARATE"))
