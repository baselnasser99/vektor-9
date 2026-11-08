"""Build the railway terminus, in Blender (an original design).

In Blender: REPO = r"<repo root>"; exec(open(REPO + "/tools/blender/train_station.py").read())
Builds the station into its own scene (with a studio for review renders). CITY = True before exec
writes the city's copy (web/assets/models/train_station).

The renderer (web/src/landmarks.js station, terrain.js railway) puts it on the viaduct at the
line's inner end: x runs along the line, x = 0 is the concourse's street face and the shed runs
out along -x, y = 0 is the viaduct deck's centre (8 m up, so the ground is at y = -8), the two
tracks at z = +-1.85. It stays within z = +-13.5, the two rail tiles it stands on.
- shed: an armoured train shed over both tracks and two side platforms, its walls an armoured
  plinth under a recessed glass band, its roof folded graphite plates stepped like armour, with
  a raised monitor along the ridge whose two cold ice-blue slots are its main light;
- concourse: a heavy block at the buffer end down to the street, its entrance under a canopy at
  street level, a warm slit above, a stair tower on one side and on the other a sign tower
  carrying a vertical crimson sign (its word is the renderer's) under a steady red lamp;
- throat: the open end the trains run in at, with a signal gantry over the tracks.
Restrained light: cold ice-blue in the shed, warm only in the concourse, steady red lamps.
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
from kit import at, block, clear, join, lamp, parts, rail, screen, studio, tube  # noqa: E402

ID = Matrix()
GROUND, TOP, PLAT = -8.0, 0.6, 1.1  # ground, deck top and platform top, from the deck's centre
X0, X1 = -98.0, -14.0  # the shed, from the throat to the concourse
BAY = 12.0  # frame spacing, the viaduct's span
W = 11.0  # half the shed's width, to the face of its walls
EAVE, RIDGE = 10.4, 13.4  # roof height at the walls and at the monitor
MON = 3.2  # half the monitor's width
TRACKS = (-1.85, 1.85)


def tilt(a):
    return Matrix.Rotation(a, 4, "X")


def deck():
    """The station's slab either side of the viaduct, its columns, and the platforms on it."""
    length = -X0
    for s in (-1, 1):
        block("concrete", length, 1.2, 8.3, at(ID, X0 / 2, 0, s * 8.65))  # slab
        block(
            "panel", X1 - X0 + 2, PLAT - TOP, 6.2, at(ID, (X0 + X1) / 2, (PLAT + TOP) / 2, s * 7.75)
        )
        block(
            "ice", X1 - X0, 0.05, 0.14, at(ID, (X0 + X1) / 2, PLAT + 0.02, s * 4.75)
        )  # platform edge
        block("hazard", X1 - X0, 0.02, 0.5, at(ID, (X0 + X1) / 2, PLAT + 0.01, s * 5.1), True)
        for x in range(int(X0) + 6, int(X1), int(BAY)):  # columns under the slab, between the piers
            block(
                "concrete",
                1.3,
                -0.6 - GROUND,
                1.3,
                at(ID, x, (GROUND - 0.6) / 2, s * 10.6),
                bevel=0.08,
            )
            block("steel", 2.4, 0.6, 2.4, at(ID, x, -0.9, s * 10.6))  # capital
        for x in range(int(X0) + 9, int(X1) - 3, 18):  # benches and bins
            block("dark", 3.0, 0.45, 0.6, at(ID, x, PLAT + 0.45, s * 9.6), True)
            block("steel", 0.5, 0.9, 0.5, at(ID, x + 3, PLAT + 0.45, s * 9.6), True)


def walls():
    """Frames every BAY metres, each wall an armoured plinth, a recessed glass band and a fascia."""
    length, mid = X1 - X0, (X0 + X1) / 2
    for s in (-1, 1):
        z = s * W
        block("steel", length, 3.4, 0.6, at(ID, mid, PLAT + 1.7, z))  # plinth
        block("dark", length, 0.3, 0.9, at(ID, mid, PLAT + 3.5, z))  # its ledge
        block("glass", length, 3.6, 0.2, at(ID, mid, PLAT + 5.4, z - s * 0.35))  # recessed band
        block("panel", length, 2.4, 0.7, at(ID, mid, EAVE - 1.0, z))  # fascia
        block("ice", length, 0.08, 0.1, at(ID, mid, PLAT + 7.15, z + s * 0.05))  # a thin cold line
        for k in range(int(length / BAY) + 1):
            x = X0 + k * BAY
            block(
                "graphite", 1.0, EAVE - PLAT + 0.6, 1.4, at(ID, x, (EAVE + PLAT) / 2, z), bevel=0.06
            )
            # an armoured buttress fin raking out from the column, down to the slab's edge
            block("graphite", 0.7, 6.0, 1.0, at(tilt(-s * 0.32), x, PLAT + 3.2, z + s * 1.0))
            block("steel", 1.2, 0.6, 1.4, at(ID, x, PLAT + 0.3, z + s * 1.8))  # its foot
            block(
                "panel", 0.3, 4.0, 0.12, at(ID, x + BAY / 2, PLAT + 1.8, z + s * 0.32), True
            )  # plate seam
        for k in range(int(length / 6)):  # plinth plates, staggered like armour
            x = X0 + 3 + k * 6
            block("panel", 5.6, 1.4, 0.18, at(ID, x, PLAT + 1.1 + (k % 2) * 1.3, z + s * 0.38))


