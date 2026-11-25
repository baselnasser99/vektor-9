"""Detail kit: the service platform near a stack's head, with its caged ladder (web/src/plant.js),
original design.

Nominal stack base radius 0.75 m (the renderer scales x and z to each stack), origin on the
stack's axis at the deck's top. A grated ring deck on brackets, a toe plate, posts and a top rail;
below it, on the +x side, a ladder with rungs inside hoops and straps, CAGE metres long (the
renderer runs a plain ladder on below it). Slots: grate (deck), frame (everything else).
"""

import math
import os
import sys

import bmesh

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kit  # noqa: E402
from detail import ID, annulus, beam, run  # noqa: E402

SEG, CAGE, LX = 10, 6.0, 0.9  # ring segments, cage length, the ladder's distance from the axis


def stack_head():
    annulus("grate", 0.6, 1.35, -0.08, 0, SEG)
    annulus("frame", 1.31, 1.35, 0, 0.12, SEG)  # toe plate
    annulus("frame", 1.29, 1.33, 1.04, 1.08, SEG)  # top rail
    for k in range(5):
        a = (k + 0.5) * 2 * math.pi / 5
        c, s = math.cos(a), math.sin(a)
        beam("frame", (1.31 * c, 0.1, 1.31 * s), (1.31 * c, 1.05, 1.31 * s), 0.045)  # post
        beam(
            "frame", (1.2 * c, -0.1, 1.2 * s), (0.5 * c, -0.75, 0.5 * s), 0.06
        )  # bracket, into the stack
    # Ladder: two rails and rungs (thin two-sided plates facing out), under the deck.
    for z in (-0.2, 0.2):
        beam("frame", (LX, -CAGE - 0.08, z), (LX, -0.08, z), 0.045)
    bm = bmesh.new()
    y = -CAGE + 0.2
    while y < -0.2:
        for side in (1, -1):
            v = [
                bm.verts.new(p)
                for p in ((LX, y, -0.2), (LX, y, 0.2), (LX, y + 0.03, 0.2), (LX, y + 0.03, -0.2))
            ]
            bm.faces.new(v if side > 0 else v[::-1])
        y += 0.3
    kit.add(bm, "frame", ID, smooth_angle=30)
    # Cage: hoops round the outside of the ladder, three straps up them.
    cx, r = LX + 0.32, 0.38
    for k in range(5):
        y0 = -CAGE + 2.4 + k * (CAGE - 2.6) / 4
        annulus("frame", r - 0.02, r + 0.02, y0, y0 + 0.05, 5, a0=-2.3, a1=2.3, center=(cx, 0))
    for a in (-1.4, 0, 1.4):
        p = (cx + r * math.cos(a), r * math.sin(a))
        beam("frame", (p[0], -CAGE + 2.4, p[1]), (p[0], -0.1, p[1]), 0.04)


run("stack_head", stack_head)
