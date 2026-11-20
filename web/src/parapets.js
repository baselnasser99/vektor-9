// Deck parapets as geometry, from the runs interchange.js barriers finds along every deck edge. Each run is a
// polyline on the edge itself ({ pts, cross, caps, depth }): cross[i] points inward across the deck at point i,
// mitred where the edge bends and where the run meets the next one, so neighbouring runs meet flush; caps says which
// ends are openings; depth is the deck's thickness there. A safety-shape concrete barrier (a narrow top, an inner
// face sloping out to a wide foot buried in the deck, and an outer face a centimetre outside the deck's edge that
// carries on down as the deck's fascia to exactly its underside (foot and depth may be given per point: over a
// landed ramp's fill the foot rests on its top and the face runs down to the road), so the barrier and the deck's side never share a
// plane and no seam shows between them), cast in 3 m panels with a dark joint between them, darker toward the foot where road
// spray and rain leave their grime (vertex colours, no texture), with small amber reflectors along its inner face;
// a steel cap rail on short posts. At an opening the barrier above the deck tapers down over its last metre and a
// half to a closed end (the fascia keeps its depth) and the rail stops short of it. One geometry per material, so the whole interchange's parapets draw in three
// calls.
import * as THREE from 'three';
import { REPEAT } from './geometry.js';

// Across the barrier, for a deck `depth` thick: [inward from the edge, up from the deck], round the section; the
// shade of each point. The inner foot is well down into the deck (where two runs join at different heights, the
// lower one's end is raised up to 30 cm).
const profile = (depth) => [[-0.01, -depth], [-0.01, 0.9], [0.2, 0.9], [0.27, 0.38], [0.47, 0.1], [0.56, -0.35]];
const SHADE = [0.5, 0.95, 1, 0.9, 0.62, 0.46];
const FAN = 3; // the section's one reflex corner, where its end face is fanned from
const PANEL = 3, JOINT = 0.03, TAPER = 1.5, LOW = 0.35; // m; a capped end comes down to LOW of the height
const RAIL = [0.06, 0.16, 1.1, 1.17]; // inward from, to; up from, to
const POST = [0.08, 0.14, 0.9, 1.1, 0.04]; // inward from, to; up from, to; half its length along the run

const flat = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const hash = (a, b) => ((Math.sin(a * 127.1 + b * 311.7) * 43758.5453) % 1 + 1) % 1;

// Twice triangle abc's area; below AREA (m²) a triangle or face has none and is left out.
const AREA = 1e-7;
const twice = (a, b, c) => {
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  return Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]);
};

// Triangles into one indexed geometry: quads and fans, wound to face away from a point inside the solid.
function sink(colours) {
  const pos = [], nor = [], uv = [], col = [], index = [];
  // vs: [x, y, z][] round a polygon that vs[0] sees all of (fanned from it); shade: one grey, or one per vertex.
  const face = (vs, inside, shade = 1, uvs) => {
    // Newell's normal, over the whole polygon: where a section collapses onto the road (a landed end's lift and depth both
    // 0) its points repeat, the first three alone gave a zero normal, NaN in the shader, and bloom spread it to a black frame.
    let n = [0, 0, 0];
    vs.forEach((p, k) => {
      const q = vs[(k + 1) % vs.length];
      n = [n[0] + (p[1] - q[1]) * (p[2] + q[2]), n[1] + (p[2] - q[2]) * (p[0] + q[0]), n[2] + (p[0] - q[0]) * (p[1] + q[1])];
    });
    const l = Math.hypot(...n);
    if (l < AREA) return; // no area: nothing to draw
    const mid = vs.reduce((m, p) => m.map((x, k) => x + p[k] / vs.length), [0, 0, 0]);
    const flip = n[0] * (mid[0] - inside[0]) + n[1] * (mid[1] - inside[1]) + n[2] * (mid[2] - inside[2]) < 0;
    n = n.map((x) => (flip ? -x : x) / l);
    const base = pos.length / 3;
    vs.forEach((p, k) => {
      pos.push(...p);
      nor.push(...n);
      uv.push(...(uvs ? uvs[k] : [(p[0] + p[2]) / REPEAT, p[1] / REPEAT]));
      const v = Array.isArray(shade) ? shade[k] : shade;
      if (colours) col.push(v, v, v);
    });
    for (let k = 1; k < vs.length - 1; k++) if (twice(vs[0], vs[k], vs[k + 1]) >= AREA) index.push(...(flip ? [base, base + k + 1, base + k] : [base, base + k, base + k + 1]));
  };
  const geometry = () => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    if (colours) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(index);
    return g;
  };
  return { face, geometry };
}

