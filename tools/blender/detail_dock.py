"""Detail kit: a loading dock at a hall's back wall (web/src/market.js), original design.

Origin on the ground at the door's centre on the wall's face, out to +z. A bevelled concrete
platform with a steel edge, a leveller plate, a hazard band and two rubber bumpers; steps with a
handrail at one side; hazard posts either side of a door 3 m wide and 2.8 m tall, 0.9 m up (the
roller shutter is its own part, placed by the renderer, its hood up to 0.39 m over the door); a
sloped canopy on tie rods above the hood, a lit wall lamp under it beside the door.
Slots: concrete, frame, hazard, dark (bumpers), lit (the lamp).
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from detail import beam, block, run  # noqa: E402
from mathutils import Matrix  # noqa: E402

W, DOOR = 3.0, 2.8  # the opening, from the platform up


def dock():
    block("concrete", 3.6, 0.9, 1.1, 0, 0.45, 0.55, bevel=0.03)
    block("frame", 3.56, 0.06, 0.08, 0, 0.9, 1.08)  # steel edge angle
    block("frame", 2.2, 0.03, 0.95, 0, 0.915, 0.52)  # leveller plate
    block("hazard", 3.5, 0.14, 0.02, 0, 0.75, 1.11)
    for x in (-1.1, 1.1):
        block("dark", 0.25, 0.42, 0.14, x, 0.52, 1.17)
    # Steps down at the right, with a rail.
    for k in range(3):
        block("concrete", 0.7, 0.3 * (k + 1), 0.32, 2.15, 0.15 * (k + 1), 1.1 - k * 0.32)
    for z, y in ((0.4, 0.9), (1.1, 0.3)):  # posts on the top and bottom steps
        beam("frame", (2.45, y, z), (2.45, y + 1.0, z), 0.04)
    beam("frame", (2.45, 1.9, 0.4), (2.45, 1.3, 1.1), 0.04)
    # Door posts in hazard paint, outside the shutter's guides, up to its hood.
    for s in (-1, 1):
        block("hazard", 0.25, DOOR, 0.15, s * (W / 2 + 0.25), 0.9 + DOOR / 2, 0.075)
    # Canopy: a sheet sloping out and down, its fascia, two tie rods back to the wall.
    top = 0.9 + DOOR + 0.5
    block("frame", 4.4, 0.08, 1.5, 0, top, 0.75, turn=Matrix.Rotation(0.12, 4, "X"))
    block("frame", 4.4, 0.2, 0.06, 0, top - 0.12, 1.5)
    for x in (-1.8, 1.8):
        beam("frame", (x, top + 0.8, 0.02), (x, top - 0.05, 1.45), 0.04)
    # Wall lamp under the canopy, beside the door.
    block("frame", 0.4, 0.14, 0.24, -1.95, top - 0.3, 0.13)
    block("lit", 0.3, 0.03, 0.16, -1.95, top - 0.385, 0.15)


run("dock", dock)
