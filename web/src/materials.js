// Materials: CC0 PBR texture sets and models (web/assets), and materials built on the textures in textures.js.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { palette } from './palette.js';
import { adTexture, concreteTexture, corpTexture, messageTexture, posterTexture, textTexture } from './textures.js';
import { STYLES, facadeMaterial, facadeTime } from './facade.js';

const TEXTURES = ['rusty_corrugated_iron', 'rusty_painted_metal', 'box_profile_metal_sheet', 'metal_grate_rusty', 'aerial_asphalt_01'];
// Glowing parts are dimmed by this factor everywhere, so neon accents without blowing out the frame.
const NEON = 0.65;

// A corporate sign's display, made to look digital in its own shader (no extra draw calls, no light): on a face
// (kind 0) the crimson mark breathes slowly, a soft scan band sweeps down every few seconds, fine scanlines drift
// and now and then one thin slice slips sideways for a moment; on an info display (kind 1) the amber text is
// redrawn left to right every few seconds. Nothing flashes, and with reduced motion there is no frame loop, so
// the time never advances and the sign holds still. phase keeps the signs out of step.
function liveSign(m, kind, phase) {
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, { sTime: facadeTime, sPhase: { value: phase }, sKind: { value: kind } });
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float sTime, sPhase, sKind;`)
      .replace('#include <emissivemap_fragment>', `
        vec2 sUv = vEmissiveMapUv;
        float sT = sTime + sPhase;
        // A glitch: for a quarter second in every eleven, one thin band of the face slips sideways.
        float sGlitch = step(fract(sT / 11.0), 0.022) * step(abs(sUv.y - fract(sPhase * 0.37) * 0.8 - 0.1), 0.04);
        vec3 sE = texture2D(emissiveMap, sUv + vec2(sGlitch * 0.035 * (1.0 - sKind), 0.0)).rgb;
        if (sKind < 0.5) {
          float red = clamp((sE.r - max(sE.g, sE.b)) * 3.0, 0.0, 1.0);
          sE *= 1.0 + red * 0.4 * sin(sT * 1.5); // the mark breathes, about once every four seconds
          float sB = (sUv.y - (1.15 - fract(sT * 0.18) * 1.3)) * 12.0, band = exp(-sB * sB); // the scan band
          sE += sE * band * 0.8;
        } else {
          float reveal = fract(sT * 0.2) * 1.4; // redrawn left to right every five seconds
          sE *= smoothstep(reveal, reveal - 0.03, sUv.x) * 0.85 + 0.15;
        }
        sE *= 0.9 + 0.1 * sin(sUv.y * 180.0 - sT * 5.0); // fine scanlines drifting down
        totalEmissiveRadiance *= sE;`);
  };
  m.customProgramCacheKey = () => 'liveSign';
  return m;
}

// Projected light (holograms, tools/blender/holo_projectors.py): additive, unlit, no depth write, both sides, in
// its own shader. kind 0 is the floating image: the ad cast in the projector's tint, rising scanlines, a refresh
// line climbing every few seconds, fine grain, a faint shimmer, soft edges, a slow breath and, every nine seconds,
// one slice slipping sideways for a moment. kind 1 is a fan of light from the lens: brightest at the lens, fading
// to the image, with slow drifting streaks. Far away it fades to nothing (fog would add glow, not hide it).
// Nothing flashes; with reduced motion the time never advances.
const HOLO_VERT = `varying vec2 vUv; varying vec3 vWorld;
void main() {
  vUv = uv;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const HOLO_FRAG = `uniform sampler2D map; uniform vec3 tint; uniform float time, phase, kind, strength;
varying vec2 vUv; varying vec3 vWorld;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  float t = time + phase, far = exp(-distance(cameraPosition, vWorld) / 900.0);
  if (far < 0.02) discard; // past about 3.5 km it would add nothing: skip the work
  vec3 c;
  if (kind < 0.5) {
    vec2 uv = vUv;
    uv.x += step(fract(t / 9.0), 0.03) * step(abs(uv.y - fract(phase * 0.61)), 0.05) * 0.04; // the glitch slice
    uv.x += sin(uv.y * 14.0 + t * 2.3) * 0.0025; // shimmer
    vec3 tex = texture2D(map, uv).rgb;
    float l = dot(tex, vec3(0.2126, 0.7152, 0.0722));
    c = mix(tex, tint * l * 1.6, 0.35) + tint * 0.012; // a trace of fill: the projected volume, not a sheet
    c *= 0.72 + 0.28 * sin(uv.y * 220.0 - t * 6.0);
    float r = (uv.y - fract(t * 0.22)) * 18.0; // pow() of a negative is undefined in GLSL
    c += tint * 0.5 * exp(-r * r);
    c *= 0.92 + 0.08 * hash(floor(uv * vec2(90.0, 160.0)) + floor(t * 8.0));
    vec2 e = min(uv, 1.0 - uv);
    c *= smoothstep(0.0, 0.04, min(e.x, e.y)) * (0.88 + 0.12 * sin(t * 0.9));
  } else {
    float edge = 1.0 - abs(vUv.x - 0.5) * 2.0;
    c = tint * (0.16 * pow(max(1.0 - vUv.y, 0.0), 0.6) + 0.05) * smoothstep(0.0, 0.5, edge) * (0.75 + 0.25 * sin(vUv.x * 50.0 + t * 1.7));
  }
  gl_FragColor = vec4(c * strength * far, 1.0);
}`;
const hologram = (map, tint, kind, phase, strength) => new THREE.ShaderMaterial({
  uniforms: { map: { value: map }, tint: { value: new THREE.Color(tint) }, time: facadeTime, phase: { value: phase },
    kind: { value: kind }, strength: { value: strength } },
  vertexShader: HOLO_VERT, fragmentShader: HOLO_FRAG, transparent: true, depthWrite: false,
  blending: THREE.AdditiveBlending, side: THREE.DoubleSide });

// A display lit from within by its texture (signs, ads, screens): black where the texture is, glowing as drawn.
const lit = (map, intensity = NEON) => new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: map,
  emissiveIntensity: intensity });

