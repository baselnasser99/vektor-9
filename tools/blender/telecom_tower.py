"""Build the city's telecom and observation tower in Blender (an original design).

In Blender: REPO = r"<repo root>"; exec(open(REPO + "/tools/blender/telecom_tower.py").read())
Builds into its own scene "telecom_tower" (with a studio for review renders), leaving the open
scene alone. EXPORT = r"<folder>" before exec also writes telecom_tower.glb there.

Structure: a tapered concrete core with panel joints; three tapered concrete legs, flared at the
foot, standing on pile caps, grown out of the core on web walls low down and tied back to it by
steel girders higher up; a concrete transfer ring where the legs and core meet under the crown,
and twelve raking steel columns from it out to the crown's floor. The crown: a louvred service
level, the main observation level (outward-raked glass, steel mullions, a transom, a lit ceiling),
a control level, a shallow tapered roof and a plant penthouse. A short lattice-and-pole mast
(about 14% of the height). At the foot, a two-level podium round a glazed lobby.

Decades of retrofits sit on that concrete frame, concentrated at three structural nodes so most of
the shaft stays clean: a lower plant node where the web walls end (housings, fans, radiators, a
steel collar), the main mechanical level (a two-storey drum clamped between the legs, knee braces,
collars, a gantry, comms modules) and an upper equipment node under the transfer ring. Enclosed
steel lift shafts with a lit conduit and maintenance indicators, and two large pipelines feeding
the plant nodes. The crown becomes a command level: angular armour over the legs, a reinforced
control level with slit glazing, one curved display, comms dishes, a radome, walkways. The base
becomes a hub: a monumental portal, power yard with transformers, vent towers, garages, an annex
on an enclosed cable bridge. Signage is invented text. build(1) makes a lighter variant (LOD1).

Parts are built in three.js coordinates (y up) and turned to Blender's z up as they are added, so
the glTF comes out in the renderer's frame. UVs are in metres / REPEAT (web/src/geometry.js).
Objects are joined per material and named after a role ("concrete", "glass", ...); the renderer
gives each a palette material. Small parts go under the empty "detail", drawn only near the camera.
"""

import math
import os

import bmesh
import bpy
from mathutils import Matrix, Vector

REPEAT = 4.0

# Proportions, in metres. Tune here; everything else follows.
H = 260.0  # mast tip
TOP = 224.0  # top of the concrete (plant penthouse roof); the mast is the last 36 m
CORE = (6.5, 3.4)  # core radius at the ground and at TOP (straight taper)
JOINT = 12.0  # concrete panel joint spacing on core and legs
LEG_R = (18.0, 8.0)  # leg centre radius at the foot and at the top
LEG_D = (6.4, 2.8)  # leg depth (radial) at the foot and top
LEG_W = (4.2, 2.2)  # leg width (tangential) at the foot and top
FOOT, LEG_TOP = 3.5, 188.0  # legs run from the pile caps to inside the transfer ring
TIES = (96.0, 160.0)  # steel girders, legs to core, between the nodes
WEB = (15.0, 40.0, 74.0)  # web walls: from, full depth up to, peeled into the leg at
WEB_T = 1.6  # web wall thickness at its foot
NODES = (78.0, 134.0, 170.0)  # plant nodes: lower, main mechanical level, upper equipment
SIGN = "V9 RELAY"  # operator mark on the crown (invented)
SMALL = 1.2  # LOD 1 drops parts smaller than this (m)
LOD = 0  # 1: lighter variant (no detail group, halved segments, no small parts)
RING = (185.0, 190.0)  # concrete transfer ring under the crown
FLOOR = 196.4  # top of the crown's floor slab
SERVICE, MAIN, UPPER = 4.0, 8.5, 5.0  # storey heights in the crown
CROWN_R = (15.3, 16.1)  # main glass radius at its foot and head (raked out)
UPPER_R = 13.2  # restaurant level glass radius
CS = 1.12  # crown scale: all crown radii below are multiplied by this
LEG_ANGLES = [k * 2 * math.pi / 3 + math.pi / 2 for k in range(3)]
ENTRANCE, SERVICE_SIDE, VENT_SIDE = math.radians(270), math.radians(30), math.radians(150)
LIFTS = (math.radians(270), math.radians(150))  # glazed lift shafts on the core
CONDUITS = math.radians(30)

# Preview materials (Blender only; the renderer replaces each by its name): (hex, metallic,
# roughness, emission hex, emission strength, alpha, weathering: "streak" or "rust" or None).
ROLES = {
    "concrete": (0x7E8992, 0.0, 0.9, None, 0, 1, "streak"),  # the old primary frame
    "steel": (0x2C3237, 0.55, 0.5, None, 0, 1, "rust"),  # dark gunmetal retrofits
    "mech": (0x5B6166, 0.45, 0.55, None, 0, 1, "rust"),  # industrial plant, desaturated
    "panel": (0x34383D, 0.3, 0.35, None, 0, 1, None),  # newer graphite composite cladding
    "dark": (0x15181C, 0.3, 0.6, None, 0, 1, None),  # grilles, recesses, doors
    "glass": (0x141B22, 0.0, 0.05, None, 0, 0.86, None),  # smoked glass
    "orange": (0xB5602F, 0.2, 0.6, None, 0, 1, None),  # safety accents, sparingly
    "interior": (0xE6DCCB, 0.0, 0.8, 0xFFC98A, 1.2, 1, None),  # warm amber and white rooms
    "amber": (0xFFB04A, 0.0, 0.5, 0xFFB04A, 4.0, 1, None),  # warm work lights at the plant
    "white": (0xDDEFFF, 0.0, 0.5, 0xE4F2FF, 3.0, 1, None),  # cool infrastructure light, signs
    "cyan": (0x2FD8F0, 0.0, 0.5, 0x3FE6FF, 4.0, 1, None),  # the lit conduit, info panels
    "ad": (0x0B0F17, 0.0, 0.4, 0xFFFFFF, 1.6, 1, None),  # the one curved display
    "red": (0xE2453C, 0.0, 0.5, 0xFF3B2F, 12.0, 1, None),  # aviation lights
}
TO_BLENDER = Matrix.Rotation(math.pi / 2, 4, "X")  # three (x, y, z) -> Blender (x, -z, y)
parts = {}  # (role, detail) -> [objects]


def linear(c):
    return (*[(((c >> s) & 255) / 255) ** 2.2 for s in (16, 8, 0)], 1)


