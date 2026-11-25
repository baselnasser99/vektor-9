"""Detail kit: a ribbed roller shutter for a doorway (web/src/market.js bays and loading door,
web/src/plant.js gate), original design.

Nominal opening 3 m wide and 3 m tall (the renderer stretches it to the opening), origin at the
sill's centre on the wall's face, out to +z. The curtain's ribbed slats between two guide
channels, a bottom rail with two pull handles and a lock, the roll's bevelled hood above.
Slots: slats, frame.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from detail import block, run, strip  # noqa: E402

W, H, PITCH = 3.0, 3.0, 0.2  # opening, slat pitch


def shutter():
    # Curtain: trapezoid ribs, 2.5 cm proud of the slats' flat, from the bottom rail to the hood.
    profile, y = [], 0.08
    while y + PITCH <= H:
        profile += [(y, 0.04), (y + 0.13, 0.04), (y + 0.15, 0.065), (y + 0.18, 0.065)]
        y += PITCH
    profile.append((H, 0.04))
    strip("slats", profile[::-1], -W / 2, W / 2, back=False)  # top down, so its face is +z
    # Guide channels each side, the bottom rail, its handles and a lock box.
    for s in (-1, 1):
        block("frame", 0.12, H + 0.1, 0.12, s * (W / 2 + 0.03), (H + 0.1) / 2, 0.06)
    block("frame", W, 0.08, 0.09, 0, 0.04, 0.06)
    for x in (-0.9, 0.9):
        block("frame", 0.16, 0.035, 0.05, x, 0.14, 0.12)
    block("frame", 0.14, 0.12, 0.05, 0.3, 0.16, 0.11)
    # The roll's hood over the opening.
    block("frame", W + 0.36, 0.42, 0.34, 0, H + 0.21, 0.17, bevel=0.03)


run("shutter", shutter)
