// The people's figure kit (people.js places and drives them): a modular, low-poly human built in code from
// tapered boxes, short tubes and a small sphere for the head, at real scale (about 1.75 m, scaled per person).
// Every person is a shared body (legs, pelvis, neck, head, hands, a phone) plus one top (jacket, hoodie, long coat,
// corporate coat, suit, workwear, streetwear, patrol armour), one head (hair, cap, hood, helmet, hard hat) and a
// few accessories (backpack, messenger bag, mask, visor, earpiece, cybernetic arm). Each module is one instanced
// draw per level of detail, so the crowd costs a few dozen draws however many people there are.
//
// Animation is procedural and runs on the GPU: every vertex knows its bone (thigh, shin, upper arm, ...) and the
// vertex shader bends the limbs from a handful of numbers per person (walk phase and amount, device, talking,
// sitting, head turn), read from one float texture the CPU rewrites each frame. Colours come from the vertex's
// slot (skin, top, bottom, ...) and the person's colour indices, so outfits vary without new geometry.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { palette } from './palette.js';

// Joints of the rest pose, in metres (feet at 0, facing +z). The shader uses the same numbers.
const HX = 0.095, HY = 0.92, KY = 0.5, SX = 0.215, SY = 1.41, EY = 1.12, NY = 1.5, WY = 1.0;
const B = { pelvis: 0, torso: 1, head: 2, uarmL: 3, farmL: 4, uarmR: 5, farmR: 6, thighL: 7, shinL: 8, thighR: 9, shinR: 10, skirtL: 11, skirtR: 12 };
const S = { skin: 0, top: 1, bottom: 2, shoe: 3, accent: 4, hair: 5, gear: 6, glow: 7, screen: 8, strip: 9 };
export const TEXELS = 7; // per person in the data texture (people.js writes them)

// Colours a person can wear, by name; people.js packs indices into this list.
export const COLOURS = ['clothBlack', 'clothCharcoal', 'clothGraphite', 'clothSlate', 'clothNavy', 'clothOlive', 'clothBrown',
  'clothSand', 'clothBone', 'clothOxblood', 'clothTeal', 'clothRust', 'workOrange', 'workYellow', 'reflective', 'gearSteel',
  'skinLight', 'skinFair', 'skinTan', 'skinBrown', 'skinDeep', 'hairBlack', 'hairBrown', 'hairAsh', 'hairBleach', 'hairRed',
  'coldCyan', 'coreScarlet', 'agedAmber', 'glare', 'charcoal', 'gunmetal', 'deepRed'];
export const colour = (name) => COLOURS.indexOf(name);

// Shapes, top at y = 0 for limbs (they hang from their joint).
function slab(w0, w1, h, d0, d1 = d0) { // box tapering from w0 x d0 at the bottom to w1 x d1 at the top
  const g = new THREE.BoxGeometry(1, 1, 1), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = p.getY(i) + 0.5;
    p.setXYZ(i, p.getX(i) * (w0 + (w1 - w0) * t), (t - 0.5) * h, p.getZ(i) * (d0 + (d1 - d0) * t));
  }
  return g;
}
const tube = (r0, r1, len, sides) => new THREE.CylinderGeometry(r0, r1, len, sides, 1, false).translate(0, -len / 2, 0);
const ball = (r, q) => new THREE.SphereGeometry(r, q.ws, q.hs);

// One module at one level of detail: its parts merged, each vertex tagged with its bone and colour slot.
function build(def, q) {
  const parts = [];
  const P = (geo, bone, slot, x, y, z, o = {}) => {
    if (o.fine && !q.fine) return;
    if (o.s) geo.scale(...o.s);
    if (o.rz) geo.rotateZ(o.rz);
    if (o.rx) geo.rotateX(o.rx);
    geo.translate(x, y, z);
    geo.deleteAttribute('uv');
    geo.computeVertexNormals(); // after the taper and scale; boxes keep a vertex per face, so they stay faceted
    const n = geo.attributes.position.count;
    geo.setAttribute('aBone', new THREE.Float32BufferAttribute(new Float32Array(n).fill(bone), 1));
    geo.setAttribute('aSlot', new THREE.Float32BufferAttribute(new Float32Array(n).fill(slot), 1));
    parts.push(geo);
  };
  def(P, q);
  return parts.length ? mergeGeometries(parts) : null;
}

