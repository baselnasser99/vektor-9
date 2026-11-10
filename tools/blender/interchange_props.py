"""Build the highway interchange's props in Blender (original designs; ADR-0011).

In Blender: REPO = r"<repo root>"; exec(open(REPO + "/tools/blender/interchange_props.py").read())
Builds each prop into its own scene "ix_<kind>" (with a studio for review renders). CITY = True
before exec writes the city's copies (web/assets/models/ix_<kind>), loaded by
web/src/interchange.js.

Each stands on y = 0 with its footprint centred on the origin and its front toward +z.
Functional and industrial, low-poly, light kept to small amber and cyan points:
- gantry: an overhead sign gantry spanning the 30 m expressway deck (legs at x = +-15.4), two
  dot-matrix panels each way, "panel" facing +z on the +x half and "panel_b" facing -z on the
  -x half (the renderer draws their messages), a maintenance walkway and a cabinet at one leg;
- wall: a 6 m sound-wall panel, 4 m high: concrete plinth, ribbed steel infill, a cap, posts;
- depot: a highway maintenance shed, 12 x 8 m, two roller doors under work lamps, a canopy;
- stock: spare jersey barriers stacked two high, cable drums and a sand bin, about 9 x 4 m;
- monument: the landmark in each loop's pond: a stepped island 8.4 m across and two faceted
  graphite blades, 22 and 16.5 m tall, leaning toward each other across a 1.2 m gap, a
  cold-cyan seam up each inner edge, a titanium tie across the gap with a light under it, a
  steady red lamp on each tip.
Same conventions as the other models (tools/blender/kit.py).
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
kit.ROLES.setdefault("panel_b", kit.ROLES["ad"])  # the outbound message, drawn by the renderer
from kit import at, block, clear, join, lathe, loft, parts, ring, screen, studio, tube  # noqa: E402

ID = Matrix()


def gantry():
    span, h = 15.4, 7.0
    for x in (-span, span):
        block("graphite", 0.9, 0.12, 0.9, at(ID, x, 0.06, 0))  # base plate
        block("graphite", 0.5, h, 0.5, at(ID, x, h / 2, 0))
        block("hazard", 0.52, 0.6, 0.52, at(ID, x, 0.5, 0))  # impact band
    for y in (h - 0.15, h - 1.15):  # the truss's two chords
        for z in (-0.35, 0.35):
            block("steel", 2 * span + 0.5, 0.14, 0.14, at(ID, 0, y, z))
    for k in range(-7, 8):  # verticals, all on the truss (chords end at +-15.65)
        block("steel", 0.08, 1.0, 0.08, at(ID, k * 2.0, h - 0.65, 0.35), True)
        block("steel", 0.08, 1.0, 0.08, at(ID, k * 2.0, h - 0.65, -0.35), True)
    block("steel", 2 * span, 0.05, 1.2, at(ID, 0, h - 1.25, 0.9), True)  # walkway
    for role, face, xs in (("panel", 1, (4.5, 10.5)), ("panel_b", -1, (-4.5, -10.5))):
        for x in xs:
            block("graphite", 5.2, 2.3, 0.3, at(ID, x, h - 2.4, face * 0.55))  # housing
            turn = Matrix.Rotation(0 if face > 0 else math.pi, 4, "Y")
            screen(role, 4.9, 2.0, at(turn, x, h - 2.4, face * 0.71))
            block("steel", 5.4, 0.1, 0.5, at(ID, x, h - 1.2, face * 0.6))  # visor
            block("glow_amber", 0.12, 0.06, 0.04, at(ID, x + 2.3, h - 3.5, face * 0.72), True)
    block("olive", 0.7, 1.2, 0.5, at(ID, span, 1.6, 0.6))  # cabinet at the leg
    block("glow_cyan", 0.1, 0.05, 0.03, at(ID, span + 0.2, 1.9, 0.86), True)


def wall():
    block("concrete", 6.0, 0.8, 0.4, at(ID, 0, 0.4, 0))  # plinth
    for k in range(10):  # ribbed infill, alternating panels
        role = "titanium" if k % 2 else "olive"
        block(role, 0.58, 3.0, 0.18, at(ID, -2.7 + k * 0.6, 2.3, 0))
    block("steel", 6.0, 0.14, 0.3, at(ID, 0, 3.86, 0))  # cap
    for x in (-2.9, 2.9):
        block("graphite", 0.22, 4.0, 0.34, at(ID, x, 2.0, 0))  # posts
    block("dark", 0.05, 2.8, 0.2, at(ID, 0, 2.3, 0), True)  # the joint


def depot():
    w, h, d = 12.0, 5.2, 8.0
    block("graphite", w + 0.3, 0.3, d + 0.3, at(ID, 0, 0.15, 0))  # slab
    block("olive", w, h, d, at(ID, 0, 0.3 + h / 2, 0))
    block("steel", w + 0.4, 0.3, d + 0.4, at(ID, 0, h + 0.45, 0))  # roof edge
    block("titanium", 2.4, 0.8, 2.0, at(ID, 3, h + 1.0, -1))  # roof unit
    for x in (-3.0, 3.0):  # roller doors
        block("hazard", 4.0, 4.0, 0.12, at(ID, x, 2.3, d / 2 + 0.05))
        block("titanium", 3.6, 3.7, 0.08, at(ID, x, 2.15, d / 2 + 0.12))
        for y in (0.9, 1.7, 2.5, 3.3):
            block("dark", 3.6, 0.04, 0.03, at(ID, x, y, d / 2 + 0.17), True)
        block("lamp", 0.5, 0.12, 0.25, at(ID, x, 4.765, d / 2 + 0.125))  # work lamp on the wall
    block("steel", w + 1.0, 0.15, 2.0, at(ID, 0, 4.9, d / 2 + 1.0))  # canopy
    block("interior", 0.9, 1.0, 0.05, at(ID, 5.4, 3.6, d / 2 + 0.03))  # office window
    block("dark", 0.9, 2.0, 0.06, at(ID, -5.4, 1.3, d / 2 + 0.03))  # side door
    block("glow_cyan", 0.08, 0.08, 0.03, at(ID, -4.8, 2.0, d / 2 + 0.06), True)


def stock():
    def barrier(x, y, z):  # a 3 m jersey barrier along x: wide foot, narrow top
        block("concrete", 3.0, 0.3, 0.6, at(ID, x, y + 0.15, z))
        block("concrete", 3.0, 0.5, 0.3, at(ID, x, y + 0.55, z))

    for k in range(3):
        barrier(-2.2, 0, -1.2 + k * 0.7)
    for k in range(2):
        barrier(-2.2, 0.8, -0.85 + k * 0.7)
    block("hazard", 0.6, 0.3, 0.02, at(ID, -2.2, 0.55, 0.2), True)  # a striped end
    for x in (1.6, 3.0):  # cable drums on their sides
        tube("olive", (x, 0.9, -0.5), (x, 0.9, 0.5), 0.9, False, 12)
        tube("dark", (x, 0.9, -0.52), (x, 0.9, 0.52), 0.25, True, 8)
    block("yellow", 1.4, 1.0, 1.0, at(ID, 2.3, 0.5, 1.4))  # sand bin
    block("steel", 1.5, 0.08, 1.1, at(ID, 2.3, 1.04, 1.4))


def monument():
    lathe("concrete", [(4.2, 0), (4.2, 0.5), (3.6, 0.5), (0, 0.5)], 48)
    lathe("graphite", [(3.6, 0.5), (3.6, 0.9), (0, 0.9)], 48)
    ring("glow_cyan", 3.7, 0.05, 0.92, 48, 4)
    # Each blade: diamond sections (y, centre, half-width, half-depth), wide and deep at the foot,
    # kinked two thirds up, thin at the tip, leaning in across a gap of about 1.2 m; one taller.
    for s, top in ((-1, 22.0), (1, 16.5)):
        levels = ((0.9, 2.2, 1.6, 0.5), (top * 0.62, 1.35, 0.75, 0.3), (top, 0.75, 0.15, 0.1))
        diamond = ((1, 0), (0, 1), (-1, 0), (0, -1))
        rings = [[(s * c + u * w, y, v * d) for u, v in diamond] for y, c, w, d in levels]
        loft("graphite", rings, smooth_angle=0)
        for (y0, c0, w0, _), (y1, c1, w1, _) in zip(levels, levels[1:], strict=False):
            # stop 1 cm under the tip, so the seam's cap is not coplanar with the top
            a, b = (s * (c0 - w0 + 0.02), y0, 0), (s * (c1 - w1 + 0.02), min(y1, top - 0.01), 0)
            tube("glow_cyan", a, b, 0.05, False, 6)  # the seam up its inner edge
        block("red", 0.18, 0.18, 0.18, at(ID, s * 0.75, top + 0.09, 0))  # sits on the tip
    block("titanium", 1.5, 0.14, 0.4, at(ID, 0, 9.0, 0))  # a tie across the gap
    block("glow_cyan", 0.16, 0.6, 0.16, at(ID, 0, 8.63, 0))  # a light hung from it


PROPS = {"gantry": gantry, "wall": wall, "depot": depot, "stock": stock, "monument": monument}

for kind, make in PROPS.items():
    name = "ix_" + kind
    scene = bpy.data.scenes.get(name) or bpy.data.scenes.new(name)
    bpy.context.window.scene = scene
    clear(scene)
    parts.clear()
    make()
    join(scene, name)
    studio(scene)
    if globals().get("CITY"):  # the city's copies: .gltf + .bin, loaded by web/src/interchange.js
        folder = os.path.join(REPO, "web", "assets", "models", name)  # noqa: F821
        print(kit.export(name, folder, "GLTF_SEPARATE"))
