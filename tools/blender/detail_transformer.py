"""Detail kit: a plant's yard transformer (web/src/plant.js), original design.

Origin on the ground at its centre, front (the indicator) to +z, about 2.6 m across its fins and
2.9 m to the bushings' caps. A bevelled tank on a skid with a lidded top, radiator fin banks on
both sides between header pipes, a conservator drum on brackets, three high-voltage bushings
with two sheds and three low-voltage stubs, a lit status lamp on the front.
Slots: tank (tank, fins, skid, drum), bushing, lit.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kit  # noqa: E402
from detail import block, cylinder, run  # noqa: E402


def transformer():
    block("tank", 1.5, 0.12, 1.2, 0, 0.06, 0)  # skid
    block("tank", 1.3, 1.55, 1.05, 0, 0.12 + 0.775, 0, bevel=0.05)
    block("tank", 1.42, 0.08, 1.16, 0, 1.71, 0)  # lid
    # Radiator banks: four fins each side between a top and a bottom header.
    for s in (-1, 1):
        for k in range(4):
            block("tank", 0.42, 1.15, 0.035, s * 0.92, 0.85, -0.36 + k * 0.24)
        for y in (0.3, 1.4):
            block("tank", 0.32, 0.09, 0.95, s * 0.86, y, 0)
    # Conservator: a drum lying along x on two brackets, at the back.
    cylinder("tank", 0.22, 1.0, 0, 2.15, -0.38, seg=10, axis="X")
    for x in (-0.35, 0.35):
        block("tank", 0.06, 0.4, 0.12, x, 1.9, -0.38)
    # High-voltage bushings: a porcelain stack with two sheds; low-voltage stubs.
    sheds = [(0.07, 0), (0.15, 0.12), (0.07, 0.2), (0.14, 0.3), (0.06, 0.44), (0.0, 0.5)]
    for x in (-0.42, 0, 0.42):
        kit.lathe(
            "bushing", [(r, 1.75 + y) for r, y in sheds], seg=6, smooth_angle=60, center=(x, 0)
        )
    for x in (-0.3, 0, 0.3):
        cylinder("bushing", 0.045, 0.22, x, 1.86, 0.38, seg=6)
    # Status lamp in a small hood on the front.
    block("tank", 0.22, 0.2, 0.06, 0.4, 1.35, 0.55)
    block("lit", 0.13, 0.11, 0.03, 0.4, 1.35, 0.585)


run("transformer", transformer)