def material(role):
    """Preview material, rebuilt each run: base values, and procedural weathering (vertical
    streaks and grime in crevices on concrete, rust in crevices on steel) or display content."""
    m = bpy.data.materials.get(role) or bpy.data.materials.new(role)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out, bsdf = nt.nodes.new("ShaderNodeOutputMaterial"), nt.nodes.new("ShaderNodeBsdfPrincipled")
    nt.links.new(bsdf.outputs[0], out.inputs[0])
    base, metal, rough, glow, strength, alpha, weather = ROLES[role]
    bsdf.inputs["Base Color"].default_value = linear(base)
    bsdf.inputs["Metallic"].default_value = metal
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Alpha"].default_value = alpha
    if glow:
        bsdf.inputs["Emission Color"].default_value = linear(glow)
        bsdf.inputs["Emission Strength"].default_value = strength
    if alpha < 1:
        try:
            m.surface_render_method = "BLENDED"
        except (AttributeError, TypeError):
            pass

    def mix(fac, a, b):
        n = nt.nodes.new("ShaderNodeMix")
        n.data_type = "RGBA"
        nt.links.new(fac, n.inputs[0])
        for sock, v in ((6, a), (7, b)):
            if isinstance(v, tuple):
                n.inputs[sock].default_value = v
            else:
                nt.links.new(v, n.inputs[sock])
        return n.outputs[2]

    def ramp(fac, lo, hi):
        n = nt.nodes.new("ShaderNodeMapRange")
        n.inputs[1].default_value, n.inputs[2].default_value = lo, hi
        nt.links.new(fac, n.inputs[0])
        return n.outputs[0]

    if weather:
        coord = nt.nodes.new("ShaderNodeTexCoord")
        ao = nt.nodes.new("ShaderNodeAmbientOcclusion")
        ao.inputs["Distance"].default_value = 1.5
        crevice = ramp(ao.outputs["AO"], 0.95, 0.45)  # 0 open, 1 deep in a corner
        noise = nt.nodes.new("ShaderNodeTexNoise")
        noise.inputs["Scale"].default_value = 0.35
        noise.inputs["Detail"].default_value = 6
        nt.links.new(coord.outputs["Object"], noise.inputs["Vector"])
        colour = mix(noise.outputs["Fac"], linear(base), linear(base + 0x0C0C0C))
        if weather == "streak":  # rain and dirt run down from ledges: long in z, thin across
            mapping = nt.nodes.new("ShaderNodeMapping")
            mapping.inputs["Scale"].default_value = (0.9, 0.9, 0.05)
            nt.links.new(coord.outputs["Object"], mapping.inputs["Vector"])
            streaks = nt.nodes.new("ShaderNodeTexNoise")
            streaks.inputs["Scale"].default_value = 3.0
            nt.links.new(mapping.outputs["Vector"], streaks.inputs["Vector"])
            colour = mix(ramp(streaks.outputs["Fac"], 0.58, 0.9), colour, linear(0x69727A))
            colour = mix(crevice, colour, linear(0x434A4F))
            bump = nt.nodes.new("ShaderNodeBump")
            bump.inputs["Strength"].default_value = 0.08
            nt.links.new(noise.outputs["Fac"], bump.inputs["Height"])
            nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
        else:  # rust: a little, only where water sits
            spots = nt.nodes.new("ShaderNodeTexNoise")
            spots.inputs["Scale"].default_value = 1.2
            nt.links.new(coord.outputs["Object"], spots.inputs["Vector"])
            mult = nt.nodes.new("ShaderNodeMath")
            mult.operation = "MULTIPLY"
            nt.links.new(crevice, mult.inputs[0])
            nt.links.new(ramp(spots.outputs["Fac"], 0.45, 0.7), mult.inputs[1])
            colour = mix(mult.outputs[0], colour, linear(0x6A4732))
        nt.links.new(colour, bsdf.inputs["Base Color"])
    if role == "ad":  # placeholder content: slow bands of colour, mostly dark
        uvn = nt.nodes.new("ShaderNodeTexCoord")
        wave = nt.nodes.new("ShaderNodeTexWave")
        wave.inputs["Scale"].default_value = 0.7
        wave.inputs["Distortion"].default_value = 1.2
        nt.links.new(uvn.outputs["UV"], wave.inputs["Vector"])
        cr = nt.nodes.new("ShaderNodeValToRGB")
        els = cr.color_ramp.elements
        els[0].position, els[0].color = 0.0, linear(0x0B1020)
        els[1].position, els[1].color = 1.0, linear(0xFFB347)
        for pos, c in ((0.55, 0x0B1020), (0.7, 0xD12E9A), (0.85, 0x2FD8F0)):
            e = els.new(pos)
            e.color = linear(c)
        nt.links.new(wave.outputs["Fac"], cr.inputs["Fac"])
        nt.links.new(cr.outputs["Color"], bsdf.inputs["Emission Color"])
    return m


def add(bm, role, matrix=None, detail=False, smooth_angle=None, project=True):
    """Place a finished part: project UVs (unless set), mark sharp edges, move it, keep it.
    At LOD 1 the detail group and parts under SMALL metres across are left out."""
    if LOD and role != "red":
        size = max(
            (max(v.co[i] for v in bm.verts) - min(v.co[i] for v in bm.verts)) for i in range(3)
        )
        if detail or size < SMALL:
            bm.free()
            return None
    uv = bm.loops.layers.uv.verify()
    if project:  # projectUV in geometry.js: along each face's main normal axis, in local metres
        for f in bm.faces:
            n = f.normal
            ax, ay, az = abs(n.x), abs(n.y), abs(n.z)
            for loop in f.loops:
                p = loop.vert.co
                u, v = (
                    (p.z, p.y) if ax >= ay and ax >= az else (p.x, p.z) if ay >= az else (p.x, p.y)
                )
                loop[uv].uv = (u / REPEAT, 1 - v / REPEAT)  # glTF export flips v
    for f in bm.faces:
        f.smooth = True
    if smooth_angle is not None:
        for e in bm.edges:
            e.smooth = e.is_manifold and e.calc_face_angle(0) < math.radians(smooth_angle)
    bm.transform(TO_BLENDER @ (matrix or Matrix()))
    bm.normal_update()
    mesh = bpy.data.meshes.new("part")
    bm.to_mesh(mesh)
    bm.free()
    mesh.materials.append(material(role))
    obj = bpy.data.objects.new("part", mesh)  # renamed after the join
    bpy.context.scene.collection.objects.link(obj)
    parts.setdefault((role, detail), []).append(obj)
    return obj


def at(m, x, y, z):
    return Matrix.Translation((x, y, z)) @ m


def radial(a, r, y):
    return (math.cos(a) * r, y, math.sin(a) * r)


def facing(a):
    """Turn about the vertical so local +x points out along angle a."""
    return Matrix.Rotation(-a, 4, "Y")


def box(w, h, d, bevel=0.0):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    bmesh.ops.scale(bm, vec=(w, h, d), verts=bm.verts)
    if bevel:
        bmesh.ops.bevel(bm, geom=bm.edges[:], offset=bevel, segments=2, affect="EDGES", profile=0.5)
    return bm


def block(role, w, h, d, m, detail=False, bevel=0.0):
    return add(box(w, h, d, bevel), role, m, detail, smooth_angle=40)