// Where run's cap rail runs, [from, to] in metres along it: short of the taper at each capped end and, where its height
// is given per point (lift, a landed ramp's), only where the barrier stands at its full or its stepped-down height (0.8
// of 0.9 m over the fill), so the rail stops where the sloped terminal begins.
const STEPPED = 0.8 / 0.9;
export function railSpan({ pts, caps, lift }) {
  const s = [0];
  for (let i = 1; i < pts.length; i++) s.push(s[i - 1] + flat(pts[i], pts[i - 1]));
  const len = s.at(-1), taper = Math.min(TAPER, len / 2.5);
  let ua = caps[0] ? taper : 0, ub = caps[1] ? len - taper : len;
  if (lift) {
    let i = 0, j = s.length - 1;
    while (i < s.length && lift[i] < STEPPED - 1e-3) i++;
    while (j >= 0 && lift[j] < STEPPED - 1e-3) j--;
    [ua, ub] = [Math.max(ua, s[i] ?? len), Math.min(ub, s[j] ?? 0)];
  }
  return [ua, ub];
}

// The parapets for runs (interchange.js barriers): { concrete (with vertex colours), steel, lamps, caps (how many
// end caps were built) }.
export function parapetGeometry(runs) {
  const C = sink(true), S = sink(false), L = sink(false);
  let caps = 0;
  runs.forEach(({ pts, cross, caps: cap, depth = 0.6, foot = 0.35, lift: lifts }, r) => {
    const s = [0];
    for (let i = 1; i < pts.length; i++) s.push(s[i - 1] + flat(pts[i], pts[i - 1]));
    // depth, and lift (the barrier's height as a share of its full height), may be given per point.
    const per = (v, u) => {
      if (!Array.isArray(v)) return v;
      let i = 1;
      while (i < s.length - 1 && s[i] < u) i++;
      const f = Math.max(0, Math.min(1, (u - s[i - 1]) / (s[i] - s[i - 1] || 1)));
      return v[i - 1] + (v[i] - v[i - 1]) * f;
    };
    const PROFILE = profile(Array.isArray(depth) ? 0.6 : depth);
    const len = s.at(-1);
    if (len < 0.05) return;
    // The run at u metres along it: its point, the cross vector there, the way it runs.
    const at = (u) => {
      let i = 1;
      while (i < pts.length - 1 && s[i] < u) i++;
      const [a, b] = [pts[i - 1], pts[i]], f = Math.max(0, Math.min(1, (u - s[i - 1]) / (s[i] - s[i - 1] || 1))), d = flat(a, b) || 1;
      return { p: a.map((v, k) => v + (b[k] - v) * f), c: [0, 1].map((k) => cross[i - 1][k] + (cross[i][k] - cross[i - 1][k]) * f), t: [(b[0] - a[0]) / d, (b[2] - a[2]) / d] };
    };
    const taper = Math.min(TAPER, len / 2.5), lift = (u) => Math.min(1, cap[0] ? LOW + ((1 - LOW) * u) / taper : 1, cap[1] ? LOW + ((1 - LOW) * (len - u)) / taper : 1, lifts ? per(lifts, u) : 1);
    const point = ({ p, c }, o, y) => [p[0] + c[0] * o, p[1] + y, p[2] + c[1] * o];
    const inside = (u, h = lift(u)) => point(at(u), 0.25, 0.4 * h);
    // Sections at every point of the run, at both ends of every joint and where a taper starts.
    const joints = [];
    for (let j = PANEL; j < len - PANEL / 3; j += PANEL) joints.push(j);
    const knots = [...new Set([...s, ...joints.flatMap((j) => [j - JOINT, j + JOINT]), ...(cap[0] ? [taper] : []), ...(cap[1] ? [len - taper] : [])])]
      .filter((u) => u >= 0 && u <= len).sort((a, b) => a - b);
    const section = (u) => { const A = at(u), h = lift(u), d = per(depth, u); return PROFILE.map(([o, y], k) => point(A, o, k === 0 ? -d : k === PROFILE.length - 1 ? -per(foot, u) : y > 0 ? y * h : y)); };
    let prev = section(0);
    for (let m = 1; m < knots.length; m++) {
      const [u0, u1] = [knots[m - 1], knots[m]], next = section(u1), mid = (u0 + u1) / 2;
      if (u1 - u0 > 1e-4) {
        const dark = joints.some((j) => u0 >= j - JOINT - 1e-6 && u1 <= j + JOINT + 1e-6) ? 0.45 : 0.86 + 0.18 * hash(r, Math.floor(mid / PANEL));
        for (let k = 0; k < PROFILE.length - 1; k++) {
          const shade = [SHADE[k], SHADE[k + 1], SHADE[k + 1], SHADE[k]].map((v) => v * dark);
          const v0 = (PROFILE[k][0] + PROFILE[k][1]) / REPEAT, v1 = (PROFILE[k + 1][0] + PROFILE[k + 1][1]) / REPEAT;
          C.face([prev[k], prev[k + 1], next[k + 1], next[k]], inside(mid), shade, [[u0 / REPEAT, v0], [u0 / REPEAT, v1], [u1 / REPEAT, v1], [u1 / REPEAT, v0]]);
        }
      }
      prev = next;
    }
    for (const e of [0, 1]) { // a closed end at each opening, fanned from the section's reflex corner
      if (!cap[e]) continue;
      const sec = section(e ? len : 0), ring = [...sec.slice(FAN), ...sec.slice(0, FAN)];
      C.face(ring, inside(e ? len - 0.2 : 0.2), ring.map((_, k) => SHADE[(k + FAN) % SHADE.length] * 0.8));
      caps++;
    }
    // The cap rail on posts, short of each taper; at a run's mitred ends it runs on into the next run's. On a stepped-down
    // barrier it rides as far above its top as on a full one.
    const [ua, ub] = railSpan({ pts, caps: cap, lift: lifts });
    if (ub - ua < 0.5) return;
    const up = (u) => 0.9 * ((lifts ? per(lifts, u) : 1) - 1); // the barrier's top, from its full height
    const [o0, o1, y0, y1] = RAIL, rail = (u) => { const A = at(u); return [[o0, y1], [o1, y1], [o1, y0], [o0, y0]].map(([o, y]) => point(A, o, y + up(u))); };
    const stops = [ua, ...s.filter((u) => u > ua && u < ub), ub];
    for (let m = 1; m < stops.length; m++) {
      const a = rail(stops[m - 1]), b = rail(stops[m]), mid = (stops[m - 1] + stops[m]) / 2, ins = point(at(mid), (o0 + o1) / 2, (y0 + y1) / 2);
      for (let k = 0; k < 4; k++) S.face([a[k], a[(k + 1) % 4], b[(k + 1) % 4], b[k]], ins);
    }
    for (const [e, u] of [[0, ua], [1, ub]]) if (cap[e]) S.face(rail(u), point(at(e ? u - 0.05 : u + 0.05), (o0 + o1) / 2, (y0 + y1) / 2));
    const [p0, p1, q0, q1, w] = POST;
    for (const u of [ua + 0.3, ...joints.filter((j) => j > ua + 0.6 && j < ub - 0.6), ub - 0.3]) {
      const A = at(u), [tx, tz] = A.t, corner = (o, du) => [A.p[0] + A.c[0] * o + tx * du, A.p[2] + A.c[1] * o + tz * du];
      const ring = [corner(p0, -w), corner(p1, -w), corner(p1, w), corner(p0, w)], ins = [A.p[0] + A.c[0] * (p0 + p1) / 2, A.p[1] + (q0 + q1) / 2, A.p[2] + A.c[1] * (p0 + p1) / 2];
      for (let k = 0; k < 4; k++) {
        const [a, b] = [ring[k], ring[(k + 1) % 4]];
        S.face([[a[0], A.p[1] + q0 + up(u), a[1]], [b[0], A.p[1] + q0 + up(u), b[1]], [b[0], A.p[1] + q1 + up(u), b[1]], [a[0], A.p[1] + q1 + up(u), a[1]]], ins);
      }
    }
    // Reflectors: a small amber plate on the inner face's upper slope, at the middle of every other panel.
    const [[ta, ya], [tb, yb]] = [PROFILE[2], PROFILE[3]], sl = Math.hypot(tb - ta, yb - ya), fy = 0.6, fo = ta + ((tb - ta) * (ya - fy)) / (ya - yb);
    const [so, sy] = [(tb - ta) / sl, (yb - ya) / sl], [no, ny] = [-sy, so]; // down the slope; off it, inward and up
    for (let j = PANEL * 1.5; j < ub - 0.5; j += 2 * PANEL) {
      if (j < ua + 0.5) continue;
      const A = at(j), [tx, tz] = A.t, cl = Math.hypot(...A.c), [cx, cz] = A.c.map((v) => v / cl);
      const centre = [A.p[0] + A.c[0] * fo + cx * no * 0.005, A.p[1] + fy + ny * 0.005, A.p[2] + A.c[1] * fo + cz * no * 0.005];
      const quad = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [
        centre[0] + tx * 0.05 * a + cx * so * 0.03 * b, centre[1] + sy * 0.03 * b, centre[2] + tz * 0.05 * a + cz * so * 0.03 * b]);
      L.face(quad, [centre[0] - cx * no, centre[1] - ny, centre[2] - cz * no]);
    }
  });
  return { concrete: C.geometry(), steel: S.geometry(), lamps: L.geometry(), caps };
}
