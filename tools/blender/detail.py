"""Shared by the detail kit scripts (tools/blender/detail_*.py): small parts that web/src/plant.js
and web/src/market.js place as shared instanced meshes on every plant and hall.

Blender: only the stable LTS build named in web/assets/models/kit-detail/manifest.json ("blender",
5.2.5 LTS), installed at "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe". No alpha
or beta builds and no Blender MCP add-on or server; run() stops on any other version.

Run one headless from the repo root:
    "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --factory-startup
        --python tools/blender/detail_stall.py
It writes web/assets/models/kit-detail/<part>.gltf + .bin and prints the part's triangles and the
files' bytes and SHA-256. Two runs give byte-identical files. The scripts never write the
manifest: after an intended change, copy the printed hashes into manifest.json (the test
tests/js/kit_manifest.test.mjs fails until the files and the manifest agree).

Same conventions as the other models (tools/blender/kit.py): three.js
coordinates (y up, front +z), UVs in metres / REPEAT, parts joined per material slot. No colours
are baked in: each glTF material is only a slot name, which the renderer maps to a palette.js
material (kit.model in web/src/materials.js). Lit parts have their own slot, so a blackout can
swap it for dark steel. Nothing goes into a "detail" group: instances are drawn at every distance.
"""

import hashlib
import json
import math
import os
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(REPO, "tools", "blender"))
import kit  # noqa: E402

OUT = os.path.join(REPO, "web", "assets", "models", "kit-detail")
ID = Matrix()
# Preview looks for the kit's slot names (Blender only, never exported).
for slot, like in {
    "counter": "panel", "goods": "mech", "frame": "graphite", "awning": "awning_a", "lit": "lamp",
    "slats": "steel", "tank": "mech", "bushing": "titanium", "grate": "dark",
}.items():  # fmt: skip
    kit.ROLES.setdefault(slot, kit.ROLES[like])


def box(w, h, d, bevel=0.0):
    """A box centred on the origin; bevel: one 45-degree chamfer on every edge (where it shows)."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    bmesh.ops.scale(bm, vec=(w, h, d), verts=bm.verts)
    if bevel:
        bmesh.ops.bevel(bm, geom=bm.edges[:], offset=bevel, segments=1, affect="EDGES", profile=0.5)
    return bm


def block(slot, w, h, d, x, y, z, bevel=0.0, turn=None):
    m = Matrix.Translation((x, y, z)) @ (turn or ID)
    return kit.add(box(w, h, d, bevel), slot, m, smooth_angle=30)


def beam(slot, a, b, w, d=None):
    """A square member from a to b (any direction), w by d across."""
    a, b = Vector(a), Vector(b)
    bm = box(w, (b - a).length, d or w)
    turn = Vector((0, 1, 0)).rotation_difference(b - a).to_matrix().to_4x4()
    return kit.add(bm, slot, Matrix.Translation((a + b) / 2) @ turn, smooth_angle=30)


def cylinder(slot, r, h, x, y, z, seg=12, axis="Y", r2=None):
    """Capped cylinder (cone if r2) centred at (x, y, z) along an axis."""
    bm = bmesh.new()
    bmesh.ops.create_cone(
        bm, cap_ends=True, segments=seg, radius1=r, radius2=r if r2 is None else r2, depth=h
    )
    turn = {
        "Y": Matrix.Rotation(-math.pi / 2, 4, "X"),
        "X": Matrix.Rotation(math.pi / 2, 4, "Y"),
        "Z": ID,
    }[axis]
    return kit.add(bm, slot, Matrix.Translation((x, y, z)) @ turn, smooth_angle=50)


def annulus(slot, r0, r1, y0, y1, seg, a0=0.0, a1=2 * math.pi, center=(0, 0)):
    """A ring of rectangular section about a vertical axis at center (x, z), r0 to r1 out and y0
    to y1 up, or an arc of one from angle a0 to a1, closed at its ends."""
    whole = abs(a1 - a0 - 2 * math.pi) < 1e-9
    n = seg if whole else seg + 1
    bm = bmesh.new()
    rings = []
    for k in range(n):
        t = a0 + (a1 - a0) * k / seg
        c, s = math.cos(t), math.sin(t)
        rings.append(
            [
                bm.verts.new((center[0] + r * c, y, center[1] + r * s))
                for r, y in ((r0, y0), (r1, y0), (r1, y1), (r0, y1))
            ]
        )
    for k in range(seg):
        lo, hi = rings[k], rings[(k + 1) % n]
        for j in range(4):
            bm.faces.new((lo[j], lo[(j + 1) % 4], hi[(j + 1) % 4], hi[j]))
    if not whole:
        bm.faces.new(rings[0])
        bm.faces.new(rings[-1][::-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    return kit.add(bm, slot, ID, smooth_angle=40)


def strip(slot, profile, x0, x1, back=True):
    """A thin sheet swept along x from x0 to x1 through a profile [(y, z), ...], its front to the
    left of the profile's direction; back: a reverse face too, so it shows from both sides."""
    bm = bmesh.new()
    for side in (1, -1) if back else (1,):
        left = [bm.verts.new((x0, y, z)) for y, z in profile]
        right = [bm.verts.new((x1, y, z)) for y, z in profile]
        for k in range(len(profile) - 1):
            quad = (left[k], left[k + 1], right[k + 1], right[k])
            bm.faces.new(quad if side > 0 else quad[::-1])
    return kit.add(bm, slot, ID, smooth_angle=30)


def run(name, build):
    """Build the part into its own scene, export it, rewrite its materials to bare slot names,
    and print what it costs."""
    with open(os.path.join(OUT, "manifest.json"), encoding="utf-8") as f:
        want = json.load(f)["blender"]
    if bpy.app.version_string != want:
        raise SystemExit(f"kit-detail: Blender {bpy.app.version_string}, manifest asks for {want}")
    scene = bpy.data.scenes.get(name) or bpy.data.scenes.new(name)
    bpy.context.window.scene = scene
    kit.clear(scene)
    kit.parts.clear()
    build()
    kit.join(scene, name)
    path = kit.export(name, OUT, "GLTF_SEPARATE")
    with open(path, encoding="utf-8") as f:
        doc = json.load(f)
    doc["materials"] = [
        {"name": m["name"]} for m in doc["materials"]
    ]  # slot names only, no colours
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(doc, f, indent=1, separators=(",", ":"))
        f.write("\n")
    tris = sum(
        len(p.vertices) - 2
        for o in bpy.data.objects[name].children_recursive
        if o.type == "MESH"
        for p in o.data.polygons
    )
    slots = sorted(m["name"] for m in doc["materials"])
    for p in (path, path[:-5] + ".bin"):
        data = open(p, "rb").read()
        digest = hashlib.sha256(data).hexdigest()
        print(f"kit-detail {name}: {os.path.basename(p)} {len(data)} B sha256 {digest}")
    print(f"kit-detail {name}: {tris} triangles, slots {', '.join(slots)}")