def loft(role, rings, detail=False, smooth_angle=40):
    """Closed solid through horizontal sections: rings is a list of point lists (same count)."""
    bm = bmesh.new()
    vs = [[bm.verts.new(p) for p in ring] for ring in rings]
    n = len(rings[0])
    for lo, hi in zip(vs, vs[1:], strict=False):
        for j in range(n):
            bm.faces.new((lo[j], lo[(j + 1) % n], hi[(j + 1) % n], hi[j]))
    bm.faces.new(vs[0][::-1])
    bm.faces.new(vs[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    return add(bm, role, None, detail, smooth_angle)


def section(c, a, pts):
    """Points (u radial, v tangential) of a section centred at c, turned to face angle a."""
    ca, sa = math.cos(a), math.sin(a)
    return [(c[0] + u * ca - v * sa, c[1], c[2] + u * sa + v * ca) for u, v in pts]


def bar(role, a, b, wu, wv, ang, detail=False):
    """Rising rectangular member from a to b, wu radial by wv tangential, sections horizontal."""
    rect = [(wu / 2, wv / 2), (-wu / 2, wv / 2), (-wu / 2, -wv / 2), (wu / 2, -wv / 2)]
    return loft(role, [section(a, ang, rect), section(b, ang, rect)], detail)


def tube(role, a, b, r, detail=False, seg=8):
    """Round tube from a to b in any direction."""
    seg = max(4, seg // 2) if LOD else seg
    a, b = Vector(a), Vector(b)
    bm = bmesh.new()
    bmesh.ops.create_cone(
        bm, cap_ends=True, segments=seg, radius1=r, radius2=r, depth=(b - a).length
    )
    turn = Vector((0, 0, 1)).rotation_difference(b - a).to_matrix().to_4x4()
    return add(bm, role, Matrix.Translation((a + b) / 2) @ turn, detail, smooth_angle=60)


def lathe(role, profile, seg=64, detail=False, smooth_angle=40, center=None):
    """Revolve a profile [(r, y), ...] about the vertical. Walk it with the outside on the right
    (out along the bottom, up the side, in over the top) so faces point outwards. r = 0 points
    close the surface at the axis. UVs: around and along the profile, in metres. center: (x, z)
    of the axis, if not the tower's."""
    seg = max(8, seg // 2) if LOD else seg
    bm = bmesh.new()
    uv = bm.loops.layers.uv.verify()
    angles = [k * 2 * math.pi / seg for k in range(seg)]
    rings = [
        [bm.verts.new((0, y, 0))]
        if r < 1e-6
        else [bm.verts.new((r * math.cos(t), y, r * math.sin(t))) for t in angles]
        for r, y in profile
    ]
    along, rmax = [0.0], max(r for r, _ in profile)
    for (r0, y0), (r1, y1) in zip(profile, profile[1:], strict=False):
        along.append(along[-1] + math.hypot(r1 - r0, y1 - y0))
    for i in range(len(profile) - 1):
        dr, dy = profile[i + 1][0] - profile[i][0], profile[i + 1][1] - profile[i][1]
        for k in range(seg):
            j = (k + 1) % seg
            corners = [(i, k, k), (i, j, k + 1), (i + 1, j, k + 1), (i + 1, k, k)]
            quad, seen = [], set()
            for ii, kk, step in corners:
                v = rings[ii][0 if len(rings[ii]) == 1 else kk]
                if v not in seen:
                    seen.add(v)
                    quad.append((v, ii, step))
            if len(quad) < 3:
                continue
            f = bm.faces.new([v for v, _, _ in quad])
            for loop, (_, ii, step) in zip(f.loops, quad, strict=True):
                loop[uv].uv = (step / seg * 2 * math.pi * rmax / REPEAT, 1 - along[ii] / REPEAT)
            t = (k + 0.5) * 2 * math.pi / seg
            f.normal_update()
            if f.normal.dot(Vector((dy * math.cos(t), -dr, dy * math.sin(t)))) < 0:
                f.normal_flip()
    m = Matrix.Translation((center[0], 0, center[1])) if center else None
    return add(bm, role, m, detail, smooth_angle, project=False)


def ring(role, r, tube_r, y, seg=64, radial_seg=6, detail=False):
    """Thin torus round the vertical at height y."""
    seg = max(12, seg // 2) if LOD else seg
    bm = bmesh.new()
    vs = [
        [
            bm.verts.new(
                (
                    (r + tube_r * math.cos(b)) * math.cos(a),
                    y + tube_r * math.sin(b),
                    (r + tube_r * math.cos(b)) * math.sin(a),
                )
            )
            for b in (j * 2 * math.pi / radial_seg for j in range(radial_seg))
        ]
        for a in (i * 2 * math.pi / seg for i in range(seg))
    ]
    for i in range(seg):
        for j in range(radial_seg):
            a, b = vs[i], vs[(i + 1) % seg]
            bm.faces.new((a[j], b[j], b[(j + 1) % radial_seg], a[(j + 1) % radial_seg]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    return add(bm, role, None, detail, smooth_angle=80)


def lamp(p, r=0.4):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=8, v_segments=6, radius=r)
    return add(bm, "red", Matrix.Translation(p), smooth_angle=80)


def core_r(y):
    return CORE[0] + (CORE[1] - CORE[0]) * y / TOP


def leg_s(y):
    return (y - FOOT) / (LEG_TOP - FOOT)


def leg_r(y):
    return LEG_R[1] + (LEG_R[0] - LEG_R[1]) * (1 - leg_s(y)) ** 2.0


def leg_dw(y):
    s = leg_s(y)
    return (
        LEG_D[1] + (LEG_D[0] - LEG_D[1]) * (1 - s) ** 1.3,
        LEG_W[1] + (LEG_W[0] - LEG_W[1]) * (1 - s) ** 1.3,
    )


def rail(role, pts, h=1.1):
    """A handrail at height h over a polyline of floor points, with posts; detail only."""
    for p, q in zip(pts, pts[1:], strict=False):
        tube(role, (p[0], p[1] + h, p[2]), (q[0], q[1] + h, q[2]), 0.04, True, 4)
    for p in pts:
        tube(role, p, (p[0], p[1] + h, p[2]), 0.035, True, 4)


def offset(c, a, side):
    """Point c moved sideways (tangentially to angle a) by side metres."""
    return (c[0] - math.sin(a) * side, c[1], c[2] + math.cos(a) * side)


def arc(role, profile, a0, a1, seg, detail=False, uv01=False, smooth_angle=30):
    """A closed profile [(r, y), ...] swept from angle a0 to a1, capped at both ends: a band
    segment (armour, a display, a walkway). uv01: UVs 0..1 across the outside, as a viewer reads
    it, for a screen texture; otherwise in metres."""
    seg = max(2, seg // 2) if LOD else seg
    bm = bmesh.new()
    uv = bm.loops.layers.uv.verify()
    n, ys = len(profile), [y for _, y in profile]
    angs = [a0 + (a1 - a0) * i / seg for i in range(seg + 1)]
    rings = [
        [bm.verts.new((r * math.cos(t), y, r * math.sin(t))) for r, y in profile] for t in angs
    ]
    for i in range(seg):
        for j in range(n):
            q = (j + 1) % n
            f = bm.faces.new((rings[i][j], rings[i + 1][j], rings[i + 1][q], rings[i][q]))
            for loop, (ii, jj) in zip(
                f.loops, ((i, j), (i + 1, j), (i + 1, q), (i, q)), strict=True
            ):
                r, y = profile[jj]
                loop[uv].uv = (
                    (1 - ii / seg, (y - min(ys)) / (max(ys) - min(ys)))
                    if uv01
                    else (angs[ii] * r / REPEAT, 1 - y / REPEAT)
                )
    bm.faces.new(rings[0])
    bm.faces.new(rings[-1][::-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    return add(bm, role, None, detail, smooth_angle, project=False)


def text(role, body, size, m, depth=0.12):
    """Invented sign text as geometry, in a vertical plane facing local +x (use facing(a)).
    Left out at LOD 1, where it would be a few pixels."""
    if LOD:
        return None
    cu = bpy.data.curves.new("sign_text", "FONT")
    cu.body, cu.size, cu.extrude = body, size, depth
    cu.align_x, cu.align_y = "CENTER", "CENTER"
    ob = bpy.data.objects.new("sign_text", cu)
    bpy.context.scene.collection.objects.link(ob)
    dg = bpy.context.evaluated_depsgraph_get()
    ev = ob.evaluated_get(dg)
    bm = bmesh.new()
    bm.from_mesh(ev.to_mesh())
    ev.to_mesh_clear()
    bpy.data.objects.remove(ob)
    bpy.data.curves.remove(cu)
    return add(bm, role, m @ Matrix.Rotation(math.pi / 2, 4, "Y"), smooth_angle=30)


def dish(r, m, detail=False):
    """Dish antenna opening along local +z, with a feed boom."""
    bm = bmesh.new()
    bmesh.ops.create_cone(
        bm, cap_ends=True, segments=16 if not LOD else 8, radius1=0.3, radius2=r, depth=r * 0.35
    )
    add(bm, "mech", m, detail, smooth_angle=50)
    tube("steel", m @ Vector((0, 0, 0)), m @ Vector((0, 0, r * 0.9)), 0.06, True, 6)


def fan(c, y, r=1.4):
    """Roof fan unit: a shroud with a dark grille, axis vertical at point c."""
    lathe(
        "mech",
        [(r - 0.2, y), (r, y), (r, y + 1.1), (r - 0.2, y + 1.1), (r - 0.2, y)],
        16,
        smooth_angle=30,
        center=(c[0], c[2]),
    )
    lathe("dark", [(r - 0.2, y + 0.85), (0, y + 0.85)], 16, center=(c[0], c[2]))


def radiator(c, a, y, n, width, h, depth=0.9):
    """A bank of n vertical cooling fins standing off a face that looks out along angle a,
    with header pipes top and bottom; c is the bank's centre on the face."""
    for i in range(n):
        p = offset(
            (c[0] + math.cos(a) * depth / 2, y, c[2] + math.sin(a) * depth / 2),
            a,
            (i / (n - 1) - 0.5) * width,
        )
        block("mech", depth, h, 0.07, at(facing(a), *p))
    for yy in (y - h / 2 - 0.15, y + h / 2 + 0.15):
        e0 = offset((c[0], yy, c[2]), a, -width / 2 - 0.3)
        e1 = offset((c[0], yy, c[2]), a, width / 2 + 0.3)
        tube("steel", e0, e1, 0.16, seg=8)


def grille(c, a, y, w, h):
    """Ventilation grille on a face looking out along angle a: dark opening, steel slats."""
    block("dark", 0.12, h, w, at(facing(a), c[0], y, c[2]))
    for i in range(int(h / 0.45)):
        yy = y - h / 2 + 0.25 + i * 0.45
        slat = at(facing(a) @ Matrix.Rotation(-0.5, 4, "Z"), c[0], yy, c[2])
        block("steel", 0.3, 0.05, w - 0.1, slat, True)


def collar(y, r_in, r_out, h, role="steel"):
    """Heavy steel ring collar with chamfered outer edges, a warm work-light line under it."""
    ring("amber", r_out - 0.15, 0.07, y - h / 2 - 0.05, 48, 4)
    lathe(
        role,
        [
            (r_in, y - h / 2),
            (r_out - 0.3, y - h / 2),
            (r_out, y - h / 2 + 0.3),
            (r_out, y + h / 2 - 0.3),
            (r_out - 0.3, y + h / 2),
            (r_in, y + h / 2),
            (r_in, y - h / 2),
        ],
        48,
        smooth_angle=30,
    )


def leg_out(y):
    """Radius of the legs' outer faces at height y."""
    return leg_r(y) + leg_dw(y)[0] / 2


def gaps():
    """Angles midway between the legs."""
    return [a + math.pi / 3 for a in LEG_ANGLES]


# ---------------------------------------------------------------------------------------------


def build_core():
    """Tapered concrete core in JOINT-high lifts with recessed joints, from the ground up through
    the crown to the penthouse. LOD 1: one plain taper."""
    if LOD:
        lathe("concrete", [(core_r(0), 0), (core_r(TOP), TOP)], 24)
        return
    y = 0.0
    while y < TOP - 0.1:
        y1 = min(y + JOINT, TOP)
        lathe(
            "concrete",
            [
                (core_r(y) - 0.15, y),
                (core_r(y) - 0.15, y + 0.15),
                (core_r(y + 0.3), y + 0.3),
                (core_r(y1 - 0.3), y1 - 0.3),
                (core_r(y1) - 0.15, y1 - 0.15),
                (core_r(y1) - 0.15, y1),
            ],
            48,
        )
        y = y1


def build_legs():
    """Three concrete legs: a chamfered section, deep at the foot and slim at the top, on a
    concave curve in towards the core; recessed panel joints every JOINT metres."""
    joints = set() if LOD else set(range(int(JOINT), int(LEG_TOP), int(JOINT)))
    levels = sorted(
        {FOOT + (LEG_TOP - FOOT) * (i / 16) ** 1.3 for i in range(17)}
        | {j + d for j in joints for d in (-0.2, 0.2)}
        | joints
    )
    for a in LEG_ANGLES:
        rings = []
        for y in levels:
            d, w = leg_dw(y)
            k = 0.97 if y in joints else 1.0
            pts = [
                (d / 2, w * 0.2),
                (d * 0.28, w / 2),
                (-d * 0.36, w / 2),
                (-d / 2, w * 0.3),
                (-d / 2, -w * 0.3),
                (-d * 0.36, -w / 2),
                (d * 0.28, -w / 2),
                (d / 2, -w * 0.2),
            ]
            rings.append(section(radial(a, leg_r(y), y), a, [(u * k, v * k) for u, v in pts]))
        loft("concrete", rings, smooth_angle=30)


def build_webs():
    """Concrete web walls in each leg's plane, core to leg, from the podium roof up the lower
    shaft. Above WEB[1] the web peels off the core on a curve and runs into the leg, so the legs
    read as growing out of the core rather than standing apart from it."""
    y0, y1, top = WEB
    levels = [y0 + (top - y0) * i / 24 for i in range(25)]
    for a in LEG_ANGLES:
        rings = []
        for y in levels:
            inner, outer = core_r(y) - 0.3, leg_r(y) - leg_dw(y)[0] * 0.3
            if y > y1:
                inner += (outer - 0.6 - inner) * ((y - y1) / (top - y1)) ** 1.6
            t = WEB_T * (1 - 0.35 * (y - y0) / (top - y0))
            rings.append(
                section(
                    radial(a, (inner + outer) / 2, y),
                    a,
                    [
                        ((outer - inner) / 2, t / 2),
                        (-(outer - inner) / 2, t / 2),
                        (-(outer - inner) / 2, -t / 2),
                        ((outer - inner) / 2, -t / 2),
                    ],
                )
            )
        loft("concrete", rings, smooth_angle=30)


def build_ties():
    """Steel box girders from the core to each leg's inner face at every tie level, with bolted
    connection plates at both ends."""
    for y in TIES:
        for a in LEG_ANGLES:
            r0, r1 = core_r(y), leg_r(y) - leg_dw(y)[0] / 2 + 0.1
            mid = (r0 + r1) / 2
            block("steel", r1 - r0, 1.8, 1.2, at(facing(a), *radial(a, mid, y)))
            for r in (r0 + 0.15, r1 - 0.15):
                block("steel", 0.3, 2.6, 2.0, at(facing(a), *radial(a, r, y)))


def build_lifts():
    """Enclosed lift shafts (a steel frame clad in composite panels, a narrow glass strip up the
    front) riding up the core; one carries a lit service conduit, the other a column of
    segmented maintenance indicators. Two large pipelines up the third face, feeding the plant
    nodes, clamped at each node and every 24 m, with a cable tray beside them."""
    for a in LIFTS:
        y0, y1 = 9.6, RING[0]
        d = 3.0
        c0, c1 = radial(a, core_r(y0) + d / 2 - 0.2, y0), radial(a, core_r(y1) + d / 2 - 0.2, y1)
        bar("mech", c0, c1, d, 4.2, a)
        f0, f1 = radial(a, core_r(y0) + d - 0.15, y0), radial(a, core_r(y1) + d - 0.15, y1)
        bar("glass", f0, f1, 0.12, 0.8, a)
        for side in (-2.15, 2.15):  # steel corner posts
            bar("steel", offset(c0, a, side), offset(c1, a, side), d + 0.3, 0.25, a)
        for y in range(int(JOINT), int(y1), int(JOINT)):  # frame bands, an indicator at each
            block(
                "steel", d + 0.3, 0.35, 4.6, at(facing(a), *radial(a, core_r(y) + d / 2 - 0.2, y))
            )
            if a == LIFTS[1]:
                p = offset(radial(a, core_r(y + 3) + d - 0.05, y + 3), a, 1.6)
                block("white", 0.12, 1.2, 0.35, at(facing(a), *p))
        if a == LIFTS[0]:  # the lit conduit, up one front edge
            g0, g1 = (offset(radial(a, core_r(y) + d - 0.05, y), a, -1.7) for y in (y0, y1))
            bar("cyan", g0, g1, 0.14, 0.14, a)
    a = CONDUITS
    for side in (-0.85, 0.85):
        lo, hi = (offset(radial(a, core_r(y) + 1.0, y), a, side) for y in (14.6, NODES[2]))
        tube("mech", lo, hi, 0.62, seg=12)
    tray0, tray1 = (offset(radial(a, core_r(y) + 0.25, y), a, 2.2) for y in (14.6, RING[0]))
    bar("steel", tray0, tray1, 0.5, 0.9, a)
    for y in sorted({*NODES, *range(36, int(NODES[2]), 24)}):
        if y < NODES[2]:
            block("steel", 1.6, 0.5, 3.4, at(facing(a), *radial(a, core_r(y) + 1.0, y)))


def build_nodes():
    """The plant nodes, at structural transitions only; the shaft between them stays clean.
    Each breaks the shaft's outline, so it reads from across the city."""
    gs = gaps()
    # Lower plant node, where the web walls end: three heavy housings between the legs, reaching
    # out past them (fans on top, a radiator bank on one, grilles on the others), and a collar.
    y = NODES[0]
    for k, a in enumerate(gs):
        r0, r1 = core_r(y) - 0.3, leg_out(y) + 2.6
        mid = (r0 + r1) / 2
        block("mech", r1 - r0, 10.0, 8.0, at(facing(a), *radial(a, mid, y)), bevel=0.2)
        block("steel", r1 - r0 + 0.5, 0.7, 8.5, at(facing(a), *radial(a, mid, y + 5.2)))
        block("steel", r1 - r0 + 0.5, 0.7, 8.5, at(facing(a), *radial(a, mid, y - 5.2)))
        for side in (-2.0, 2.0):
            fan(offset(radial(a, r1 - 2.4, 0), a, side), y + 5.5, 1.5)
        for side in (-2.6, 2.6):  # lit plant-room windows on the side faces
            for sgn in (-1, 1):
                p = offset(radial(a, mid + side, y + 2.4), a, sgn * 4.03)
                block("interior", 1.6, 0.9, 0.08, at(facing(a), *p))
        if k == 0:
            radiator(radial(a, r1, y), a, y, 14, 6.4, 7.0, 1.0)
        else:
            grille(radial(a, r1 + 0.05, 0), a, y + 1.5, 5.0, 3.6)
            block(
                "dark",
                0.12,
                2.4,
                1.6,
                at(facing(a), *offset(radial(a, r1 + 0.05, y - 3.2), a, 2.6)),
            )
    collar(y + 6.2, leg_out(y + 6.2) - 1.6, leg_out(y + 6.2) + 0.8, 2.6)

    # Main mechanical level: a faceted two-storey plant drum wrapped round core and legs, on
    # steel corbels from the legs; a louvred band with radiator banks, collars top and bottom,
    # comms modules and a gantry on the roof ring.
    y0, y1 = NODES[1] - 7.0, NODES[1] + 7.0
    rd = leg_out(NODES[1]) + 2.6
    lathe(
        "mech",
        [
            (core_r(y0), y0),
            (rd - 1.0, y0),
            (rd, y0 + 1.6),
            (rd, y1 - 1.0),
            (rd - 0.6, y1),
            (core_r(y1), y1),
        ],
        12,
        smooth_angle=20,
    )
    lathe("dark", [(rd + 0.03, NODES[1] - 1.2), (rd + 0.03, NODES[1] + 2.6)], 12, smooth_angle=20)
    collar(y0 + 1.2, rd - 0.4, rd + 0.5, 1.2)
    collar(y1 - 0.5, rd - 0.4, rd + 0.6, 1.0)
    for k in range(12):  # louvre fins on each facet, radiator banks on three
        b = (k + 0.5) * 2 * math.pi / 12
        apo = rd * math.cos(math.pi / 12)
        for i in range(5):
            p = offset(radial(b, apo + 0.15, NODES[1] + 0.7), b, (i - 2) * 1.2)
            block("steel", 0.45, 3.4, 0.08, at(facing(b) @ Matrix.Rotation(0.4, 4, "Y"), *p))
        if k % 4 == 1:
            radiator(radial(b, apo + 0.5, 0), b, y0 + 3.6, 10, 5.0, 3.2, 0.8)
        elif k % 2:  # lit control-room windows on some facets
            p = radial(b, apo + 0.06, NODES[1] + 4.4)
            block("interior", 0.08, 1.0, 3.2, at(facing(b), *p))
    for a in LEG_ANGLES:  # corbels: raking steel from the leg's outer face to the drum's edge
        for side in (-1.2, 1.2):
            foot = offset(radial(a, leg_out(y0 - 6) - 0.3, y0 - 6), a, side)
            head = offset(radial(a, rd - 1.2, y0 + 0.2), a, side)
            tube("steel", foot, head, 0.65, seg=10)
    for a in gs:  # comms modules on the roof ring
        for side in (-1.4, 1.4):
            p = offset(radial(a, rd - 1.6, y1 + 1.7), a, side)
            block("steel", 0.5, 3.4, 1.3, at(facing(a), *p))
    a = gs[0]  # service gantry off the roof ring, safety-orange rails
    block("steel", 3.0, 0.25, 4.2, at(facing(a), *radial(a, rd + 1.3, y1 - 0.2)))
    for side in (-1.9, 1.9):
        rail(
            "orange",
            [
                offset(radial(a, rd - 0.2, y1 - 0.05), a, side),
                offset(radial(a, rd + 2.7, y1 - 0.05), a, side),
            ],
        )
    rail("orange", [offset(radial(a, rd + 2.7, y1 - 0.05), a, s2) for s2 in (-1.9, 1.9)])
    p = radial(gs[1], rd - 2.6, y1 + 1.6)  # a roof plant room
    block("mech", 3.6, 3.2, 4.6, at(facing(gs[1]), *p), bevel=0.1)

    # Upper equipment node under the transfer ring: enclosures between the legs, out past them,
    # radiator banks on two, a grille on the third, a collar, a sensor dome.
    y = NODES[2]
    for k, a in enumerate(gs):
        r0, r1 = core_r(y) - 0.3, leg_out(y) + 1.8
        block("mech", r1 - r0, 7.0, 5.4, at(facing(a), *radial(a, (r0 + r1) / 2, y)), bevel=0.15)
        block("steel", r1 - r0 + 0.4, 0.5, 5.8, at(facing(a), *radial(a, (r0 + r1) / 2, y + 3.7)))
        if k < 2:
            radiator(radial(a, r1, y), a, y, 9, 4.2, 5.0, 0.8)
        else:
            grille(radial(a, r1 + 0.05, 0), a, y + 0.6, 3.6, 2.6)
    collar(y + 5.0, leg_out(y + 5.0) - 1.5, leg_out(y + 5.0) + 0.6, 2.0)
    a = gs[2]
    dome = radial(a, leg_out(y) + 0.2, y + 3.95)
    lathe(
        "mech",
        [(0, dome[1]), (0.9, dome[1]), (0.9, dome[1] + 0.6), (0, dome[1] + 0.6)],
        12,
        center=(dome[0], dome[2]),
    )
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=16 if not LOD else 8, v_segments=8, radius=1.4)
    add(bm, "mech", Matrix.Translation((dome[0], dome[1] + 1.6, dome[2])), smooth_angle=80)


def build_transfer():
    """Where the structure gathers under the crown: a concrete transfer ring round the core that
    the legs run into, faceted and with a recessed joint; twelve raking steel columns from bearing
    plates on its face out to the crown floor's edge, and radial steel beams under the floor
    from each column head back to the core, so the load path reads."""
    y0, y1 = RING
    mid = (y0 + y1) / 2
    lathe(
        "concrete",
        [
            (core_r(y0) - 0.2, y0),
            (8.6, y0),
            (9.8, y0 + 1.0),
            (9.8, mid - 0.2),
            (9.55, mid),
            (9.8, mid + 0.2),
            (9.8, y1 - 0.6),
            (9.2, y1),
            (core_r(y1) - 0.2, y1),
        ],
        24,
        smooth_angle=20,
    )
    head_r, beam_y = 15.0 * CS, FLOOR - 1.2 - 0.45
    for k in range(12):
        a = k * math.pi / 6 + LEG_ANGLES[0]
        bar("steel", radial(a, 9.9, y0 + 1.9), radial(a, head_r, FLOOR - 1.1), 1.0, 0.8, a)
        block("steel", 0.3, 2.2, 1.6, at(facing(a), *radial(a, 9.95, y0 + 2.1)))
        r0 = core_r(beam_y)
        block("steel", head_r - r0, 0.9, 0.55, at(facing(a), *radial(a, (head_r + r0) / 2, beam_y)))


def build_crown():
    """The observation crown, from its floor slab up to the plant penthouse."""
    f = FLOOR
    lathe(
        "concrete",
        [
            (core_r(f) - 0.2, f - 1.2),
            (15.5 * CS, f - 1.2),
            (15.9 * CS, f - 0.8),
            (15.9 * CS, f),
            (core_r(f) - 0.2, f),
        ],
        64,
    )
    # Service level: set back, louvred.
    s1 = f + SERVICE
    lathe("dark", [(13.6 * CS, f), (13.6 * CS, s1)], 64)
    for k in range(64):
        a = k * 2 * math.pi / 64
        fin = at(facing(a) @ Matrix.Rotation(0.35, 4, "Y"), *radial(a, 13.95 * CS, (f + s1) / 2))
        block("steel", 0.7, SERVICE - 0.3, 0.1, fin)
    # Main floor slab, the observation level's glass, mullions, a transom, the lit ceiling.
    m0 = s1 + 0.8
    lathe(
        "concrete",
        [
            (core_r(s1), s1),
            (16.1 * CS, s1),
            (16.3 * CS, s1 + 0.3),
            (16.3 * CS, m0 - 0.1),
            (15.3 * CS, m0),
            (core_r(m0), m0),
        ],
        64,
    )
    m1 = m0 + MAIN
    lathe("glass", [(CROWN_R[0] * CS, m0), (CROWN_R[1] * CS, m1)], 64)
    for k in range(60):
        a = k * 2 * math.pi / 60
        foot, head = radial(a, CROWN_R[0] * CS + 0.05, m0), radial(a, CROWN_R[1] * CS + 0.05, m1)
        bar("steel", foot, head, 0.32, 0.16, a)
    ring("steel", (CROWN_R[0] + CROWN_R[1]) / 2 * CS + 0.12, 0.1, m0 + MAIN * 0.5, 64, 4)
    lathe("interior", [(4.2 * CS, m1 - 0.05), (15.6 * CS, m1 - 0.05)], 64)  # ceiling, facing down
    for k in range(12):  # interior columns, and a few silhouettes: counters, seating
        a = k * math.pi / 6 + 0.13
        tube("concrete", radial(a, 10.5 * CS, m0), radial(a, 10.5 * CS, m1), 0.45, seg=10)
        if k % 2:
            p = radial(a + 0.25, 13.2 * CS, m0 + 0.55)
            block("dark", 2.4, 1.1, 0.8, at(facing(a + 0.25), *p), True)
    # Upper slab with a thin overhang, and a cool line of light under its edge.
    u0 = m1 + 1.0
    lathe(
        "concrete",
        [
            (core_r(m1), m1),
            (16.8 * CS, m1),
            (17.1 * CS, m1 + 0.35),
            (17.1 * CS, u0 - 0.3),
            (16.8 * CS, u0),
            (core_r(u0), u0),
        ],
        64,
    )
    ring("white", 16.95 * CS, 0.05, m1 - 0.03, 96, 4)
    # Control level: reinforced. A composite wall to sill height, a band of slit glazing behind
    # steel fins, and a visor-like upper wall leaning out over it; the lit ceiling shows through.
    u1 = u0 + UPPER
    U = UPPER_R * CS
    sill, head = u0 + 1.5, u0 + 3.0
    lathe("panel", [(U - 0.2, u0), (U + 0.5, u0), (U + 0.5, sill), (U - 0.2, sill)], 64)
    lathe("glass", [(U + 0.05, sill), (U + 0.05, head)], 64)
    lathe("panel", [(U - 0.2, head), (U + 0.5, head), (U + 1.0, u1), (U - 0.2, u1)], 64)
    for k in range(48):
        a = k * 2 * math.pi / 48
        bar("steel", radial(a, U + 0.3, sill), radial(a, U + 0.3, head), 0.5, 0.14, a)
    lathe("interior", [(5.0 * CS, u1 - 0.05), (U - 0.3, u1 - 0.05)], 64)
    for k in range(16):
        a = k * math.pi / 8
        block("dark", 1.2, 0.9, 1.2, at(facing(a), *radial(a, 11.4 * CS, u0 + 0.45)), True)
    # Roof: a thin overhanging slab, a shallow taper, the plant penthouse with louvres.
    lathe(
        "concrete",
        [
            (core_r(u1), u1),
            (14.4 * CS, u1),
            (14.6 * CS, u1 + 0.35),
            (14.3 * CS, u1 + 0.7),
            (6.2 * CS, u1 + 3.4),
            (4.9 * CS, u1 + 3.6),
            (4.9 * CS, TOP - 0.6),
            (5.3 * CS, TOP - 0.4),
            (5.3 * CS, TOP),
            (0, TOP),
        ],
        64,
    )
    slope = math.atan2(2.7, 8.1 * CS)
    for k in range(24):
        a = k * 2 * math.pi / 24
        fin = at(facing(a) @ Matrix.Rotation(0.4, 4, "Y"), *radial(a, 5.0 * CS, (u1 + TOP + 3) / 2))
        block("steel", 0.5, TOP - u1 - 4.8, 0.08, fin)
        rib = at(facing(a) @ Matrix.Rotation(-slope, 4, "Z"), *radial(a, 10.3 * CS, u1 + 2.1))
        block("steel", 8.4 * CS, 0.12, 0.16, rib, True)
    for a in LEG_ANGLES:
        lamp(radial(a + math.pi / 3, 14.3 * CS, u1 + 1.0), 0.3)


def crown_levels():
    s1 = FLOOR + SERVICE
    m0 = s1 + 0.8
    m1 = m0 + MAIN
    u0 = m1 + 1.0
    return s1, m0, m1, u0, u0 + UPPER


def roof_y(r):
    """Height of the crown's sloping roof at radius r."""
    u1 = crown_levels()[4]
    return u1 + 0.7 + (14.3 * CS - r) / ((14.3 - 6.2) * CS) * 2.7


def build_command():
    """The crown as a command complex: angular armour over each leg on the observation level,
    the operator's mark on one, one curved display on the control level over the entrance,
    walkways round two stretches of the glass, large dishes and modular arrays, a radome."""
    s1, m0, m1, u0, u1 = crown_levels()
    g0, g1 = CROWN_R[0] * CS, CROWN_R[1] * CS
    for k, a in enumerate(LEG_ANGLES):  # faceted armour, wide at the waist, steel capped
        prof = [
            (g0 - 0.2, m0 - 1.0),
            (g0 + 1.9, m0 + 0.6),
            (g1 + 1.9, m0 + MAIN * 0.55),
            (g1 + 1.4, m1 + 0.4),
            (g1 - 0.2, m1 + 0.4),
        ]
        arc("concrete", prof, a - 0.28, a + 0.28, 4)
        U = UPPER_R * CS  # the fin carries on up the control level, raked back at the top
        arc(
            "steel",
            [(U + 0.4, u0 - 0.1), (g1 + 0.9, u0 - 0.1), (U + 2.2, u1 + 0.5), (U + 0.4, u1 + 0.5)],
            a - 0.12,
            a + 0.12,
            2,
        )
        if k == 2:
            y = m0 + MAIN * 0.55
            text("white", SIGN, 1.5, at(facing(a), *radial(a, g1 + 2.0, y)))
    U = UPPER_R * CS
    a0, a1 = ENTRANCE - 0.6, ENTRANCE + 0.6  # the display, framed in steel
    arc(
        "ad",
        [(U + 1.05, u0 + 0.4), (U + 1.3, u0 + 0.4), (U + 1.3, u1 - 0.4), (U + 1.05, u1 - 0.4)],
        a0,
        a1,
        16,
        uv01=True,
    )
    for y in (u0 + 0.25, u1 - 0.25):
        arc(
            "steel",
            [(U + 0.9, y - 0.15), (U + 1.45, y - 0.15), (U + 1.45, y + 0.15), (U + 0.9, y + 0.15)],
            a0 - 0.02,
            a1 + 0.02,
            16,
        )
    for a in (a0 - 0.02, a1 + 0.02):
        block("steel", 0.6, UPPER, 0.3, at(facing(a), *radial(a, U + 1.15, (u0 + u1) / 2)))
    slab = 16.3 * CS
    for c in (gaps()[0], gaps()[1]):  # walkways off the slab edge, orange rails
        arc(
            "steel",
            [
                (slab - 0.1, m0 - 0.35),
                (slab + 1.6, m0 - 0.35),
                (slab + 1.6, m0 - 0.15),
                (slab - 0.1, m0 - 0.15),
            ],
            c - 0.55,
            c + 0.55,
            12,
        )
        pts = [radial(c - 0.55 + 1.1 * i / 10, slab + 1.5, m0 - 0.15) for i in range(11)]
        rail("orange", pts)
    for a in (gaps()[0] + 0.5, gaps()[2] - 0.4):  # large dishes on pedestals at the roof edge
        r = 11.2 * CS
        p = radial(a, r, roof_y(r) + 4.6)
        tube("mech", radial(a, r - 0.8, roof_y(r - 0.8)), radial(a, r - 0.8, p[1]), 0.35, seg=10)
        dish(
            4.2,
            at(
                facing(a) @ Matrix.Rotation(math.pi / 2, 4, "Y") @ Matrix.Rotation(-0.35, 4, "X"),
                *p,
            ),
        )
    for k in range(4):  # modular arrays on the penthouse
        a = k * math.pi / 2 + 0.4
        block("steel", 0.35, 3.4, 1.3, at(facing(a), *radial(a, 5.6 * CS, TOP - 2.4)))
    a, r = gaps()[1] + 0.3, 8.6 * CS  # radome on a plinth
    y = roof_y(r)
    lathe("mech", [(0, y), (1.4, y), (1.4, y + 1.0), (0, y + 1.0)], 16, center=radial(a, r, 0)[::2])
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=20 if not LOD else 10, v_segments=10, radius=2.4)
    add(bm, "mech", Matrix.Translation(radial(a, r, y + 2.6)), smooth_angle=80)


def build_mast():
    """Short mast: a three-legged lattice (horizontal frames and one diagonal per face per panel,
    all node to node), two platforms, panel antennas; a tapered pole; obstruction lights."""
    y0, y1, panels = TOP, TOP + 18.0, 3
    corner = [k * 2 * math.pi / 3 + math.pi / 6 for k in range(3)]

    def node(c, y):
        return radial(c, 2.2 + (1.0 - 2.2) * (y - y0) / (y1 - y0), y)

    for c in corner:
        tube("steel", node(c, y0), node(c, y1), 0.22, seg=8)
    for i in range(panels + 1):
        y = y0 + i * (y1 - y0) / panels
        for k, c in enumerate(corner):
            nxt = corner[(k + 1) % 3]
            tube("steel", node(c, y), node(nxt, y), 0.1, seg=6)
            if i < panels:
                lo, hi = (c, nxt) if (i + k) % 2 else (nxt, c)
                tube("steel", node(lo, y), node(hi, y + (y1 - y0) / panels), 0.08, seg=6)
    for y, r in ((y0 + 6.0, 3.0), (y1, 2.0)):  # platforms with rails
        lathe("steel", [(0.6, y - 0.08), (r, y - 0.08), (r, y + 0.08), (0.6, y + 0.08)], 24)
        ring("steel", r - 0.05, 0.03, y + 1.1, 24, 4, True)
    for k, c in enumerate(corner):  # panel antennas on the lattice and the pole
        a = c + math.pi / 3
        block("steel", 0.25, 2.6, 0.7, at(facing(a), *radial(a, 2.0, y0 + 9.5)))
        b = a + 0.4
        block("steel", 0.22, 2.0, 0.6, at(facing(b), *radial(b, 1.0, y1 + 4.5 + k * 0.4)))
    lathe(
        "steel",
        [(0.8, y1 - 1.0), (0.8, y1), (0.28, H - 1.6), (0.08, H - 1.6), (0.08, H), (0, H)],
        16,
    )
    for c in corner:
        lamp(node(c, y1 + 0.3), 0.25)
    lamp(radial(0, 0.5, y1 + 8.0), 0.22)
    lamp((0, H + 0.2, 0), 0.3)


def build_base():
    """Industrial-civic hub at the foot, inside the legs' reach: pile caps with steel shoes and
    gussets under the legs; the glazed lobby ring and its upper drum; a monumental portal at the
    entrance with the operator's name and info panels; maintenance garages with an apron; a power
    yard (transformers with radiators, a switchgear house) linked to the drum by an enclosed
    cable bridge; two ventilation towers."""
    for a in LEG_ANGLES:
        d, w = leg_dw(FOOT)
        c = radial(a, leg_r(FOOT), 0)
        block("concrete", d + 4.0, 1.2, w + 4.0, at(facing(a), c[0], 0.6, c[2]), bevel=0.2)
        block(
            "concrete",
            d + 3.0,
            FOOT - 1.2,
            w + 3.0,
            at(facing(a), c[0], 1.2 + (FOOT - 1.2) / 2, c[2]),
            bevel=0.2,
        )
        block("steel", d + 0.6, 0.5, w + 0.6, at(facing(a), c[0], FOOT + 0.05, c[2]))
        for side in (-1, 1):  # gusset plates either side of the foot
            p = offset((c[0], FOOT + 1.2, c[2]), a, side * (w / 2 + 0.15))
            block("steel", d + 0.4, 2.0, 0.25, at(facing(a), *p))
    g0, g1 = 0.8, 8.8
    lathe("concrete", [(0, 0), (12.6, 0), (12.6, g0), (0, g0)], 64)  # plinth
    lathe("glass", [(11.6, g0), (11.6, g1)], 64)
    for k in range(40):
        a = k * 2 * math.pi / 40
        bar("steel", radial(a, 11.65, g0), radial(a, 11.65, g1), 0.3, 0.16, a)
    lathe("interior", [(7.2, g1 - 0.05), (11.5, g1 - 0.05)], 64)
    lathe(
        "concrete",
        [
            (core_r(g1), g1),
            (12.8, g1),
            (13.0, g1 + 0.3),
            (13.0, g1 + 0.9),
            (12.4, g1 + 0.9),
            (12.6, g1 + 1.2),
            (12.6, 22.0),
            (13.2, 22.2),
            (13.2, 23.0),
            (core_r(23.0), 23.0),
        ],
        64,
    )
    # The podium's upper plant level: a louvred band with fins round the drum.
    lathe("dark", [(12.63, 14.0), (12.63, 19.0)], 64)
    for k in range(48):
        b = k * 2 * math.pi / 48
        fin = at(facing(b) @ Matrix.Rotation(0.45, 4, "Y"), *radial(b, 12.85, 16.5))
        block("steel", 0.5, 4.6, 0.08, fin)
    for k in range(4):  # lobby silhouettes
        a = ENTRANCE + math.pi + (k - 1.5) * 0.5
        block("dark", 2.8, 1.1, 0.9, at(facing(a + math.pi / 2), *radial(a, 9.0, g0 + 0.55)), True)
    # Portal: two concrete pylons and a lintel carrying the name, over the doors and canopy.
    a = ENTRANCE
    block("dark", 0.4, 4.4, 6.0, at(facing(a), *radial(a, 11.7, g0 + 2.2)))
    block("steel", 9.0, 0.45, 10.0, at(facing(a), *radial(a, 16.2, 6.0)), bevel=0.1)
    block("glass", 8.6, 0.1, 9.6, at(facing(a), *radial(a, 16.2, 6.28)))
    for side in (-6.4, 6.4):
        p = offset(radial(a, 19.6, 6.8), a, side)
        block("concrete", 3.0, 13.6, 2.6, at(facing(a), *p), bevel=0.15)
        block("cyan", 0.12, 2.2, 1.3, at(facing(a), *offset(radial(a, 21.15, 3.2), a, side)))
    block("concrete", 3.2, 2.8, 15.4, at(facing(a), *radial(a, 19.6, 15.0)), bevel=0.15)
    text("white", "RELAY TOWER", 1.3, at(facing(a), *radial(a, 21.25, 15.0)))
    # Garages: three bays, steel headers, an apron, roof vents.
    a = SERVICE_SIDE
    block("concrete", 8.0, 6.5, 16.0, at(facing(a), *radial(a, 17.5, 3.25)), bevel=0.15)
    for side in (-5.0, 0.0, 5.0):
        block("dark", 0.2, 4.6, 4.0, at(facing(a), *offset(radial(a, 21.55, 2.3), a, side)))
        block("orange", 0.25, 0.3, 4.3, at(facing(a), *offset(radial(a, 21.6, 4.75), a, side)))
        if side:
            fan(offset(radial(a, 17.5, 0), a, side), 6.5, 1.1)
    block("concrete", 4.0, 0.2, 17.0, at(facing(a), *radial(a, 23.5, 0.1)))
    # Power yard: a pad, three transformers with radiator banks, a switchgear house, and the
    # enclosed cable bridge up to the drum.
    a = VENT_SIDE
    block("concrete", 7.0, 0.4, 15.0, at(facing(a), *radial(a, 20.0, 0.2)))
    for side in (-4.8, 0.0, 4.8):
        c = offset(radial(a, 20.0, 0), a, side)
        block("mech", 2.4, 3.0, 3.2, at(facing(a), c[0], 1.9, c[2]), bevel=0.08)
        radiator(offset(radial(a, 21.2, 0), a, side), a, 1.9, 6, 2.4, 2.4, 0.6)
        for b in (-0.8, 0.0, 0.8):
            bush = offset((c[0], 3.4, c[2]), a, b)
            tube("dark", bush, (bush[0], 4.4, bush[2]), 0.12, True, 6)
    house = radial(a, 14.6, 0)
    block("mech", 4.0, 5.0, 7.0, at(facing(a), house[0], 2.5, house[2]), bevel=0.1)
    bar("mech", radial(a, 14.6, 5.0), radial(a, 12.9, 11.0), 2.2, 2.4, a)
    # Ventilation towers either side of the power yard, louvred, fans on top.
    for b in (a - 0.42, a + 0.42):
        c = radial(b, 14.2, 0)
        block("concrete", 4.2, 18.0, 4.2, at(facing(b), c[0], 9.0, c[2]), bevel=0.12)
        grille(radial(b, 16.35, 0), b, 13.0, 3.0, 5.0)
        fan(c, 18.0, 1.6)
    for a in LEG_ANGLES:  # downpipes on the upper drum
        tube("steel", radial(a + 1.0, 12.75, g1 + 1.4), radial(a + 1.0, 12.75, 22.0), 0.15, seg=6)


def clear(scene):
    for o in list(scene.objects):
        bpy.data.objects.remove(o)
    for m in [m for m in bpy.data.meshes if not m.users]:  # so rebuilt meshes keep their names
        bpy.data.meshes.remove(m)


def build(lod=0):
    """Build the tower (lod 0, scene "telecom_tower", with the studio) or its light variant
    (lod 1, scene "telecom_tower_lod1", objects prefixed "lod1_")."""
    global LOD
    LOD = lod
    name = "telecom_tower_lod1" if lod else "telecom_tower"
    scene = bpy.data.scenes.get(name) or bpy.data.scenes.new(name)
    bpy.context.window.scene = scene
    clear(scene)
    parts.clear()
    for step in (
        build_core,
        build_legs,
        build_webs,
        build_ties,
        build_lifts,
        build_nodes,
        build_transfer,
        build_crown,
        build_command,
        build_mast,
        build_base,
    ):
        step()
    prefix = "lod1_" if lod else ""
    root = bpy.data.objects.new(name, None)
    scene.collection.objects.link(root)
    detail = None
    if not lod:
        detail = bpy.data.objects.new("detail", None)
        scene.collection.objects.link(detail)
        detail.parent = root
    for (role, is_detail), objs in sorted(parts.items()):
        bpy.ops.object.select_all(action="DESELECT")
        for o in objs:
            o.select_set(True)
        bpy.context.view_layer.objects.active = objs[0]
        if len(objs) > 1:
            bpy.ops.object.join()
        joined = bpy.context.view_layer.objects.active
        joined.name = joined.data.name = f"{prefix}{'detail_' if is_detail else ''}{role}"
        joined.parent = detail if is_detail else root
    if not lod:
        studio(scene)
    LOD = 0
    return scene


def night_review(seed=9):
    """Review scene "tower_night": the tower's objects linked in, a field of lit skyscraper
    proxies round it (no tower-sized neighbours), a night sky. Not part of the export."""
    import random

    rnd = random.Random(seed)
    scene = bpy.data.scenes.get("tower_night") or bpy.data.scenes.new("tower_night")
    for o in list(scene.objects):
        if o.name.startswith("proxy") or o.name.startswith("night_"):
            bpy.data.objects.remove(o)
        else:
            scene.collection.objects.unlink(o)
    root = bpy.data.objects["telecom_tower"]
    for o in [root, *root.children_recursive]:
        scene.collection.objects.link(o)
    mat = bpy.data.materials.get("proxy_facade") or bpy.data.materials.new("proxy_facade")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out, bsdf = nt.nodes.new("ShaderNodeOutputMaterial"), nt.nodes.new("ShaderNodeBsdfPrincipled")
    nt.links.new(bsdf.outputs[0], out.inputs[0])
    bsdf.inputs["Base Color"].default_value = linear(0x1A1F27)
    bsdf.inputs["Roughness"].default_value = 0.6
    coord = nt.nodes.new("ShaderNodeTexCoord")
    scale = nt.nodes.new("ShaderNodeVectorMath")
    scale.operation = "MULTIPLY"
    scale.inputs[1].default_value = (0.28, 0.28, 0.3)  # rooms about 3.6 m wide, 3.3 m tall
    nt.links.new(coord.outputs["Object"], scale.inputs[0])
    cells = nt.nodes.new("ShaderNodeVectorMath")
    cells.operation = "FLOOR"
    nt.links.new(scale.outputs[0], cells.inputs[0])
    rand = nt.nodes.new("ShaderNodeTexWhiteNoise")
    rand.noise_dimensions = "3D"
    nt.links.new(cells.outputs[0], rand.inputs["Vector"])
    lit = nt.nodes.new("ShaderNodeMath")
    lit.operation = "GREATER_THAN"
    lit.inputs[1].default_value = 0.8
    nt.links.new(rand.outputs["Value"], lit.inputs[0])
    frac = nt.nodes.new("ShaderNodeVectorMath")
    frac.operation = "FRACTION"
    nt.links.new(scale.outputs[0], frac.inputs[0])
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(frac.outputs[0], sep.inputs[0])
    sill = nt.nodes.new("ShaderNodeMath")
    sill.operation = "GREATER_THAN"
    sill.inputs[1].default_value = 0.35
    nt.links.new(sep.outputs["Z"], sill.inputs[0])
    both = nt.nodes.new("ShaderNodeMath")
    both.operation = "MULTIPLY"
    nt.links.new(lit.outputs[0], both.inputs[0])
    nt.links.new(sill.outputs[0], both.inputs[1])
    warm = nt.nodes.new("ShaderNodeMix")
    warm.data_type = "RGBA"
    nt.links.new(rand.outputs["Color"], warm.inputs[0])
    warm.inputs[6].default_value = linear(0xFFB45E)
    warm.inputs[7].default_value = linear(0xE8EEF5)
    nt.links.new(warm.outputs[2], bsdf.inputs["Emission Color"])
    dim = nt.nodes.new("ShaderNodeMath")
    dim.operation = "MULTIPLY"
    dim.inputs[1].default_value = 0.55
    nt.links.new(both.outputs[0], dim.inputs[0])
    nt.links.new(dim.outputs[0], bsdf.inputs["Emission Strength"])
    placed = []
    while len(placed) < 110:
        r, t = 120 + rnd.random() ** 0.7 * 700, rnd.random() * 2 * math.pi
        x, y = r * math.cos(t), r * math.sin(t)
        w, d = rnd.uniform(18, 34), rnd.uniform(18, 34)
        if any(
            abs(x - px) < (w + pw) / 2 + 8 and abs(y - py) < (d + pd) / 2 + 8
            for px, py, pw, pd in placed
        ):
            continue
        placed.append((x, y, w, d))
        h = rnd.uniform(25, 75) + (rnd.random() < 0.3) * rnd.uniform(20, 70) * (r < 300)
        for k, (hh, ww, dd) in enumerate(((h, w, d), (h * 0.25, w * 0.7, d * 0.7))):
            if k and rnd.random() < 0.6:
                continue
            bm = bmesh.new()
            bmesh.ops.create_cube(bm, size=1)
            bmesh.ops.scale(bm, vec=(ww, dd, hh), verts=bm.verts)
            z0 = 0 if not k else h
            bmesh.ops.translate(bm, vec=(x, y, z0 + hh / 2), verts=bm.verts)
            me = bpy.data.meshes.new("proxy")
            bm.to_mesh(me)
            bm.free()
            me.materials.append(mat)
            scene.collection.objects.link(bpy.data.objects.new("proxy", me))
    gm = bpy.data.materials.get("night_ground") or bpy.data.materials.new("night_ground")
    gm.use_nodes = True
    gb = next(n for n in gm.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    gb.inputs["Base Color"].default_value = (0.02, 0.022, 0.026, 1)
    gb.inputs["Roughness"].default_value = 0.5
    ground = bpy.data.meshes.new("night_ground")
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=2000)
    bm.to_mesh(ground)
    bm.free()
    ground.materials.append(gm)
    scene.collection.objects.link(bpy.data.objects.new("night_ground", ground))
    world = bpy.data.worlds.get("tower_night") or bpy.data.worlds.new("tower_night")
    world.use_nodes = True
    bg = next(n for n in world.node_tree.nodes if n.type == "BACKGROUND")
    bg.inputs[0].default_value = (0.02, 0.03, 0.07, 1)
    bg.inputs[1].default_value = 1.0
    scene.world = world
    moon = bpy.data.objects.new("night_moon", bpy.data.lights.new("night_moon", "SUN"))
    moon.data.energy, moon.data.color = 0.25, (0.65, 0.72, 1.0)
    moon.rotation_euler = (math.radians(55), 0, math.radians(-40))
    cam = bpy.data.objects.new("night_cam", bpy.data.cameras.new("night_cam"))
    for o in (moon, cam):
        scene.collection.objects.link(o)
    scene.camera = cam
    try:
        scene.eevee.use_raytracing = True
    except AttributeError:
        pass
    return scene


def studio(scene):
    """Neutral overcast review set: dark grey ground, soft sky, a soft sun. Not exported."""
    world = bpy.data.worlds.get("tower_studio") or bpy.data.worlds.new("tower_studio")
    world.use_nodes = True
    bg = next(n for n in world.node_tree.nodes if n.type == "BACKGROUND")
    bg.inputs[0].default_value = (0.42, 0.47, 0.53, 1)
    bg.inputs[1].default_value = 1.1
    scene.world = world
    ground = bpy.data.meshes.new("studio_ground")
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=1500)
    bm.to_mesh(ground)
    bm.free()
    gm = bpy.data.materials.get("studio_ground") or bpy.data.materials.new("studio_ground")
    gm.use_nodes = True
    gb = next(n for n in gm.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    gb.inputs["Base Color"].default_value = (0.18, 0.19, 0.2, 1)
    gb.inputs["Roughness"].default_value = 0.9
    ground.materials.append(gm)
    g = bpy.data.objects.new("studio_ground", ground)
    sun_data = bpy.data.lights.new("studio_sun", "SUN")
    sun_data.energy, sun_data.angle = 2.2, math.radians(8)
    sun = bpy.data.objects.new("studio_sun", sun_data)
    sun.rotation_euler = (math.radians(50), 0, math.radians(35))
    cam = bpy.data.objects.new("studio_cam", bpy.data.cameras.new("studio_cam"))
    for o in (g, sun, cam):
        scene.collection.objects.link(o)
    scene.camera = cam
    scene.render.resolution_x, scene.render.resolution_y = 1000, 1250
    try:
        scene.eevee.use_raytracing = True
    except AttributeError:
        pass


def export(folder, lod=0, fmt="GLB"):
    """telecom_tower.glb (or _lod1): that tower's hierarchy only. fmt "GLTF_SEPARATE" writes
    .gltf + .bin, the form web/src/materials.js loads (web/assets/models/telecom_tower)."""
    os.makedirs(folder, exist_ok=True)
    name = "telecom_tower_lod1" if lod else "telecom_tower"
    bpy.context.window.scene = bpy.data.scenes[name]
    bpy.ops.object.select_all(action="DESELECT")
    root = bpy.data.objects[name]
    for o in [root, *root.children_recursive]:
        o.select_set(True)
    path = os.path.join(folder, name + (".glb" if fmt == "GLB" else ".gltf"))
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format=fmt,
        use_selection=True,
        use_active_scene=True,  # selections in other scenes (the backups) stay out
        export_yup=True,
        export_apply=True,
        export_normals=True,
        export_texcoords=True,
        export_tangents=False,
        export_materials="EXPORT",
        export_cameras=False,
        export_lights=False,
        export_extras=False,
    )
    return path


# exec() from Blender has no __file__, so set REPO (repo root) first. CITY = True writes the
# city's copy (web/assets/models/telecom_tower); EXPORT = r"<folder>" writes GLBs there.
build()
if globals().get("CITY"):
    city = os.path.join(REPO, "web", "assets", "models", "telecom_tower")  # noqa: F821
    print(export(city, 0, "GLTF_SEPARATE"))
if globals().get("WITH_LOD"):
    build(1)
    bpy.context.window.scene = bpy.data.scenes["telecom_tower"]
if globals().get("EXPORT"):
    print(export(EXPORT))  # noqa: F821
    if globals().get("WITH_LOD"):
        print(export(EXPORT, 1))  # noqa: F821
