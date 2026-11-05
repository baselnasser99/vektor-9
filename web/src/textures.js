// Every texture drawn in code: concrete, windows, signs, ads, light pools, clouds, fades and far skylines.
import * as THREE from 'three';
import { css, palette } from './palette.js';
import { rng } from './geometry.js';

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

// An advertisement for a display w x h pixels (the display's own shape): an invented brand selling one product,
// drawn as a picture (PRODUCTS below) in a soft glow, with the brand, a slogan and a price tag. Tall displays
// stack brand, picture and slogan; squarer ones put the picture beside the words. ink is the main colour (the
// product, the brand), accent the second (glow, details, the tag); a lot of the panel stays dark.
export const posterTexture = (brand, line, product, ink, accent, w, h) => painted(w, h, (g) => {
  const tall = h > w * 1.6, rand = rng([...brand].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) % 9973);
  g.fillStyle = css(palette.graphite);
  g.fillRect(0, 0, w, h);
  // Narrow products (a can, an arm, a cell) fill a tall display's height; wide ones its width.
  const grow = tall && ['drink', 'arm', 'cell'].includes(product) ? 1.7 : 1;
  const [cx, cy, s] = tall ? [w / 2, h * 0.48, w * 0.45 * grow] : [w * 0.5, h * 0.42, Math.min(w, h) * 0.3];
  const glow = g.createRadialGradient(cx, cy, 0, cx, cy, s * 1.9);
  glow.addColorStop(0, rgba(accent, 0.55));
  glow.addColorStop(1, rgba(accent, 0));
  g.fillStyle = glow;
  g.fillRect(0, 0, w, h);
  g.fillStyle = rgba(palette.charcoal, 0.5); // faint scanlines over the whole display
  for (let y = 0; y < h; y += 6) g.fillRect(0, y, w, 2);
  g.save();
  g.translate(cx, cy);
  g.scale(s / 100, s / 100); // products are drawn in a 200 x 200 box round the origin
  PRODUCTS[product](g, ink, accent, rand);
  g.restore();
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = css(ink);
  g.font = `bold ${Math.round(Math.min(w * 0.17, (w * 1.6) / brand.length))}px monospace`;
  g.fillText(brand, w / 2, tall ? h * 0.1 : h * 0.8, w - 24);
  g.font = `bold ${Math.round(w * (tall ? 0.085 : 0.06))}px monospace`;
  g.fillStyle = css(accent);
  g.fillText(line, w / 2, tall ? h * 0.86 : h * 0.91, w - 24);
  const tag = `${2 + Math.floor(rand() * 8)}.99`, tw = w * 0.34, th = w * (tall ? 0.12 : 0.08);
  const [tx, ty] = tall ? [w / 2, h * 0.93] : [w * 0.82, h * 0.14];
  g.fillRect(tx - tw / 2, ty - th / 2, tw, th); // price tag
  g.fillStyle = css(palette.graphite);
  g.font = `bold ${Math.round(th * 0.7)}px monospace`;
  g.fillText(tag, tx, ty + 1, tw - 8);
  g.strokeStyle = css(ink);
  g.lineWidth = 3;
  g.strokeRect(6, 6, w - 12, h - 12);
});

const rgba = (c, a) => `rgba(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255},${a})`;
// A vertical gradient from colour c lit (top) to shaded (bottom), for a product's body.
const shade = (g, c, y0, y1, dark = 0.35) => {
  const grad = g.createLinearGradient(-100, y0, 100, y1);
  grad.addColorStop(0, css(c));
  grad.addColorStop(1, rgba(c, dark));
  return grad;
};
const round = (g, x, y, w, h, r) => {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
};