// An animation phase (seconds) from a material's key, so no two signs run in step.
const phaseOf = (key) => ([...key].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 9973, 7) % 997) * 0.37;

// models: the glTF models (web/assets/models) this page uses; the city's are its own (telecom_tower, power_plant,
// market_hall, ADR-0005), the rest CC0 kit pieces for close-ups.
export async function loadKit(renderer, models = [], base = './assets') {
  const tl = new THREE.TextureLoader();
  const aniso = renderer.capabilities.getMaxAnisotropy();
  const tex = (url, srgb) => tl.loadAsync(url).then((t) => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = aniso;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });
  const maps = {};
  await Promise.all(TEXTURES.map(async (name) => {
    const [map, normalMap, arm] = await Promise.all([
      tex(`${base}/textures/${name}/diff.jpg`, true), tex(`${base}/textures/${name}/nor.jpg`), tex(`${base}/textures/${name}/arm.jpg`)]);
    // arm packs AO, roughness and metalness into R, G and B, which is what three.js reads from each map.
    maps[name] = { map, normalMap, aoMap: arm, roughnessMap: arm, metalnessMap: arm };
  }));
  const gltf = new GLTFLoader(), scenes = {};
  await Promise.all(models.map(async (name) => (scenes[name] = (await gltf.loadAsync(`${base}/models/${name}/${name}.gltf`)).scene)));

  const cache = new Map();
  // Cached by key; the key doubles as the material's name, which ?bench uses to report where triangles go.
  const once = (key, make) => {
    if (!cache.has(key)) cache.set(key, Object.assign(make(), { name: key }));
    return cache.get(key);
  };
  return {
    // Textured material, tinted by a palette color; roughness below 1 makes it wetter.
    mat: (name, color = 0xffffff, roughness = 1) => once(`${name}:${color}:${roughness}`, () =>
      new THREE.MeshStandardMaterial({ ...maps[name], color, metalness: 1, roughness })),
    // Smooth painted steel: flat color with only the worn metal's surface relief and roughness.
    steel: (color, roughness = 0.5) => once(`steel:${color}:${roughness}`, () => new THREE.MeshStandardMaterial({
      color, metalness: 0.25, roughness: Math.max(roughness, 0.6), normalMap: maps.rusty_painted_metal.normalMap, normalScale: new THREE.Vector2(0.35, 0.35) })),
    glass: (color = palette.glassBand) => once(`glass:${color}`, () =>
      new THREE.MeshStandardMaterial({ color, metalness: 0.2, roughness: 0.4 })),
    // See-through tinted glass, e.g. over the reactor core.
    veil: (color, opacity) => once(`veil:${color}:${opacity}`, () =>
      new THREE.MeshStandardMaterial({ color, roughness: 0.25, transparent: true, opacity })),
    glow: (color, intensity = 2.5) => once(`glow:${color}:${intensity}`, () =>
      new THREE.MeshStandardMaterial({ color: palette.deepNavy, emissive: color, emissiveIntensity: intensity * NEON })),
    // The one red warning light (masts, machinery, industry, security indicators): deep crimson, steady, never
    // neon, one material so every lamp in the city merges into a single draw call.
    warning() { return this.glow(palette.crimson, 5); },
    // Cast concrete drawn in code: soft blotches, rain streaks, faint formwork seams; no tiling grid.
    concrete: (color) => once(`concrete:${color}`, () => new THREE.MeshStandardMaterial({
      map: once('concreteMap', concreteTexture), color, roughness: 0.9, metalness: 0 })),
    // Facade with windows (facade.js), by kind: office and luxury glass curtain walls, or windows in a wall: homes
    // (residential), shopfronts, old brick or weathered concrete, industrial strip windows. Unlit (blackout): every
    // room dark. seed varies which rooms are lit, and for old walls whether they are brick.
    windows: (seed = 1, lit = true, concrete = false, kind = concrete ? 'residential' : 'office') =>
      once(`windows:${seed}:${lit}:${kind}`, () => facadeMaterial(kind, {
        lit, seed, color: kind === 'old' ? (seed % 2 ? palette.brick : palette.roseGrey) : palette.slate,
        map: STYLES[kind].glass ? null : once('concreteMap', concreteTexture) })),
    // Lit sign with an invented word: glowing text and frame on a dark panel.
    sign: (text, color, vertical = false) => once(`sign:${text}:${color}:${vertical}`, () =>
      lit(textTexture(text, color, vertical, palette.deepNavy), 1.3 * NEON)),
    // Billboard ad: an invented word over bands of color, lit from within.
    billboard: (text, a, b) => once(`ad:${text}:${a}:${b}`, () => lit(adTexture(text, a, b), 1.1 * NEON)),
    // Advertisement on a billboard display (textures.js posterTexture), lit from within; size in pixels.
    poster: (brand, line, product, ink, accent, w, h) => once(`poster:${brand}:${w}x${h}`, () =>
      lit(posterTexture(brand, line, product, ink, accent, w, h))),
    // A traffic sign's dot-matrix message (textures.js messageTexture): lines of text.
    message: (lines, w, h) => once(`message:${lines.join('/')}:${w}x${h}`, () => lit(messageTexture(lines, w, h))),
    // A large corporate sign's face (textures.js corpTexture), lit from within; size in pixels.
    corp: (name, line, mark, w, h, ink, markColor) => once(`corp:${name}:${w}x${h}`, () =>
      liveSign(lit(corpTexture(name, line, mark, w, h, ink, markColor)), 0, phaseOf(`${name}${w}`))),
    // A projected ad (hologram above): the ad in the corporate-sign style, cast in its ink as the projector's tint.
    projection: (name, line, mark, ink, markColor, w, h) => once(`projection:${name}:${w}x${h}`, () =>
      hologram(corpTexture(name, line, mark, w, h, ink, markColor, true), ink, 0, phaseOf(`${name}${w}`), 1.5)),
    // The fans of light from a projector's lens, one per tint.
    beam: (tint) => once(`beam:${tint}`, () => hologram(null, tint, 1, 0, 1)),
    // A corporate sign's amber info display: a traffic sign's dot-matrix message, redrawn now and then (liveSign).
    display: (lines, w, h) => once(`display:${lines.join('/')}:${w}x${h}`, () =>
      liveSign(lit(messageTexture(lines, w, h)), 1, phaseOf(lines.join()))),
    // Hologram: see-through, additive, with scanlines.
    holo: (text, color) => once(`holo:${text}:${color}`, () => new THREE.MeshBasicMaterial({
      map: textTexture(text, color, false, null), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending,
      depthWrite: false, side: THREE.DoubleSide })),
    // One of our Blender models (ADR-0005): a copy whose meshes, named by material role, get roles[role]. Throws
    // on a role the caller has no material for, so a re-export with a new role cannot slip through unlit.
    model(name, roles) {
      const g = this.piece(name);
      g.traverse((o) => {
        if (!o.isMesh) return;
        const role = o.material.name;
        o.material = roles[role];
        if (!o.material) throw new Error(`${name}: no material for role ${role} (mesh ${o.name})`);
      });
      return g;
    },
    // A model's near-camera detail is merged per sector, so every material in it is a draw call in every sector that
    // has one: keep the materials in `keep`, move its lights (anything emissive) to the always-drawn model, and give
    // every other part one common steel.
    foldDetail(g, keep = []) {
      const detail = g.getObjectByName('detail'), metal = this.steel(palette.gunmetal, 0.6);
      for (const o of [...detail.children]) {
        if (o.material.emissive?.getHex()) g.add(o);
        else if (!keep.includes(o.material)) o.material = metal;
      }
      return g;
    },
    // The painted steels and dim lights the street-level Blender models share (storefronts, shop strips, skybridges),
    // by role. In a blackout (lit false) the lights are dark steel too.
    industrial(lit = true) {
      const dark = this.steel(palette.charcoal, 0.6), off = (m) => (lit ? m : dark);
      return {
        graphite: this.steel(palette.graphite, 0.6), steel: this.steel(palette.gunmetal, 0.6), olive: this.steel(palette.oliveGrey, 0.6),
        titanium: this.steel(palette.weatheredTitanium, 0.6), hazard: this.steel(palette.hazardPaint, 0.7), dark,
        sheet: this.mat('box_profile_metal_sheet', palette.gunmetal), interior: off(this.glow(palette.warmWindow, 0.5)),
        lamp: off(this.glow(palette.dirtyAmber, 1.2)), glow_amber: off(this.glow(palette.agedAmber, 1)),
        glow_cyan: off(this.glow(palette.coldCyan, 0.8)), red: off(this.warning()),
      };
    },
    // A named piece from a CC0 model, or the whole model when no node is given; its sheet offset is cleared.
    piece(model, node) {
      const obj = (node ? scenes[model].getObjectByName(node) : scenes[model]).clone();
      obj.position.set(0, 0, 0);
      obj.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
      return obj;
    },
  };
}