def roof():
    """Folded graphite plates from the eaves up to the monitor, stepped bay by bay, the monitor's
    two ice-blue slots, ribs over every frame, and lamps hung over the platforms."""
    dz, dy = W - MON, RIDGE - EAVE
    run, a = math.hypot(dz, dy), math.atan2(dy, dz)
    for k in range(int((X1 - X0) / BAY)):
        x = X0 + (k + 0.5) * BAY
        lift = 0.45 * (k % 2)  # every other bay's plates stand proud
        for s in (-1, 1):
            zc, yc = s * (MON + dz / 2), (EAVE + RIDGE) / 2 + lift
            block("graphite", BAY + 0.1, 0.45, run + 0.6, at(tilt(s * a), x, yc, zc))
            block(
                "panel", BAY - 1.2, 0.2, run * 0.5, at(tilt(s * a), x, yc + 0.32, zc + s * 1.2)
            )  # a plate on it
    for k in range(int((X1 - X0) / BAY) + 1):
        x = X0 + k * BAY
        for s in (-1, 1):  # ribs over the frames
            block(
                "steel",
                1.0,
                1.3,
                run + 0.8,
                at(tilt(s * a), x, (EAVE + RIDGE) / 2 + 0.8, s * (MON + dz / 2)),
            )
    length, mid = X1 - X0, (X0 + X1) / 2
    block(
        "panel", length + 1, 0.5, 2 * MON + 1.2, at(ID, mid, RIDGE + 2.0, 0)
    )  # the monitor's roof
    for s in (-1, 1):
        block(
            "ice", length, 0.7, 0.12, at(ID, mid, RIDGE + 1.1, s * MON)
        )  # its slots, the cold light
        block("dark", length, 0.5, 0.3, at(ID, mid, RIDGE + 0.45, s * MON))
    for k in range(int(length / BAY) + 1):
        block(
            "graphite", 0.6, 2.2, 2 * MON + 0.4, at(ID, X0 + k * BAY, RIDGE + 0.9, 0)
        )  # monitor frames
    block(
        "dark", length, 0.4, 2 * W, at(ID, mid, EAVE + 0.1, 0)
    )  # the ceiling, seen through the slots
    for x in range(int(X0) + 3, int(X1), 6):  # lamps over the platforms, cold
        for s in (-1, 1):
            block("ice", 1.6, 0.12, 0.4, at(ID, x, EAVE - 0.5, s * 7.6))
            tube("steel", (x, EAVE - 0.45, s * 7.6), (x, EAVE - 0.1, s * 7.6), 0.03, True, 4)


def gable():
    """The throat end (-x): a heavy portal frame and the shed's open end with louvres above the
    trains, and a signal gantry out over the tracks."""
    block("graphite", 1.6, 2.2, 2 * W + 1.6, at(ID, X0, EAVE - 0.3, 0))  # portal beam
    for s in (-1, 1):
        block(
            "graphite", 2.0, EAVE - PLAT + 1, 2.0, at(ID, X0, (EAVE + PLAT) / 2, s * W), bevel=0.08
        )
        dz, dy = W - MON, RIDGE - EAVE
        block(
            "steel",
            1.4,
            0.6,
            math.hypot(dz, dy) + 0.6,
            at(
                tilt(s * math.atan2(dy, dz)), X0 - 0.1, (EAVE + RIDGE) / 2 + 0.6, s * (MON + dz / 2)
            ),
        )
    for k in range(5):  # louvres in the gable, over the trains
        block(
            "dark",
            0.2,
            0.35,
            2 * MON + 2 * (4 - k) * 1.8,
            at(ID, X0 + 0.2, EAVE + 0.8 + k * 0.6, 0),
        )
    gx = X0 - 7
    for s in (-1, 1):
        block("steel", 0.5, 7.0, 0.5, at(ID, gx, TOP + 3.5, s * 4.0))
    block("steel", 0.6, 0.7, 8.6, at(ID, gx, TOP + 7.0, 0))
    for z in TRACKS:
        block("dark", 0.5, 1.6, 0.8, at(ID, gx + 0.1, TOP + 5.9, z))  # signal heads
        lamp((gx + 0.4, TOP + 6.3, z), 0.22)
        block("ice", 0.08, 0.3, 0.3, at(ID, gx + 0.38, TOP + 5.6, z))
    tube("steel", (gx, TOP + 7.0, 3.8), (gx, TOP + 7.0, -3.8), 0.06, True, 6)  # cable


def buffers():
    """Buffer stops at the end of both tracks, a steady red lamp on each."""
    for z in TRACKS:
        block("steel", 1.2, 1.5, 2.8, at(ID, X1 - 1.2, TOP + 0.75, z))
        block("hazard", 0.1, 0.4, 2.6, at(ID, X1 - 1.85, TOP + 1.0, z))
        lamp((X1 - 1.9, TOP + 1.7, z), 0.25)