// Product pictures, each in a 200 x 200 box centred on the origin.
const PRODUCTS = {
  drink(g, ink, accent, rand) { // a cold can with a label band, condensation and bubbles
    round(g, -38, -80, 76, 165, 14);
    g.fillStyle = shade(g, ink, -80, 85);
    g.fill();
    g.fillStyle = css(accent);
    g.fillRect(-38, -30, 76, 46);
    g.fillStyle = css(palette.graphite);
    g.font = 'bold 34px monospace';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('ICE', 0, -6);
    g.fillStyle = rgba(palette.graphite, 0.6);
    g.fillRect(-30, -88, 60, 10); // the lid
    g.fillStyle = rgba(palette.glare, 0.5);
    g.fillRect(-28, -70, 8, 140); // highlight
    for (let k = 0; k < 14; k++) { // drops and bubbles
      g.beginPath();
      g.arc(-90 + rand() * 180, -95 + rand() * 190, 2 + rand() * 4, 0, Math.PI * 2);
      g.fillStyle = rgba(k % 2 ? ink : accent, 0.7);
      g.fill();
    }
  },
  arm(g, ink, accent) { // a cybernetic arm, elbow to fingertips, with pistons and lit joints
    g.lineCap = 'round';
    g.fillStyle = shade(g, ink, -90, 90);
    round(g, -30, 30, 44, 70, 10); // upper arm, from below
    g.fill();
    g.beginPath();
    g.moveTo(-26, 30);
    g.lineTo(-14, -40);
    g.lineTo(18, -44);
    g.lineTo(14, 30);
    g.closePath();
    g.fill(); // forearm
    g.strokeStyle = css(accent);
    g.lineWidth = 5;
    for (const x of [-12, 4]) { g.beginPath(); g.moveTo(x, 22); g.lineTo(x + 3, -32); g.stroke(); } // pistons
    for (const [x, y, r] of [[-8, 30, 14], [2, -44, 11]]) { // elbow and wrist joints
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fillStyle = css(accent);
      g.fill();
      g.beginPath();
      g.arc(x, y, r * 0.45, 0, Math.PI * 2);
      g.fillStyle = css(palette.graphite);
      g.fill();
    }
    g.fillStyle = shade(g, ink, -95, -50);
    round(g, -14, -76, 32, 28, 6); // palm
    g.fill();
    g.strokeStyle = css(ink);
    g.lineWidth = 7;
    for (let k = 0; k < 4; k++) { // fingers, two segments each
      const x = -10 + k * 8;
      g.beginPath(); g.moveTo(x, -76); g.lineTo(x - 1, -92); g.lineTo(x + 1, -100); g.stroke();
    }
    g.beginPath(); g.moveTo(-14, -60); g.lineTo(-28, -72); g.lineTo(-30, -84); g.stroke(); // thumb
  },
  eye(g, ink, accent) { // an ocular implant: the eye, a lit iris ring, targeting ticks
    g.beginPath();
    g.moveTo(-95, 0);
    g.quadraticCurveTo(0, -75, 95, 0);
    g.quadraticCurveTo(0, 75, -95, 0);
    g.fillStyle = shade(g, ink, -60, 60, 0.6);
    g.fill();
    g.beginPath();
    g.arc(0, 0, 38, 0, Math.PI * 2);
    g.fillStyle = css(accent);
    g.fill();
    g.beginPath();
    g.arc(0, 0, 16, 0, Math.PI * 2);
    g.fillStyle = css(palette.graphite);
    g.fill();
    g.strokeStyle = css(ink);
    g.lineWidth = 3;
    g.beginPath();
    g.arc(0, 0, 58, 0, Math.PI * 2);
    g.stroke();
    for (let k = 0; k < 12; k++) { // ticks round the ring
      const a = (k / 12) * Math.PI * 2;
      g.beginPath();
      g.moveTo(Math.cos(a) * 62, Math.sin(a) * 62);
      g.lineTo(Math.cos(a) * 74, Math.sin(a) * 74);
      g.stroke();
    }
    g.beginPath(); g.arc(10, -10, 6, 0, Math.PI * 2); g.fillStyle = css(palette.glare); g.fill(); // glint
  },
  noodles(g, ink, accent) { // a steaming bowl of noodles with chopsticks
    g.strokeStyle = css(ink);
    g.lineWidth = 4;
    g.lineCap = 'round';
    for (const x of [-35, 0, 35]) { // steam
      g.beginPath();
      g.moveTo(x, -10);
      g.bezierCurveTo(x - 18, -40, x + 18, -60, x, -95);
      g.stroke();
    }
    g.beginPath();
    g.ellipse(0, 10, 90, 18, 0, 0, Math.PI * 2);
    g.fillStyle = css(accent);
    g.fill(); // the broth
    g.strokeStyle = css(palette.glare);
    g.lineWidth = 3;
    for (let k = 0; k < 5; k++) { // noodles
      g.beginPath();
      g.moveTo(-70 + k * 10, 12);
      g.bezierCurveTo(-30, 0 + k * 3, 20, 24 - k * 3, 70 - k * 10, 10);
      g.stroke();
    }
    g.beginPath();
    g.moveTo(-90, 10);
    g.bezierCurveTo(-85, 90, 85, 90, 90, 10);
    g.closePath();
    g.fillStyle = shade(g, ink, 10, 90);
    g.fill(); // the bowl
    g.fillStyle = css(accent);
    g.fillRect(-60, 40, 120, 8); // its band
    g.strokeStyle = css(ink);
    g.lineWidth = 6;
    for (const d of [0, 12]) { g.beginPath(); g.moveTo(20 + d, -90); g.lineTo(80 + d, 5); g.stroke(); } // chopsticks
  },
  drone(g, ink, accent) { // a delivery drone carrying a parcel
    g.strokeStyle = css(ink);
    g.lineWidth = 7;
    for (const [x, y] of [[-70, -60], [70, -60], [-70, 0], [70, 0]]) { // arms
      g.beginPath(); g.moveTo(0, -30); g.lineTo(x, y); g.stroke();
      g.beginPath();
      g.ellipse(x, y - 6, 34, 7, 0, 0, Math.PI * 2);
      g.fillStyle = rgba(accent, 0.75);
      g.fill(); // rotor blur
    }
    round(g, -32, -50, 64, 38, 10);
    g.fillStyle = shade(g, ink, -50, -12);
    g.fill(); // body
    g.fillStyle = css(accent);
    g.fillRect(-20, -38, 40, 6); // its light
    g.strokeStyle = css(ink);
    g.lineWidth = 3;
    for (const x of [-18, 18]) { g.beginPath(); g.moveTo(x, -12); g.lineTo(x * 1.6, 30); g.stroke(); } // cables
    g.fillStyle = shade(g, ink, 30, 95, 0.5);
    g.fillRect(-38, 30, 76, 62); // the parcel
    g.fillStyle = css(accent);
    g.fillRect(-4, 30, 8, 62);
    g.fillRect(-38, 56, 76, 8);
  },
  cell(g, ink, accent) { // a power cell, charged, with a bolt
    round(g, -42, -70, 84, 160, 12);
    g.fillStyle = shade(g, ink, -70, 90);
    g.fill();
    g.fillStyle = css(ink);
    g.fillRect(-18, -84, 36, 14); // terminal
    for (let k = 0; k < 4; k++) { // charge bars
      g.fillStyle = k < 3 ? css(accent) : rgba(accent, 0.25);
      g.fillRect(-30, 60 - k * 32, 60, 22);
    }
    g.beginPath(); // the bolt, over the bars
    g.moveTo(8, -60); g.lineTo(-22, 8); g.lineTo(-2, 8); g.lineTo(-12, 70); g.lineTo(24, -6); g.lineTo(4, -6);
    g.closePath();
    g.fillStyle = css(palette.glare);
    g.fill();
  },
};