// Both sides of a limb pair: s = 1 is the person's left (+x), -1 the right.
const SIDES = [[1, B.thighL, B.shinL, B.uarmL, B.farmL, B.skirtL], [-1, B.thighR, B.shinR, B.uarmR, B.farmR, B.skirtR]];
const sleeves = (P, q, r, slot = S.top) => {
  for (const [s, , , ua, fa] of SIDES) {
    P(tube(r, r * 0.88, 0.31, q.n), ua, slot, s * SX, SY + 0.03, 0);
    P(tube(r * 0.86, r * 0.72, 0.27, q.n), fa, slot, s * SX, EY + 0.01, 0);
  }
};
const torso = (P, w0, w1, d0, d1, slot = S.top) => P(slab(w0, w1, 0.52, d0, d1), B.torso, slot, 0, WY - 0.02 + 0.26, 0);
const belt = (P, slot = S.accent) => P(slab(0.335, 0.335, 0.045, 0.225), B.pelvis, slot, 0, 0.97, 0, { fine: true });
const skirt = (P, len, flare, slot = S.top, only = 0) => {
  for (const [s, , , , , sk] of SIDES) if (!only || only === s) {
    P(slab(0.165 + flare, 0.165, len, 0.25 + flare, 0.24), sk, slot, s * 0.085, 0.96 - len / 2, 0);
  }
};

