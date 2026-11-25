"""Detail kit: a market stall for one bay of a hall's colonnade (web/src/market.js), original
design.

Nominal bay 3.2 m wide (the renderer stretches x to the bay), origin on the floor at the bay's
centre against the nave wall, out to +z. A bevelled counter with a steel top, goods on it
and on a back shelf, a framed awning on two posts with a valance, a pendant lamp and a lit menu
board on the right post. Slots: counter, goods, frame, awning, lit (the lamp's bulb and the menu).
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from detail import beam, block, cylinder, run, strip  # noqa: E402


def stall():
    # Counter: a bevelled body and a steel top with a lip.
    block("counter", 2.5, 0.88, 0.58, 0, 0.5, 0.62, bevel=0.03)
    block("frame", 2.62, 0.05, 0.7, 0, 0.965, 0.64, bevel=0.015)
    # Goods on the counter: crates, a stack of boxes, jars; and on a shelf against the wall.
    for x, w, h in ((-0.85, 0.5, 0.26), (-0.28, 0.42, 0.2), (0.75, 0.46, 0.3)):
        block("goods", w, h, 0.36, x, 0.99 + h / 2, 0.6)
    block("goods", 0.3, 0.18, 0.28, 0.75, 1.38, 0.62)
    cylinder("goods", 0.07, 0.22, 0.2, 1.1, 0.72, seg=6)
    block("frame", 2.6, 0.04, 0.32, 0, 1.55, 0.18)  # back shelf
    for x, w, h in ((-0.6, 0.9, 0.3), (0.6, 0.8, 0.34)):
        block("goods", w, h, 0.24, x, 1.57 + h / 2, 0.18)
    # Framed awning: two posts, a frame round its edge, the cloth sloping out, a valance.
    for x in (-1.48, 1.48):
        block("frame", 0.07, 2.6, 0.07, x, 1.3, 1.3)
    beam("frame", (-1.52, 2.62, 0.05), (1.52, 2.62, 0.05), 0.06)
    beam("frame", (-1.52, 2.3, 1.3), (1.52, 2.3, 1.3), 0.06)
    for x in (-1.5, 1.5):
        beam("frame", (x, 2.62, 0.05), (x, 2.3, 1.3), 0.05)
    strip("awning", [(2.66, 0.05), (2.34, 1.32)], -1.5, 1.5)  # cloth, its face up and out
    strip(
        "awning", [(2.34, 1.32), (2.12, 1.36), (2.04, 1.33)], -1.5, 1.5
    )  # valance, turned in at the hem
    # Pendant lamp: a rod, a shade, the bulb.
    beam("frame", (0, 2.46, 0.7), (0, 2.18, 0.7), 0.02)
    cylinder("frame", 0.17, 0.14, 0, 2.12, 0.7, seg=6, r2=0.05)  # wide at the bottom
    cylinder("lit", 0.12, 0.03, 0, 2.04, 0.7, seg=6)
    # Menu board on the right post: a frame and its lit face.
    block("frame", 0.62, 0.48, 0.05, 1.12, 1.75, 1.33)
    block("lit", 0.54, 0.4, 0.02, 1.12, 1.75, 1.365)


run("stall", stall)
