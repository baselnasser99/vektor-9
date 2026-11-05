// Materials: CC0 PBR texture sets and models (web/assets), and materials built on the textures in textures.js.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { palette } from './palette.js';
import { adTexture, concreteTexture, messageTexture, posterTexture, textTexture } from './textures.js';
import { STYLES, facadeMaterial } from './facade.js';

const TEXTURES = ['rusty_corrugated_iron', 'rusty_painted_metal', 'box_profile_metal_sheet', 'metal_grate_rusty', 'aerial_asphalt_01'];
// Glowing parts are dimmed by this factor everywhere, so neon accents without blowing out the frame.
const NEON = 0.65;

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
    sign: (text, color, vertical = false) => once(`sign:${text}:${color}:${vertical}`, () => {
      const map = textTexture(text, color, vertical, palette.deepNavy);
      return new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: 1.3 * NEON });
    }),
    // Billboard ad: an invented word over bands of color, lit from within.
    billboard: (text, a, b) => once(`ad:${text}:${a}:${b}`, () => new THREE.MeshStandardMaterial({
      color: 0x000000, emissive: 0xffffff, emissiveMap: adTexture(text, a, b), emissiveIntensity: 1.1 * NEON })),
    // Advertisement on a billboard display (textures.js posterTexture), lit from within; size in pixels.
    poster: (brand, line, product, ink, accent, w, h) => once(`poster:${brand}:${w}x${h}`, () => new THREE.MeshStandardMaterial({
      color: 0x000000, emissive: 0xffffff, emissiveMap: posterTexture(brand, line, product, ink, accent, w, h), emissiveIntensity: NEON })),
    // A traffic sign's dot-matrix message (textures.js messageTexture): lines of text.
    message: (lines) => once(`message:${lines.join('/')}`, () => new THREE.MeshStandardMaterial({
      color: 0x000000, emissive: 0xffffff, emissiveMap: messageTexture(lines), emissiveIntensity: NEON })),
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
    // A named piece from a CC0 model, or the whole model when no node is given; its sheet offset is cleared.
    piece(model, node) {
      const obj = (node ? scenes[model].getObjectByName(node) : scenes[model]).clone();
      obj.position.set(0, 0, 0);
      obj.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
      return obj;
    },
  };
}