// The modules. kind: 'body' (everyone), 'top', 'head' or 'extra'.
export const MODULES = {
  body: ['body', (P, q) => {
    for (const [s, th, sh, , fa] of SIDES) {
      P(tube(0.08, 0.062, 0.44, q.n), th, S.bottom, s * HX, HY + 0.02, 0);
      P(tube(0.06, 0.046, 0.43, q.n), sh, S.bottom, s * HX, KY + 0.01, 0);
      P(slab(0.105, 0.09, 0.085, 0.27, 0.2), sh, S.shoe, s * HX, 0.043, 0.04);
      P(slab(0.07, 0.06, 0.1, 0.035, 0.03), fa, S.skin, s * SX, EY - 0.32, 0.005);
    }
    P(slab(0.32, 0.31, 0.2, 0.21), B.pelvis, S.bottom, 0, 0.94, 0);
    P(tube(0.047, 0.052, 0.13, q.n), B.head, S.skin, 0, 1.58, 0);
    P(ball(0.1, q), B.head, S.skin, 0, 1.635, 0.005, { s: [0.9, 1.12, 1] });
    P(slab(0.028, 0.026, 0.045, 0.03), B.head, S.skin, 0, 1.625, 0.1, { fine: true }); // nose
    P(slab(0.066, 0.066, 0.13, 0.013), B.farmR, S.screen, -SX, EY - 0.34, 0.045); // phone, shown only in use
  }],
  // Tops.
  jacket: ['top', (P, q) => {
    torso(P, 0.34, 0.42, 0.23, 0.25);
    P(slab(0.27, 0.25, 0.075, 0.19, 0.17), B.torso, S.top, 0, 1.5, -0.005);
    P(slab(0.36, 0.35, 0.06, 0.25, 0.25), B.torso, S.top, 0, 0.99, 0, { fine: true }); // hem band
    sleeves(P, q, 0.06);
    belt(P);
  }],
  hoodie: ['top', (P, q) => {
    torso(P, 0.35, 0.41, 0.24, 0.26);
    P(slab(0.25, 0.29, 0.15, 0.1, 0.12), B.torso, S.top, 0, 1.47, -0.13); // the hood, down
    P(slab(0.21, 0.2, 0.11, 0.02), B.torso, S.accent, 0, 1.08, 0.13, { fine: true }); // front pocket
    sleeves(P, q, 0.064);
  }],
  longcoat: ['top', (P, q) => {
    torso(P, 0.35, 0.42, 0.24, 0.26);
    P(slab(0.31, 0.29, 0.11, 0.21, 0.2), B.torso, S.top, 0, 1.5, -0.01); // turned-up collar
    skirt(P, 0.52, 0.04);
    sleeves(P, q, 0.062);
    belt(P);
  }],
  corpcoat: ['top', (P, q) => {
    torso(P, 0.34, 0.43, 0.23, 0.25);
    P(slab(0.2, 0.22, 0.17, 0.17, 0.18), B.torso, S.top, 0, 1.53, -0.005); // high collar
    for (const s of [1, -1]) P(slab(0.13, 0.11, 0.05, 0.15, 0.14), B.torso, S.top, s * 0.19, 1.48, 0); // squared shoulders
    P(slab(0.012, 0.012, 0.4, 0.012), B.torso, S.glow, 0.045, 1.2, 0.128); // a thin lit seam down the placket
    skirt(P, 0.56, 0.015);
    sleeves(P, q, 0.058);
  }],
  suit: ['top', (P, q) => {
    torso(P, 0.33, 0.45, 0.22, 0.24);
    P(slab(0.21, 0.21, 0.1, 0.17, 0.17), B.torso, S.accent, 0, 1.52, 0); // band collar
    for (const s of [1, -1]) P(slab(0.03, 0.03, 0.32, 0.01), B.torso, S.accent, s * 0.06, 1.28, 0.118, { rz: s * 0.25, fine: true }); // lapels
    P(slab(0.02, 0.02, 0.02, 0.01), B.torso, S.glow, 0.11, 1.38, 0.122, { fine: true }); // a small lit pin
    P(slab(0.35, 0.34, 0.12, 0.25, 0.24), B.pelvis, S.top, 0, 0.96, 0); // the jacket's skirt over the hips
    sleeves(P, q, 0.057);
  }],
  workwear: ['top', (P, q) => {
    torso(P, 0.36, 0.43, 0.25, 0.27);
    for (const y of [1.12, 1.3]) P(slab(0.37, 0.4, 0.035, 0.26, 0.265), B.torso, S.strip, 0, y, 0); // reflective bands
    P(slab(0.36, 0.36, 0.07, 0.25), B.pelvis, S.gear, 0, 0.97, 0); // tool belt
    for (const s of [1, -1]) P(slab(0.07, 0.07, 0.1, 0.07), B.pelvis, S.gear, s * 0.17, 0.92, 0.06, { fine: true }); // pouches
    for (const [s, , sh] of SIDES) P(tube(0.064, 0.062, 0.04, q.n), sh, S.strip, s * HX, 0.32, 0); // shin strips
    sleeves(P, q, 0.064);
  }],
  street: ['top', (P, q) => { // asymmetric: one long panel down the left side, a patch on the right shoulder
    torso(P, 0.34, 0.41, 0.23, 0.25);
    skirt(P, 0.38, 0.02, S.top, 1);
    P(slab(0.1, 0.1, 0.12, 0.14), B.torso, S.accent, -0.17, 1.38, 0, { fine: true });
    P(slab(0.3, 0.27, 0.07, 0.2, 0.18), B.torso, S.accent, 0, 1.5, -0.01);
    sleeves(P, q, 0.062);
    P(tube(0.066, 0.064, 0.05, q.n), B.farmR, S.accent, -SX, EY - 0.1, 0, { fine: true }); // a band on one sleeve
  }],
  armor: ['top', (P, q) => { // security patrol: dark uniform, plates, a lit strip across the chest
    torso(P, 0.37, 0.45, 0.26, 0.28);
    P(slab(0.3, 0.34, 0.26, 0.06), B.torso, S.gear, 0, 1.27, 0.13);
    P(slab(0.3, 0.3, 0.02, 0.01), B.torso, S.glow, 0, 1.34, 0.163);
    for (const s of [1, -1]) P(slab(0.15, 0.13, 0.07, 0.17, 0.15), B.torso, S.gear, s * 0.21, 1.46, 0);
    P(slab(0.36, 0.36, 0.08, 0.25), B.pelvis, S.gear, 0, 0.97, 0);
    for (const [s, , sh] of SIDES) P(slab(0.1, 0.09, 0.12, 0.07), sh, S.gear, s * HX, 0.44, 0.05);
    sleeves(P, q, 0.064);
  }],
  // Heads.
  hairShort: ['head', (P, q) => P(ball(0.106, q), B.head, S.hair, 0, 1.668, -0.014, { s: [0.95, 0.8, 1.04] })],
  hairLong: ['head', (P, q) => {
    P(ball(0.108, q), B.head, S.hair, 0, 1.666, -0.014, { s: [0.97, 0.82, 1.05] });
    P(slab(0.2, 0.18, 0.25, 0.07), B.head, S.hair, 0, 1.56, -0.075);
  }],
  cap: ['head', (P, q) => {
    P(ball(0.106, q), B.head, S.hair, 0, 1.66, -0.014, { s: [0.95, 0.75, 1.04] });
    P(ball(0.11, q), B.head, S.gear, 0, 1.7, -0.005, { s: [1, 0.55, 1.05] });
    P(slab(0.15, 0.15, 0.018, 0.11), B.head, S.gear, 0, 1.692, 0.1);
  }],
  hood: ['head', (P, q) => { // up: a dark shape round the head, the face just showing
    P(ball(0.13, q), B.head, S.top, 0, 1.648, -0.035, { s: [1, 1.07, 1.04] });
    P(slab(0.33, 0.25, 0.12, 0.25, 0.2), B.torso, S.top, 0, 1.5, -0.015);
  }],
  helmet: ['head', (P, q) => { // courier: smoked visor, a small lit tail light
    P(ball(0.126, q), B.head, S.gear, 0, 1.676, -0.012, { s: [1, 0.9, 1.1] });
    P(slab(0.18, 0.18, 0.045, 0.035), B.head, S.accent, 0, 1.645, 0.105);
    P(slab(0.045, 0.045, 0.02, 0.02), B.head, S.glow, 0, 1.7, -0.142, { fine: true });
  }],
  hardhat: ['head', (P, q) => {
    P(ball(0.106, q), B.head, S.hair, 0, 1.66, -0.014, { s: [0.95, 0.75, 1.04] });
    P(ball(0.122, q), B.head, S.accent, 0, 1.712, 0, { s: [1.02, 0.7, 1.1] });
    P(slab(0.27, 0.27, 0.016, 0.3), B.head, S.accent, 0, 1.69, 0.01);
  }],
  patrolHelmet: ['head', (P, q) => {
    P(ball(0.128, q), B.head, S.gear, 0, 1.675, -0.012, { s: [1, 0.92, 1.1] });
    P(slab(0.19, 0.19, 0.045, 0.035), B.head, S.glow, 0, 1.648, 0.108);
  }],
  // Extras.
  backpack: ['extra', (P) => { // delivery box with a reflective band and a status light
    P(slab(0.32, 0.3, 0.42, 0.2, 0.17), B.torso, S.gear, 0, 1.2, -0.22);
    P(slab(0.33, 0.33, 0.035, 0.21), B.torso, S.strip, 0, 1.1, -0.22);
    P(slab(0.16, 0.16, 0.02, 0.01), B.torso, S.glow, 0, 1.36, -0.315, { fine: true });
  }],
  messenger: ['extra', (P) => {
    P(slab(0.3, 0.3, 0.24, 0.09), B.pelvis, S.gear, 0.06, 0.93, -0.17);
    P(slab(0.05, 0.05, 0.64, 0.02), B.torso, S.gear, 0, 1.24, 0.127, { rz: 0.72 });
  }],
  mask: ['extra', (P) => P(slab(0.13, 0.12, 0.075, 0.06, 0.05), B.head, S.gear, 0, 1.588, 0.086)],
  visor: ['extra', (P) => P(slab(0.19, 0.19, 0.028, 0.04), B.head, S.glow, 0, 1.655, 0.094)],
  earpiece: ['extra', (P) => P(slab(0.015, 0.015, 0.035, 0.025), B.head, S.glow, 0.096, 1.64, 0.01, { fine: true })],
  cyberarm: ['extra', (P, q) => { // the left arm replaced: steel segments with lit seams
    P(tube(0.064, 0.056, 0.31, q.n), B.uarmL, S.gear, SX, SY + 0.03, 0);
    P(ball(0.05, q), B.farmL, S.glow, SX, EY, 0, { fine: true });
    P(tube(0.056, 0.044, 0.27, q.n), B.farmL, S.gear, SX, EY - 0.01, 0);
    P(slab(0.012, 0.012, 0.22, 0.012), B.farmL, S.glow, SX + 0.052, EY - 0.15, 0);
    P(slab(0.078, 0.066, 0.11, 0.045, 0.04), B.farmL, S.gear, SX, EY - 0.32, 0.005);
  }],
};
export const NAMES = Object.keys(MODULES);

