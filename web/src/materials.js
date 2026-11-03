// Materials: CC0 PBR texture sets and models (web/assets), plus textures drawn in code (concrete, windows, signs, ads).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { palette } from './palette.js';
import { REPEAT, rng } from './geometry.js';

const TEXTURES = ['rusty_corrugated_iron', 'rusty_painted_metal', 'box_profile_metal_sheet', 'metal_grate_rusty', 'aerial_asphalt_01'];
const MODELS = ['modular_industrial_pipes_01', 'modular_airduct_circular_01', 'modular_fire_escape', 'utility_box_01'];
const css = (c) => `#${new THREE.Color(c).getHexString()}`;
// Glowing parts are dimmed by this factor everywhere, so neon accents without blowing out the frame.
const NEON = 0.65;

export async function loadKit(renderer, base = './assets') {
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
  const gltf = new GLTFLoader(), models = {};
  await Promise.all(MODELS.map(async (name) => (models[name] = (await gltf.loadAsync(`${base}/models/${name}/${name}.gltf`)).scene)));

  const cache = new Map();
  // Cached by key; the key doubles as the material's name, which ?bench uses to report where triangles go.
  const once = (key, make) => {
    if (!cache.has(key)) cache.set(key, Object.assign(make(), { name: key }));
    return cache.get(key);
  };
  return {
    // Textured material, tinted by a palette color.
    mat: (name, color = 0xffffff) => once(`${name}:${color}`, () =>
      new THREE.MeshStandardMaterial({ ...maps[name], color, metalness: 1, roughness: 1 })),
    // Smooth painted steel: flat color with only the worn metal's surface relief and roughness.
    steel: (color, roughness = 0.5) => once(`steel:${color}:${roughness}`, () => new THREE.MeshStandardMaterial({
      color, metalness: 0.25, roughness: Math.max(roughness, 0.6), normalMap: maps.rusty_painted_metal.normalMap, normalScale: new THREE.Vector2(0.35, 0.35) })),
    glass: (color = palette.glassBand) => once(`glass:${color}`, () =>
      new THREE.MeshStandardMaterial({ color, metalness: 0.2, roughness: 0.4 })),
    glow: (color, intensity = 2.5) => once(`glow:${color}:${intensity}`, () =>
      new THREE.MeshStandardMaterial({ color: palette.deepNavy, emissive: color, emissiveIntensity: intensity * NEON })),
    // Cast concrete drawn in code: soft blotches, rain streaks, faint formwork seams; no tiling grid.
    concrete: (color) => once(`concrete:${color}`, () => new THREE.MeshStandardMaterial({
      map: once('concreteMap', concreteCanvas), color, roughness: 0.9, metalness: 0 })),
    // Night glass: a grid of rooms (1.25 m bays, 3.5 m floors), nearly half lit, mostly warm.
    // concrete: punched windows in a concrete wall instead of a glass skin. Unlit (blackout): every room dark.
    windows: (seed = 1, lit = true, concrete = false) => once(`windows:${seed}:${lit}:${concrete}`, () => {
      const fit = (t) => { t.repeat.set(REPEAT / (8 * 1.25), REPEAT / (8 * 3.5)); return t; };
      const glow = lit ? { emissive: 0xffffff, emissiveMap: fit(windowCanvas(seed)), emissiveIntensity: 1 } : {};
      return concrete
        ? new THREE.MeshStandardMaterial({ map: fit(once('punched', punchedCanvas)), color: palette.slate, roughness: 0.85, ...glow })
        : new THREE.MeshStandardMaterial({ color: palette.charcoal, metalness: 0.15, roughness: 0.45, ...glow });
    }),
    // Lit sign with an invented word: glowing text and frame on a dark panel.
    sign: (text, color, vertical = false) => once(`sign:${text}:${color}:${vertical}`, () => {
      const map = textCanvas(text, color, vertical, palette.deepNavy);
      return new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: 1.3 * NEON });
    }),
    // Billboard ad: an invented word over bands of color, lit from within.
    billboard: (text, a, b) => once(`ad:${text}:${a}:${b}`, () => new THREE.MeshStandardMaterial({
      color: 0x000000, emissive: 0xffffff, emissiveMap: adCanvas(text, a, b), emissiveIntensity: 1.1 * NEON })),
    // Hologram: see-through, additive, with scanlines.
    holo: (text, color) => once(`holo:${text}:${color}`, () => new THREE.MeshBasicMaterial({
      map: textCanvas(text, color, false, null), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending,
      depthWrite: false, side: THREE.DoubleSide })),
    // A named piece from a CC0 model, or the whole model when no node is given; its sheet offset is cleared.
    piece(model, node) {
      const obj = (node ? models[model].getObjectByName(node) : models[model]).clone();
      obj.position.set(0, 0, 0);
      obj.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
      return obj;
    },
  };
}

