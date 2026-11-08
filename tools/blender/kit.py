"""Shared modelling kit for the Blender scripts in tools/blender (imported after REPO is set).

Parts are built in three.js coordinates (y up) and turned to Blender's z up as they are added, so
a glTF comes out in the renderer's frame. UVs are in metres / REPEAT (web/src/geometry.js).
Objects are joined per material role ("concrete", "glass", ...), which the renderer swaps for a
palette material; small parts go under an empty "detail", drawn only near the camera.
"""

import math
import os

import bmesh
import bpy
from mathutils import Matrix, Vector

REPEAT = 4.0
SMALL = 1.2  # LOD 1 drops parts smaller than this (m)
LOD = 0  # 1: lighter variant (no detail group, halved segments, no small parts)

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
    "pink": (0xFF2FB4, 0.0, 0.5, 0xFF2FB4, 5.0, 1, None),  # neon signs and strips
    "soot": (0x34373B, 0.0, 0.9, None, 0, 1, "streak"),  # blackened concrete
    "titanium": (0x666D73, 0.6, 0.5, None, 0, 1, "rust"),  # weathered light metal
    "ice": (0xB8C8D2, 0.0, 0.5, 0xC8DCE8, 0.9, 1, None),  # dim cold-white indicators
    "lamp": (0x9C7034, 0.0, 0.5, 0xD08A3A, 1.6, 1, None),  # dirty amber maintenance lamps
    "hazard": (0x7A5230, 0.2, 0.7, None, 0, 1, "rust"),  # worn safety-orange paint
    "yellow": (0x8E7A3A, 0.1, 0.7, None, 0, 1, "rust"),  # warning labels
    "stencil": (0x8F9498, 0.0, 0.8, None, 0, 1, None),  # worn painted letters, gauge faces
    "scorch": (0x24201D, 0.5, 0.6, None, 0, 1, "rust"),  # heat-discoloured, sooted steel
    "sign": (0x0B0F17, 0.0, 0.4, 0xFF5C8A, 2.0, 1, None),  # a lit sign; its word is the renderer's
    "blade": (
        0x0B0F17,
        0.0,
        0.4,
        0x3FE6FF,
        2.0,
        1,
        None,
    ),  # a vertical lit sign, also the renderer's
    "armor": (0xB9B4A8, 0.2, 0.55, None, 0, 1, "rust"),  # faded off-white armour panels
    "olive": (0x5D6157, 0.3, 0.6, None, 0, 1, "rust"),  # desaturated olive-grey cladding
    "graphite": (0x26282B, 0.4, 0.5, None, 0, 1, None),  # dark graphite structure
    "deepred": (0x6E2723, 0.2, 0.6, None, 0, 1, None),  # deep red paint, accents
    "glow_white": (0xD8DEE2, 0.0, 0.5, 0xE8EEF2, 2.2, 1, None),  # restrained white sign light
    "glow_amber": (0x8C5A22, 0.0, 0.5, 0xE09A45, 1.8, 1, None),  # aged amber screens
    "glow_cyan": (0x6FA9B2, 0.0, 0.5, 0x8CCAD2, 1.4, 1, None),  # cold cyan technical displays
    "holo": (0x7FB6BF, 0.0, 0.3, 0xA8DCE4, 1.2, 0.45, None),  # a see-through product hologram
    "awning_a": (0xA8452E, 0.0, 0.8, None, 0, 1, None),  # awning stripes: the tile's warm colour
    "awning_b": (0xCFC6B8, 0.0, 0.8, None, 0, 1, None),  # and cream
    "shell": (0xC9CED3, 0.3, 0.4, None, 0, 1, None),  # cool off-white crown structure
    "deck": (0x293642, 0.3, 0.45, None, 0, 1, None),  # dark gunmetal observation drum
    "strut": (0x425567, 0.4, 0.5, None, 0, 1, None),  # steel-blue struts under the drum
    "core": (
        0x161C29,
        0.0,
        0.35,
        0xB3122A,
        14.0,
        1,
        None,
    ),  # reactor core (animated in the renderer)
    "halo": (0x161C29, 0.0, 0.5, 0x5A0E16, 4.0, 1, None),  # the core's soft crimson spill
    "corering": (0x161C29, 0.0, 0.35, 0x8E1020, 8.0, 1, None),  # reactor ring, dimmer
    "chamber": (0x161C29, 0.0, 0.35, 0xB3122A, 11.0, 1, None),  # the reactor drum
    "conduit": (0x161C29, 0.0, 0.4, 0xB3122A, 6.0, 1, None),  # pulsing power conduits
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
            stain, grime = (0x25282B, 0x17191B) if role == "soot" else (0x69727A, 0x434A4F)
            colour = mix(ramp(streaks.outputs["Fac"], 0.58, 0.9), colour, linear(stain))
            colour = mix(crevice, colour, linear(grime))
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
    if role in ("ad", "sign", "blade"):  # placeholder content: slow bands of colour, mostly dark
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
    of the axis, if not the origin."""
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


def ring(role, r, tube_r, y, seg=64, radial_seg=6, detail=False, center=(0, 0)):
    """Thin torus round the vertical at height y; center: (x, z) of its axis."""
    seg = max(12, seg // 2) if LOD else seg
    bm = bmesh.new()
    vs = [
        [
            bm.verts.new(
                (
                    center[0] + (r + tube_r * math.cos(b)) * math.cos(a),
                    y + tube_r * math.sin(b),
                    center[1] + (r + tube_r * math.cos(b)) * math.sin(a),
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


def around(c, a, r, y):
    """The point at angle a, radius r and height y round the vertical axis through c = (x, z)."""
    p = radial(a, r, y)
    return (c[0] + p[0], y, c[1] + p[2])


def radius_at(profile, y):
    """Radius of a lathe profile [(r, y), ...] at height y (clamped to its ends)."""
    for (r0, a), (r1, b) in zip(profile, profile[1:], strict=False):
        if a <= y <= b:
            return r0 + (r1 - r0) * (y - a) / (b - a)
    return profile[-1][0] if y > profile[-1][1] else profile[0][0]


def screen(role, w, h, m, detail=False):
    """A flat panel w x h facing local +z with UVs 0..1 across it, for a texture the renderer
    draws on it (a sign's word, a display)."""
    bm = bmesh.new()
    uv = bm.loops.layers.uv.verify()
    vs = [bm.verts.new((x * w / 2, y * h / 2, 0)) for x, y in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    f = bm.faces.new(vs)
    for loop, (u, v) in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1)), strict=True):
        loop[uv].uv = (u, 1 - v)  # glTF export flips v
    return add(bm, role, m, detail, project=False)


