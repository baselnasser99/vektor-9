// Every texture drawn in code: concrete, windows, signs, ads, light pools, clouds, fades and far skylines.
import * as THREE from 'three';
import { palette } from './palette.js';
import { rng } from './geometry.js';

const css = (c) => `#${new THREE.Color(c).getHexString()}`;

// Canvas of w x h, painted by draw(g, w, h), as a texture. srgb for color art; leave it off for masks and glow maps
// whose grey values are meant literally. wrap for textures that tile.
function painted(w, h, draw, { srgb = true, wrap = false } = {}) {
  const canvas = Object.assign(document.createElement('canvas'), { width: w, height: h });
  draw(canvas.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(canvas);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  if (wrap) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// Draw something nine times, offset by the canvas size, so it wraps without seams.
const wrapped = (S, draw) => { for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) draw(dx, dy); };

// Cast concrete: soft blotches, grain, rain streaks and one faint formwork seam; no tiling grid.
export const concreteTexture = () => painted(512, 512, (g, S) => {
  const rand = rng(17);
  g.fillStyle = '#d8d8d8';
  g.fillRect(0, 0, S, S);
  for (let i = 0; i < 40; i++) {
    const [x, y, r, v] = [rand() * S, rand() * S, 30 + rand() * 120, rand() < 0.5 ? 0 : 255];
    const a = 0.03 + rand() * 0.05;
    wrapped(S, (dx, dy) => {
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
    wrapped(S, (dx, dy) => g.fillRect(x + dx, y + dy, w, len));
  }
  g.fillStyle = 'rgba(0,0,0,0.07)';
  g.fillRect(0, S / 2, S, 2);
}, { wrap: true });

// Window grid shared by the two textures below: 8 x 8 rooms per repeat.
const rooms = (draw) => { for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) draw(c * 32 + 3, r * 32 + 8); };

// Concrete wall with a dark window in every room.
export const punchedTexture = () => painted(256, 256, (g) => {
  const rand = rng(5);
  g.fillStyle = '#a8a8a8';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1500; i++) {
    g.fillStyle = `rgba(0,0,0,${0.03 + rand() * 0.06})`;
    g.fillRect(rand() * 256, rand() * 256, 1 + rand() * 2, 1 + rand() * 2);
  }
  rooms((x, y) => {
    g.fillStyle = '#1a2030';
    g.fillRect(x, y, 26, 20);
    g.fillStyle = 'rgba(0,0,0,0.12)';
    g.fillRect(x, y + 20, 26, 4);
  });
}, { wrap: true });

// Lit rooms as a glow map: nearly half lit, mostly warm; pink and cyan are rare so a city does not turn to confetti.
const LIT = [palette.warmWindow, palette.warmWindow, palette.warmWindow, palette.sodium, palette.sodium, palette.glare,
  palette.warmWindow, palette.sodium, palette.neonPink, palette.neonCyan];
export const windowTexture = (seed) => painted(256, 256, (g) => {
  // Its own small generator: changing it would reshuffle every lit window in the city.
  let a = seed * 9301 + 49297;
  const rand = () => ((a = (a * 9301 + 49297) % 233280) / 233280);
  g.fillStyle = '#000';
  g.fillRect(0, 0, 256, 256);
  rooms((x, y) => {
    if (rand() > 0.45) return;
    g.globalAlpha = 0.35 + rand() * 0.5;
    g.fillStyle = css(LIT[Math.floor(rand() * LIT.length)]);
    g.fillRect(x, y, 26, 20);
  });
}, { wrap: true });

// Billboard ad: an invented word over a two-color gradient with dark bands and a pale disc.
export const adTexture = (text, a, b) => painted(512, 256, (g) => {
  const grad = g.createLinearGradient(0, 0, 512, 256);
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
});

// Sign text in a frame; on a background panel, or with scanlines and no panel for holograms.
export const textTexture = (text, color, vertical, background) => painted(...(vertical ? [128, 512] : [512, 128]), (g, w, h) => {
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
});

// White disc fading to transparent from radius `inner` (pixels) outward: lamp pools, the city's light on the sand.
export const radialTexture = (size, inner = 0) => painted(size, size, (g, S) => {
  const grad = g.createRadialGradient(S / 2, S / 2, inner, S / 2, S / 2, S / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, S, S);
}, { srgb: false });

// Soft blotchy noise in the alpha channel, for clouds and mist. squash < 1 flattens the blobs into streaks.
export const noiseTexture = (seed, blobs, squash = 1) => painted(512, 512, (g, S) => {
  const rand = rng(seed);
  for (let i = 0; i < blobs; i++) {
    const [x, y, r, a] = [rand() * S, rand() * S, 40 + rand() * 140, 0.05 + rand() * 0.12];
    wrapped(S, (dx, dy) => {
      g.setTransform(1, 0, 0, squash, x + dx, y + dy);
      const grad = g.createRadialGradient(0, 0, 0, 0, 0, r);
      grad.addColorStop(0, `rgba(255,255,255,${a})`);
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.fillRect(-r, -r, 2 * r, 2 * r);
    });
  }
  g.setTransform(1, 0, 0, 1, 0, 0);
}, { srgb: false, wrap: true });

// Opaque white centre fading to black at the edge, from `inner` (0..1 of the radius); an alpha map that makes a
// plane melt away instead of ending in a line.
export const fadeTexture = (inner = 0) => painted(256, 256, (g, S) => {
  const grad = g.createRadialGradient(S / 2, S / 2, (inner * S) / 2, S / 2, S / 2, S / 2);
  grad.addColorStop(0, '#fff');
  grad.addColorStop(1, '#000');
  g.fillStyle = grad;
  g.fillRect(0, 0, S, S);
}, { srgb: false });

// Vertical band for an alpha map: clear at the top and bottom, solid in the lower middle.
export const bandTexture = () => painted(4, 256, (g, w, h) => {
  const grad = g.createLinearGradient(0, 0, 0, h);
  [[0, '#000'], [0.45, '#fff'], [0.8, '#fff'], [1, '#000']].forEach(([at, c]) => grad.addColorStop(at, c));
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
}, { srgb: false });

// Far-off cities on the horizon, wrapping sideways: a hazier back row and a darker front row of towers in clusters
// with gaps between them, sparse lit windows, steady red beacons on the tallest, and city glow at their feet.
export const skylineTexture = () => {
  const tex = painted(2048, 256, (g, W, H) => {
    const rand = rng(77), fog = new THREE.Color(palette.nightFog);
    const glow = g.createLinearGradient(0, H * 0.55, 0, H);
    glow.addColorStop(0, 'rgba(0,0,0,0)');
    glow.addColorStop(1, `${css(palette.sodium)}38`);
    g.fillStyle = glow;
    g.fillRect(0, 0, W, H);
    for (const [color, tallest, lit, phase] of [[fog.clone().lerp(new THREE.Color(palette.nightHorizon), 0.45), 0.5, 0.12, 2],
      [fog, 0.75, 0.25, 0]]) {
      for (let x = 0; x < W;) {
        const w = 6 + rand() * 26, cluster = Math.max(0, Math.sin((x / W) * Math.PI * 6 + phase));
        const h = H * (0.03 + cluster ** 2 * rand() ** 1.5 * tallest);
        for (const at of x + w > W ? [x, x - W] : [x]) {
          g.fillStyle = css(color);
          g.fillRect(at, H - h, w, h);
          g.globalAlpha = 0.6;
          g.fillStyle = css(palette.warmWindow);
          for (let y = H - h + 4; y < H - 3; y += 6) for (let c = at + 2; c < at + w - 2; c += 5) if (rand() < lit) g.fillRect(c, y, 2, 2);
          g.globalAlpha = 1;
          if (h > H * 0.4) {
            g.fillStyle = css(palette.signal);
            g.fillRect(at + w / 2 - 1.5, H - h - 3, 3, 3);
          }
        }
        x += w + (cluster > 0.1 ? rand() * 4 : 10 + rand() * 40);
      }
    }
  }, { wrap: true });
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
};