def concourse():
    """The heavy block at the buffer end (x X1..0), down to the street: entrance and canopy at
    street level, the waiting hall over it with a warm slit, a stair tower on -z, and the sign
    tower on +z with the crimson sign facing the street."""
    d = -X1
    block(
        "steel", d, -GROUND + PLAT + 4.0, 26.0, at(ID, X1 / 2, (GROUND + PLAT + 4.0) / 2, 0)
    )  # podium
    block("graphite", d - 1.0, 14.0, 23.0, at(ID, X1 / 2 - 0.5, PLAT + 11.0, 0))  # the hall
    block("panel", d + 0.6, 0.7, 24.0, at(ID, X1 / 2, PLAT + 18.3, 0))  # its roof edge
    block("halo", 0.12, 0.35, 20.0, at(ID, -0.5, PLAT + 17.2, 0))  # a crimson line under it
    # the armoured brow over the street face, leaning out
    block("graphite", 2.2, 7.0, 23.6, at(Matrix.Rotation(-0.28, 4, "Z"), -0.4, PLAT + 8.4, 0))
    block("interior", 0.15, 0.9, 16.0, at(ID, 0.75, PLAT + 4.6, 0))  # warm slit under the brow
    block("deepred", 0.12, 0.25, 23.0, at(ID, 0.1, PLAT + 4.0, 0))  # a deep red band
    # street level: the entrance recess, warm doors, the canopy and its lamp line
    y0 = GROUND
    block("dark", 0.6, 4.6, 12.0, at(ID, 0.05, y0 + 2.3, 0))
    block("interior", 0.1, 3.6, 10.4, at(ID, 0.4, y0 + 1.9, 0))
    for z in (-3.5, 0, 3.5):
        block("steel", 0.25, 3.6, 0.25, at(ID, 0.5, y0 + 1.9, z))  # door mullions
    block("panel", 3.6, 0.4, 14.0, at(ID, 1.8, y0 + 5.0, 0))  # canopy
    block("lamp", 0.12, 0.08, 13.0, at(ID, 3.5, y0 + 4.78, 0))
    for z in (-6.6, 6.6):
        tube("steel", (3.4, y0 + 5.0, z), (0.3, y0 + 7.4, z), 0.09, False, 6)  # canopy ties
    for z in (-12.4, 12.4):  # armoured corner piers
        block(
            "graphite",
            1.6,
            -GROUND + PLAT + 4.5,
            1.6,
            at(ID, -0.3, (GROUND + PLAT + 4.5) / 2, z),
            bevel=0.08,
        )
    for k, z in enumerate((-9.5, -3.2, 3.2, 9.5)):  # plates on the street face, staggered
        block("panel", 0.18, 3.2, 4.8, at(ID, 0.05, y0 + 7.5 + (k % 2) * 0.8, z))
    # stair tower on -z, with a lit stair slit on its outer face
    h = PLAT + 16.0 - GROUND
    block("steel", 5.0, h, 3.0, at(ID, -8.0, GROUND + h / 2, -12.0))
    block("lamp", 0.6, h - 6.0, 0.1, at(ID, -8.0, GROUND + h / 2 - 1.0, -13.52))
    # sign tower on +z: the vertical crimson sign on its street face, a red lamp on top
    h = PLAT + 28.0 - GROUND
    block("graphite", 3.4, h, 3.4, at(ID, -3.2, GROUND + h / 2, 11.3), bevel=0.08)
    block("dark", 0.3, 21.0, 2.4, at(ID, -1.4, PLAT + 15.0, 11.3))
    screen("sign", 2.0, 20.0, at(Matrix.Rotation(math.pi / 2, 4, "Y"), -1.22, PLAT + 15.0, 11.3))
    lamp((-3.2, PLAT + 28.6, 11.3), 0.35)
    # plant on the hall's roof
    block("mech", 6.0, 2.2, 5.0, at(ID, -8.0, PLAT + 19.7, -4.0))
    block("dark", 6.4, 0.3, 5.4, at(ID, -8.0, PLAT + 20.9, -4.0))
    for z in (3.0, 6.5):
        tube("titanium", (-9.0, PLAT + 18.6, z), (-9.0, PLAT + 21.4, z), 0.7, False, 10)
    y = PLAT + 18.6
    rail("steel", [(-13.5, y, -11.4), (-0.8, y, -11.4), (-0.8, y, 9.0)])


NAME = "train_station"
scene = bpy.data.scenes.get(NAME) or bpy.data.scenes.new(NAME)
bpy.context.window.scene = scene
clear(scene)
parts.clear()
for make in (deck, walls, roof, gable, buffers, concourse):
    make()
join(scene, NAME)
studio(scene)
print(kit.stats(NAME))
if globals().get("CITY"):  # the city's copy: .gltf + .bin, loaded by web/src/main.js
    print(kit.export(NAME, os.path.join(REPO, "web", "assets", "models", NAME), "GLTF_SEPARATE"))  # noqa: F821