// Levels of detail: sides on the tubes, segments on the heads, and whether the small parts are drawn.
const LODS = [{ n: 7, ws: 9, hs: 6, fine: true }, { n: 5, ws: 6, hs: 4, fine: false }, { n: 4, ws: 5, hs: 3, fine: false }];

// The shader: poses every vertex from the person's numbers. Angles in radians; forward is +z.
const VERTEX_HEAD = /* glsl */ `
uniform highp sampler2D uPeople; uniform float uTime, uFar; uniform vec3 uCols[${COLOURS.length}];
attribute float aPerson, aBone, aSlot;
varying vec3 vCol; varying vec3 vEmit;
vec3 rx(vec3 v, float a) { float c = cos(a), s = sin(a); return vec3(v.x, v.y * c - v.z * s, v.y * s + v.z * c); }
vec3 ry(vec3 v, float a) { float c = cos(a), s = sin(a); return vec3(v.x * c + v.z * s, v.y, -v.x * s + v.z * c); }
vec3 rz(vec3 v, float a) { float c = cos(a), s = sin(a); return vec3(v.x * c - v.y * s, v.x * s + v.y * c, v.z); }
vec3 pedP;`;
const POSE = /* glsl */ `
  int row = int(aPerson);
  vec4 p0 = texelFetch(uPeople, ivec2(0, row), 0), p1 = texelFetch(uPeople, ivec2(1, row), 0);
  vec4 p2 = texelFetch(uPeople, ivec2(2, row), 0), p3 = texelFetch(uPeople, ivec2(3, row), 0);
  vec4 p4 = texelFetch(uPeople, ivec2(4, row), 0), p5 = texelFetch(uPeople, ivec2(5, row), 0), p6 = texelFetch(uPeople, ivec2(6, row), 0);
  float ph = p1.x, walk = p1.y, dev = p2.y, talk = p2.z, sit = p2.w, seed = p4.x;
  // Seated postures, blended: forward (elbows on knees), back (leaning on the hands), the left leg crossed over
  // the right, and a bouncing right leg; none of them is upright with the hands on the thighs.
  float fwd = p5.x, back = p5.y, cross = p5.z, tap = p5.w;
  // Eating (a hand to the mouth every few seconds, the other holding the bowl near) and working at a counter (both
  // hands busy in front, never quite in step).
  float eat = p6.x, work = p6.y;
  int b = int(aBone + 0.5), sl = int(aSlot + 0.5);
  float side = (b == 3 || b == 4 || b == 7 || b == 8 || b == 11) ? 1.0 : -1.0;
  float t = uTime + seed * 61.0, sn = sin(ph);
  // Gait: thighs swing opposite, knees bend in the swing, arms counter-swing; each person's amplitudes differ.
  float th = (0.4 + 0.12 * fract(seed * 7.31)) * walk * sn * side;
  float kn = walk * (0.1 + 0.7 * max(0.0, cos(ph) * side));
  // Seated: thighs level, shins down, knees a little apart; a crossed left leg rides up over the right knee and
  // swings in front of it; a tapping right leg bounces at the knee.
  float lift = side > 0.0 ? cross * 0.28 : 0.0, spread = side * (0.09 + 0.08 * fract(seed * 9.1));
  spread = mix(spread, -0.32, side > 0.0 ? cross : 0.0) * sit;
  th = mix(th, 1.5 + lift, sit);
  kn = mix(kn, 1.5 - lift * 0.9 + (side < 0.0 ? tap * 0.08 * sin(t * 8.5) : 0.0), sit);
  float ua = -th * (0.55 + 0.35 * fract(seed * 3.7)) * (1.0 - sit), eb = 0.16 + 0.28 * walk + 0.15 * fract(seed * 5.3);
  float ab = 0.07 + 0.02 * walk;
  // Idle hands drift a little. Seated, the hands rest on the thighs, or the forearms on the knees with the hands
  // loosely together, or on the bench behind.
  ua += (1.0 - walk) * 0.04 * sin(t * 0.7 + side);
  float sua = mix(mix(0.18, 0.02, fwd), -0.32, back), seb = mix(mix(1.05, 1.05, fwd), 0.3, back);
  float sab = mix(mix(-0.13, -0.24, fwd), 0.36, back);
  ua = mix(ua, sua + 0.03 * sin(t * 0.5 + side), sit); eb = mix(eb, seb, sit); ab = mix(ab, sab, sit);
  if (side < 0.0) { // the right arm holds the phone, and talks
    float g = 0.5 + 0.5 * sin(t * 0.83);
    ua = mix(ua, 0.32 + 0.18 * sin(t * 1.9), talk * g); eb = mix(eb, 1.0 + 0.45 * sin(t * 2.6), talk * g);
    ua = mix(ua, 0.38, dev); eb = mix(eb, 1.45, dev);
  } else {
    float g = 0.5 + 0.5 * sin(t * 0.61 + 2.0);
    eb = mix(eb, 0.7 + 0.3 * sin(t * 2.1), talk * g * 0.6);
    ua = mix(ua, 0.2, dev * 0.6); eb = mix(eb, 0.9, dev * 0.6);
  }
  float bite = fract(t * 0.19 + seed), mouth = smoothstep(0.0, 0.07, bite) * (1.0 - smoothstep(0.2, 0.28, bite));
  if (side < 0.0) { ua = mix(ua, mix(0.4, 0.55, mouth), eat); eb = mix(eb, mix(1.3, 2.3, mouth), eat); ab = mix(ab, -0.3, eat * mouth); }
  else { ua = mix(ua, 0.32, eat); eb = mix(eb, 1.35, eat); }
  ua = mix(ua, 0.34 + 0.08 * sin(t * 2.3 + side * 1.7), work); eb = mix(eb, 1.2 + 0.18 * sin(t * 3.1 + side * 2.4), work);
  float twist = 0.07 * walk * sn, lean = 0.05 * walk + p4.y + 0.012 * sin(t * 1.4) + 0.05 * dev + sit * (0.02 + 0.42 * fwd - 0.16 * back);
  float hy = p2.x + talk * 0.12 * sin(t * 0.9), hp = p4.z + 0.4 * dev + 0.18 * eat * (1.0 - mouth) + 0.28 * work + talk * 0.05 * sin(t * 1.7) - sit * (0.32 * fwd - 0.12 * back) * (1.0 - dev);
  vec3 P = position, N = normal;
  if (sl == 8) P = mix(vec3(-${SX}, ${EY - 0.32}, 0.03), P, dev); // the phone, folded into the hand when not in use
  if (b == 4 || b == 6) { vec3 e = vec3(side * ${SX}, ${EY}, 0.0); P = e + rx(P - e, -eb); N = rx(N, -eb); }
  if (b >= 3 && b <= 6) { vec3 s = vec3(side * ${SX}, ${SY}, 0.0); P = s + rz(rx(P - s, -ua), side * ab); N = rz(rx(N, -ua), side * ab); }
  if (b == 8 || b == 10) { vec3 k = vec3(side * ${HX}, ${KY}, 0.0); P = k + rx(P - k, kn); N = rx(N, kn); }
  if (b >= 7 && b <= 10) { vec3 h = vec3(side * ${HX}, ${HY}, 0.0); P = h + ry(rx(P - h, -th), spread); N = ry(rx(N, -th), spread); }
  // Coat tails swing about half as far as the thighs, and lie along the lap when seated.
  if (b >= 11) { vec3 h = vec3(side * 0.08, ${HY + 0.04}, 0.0); float a = -th * mix(0.6, 0.97, sit) - 0.04; P = h + rx(P - h, a); N = rx(N, a); }
  if (b == 2) { vec3 n = vec3(0.0, ${NY}, 0.0); P = n + ry(rx(P - n, hp), hy); N = ry(rx(N, hp), hy); }
  if (b >= 1 && b <= 6) { vec3 w = vec3(0.0, ${WY}, 0.0); P = w + ry(rx(P - w, lean), twist); N = ry(rx(N, lean), twist); }
  // The body bobs twice a stride and shifts its weight; sitting lowers the hips onto the seat.
  P += vec3((0.012 * walk * sn + (1.0 - walk) * (1.0 - sit) * 0.015 * sin(t * 0.31)), walk * 0.03 * (cos(2.0 * ph) * 0.5 + 0.5) - sit * 0.43, -sit * 0.05);
  // Fading in and out (spawning, and beyond the crowd's distance), by shrinking to the feet: far off it is a pixel.
  float fade = p3.w * (1.0 - smoothstep(uFar * 0.82, uFar, distance(p0.xyz, cameraPosition)));
  vec3 size = vec3(p1.w, p1.z, p1.w);
  P = ry(P * size * fade, p0.w) + p0.xyz;
  N = ry(normalize(N / size), p0.w);
  pedP = P;
  vec3 objectNormal = N;
  // Colour: indices packed two or three to a float.
  float A = p3.x, Bc = p3.y, C = p3.z;
  int iTop = int(mod(A, 64.0)), iBot = int(A / 64.0), iAcc = int(mod(Bc, 64.0)), iSkin = int(Bc / 64.0);
  int iHair = int(mod(C, 64.0)), iGear = int(mod(floor(C / 64.0), 64.0)), iGlow = int(C / 4096.0);
  vCol = sl == 0 ? uCols[iSkin] : sl == 1 ? uCols[iTop] : sl == 2 ? uCols[iBot] : sl == 3 ? uCols[${colour('clothBlack')}]
    : sl == 4 ? uCols[iAcc] : sl == 5 ? uCols[iHair] : sl == 6 ? uCols[iGear] : sl == 9 ? uCols[${colour('reflective')}] : vec3(0.02);
  // A little of the street's light bounced back off them (the lamps and shopfronts are not real lights), so
  // dark clothes still read as people at night; lit parts glow.
  vEmit = sl == 7 ? uCols[iGlow] * p4.w * 1.6 : sl == 8 ? uCols[${colour('coldCyan')}] * dev * 0.9
    : sl == 9 ? uCols[${colour('reflective')}] * 0.14 : vCol * 0.22;`;