// An electronic traffic sign's message, w x h pixels: up to two short lines in amber on black, broken into
// LED dots by a dark grid, the way a dot-matrix panel reads.
export const messageTexture = (lines, w = 272, h = 160) => painted(w, h, (g) => {
  g.fillStyle = '#000';
  g.fillRect(0, 0, w, h);
  g.fillStyle = css(palette.agedAmber);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `bold ${Math.round(h * (lines.length > 1 ? 0.36 : 0.5))}px monospace`;
  lines.forEach((text, k) => g.fillText(text, w / 2, (h * (k + 0.5)) / lines.length + 4, w - 16));
  g.fillStyle = '#000';
  for (let x = 0; x < w; x += 6) g.fillRect(x, 0, 2, h);
  for (let y = 0; y < h; y += 6) g.fillRect(0, y, w, 2);
});

// A corporation's mark, drawn in a 200 x 200 box round the origin in the current fill and stroke.
const MARKS = {
  hex: (g) => {
    g.lineWidth = 22;
    g.beginPath();
    for (let k = 0; k < 6; k++) g.lineTo(90 * Math.cos((k * Math.PI) / 3 + Math.PI / 6), 90 * Math.sin((k * Math.PI) / 3 + Math.PI / 6));
    g.closePath();
    g.stroke();
    g.fillRect(-14, -50, 28, 100);
  },
  bars: (g) => { for (let k = 0; k < 4; k++) g.fillRect(-90 + k * 48, 60 - k * 40, 34, 30 + k * 40); },
  ring: (g) => {
    g.lineWidth = 26;
    g.beginPath();
    g.arc(0, 0, 76, 0.5, Math.PI * 2 - 0.5);
    g.stroke();
    g.fillRect(30, -13, 70, 26);
  },
  eye: (g) => {
    g.lineWidth = 18;
    g.beginPath();
    g.moveTo(-95, 0); g.quadraticCurveTo(0, -85, 95, 0); g.quadraticCurveTo(0, 85, -95, 0);
    g.stroke();
    g.beginPath();
    g.arc(0, 0, 30, 0, Math.PI * 2);
    g.fill();
  },
  tri: (g) => {
    g.lineWidth = 20;
    g.beginPath();
    g.moveTo(0, -90); g.lineTo(90, 70); g.lineTo(-90, 70); g.closePath();
    g.stroke();
    g.fillRect(-10, -20, 20, 60);
  },
  grid: (g) => {
    for (let x = 0; x < 3; x++) for (let y = 0; y < 3; y++) if ((x + y) % 2 === 0 || (x === 1 && y === 1)) g.fillRect(-90 + x * 62, -90 + y * 62, 54, 54);
  },
  wave: (g) => {
    g.lineWidth = 16;
    for (const dy of [-45, 0, 45]) {
      g.beginPath();
      for (let x = -95; x <= 95; x += 5) g.lineTo(x, dy + 22 * Math.sin(x / 19));
      g.stroke();
    }
  },
  chevron: (g) => {
    for (const y of [-55, 15]) {
      g.beginPath();
      g.moveTo(-95, y); g.lineTo(0, y + 50); g.lineTo(95, y); g.lineTo(95, y + 32); g.lineTo(0, y + 82); g.lineTo(-95, y + 32);
      g.fill();
    }
  },
};

