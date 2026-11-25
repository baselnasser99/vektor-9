"""Detail kit: a security kiosk for the headquarters' court (web/src/tiles.js court), original
design.

A glazed booth 1.8 m wide and 1.6 m deep on a bevelled plinth, origin on the ground at its centre,
its front to +z. Corner posts, sill and head rails and mullions frame the glass; the back wall is
solid. A lit service slot in the front's middle bay with a shelf under it, a desk and a monitor
inside, a ceiling light (monitor and ceiling light in lamp, softer than the slot and downlight in
lit); a bevelled canopy overhanging every side with a downlight strip under its front edge and a
sign board on its front edge (UVs 0..1 for the renderer's word). A door on each
side (door_l at -x, door_r at +x: the renderer keeps one) and a barrier arm out from the +x side
across the front (boom and stripe: the renderer keeps it only where the kiosk faces a lane).
Slots: base, frame, panel, glass, lit, lamp, canopy, sign, door_l, door_r, boom, stripe.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kit  # noqa: E402
from detail import ID, beam, block, run  # noqa: E402
from mathutils import Matrix  # noqa: E402

W, D = 1.8, 1.6  # the booth's glazed box
P, SILL, HEAD, TOP = 0.15, 1.0, 2.35, 2.45  # plinth top, sill, head rail, canopy underside
SLOT = (1.12, 1.44)  # the service slot's bottom and top
ARM_Y, ARM_Z, ARM = 0.95, D / 2 - 0.15, 3.4  # the boom's height, line and length


def walls():
    hw, hd = W / 2, D / 2
    for sx in (-1, 1):  # corner posts
        for sz in (-1, 1):
            x, z = sx * (hw - 0.05), sz * (hd - 0.05)
            block("frame", 0.1, TOP - P, 0.1, x, (P + TOP) / 2, z, bevel=0.015)
    # Lower panels front and sides, the back wall full height.
    block("panel", W - 0.2, SILL - P, 0.05, 0, (P + SILL) / 2, hd - 0.05)
    for sx in (-1, 1):
        block("panel", 0.05, SILL - P, D - 0.2, sx * (hw - 0.05), (P + SILL) / 2, 0)
    block("panel", W - 0.2, TOP - P, 0.05, 0, (P + TOP) / 2, -(hd - 0.05))
    # Sill rails (front and sides) and the head band all round.
    beam("frame", (-hw + 0.1, SILL, hd - 0.05), (hw - 0.1, SILL, hd - 0.05), 0.07)
    for sx in (-1, 1):
        beam("frame", (sx * (hw - 0.05), SILL, -hd + 0.1), (sx * (hw - 0.05), SILL, hd - 0.1), 0.07)
    for sz in (-1, 1):
        block("frame", W - 0.2, TOP - HEAD, 0.08, 0, (HEAD + TOP) / 2, sz * (hd - 0.05))
    for sx in (-1, 1):
        block("frame", 0.08, TOP - HEAD, D - 0.2, sx * (hw - 0.05), (HEAD + TOP) / 2, 0)
    # Front: two mullions make three bays; the middle one holds the slot.
    gh, gy = HEAD - SILL - 0.035, (SILL + 0.035 + HEAD) / 2
    for x in (-0.3, 0.3):
        block("frame", 0.06, HEAD - SILL, 0.08, x, (SILL + HEAD) / 2, hd - 0.05)
    for x in (-0.6, 0.6):
        block("glass", 0.5, gh, 0.02, x, gy, hd - 0.05)
    block("glass", 0.56, SLOT[0] - SILL - 0.035, 0.02, 0, (SILL + 0.035 + SLOT[0]) / 2, hd - 0.05)
    block("glass", 0.56, HEAD - SLOT[1], 0.02, 0, (SLOT[1] + HEAD) / 2, hd - 0.05)
    for y in SLOT:  # the slot's frame, its lit pane set back, the shelf outside
        beam("frame", (-0.28, y, hd - 0.05), (0.28, y, hd - 0.05), 0.04, 0.1)
    block("lit", 0.54, SLOT[1] - SLOT[0] - 0.04, 0.02, 0, sum(SLOT) / 2, hd - 0.12)
    block("frame", 0.7, 0.04, 0.24, 0, SLOT[0] - 0.04, hd + 0.07, bevel=0.01)
    # Sides: one mullion each, ahead of the door, two panes.
    for sx in (-1, 1):
        x = sx * (hw - 0.05)
        block("frame", 0.08, HEAD - SILL, 0.06, x, (SILL + HEAD) / 2, 0.2)
        block("glass", 0.02, gh, 0.87, x, gy, -0.235)
        block("glass", 0.02, gh, 0.47, x, gy, 0.465)


def inside():
    hd = D / 2
    block("panel", W - 0.3, 0.05, 0.45, 0, 0.93, hd - 0.33)  # the desk under the front glass
    block("panel", W - 0.3, 0.74, 0.03, 0, 0.53, hd - 0.54)
    block("frame", 0.46, 0.3, 0.04, -0.45, 1.1, hd - 0.4)  # a monitor, its screen toward the guard
    block("lamp", 0.42, 0.26, 0.01, -0.45, 1.1, hd - 0.426)
    block("lamp", W - 0.5, 0.02, D - 0.6, 0, TOP - 0.03, 0)  # the ceiling light


def canopy():
    hd = D / 2
    block("base", W + 0.2, P, D + 0.2, 0, P / 2, 0, bevel=0.03)  # the plinth
    cw, cd = W + 0.7, D + 0.7
    block("canopy", cw, 0.2, cd, 0, TOP + 0.1, 0, bevel=0.03)
    block("frame", cw - 0.2, 0.07, cd - 0.2, 0, TOP + 0.225, 0)  # the roof cap, sunk 1 cm into it
    block("lit", W, 0.02, 0.06, 0, TOP - 0.005, hd + 0.2)  # the downlight strip under the front
    # The sign board on the front edge, its word facing out.
    z = cd / 2 - 0.12
    block("frame", 1.6, 0.42, 0.08, 0, TOP + 0.465, z, bevel=0.01)
    kit.screen("sign", 1.5, 0.34, Matrix.Translation((0, TOP + 0.465, z + 0.045)) @ ID)


def door(slot, sx):
    """A steel door on the side at sx, hung toward the back, proud of the side's panels."""
    x, z, h = sx * (W / 2 + 0.01), -0.3, 2.05
    block(slot, 0.05, h, 0.75, x, P + h / 2, z, bevel=0.01)
    block(slot, 0.07, 0.25, 0.65, x, P + 0.15, z)  # the kick plate
    block(slot, 0.07, 1.2, 0.62, x, P + 1.25, z)  # the upper panel, a step out
    block(slot, 0.1, 0.04, 0.16, x, P + 1.0, z + 0.27)  # the handle
    for y in (P + 0.3, P + h - 0.3):  # hinges at the back edge
        block(slot, 0.08, 0.12, 0.04, x, y, z - 0.37)


def barrier():
    """A boom out from the +x side across the kiosk's front: its housing, the arm in bands, a rest
    post at the tip."""
    x0 = W / 2 + 0.35
    block("boom", 0.3, 1.05, 0.3, x0, 0.525, ARM_Z, bevel=0.03)
    block("stripe", 0.32, 0.06, 0.32, x0, 1.08, ARM_Z)  # the housing's cap band
    a = x0 + 0.15
    beam("boom", (a, ARM_Y, ARM_Z), (a + ARM, ARM_Y, ARM_Z), 0.08, 0.06)
    for k in range(5):  # bands every 0.6 m, a little proud of the boom
        u = a + 0.3 + k * 0.6
        block("stripe", 0.3, 0.084, 0.064, u + 0.15, ARM_Y, ARM_Z)
    block("boom", 0.05, ARM_Y - 0.04, 0.05, a + ARM - 0.1, (ARM_Y - 0.04) / 2, ARM_Z)  # rest post
    block("stripe", 0.1, 0.03, 0.09, a + ARM - 0.1, ARM_Y - 0.055, ARM_Z)  # its fork


def kiosk():
    walls()
    inside()
    canopy()
    door("door_l", -1)
    door("door_r", 1)
    barrier()


run("kiosk", kiosk)