function concreteCanvas() {
  const S = 512, canvas = Object.assign(document.createElement('canvas'), { width: S, height: S });
  const g = canvas.getContext('2d'), rand = rng(17);
  g.fillStyle = '#d8d8d8';
  g.fillRect(0, 0, S, S);
  // Drawn three times, offset by the canvas size, so blotches and streaks wrap without seams.
  const wrap = (draw) => { for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) draw(dx, dy); };
  for (let i = 0; i < 40; i++) {
    const [x, y, r, v] = [rand() * S, rand() * S, 30 + rand() * 120, rand() < 0.5 ? 0 : 255];
    const a = 0.03 + rand() * 0.05;
    wrap((dx, dy) => {
      const grad = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
      grad.addColorStop(0, `rgba(${v},${v},${v},${a})`);
      grad.addColorStop(1, `rgba(${v},${v},${v},0)`);
      g.fillStyle = grad;
      g.fillRect(x + dx - r, y + dy - r, 2 * r, 2 * r);
    });
  }
  for (let i = 0; i < 4000; i++) {
    const v = rand() < 0.5 ? 0 : 255;
    g.fillStyle = `rgba(${v},${v},${v},${0.03 + rand() * 0.05})`;
    g.fillRect(rand() * S, rand() * S, 1 + rand() * 2, 1 + rand() * 2);
  }
  for (let i = 0; i < 14; i++) {
    const [x, y, len, w] = [rand() * S, rand() * S, 60 + rand() * 200, 2 + rand() * 4];
    const grad = g.createLinearGradient(0, y, 0, y + len);
    grad.addColorStop(0, 'rgba(0,0,0,0.12)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    wrap((dx, dy) => g.fillRect(x + dx, y + dy, w, len));
  }
  g.fillStyle = 'rgba(0,0,0,0.07)';
  g.fillRect(0, S / 2, S, 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// Concrete wall with a dark window in every cell, on the same grid as windowCanvas.
function punchedCanvas() {
  const canvas = Object.assign(document.createElement('canvas'), { width: 256, height: 256 });
  const g = canvas.getContext('2d'), rand = rng(5);
  g.fillStyle = '#a8a8a8';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1500; i++) {
    g.fillStyle = `rgba(0,0,0,${0.03 + rand() * 0.06})`;
    g.fillRect(rand() * 256, rand() * 256, 1 + rand() * 2, 1 + rand() * 2);
  }
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    g.fillStyle = '#1a2030';
    g.fillRect(c * 32 + 3, r * 32 + 8, 26, 20);
    g.fillStyle = 'rgba(0,0,0,0.12)';
    g.fillRect(c * 32 + 3, r * 32 + 28, 26, 4);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function windowCanvas(seed) {
  const canvas = Object.assign(document.createElement('canvas'), { width: 256, height: 256 });
  const g = canvas.getContext('2d');
  // Mostly warm rooms; pink and cyan are rare so a whole city does not turn to confetti.
  const lit = [palette.warmWindow, palette.warmWindow, palette.warmWindow, palette.sodium, palette.sodium, palette.glare,
    palette.warmWindow, palette.sodium, palette.neonPink, palette.neonCyan];
  let a = seed * 9301 + 49297;
  const rand = () => ((a = (a * 9301 + 49297) % 233280) / 233280);
  g.fillStyle = '#000';
  g.fillRect(0, 0, 256, 256);
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    if (rand() > 0.45) continue;
    g.globalAlpha = 0.35 + rand() * 0.5;
    g.fillStyle = css(lit[Math.floor(rand() * lit.length)]);
    g.fillRect(c * 32 + 3, r * 32 + 8, 26, 20);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function adCanvas(text, a, b) {
  const canvas = Object.assign(document.createElement('canvas'), { width: 512, height: 256 });
  const g = canvas.getContext('2d'), grad = g.createLinearGradient(0, 0, 512, 256);
  grad.addColorStop(0, css(a));
  grad.addColorStop(1, css(b));
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 256);
  g.fillStyle = 'rgba(10,12,30,0.55)';
  for (let k = 0; k < 5; k++) g.fillRect(0, 30 + k * 46, 512, 14);
  g.beginPath();
  g.arc(400, 128, 70, 0, Math.PI * 2);
  g.fillStyle = 'rgba(255,255,255,0.35)';
  g.fill();
  g.fillStyle = '#fff';
  g.font = 'bold 96px monospace';
  g.textBaseline = 'middle';
  g.fillText(text, 30, 130);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function textCanvas(text, color, vertical, background) {
  const [w, h] = vertical ? [128, 512] : [512, 128];
  const canvas = Object.assign(document.createElement('canvas'), { width: w, height: h });
  const g = canvas.getContext('2d');
  if (background) {
    g.fillStyle = css(background);
    g.fillRect(0, 0, w, h);
  }
  g.strokeStyle = g.fillStyle = css(color);
  g.lineWidth = 6;
  g.strokeRect(8, 8, w - 16, h - 16);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  if (vertical) {
    g.font = 'bold 76px monospace';
    [...text].forEach((ch, i, all) => g.fillText(ch, w / 2, ((i + 0.5) / all.length) * (h - 40) + 20));
  } else {
    g.font = 'bold 64px monospace';
    g.fillText(text, w / 2, h / 2 + 4);
  }
  if (!background) {
    // Scanlines so holograms read as projected light, not paint.
    g.globalCompositeOperation = 'destination-out';
    for (let y = 0; y < h; y += 4) g.fillRect(0, y, w, 2);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