// A large corporate sign's face (or an ad in the same style): weathered dark panels, a mark (deep red unless
// markColor says otherwise) and the name and its line in ink (cold white unless given). Tall (a pylon or a blade):
// the mark on top and the name stacked below; wide: mark left, name right.
export const corpTexture = (name, line, mark, w, h, ink = palette.windowWhite, markColor = palette.crimson) => painted(w, h, (g) => {
  const tall = h > w * 1.6, rand = rng([...name].reduce((a, c) => a * 31 + c.charCodeAt(0), 11) % 9973);
  g.fillStyle = css(palette.graphite);
  g.fillRect(0, 0, w, h);
  const seams = tall ? [w, h / 6] : [w / 6, h]; // panel seams and grime: a weathered electronic panel
  g.fillStyle = rgba(palette.charcoal, 0.9);
  for (let x = seams[0]; x < w; x += seams[0]) g.fillRect(x - 1, 0, 3, h);
  for (let y = seams[1]; y < h; y += seams[1]) g.fillRect(0, y - 1, w, 3);
  for (let k = 0; k < 40; k++) {
    g.fillStyle = rgba(palette.deepNavy, 0.25 + rand() * 0.35);
    g.fillRect(rand() * w, rand() * h, 3 + rand() * 6, 10 + rand() * h * 0.15); // rain streaks
  }
  g.fillStyle = rgba(palette.charcoal, 0.45); // faint scanlines
  for (let y = 0; y < h; y += 5) g.fillRect(0, y, w, 1);
  const s = tall ? w * 0.36 : h * 0.34, [mx, my] = tall ? [w / 2, w * 0.5] : [h * 0.55, h / 2];
  g.save();
  g.translate(mx, my);
  g.scale(s / 100, s / 100);
  g.fillStyle = g.strokeStyle = css(markColor);
  MARKS[mark](g);
  g.restore();
  g.fillStyle = css(ink);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  if (tall && name.length > 9) { // too long to stack: turned on its side
    g.save();
    g.translate(w / 2, w * 1.05 + (h - w * 1.05) / 2);
    g.rotate(-Math.PI / 2);
    const room = h - w * 1.3;
    g.font = `bold ${Math.round(Math.min(w * 0.42, (room * 1.6) / name.length))}px monospace`;
    g.fillText(name, 0, -w * 0.08, room);
    g.font = `bold ${Math.round(w * 0.14)}px monospace`;
    g.fillText(line, 0, w * 0.26, room);
    g.restore();
  } else if (tall) {
    const top = w * 1.05, step = (h - top - w * 0.4) / name.length;
    g.font = `bold ${Math.round(Math.min(w * 0.5, step * 0.8))}px monospace`;
    [...name].forEach((ch, k) => g.fillText(ch, w / 2, top + (k + 0.5) * step));
    g.font = `bold ${Math.round(w * 0.075)}px monospace`;
    g.fillText(line, w / 2, h - w * 0.2, w - 16);
  } else {
    const x0 = h * 1.1, room = w - x0 - h * 0.25;
    g.textAlign = 'left';
    g.font = `bold ${Math.round(Math.min(h * 0.42, (room * 1.6) / name.length))}px monospace`;
    g.fillText(name, x0, h * 0.42, room);
    g.font = `bold ${Math.round(h * 0.13)}px monospace`;
    g.fillText(line, x0 + 4, h * 0.76, room);
  }
  g.fillStyle = css(markColor); // a thin rule framing the panel
  for (const [x, y, rw, rh] of [[0, 0, w, 4], [0, h - 4, w, 4], [0, 0, 4, h], [w - 4, 0, 4, h]]) g.fillRect(x, y, rw, rh);
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
          g.fillStyle = css(color.getHex());
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
