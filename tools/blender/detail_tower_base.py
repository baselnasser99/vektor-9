"""Detail kit: the leg ring under a hyperboloid cooling tower (web/src/plant.js), original design.

Nominal tower base radius R = 3.5 m (the renderer scales it to each tower), origin on the ground
at the tower's axis. The shell stands on a ring beam LIFT up; under it the air inlet: diagonal
legs in a zigzag from footings on a low basin kerb, and the dark fill packing seen between them.
Slots: concrete (kerb, footings, legs, ring beam), dark (the fill).
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from detail import annulus, beam, block, cylinder, run  # noqa: E402

R, LIFT, LEGS, SEG = 3.5, 2.0, 8, 20  # SEG: the shell's segments (plant.js tower lathe)


def tower_base():
    annulus("concrete", R + 0.2, R + 0.45, 0, 0.35, SEG)  # basin kerb
    annulus("concrete", 0.86 * R, R + 0.06, LIFT - 0.3, LIFT, SEG)  # ring beam, the shell's seat
    cylinder(
        "dark", 0.86 * R - 0.02, LIFT - 0.62, 0, 0.33 + (LIFT - 0.62) / 2, 0, seg=SEG
    )  # fill packing
    step = 2 * math.pi / LEGS
    for k in range(LEGS):
        a = k * step
        foot = (math.cos(a) * (R + 0.15), 0.3, math.sin(a) * (R + 0.15))
        block("concrete", 0.42, 0.4, 0.42, foot[0], 0.2, foot[2])  # proud of the kerb
        for b in (a - step / 2, a + step / 2):
            beam(
                "concrete",
                foot,
                (math.cos(b) * (R - 0.05), LIFT - 0.3, math.sin(b) * (R - 0.05)),
                0.2,
            )


run("tower_base", tower_base)