// One material for every module and level: a standard lit surface, posed and coloured by the shader above.
function material(data, time, far) {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.78, metalness: 0.05 });
  const cols = { value: COLOURS.map((name) => new THREE.Color(palette[name])) };
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, { uPeople: { value: data }, uTime: time, uFar: far, uCols: cols });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERTEX_HEAD}`)
      .replace('#include <beginnormal_vertex>', POSE)
      .replace('#include <begin_vertex>', 'vec3 transformed = pedP;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCol; varying vec3 vEmit;')
      .replace('#include <color_fragment>', 'diffuseColor.rgb = vCol;')
      .replace('#include <emissivemap_fragment>', 'totalEmissiveRadiance = vEmit;');
  };
  m.customProgramCacheKey = () => 'people';
  return m;
}

// Every module at every level, as instanced meshes drawing the people listed in their aPerson attribute.
// Returns { group, meshes: [module][lod] -> { mesh, ids, count } }, the data texture and the shared uniforms.
export function figures(capacity) {
  const data = new THREE.DataTexture(new Float32Array(TEXELS * 4 * capacity), TEXELS, capacity, THREE.RGBAFormat, THREE.FloatType);
  data.magFilter = data.minFilter = THREE.NearestFilter;
  const time = { value: 0 }, far = { value: 450 }, mat = material(data, time, far), group = new THREE.Group();
  const meshes = NAMES.map((name) => LODS.map((q) => {
    const geo = build(MODULES[name][1], q);
    if (!geo) return null;
    const g = new THREE.InstancedBufferGeometry();
    g.index = geo.index;
    for (const k of ['position', 'normal', 'aBone', 'aSlot']) g.setAttribute(k, geo.attributes[k]);
    const ids = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);
    ids.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('aPerson', ids);
    g.instanceCount = 0;
    const mesh = new THREE.Mesh(g, mat);
    mesh.frustumCulled = false; // people.js culls each person itself
    mesh.visible = false;
    group.add(mesh);
    return { mesh, ids, count: 0 };
  }));
  return { group, meshes, data, time, far };
}