def lamp(p, r=0.4):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=8, v_segments=6, radius=r)
    return add(bm, "red", Matrix.Translation(p), smooth_angle=80)


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


def text(role, body, size, m, depth=0.12, resolution=None, detail=False):
    """Invented sign text as geometry, in a vertical plane facing local +x (use facing(a)).
    depth 0 gives flat painted letters; resolution (curve steps per segment, Blender's default
    12) trades smooth curves for triangles. Left out at LOD 1, where it would be a few pixels."""
    if LOD:
        return None
    cu = bpy.data.curves.new("sign_text", "FONT")
    cu.body, cu.size, cu.extrude = body, size, depth
    cu.align_x, cu.align_y = "CENTER", "CENTER"
    if resolution:
        cu.resolution_u = resolution
    ob = bpy.data.objects.new("sign_text", cu)
    bpy.context.scene.collection.objects.link(ob)
    dg = bpy.context.evaluated_depsgraph_get()
    ev = ob.evaluated_get(dg)
    bm = bmesh.new()
    bm.from_mesh(ev.to_mesh())
    ev.to_mesh_clear()
    bpy.data.objects.remove(ob)
    bpy.data.curves.remove(cu)
    return add(bm, role, m @ Matrix.Rotation(math.pi / 2, 4, "Y"), detail, smooth_angle=30)


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


def radiator(c, a, y, n, width, h, depth=0.9, detail=False):
    """A bank of n vertical cooling fins standing off a face that looks out along angle a,
    with header pipes top and bottom; c is the bank's centre on the face."""
    for i in range(n):
        p = offset(
            (c[0] + math.cos(a) * depth / 2, y, c[2] + math.sin(a) * depth / 2),
            a,
            (i / (n - 1) - 0.5) * width,
        )
        block("mech", depth, h, 0.07, at(facing(a), *p), detail)
    for yy in (y - h / 2 - 0.15, y + h / 2 + 0.15):
        e0 = offset((c[0], yy, c[2]), a, -width / 2 - 0.3)
        e1 = offset((c[0], yy, c[2]), a, width / 2 + 0.3)
        tube("steel", e0, e1, 0.16, detail, seg=8)


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


def clear(scene):
    for o in list(scene.objects):
        bpy.data.objects.remove(o)
    for m in [m for m in bpy.data.meshes if not m.users]:  # so rebuilt meshes keep their names
        bpy.data.meshes.remove(m)


def join(scene, name, prefix=""):
    """Join the parts per (role, detail) under a root empty `name`, the detail ones under an empty
    "detail" (none at LOD 1), and name each after its role."""
    root = bpy.data.objects.new(name, None)
    scene.collection.objects.link(root)
    detail = None
    if not LOD:
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
    return root


def studio(scene):
    """Neutral overcast review set: dark grey ground, soft sky, a soft sun. Not exported."""
    world = bpy.data.worlds.get("studio") or bpy.data.worlds.new("studio")
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


def proxy_material():
    """Review-only facade for stand-in skyscrapers: dark walls, about one room in five lit,
    warm or cool white."""
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
    return mat


def night_street(name, scene_name, cam_loc, cam_target, lens=20, seed=4, low_behind=True):
    """Review scene `scene_name`: the model under the empty `name` linked in at the origin, on a
    wet street (along x, in front of it) among stand-in towers on the city's 14 m grid, with
    haze, a moon and sky fill, sodium lamps and a few signs on the towers. low_behind keeps the
    blocks just behind low, so a tall model reads against the sky. Camera in Blender
    coordinates. Returns (scene, cube, light): helpers that add to it. Not part of any export."""
    import random

    rnd = random.Random(seed)
    scene = bpy.data.scenes.get(scene_name) or bpy.data.scenes.new(scene_name)
    for o in list(scene.objects):
        if o.name.startswith(("proxy", "night_")):
            bpy.data.objects.remove(o)
        else:
            scene.collection.objects.unlink(o)
    root = bpy.data.objects[name]
    for o in [root, *root.children_recursive]:
        scene.collection.objects.link(o)
    mat = proxy_material().copy()  # finer, dimmer rooms than the tower's distant proxies
    for n in mat.node_tree.nodes:
        if n.type == "VECT_MATH" and n.operation == "MULTIPLY":
            n.inputs[1].default_value = (0.55, 0.55, 0.32)  # rooms about 1.8 m wide, 3.1 m tall
        if n.type == "MATH" and n.operation == "MULTIPLY" and n.inputs[1].default_value == 0.55:
            n.inputs[1].default_value = 0.2

    def cube(label, w, d, h, x, y, z, m):  # Blender coordinates, z from the ground up
        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=1)
        bmesh.ops.scale(bm, vec=(w, d, h), verts=bm.verts)
        bmesh.ops.translate(bm, vec=(x, y, z + h / 2), verts=bm.verts)
        me = bpy.data.meshes.new(label)
        bm.to_mesh(me)
        bm.free()
        me.materials.append(m)
        scene.collection.objects.link(bpy.data.objects.new(label, me))

    def light(kind, label, loc, energy, color, target=None):
        data = bpy.data.lights.new(label, kind)
        data.energy, data.color = energy, color
        o = bpy.data.objects.new(label, data)
        o.location = loc
        if target:
            o.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
        scene.collection.objects.link(o)
        return o

    signs = [material(r) for r in ("pink", "ice", "lamp", "lamp")]  # the district round it
    for gx in range(-3, 4):  # the street runs along x in front (Blender -y)
        for gy in range(-3, 4):
            if (gx, gy) == (0, 0) or gy == -1:
                continue
            x, y = gx * 14, gy * 14 + (-8 if gy < -1 else 0)
            h = rnd.uniform(18, 70) * (1.4 if abs(gx) + abs(gy) > 2 else 1)
            if low_behind and gy == 1 and abs(gx) <= 1:
                h = rnd.uniform(7, 11)
            cube("proxy", 12, 12, h, x, y, 0, mat)
            face = -1 if gy >= 0 else 1  # the side towards the street
            for _ in range(rnd.randint(0, 2)):
                zz, m = rnd.uniform(4, min(h - 2, 30)), rnd.choice(signs)
                if rnd.random() < 0.5:
                    cube("proxy_sign", 12.2, 0.15, 0.12, x, y + face * 6.1, zz, m)
                else:
                    cube("proxy_sign", 0.25, 1.0, 4, x + rnd.uniform(-5, 5), y + face * 6.6, zz, m)
    gm = bpy.data.materials.get("night_wet") or bpy.data.materials.new("night_wet")
    gm.use_nodes = True
    gb = next(n for n in gm.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    gb.inputs["Base Color"].default_value = linear(0x0C0E14)
    gb.inputs["Roughness"].default_value = 0.12
    cube("night_ground", 400, 400, 0.02, 0, 0, -0.03, gm)
    world = bpy.data.worlds.get("night_street") or bpy.data.worlds.new("night_street")
    world.use_nodes = True
    nt = world.node_tree
    bg = next(n for n in nt.nodes if n.type == "BACKGROUND")
    bg.inputs[0].default_value = linear(0x1B2A57)
    bg.inputs[1].default_value = 1.2
    out = next(n for n in nt.nodes if n.type == "OUTPUT_WORLD")
    fog = next((n for n in nt.nodes if n.type == "VOLUME_SCATTER"), None)
    fog = fog or nt.nodes.new("ShaderNodeVolumeScatter")
    fog.inputs["Color"].default_value = linear(0x3D528F)
    fog.inputs["Density"].default_value = 0.02
    nt.links.new(fog.outputs[0], out.inputs["Volume"])
    scene.world = world
    moon = light("SUN", "night_moon", (0, 0, 50), 0.6, (0.65, 0.72, 1.0))  # key: nothing goes black
    moon.rotation_euler = (math.radians(60), 0, math.radians(-30))
    for x in (-21, -7, 7, 21):  # sodium lamps along the street
        light("POINT", "night_lamp", (x, -9.5, 7), 900, (1.0, 0.62, 0.25))
    light("AREA", "night_fill", (0, 0, 60), 6000, (0.55, 0.62, 0.85)).data.size = 60  # sky glow
    cam = bpy.data.objects.new("night_cam", bpy.data.cameras.new("night_cam"))
    cam.data.lens = lens
    cam.location = cam_loc
    cam.rotation_euler = (Vector(cam_target) - cam.location).to_track_quat("-Z", "Y").to_euler()
    scene.collection.objects.link(cam)
    scene.camera = cam
    scene.render.resolution_x, scene.render.resolution_y = 1456, 816
    try:
        scene.eevee.use_raytracing = True
        scene.eevee.volumetric_end = 200
    except AttributeError:
        pass
    return scene, cube, light


def steam_material():
    """Review-only steam: a noisy grey volume."""
    steam = bpy.data.materials.get("night_steam") or bpy.data.materials.new("night_steam")
    steam.use_nodes = True
    snt = steam.node_tree
    snt.nodes.clear()
    vol = snt.nodes.new("ShaderNodeVolumePrincipled")
    vol.inputs["Color"].default_value = (0.75, 0.78, 0.82, 1)
    noise = snt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 1.6
    grad = snt.nodes.new("ShaderNodeMapRange")
    grad.inputs[1].default_value, grad.inputs[2].default_value = 0.5, 0.75
    grad.inputs[3].default_value, grad.inputs[4].default_value = 0.0, 0.6
    snt.links.new(noise.outputs["Fac"], grad.inputs[0])
    snt.links.new(grad.outputs[0], vol.inputs["Density"])
    sout = snt.nodes.new("ShaderNodeOutputMaterial")
    snt.links.new(vol.outputs[0], sout.inputs["Volume"])
    return steam


def plain_names(objs):
    """Give objs their names without Blender's ".001" suffixes (glTF node names are what the
    renderer looks up, e.g. "detail"), swapping with whatever object in another scene holds the
    plain name. Returns the swaps, for restore_names()."""
    swaps = []
    for o in objs:
        base = o.name.rsplit(".", 1)[0] if o.name[-4:-3] == "." and o.name[-3:].isdigit() else None
        if not base:
            continue
        other = bpy.data.objects.get(base)
        old = o.name
        if other:
            other.name = "__swap__"
        o.name = base
        if other:
            other.name = old
        swaps.append((o, old, other))
    return swaps


def restore_names(swaps):
    for o, old, other in reversed(swaps):
        base = o.name
        if other:
            other.name = "__swap__"
        o.name = old
        if other:
            other.name = base


def export(name, folder, fmt="GLB"):
    """name.glb (or .gltf + .bin with fmt "GLTF_SEPARATE", the form web/src/materials.js loads):
    the hierarchy under the empty `name` in the scene of the same name, and nothing else, with
    plain node names however many models share the .blend."""
    os.makedirs(folder, exist_ok=True)
    bpy.context.window.scene = bpy.data.scenes[name]
    bpy.ops.object.select_all(action="DESELECT")
    root = bpy.data.objects[name]
    objs = [root, *root.children_recursive]
    for o in objs:
        o.select_set(True)
    path = os.path.join(folder, name + (".glb" if fmt == "GLB" else ".gltf"))
    swaps = plain_names(objs)
    try:
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
    finally:
        restore_names(swaps)
    return path


def stats(name):
    """Review numbers for the model under the empty `name`: triangles always drawn and in the
    detail group, the share of surface in glowing roles, and its bounds (three.js x, y, z)."""
    root = bpy.data.objects[name]
    meshes = [o for o in root.children_recursive if o.type == "MESH"]
    tris = {"main": 0, "detail": 0}
    area, glow = 0.0, 0.0
    lo, hi = [1e9] * 3, [-1e9] * 3
    for o in meshes:
        key = "detail" if o.parent and o.parent.name.startswith("detail") else "main"
        tris[key] += sum(len(p.vertices) - 2 for p in o.data.polygons)
        a = sum(p.area for p in o.data.polygons)
        area += a
        if ROLES[o.data.materials[0].name.split(".")[0]][3]:
            glow += a
        for v in o.bound_box:
            w = o.matrix_world @ Vector(v)
            for i, x in enumerate((w.x, w.z, -w.y)):
                lo[i], hi[i] = min(lo[i], x), max(hi[i], x)
    bounds = [(round(a, 2), round(b, 2)) for a, b in zip(lo, hi, strict=True)]
    return {**tris, "glow %": round(100 * glow / area, 2), "bounds": bounds}
