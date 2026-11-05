// Every color in the site. Mirrors the palette table in docs/STYLE_GUIDE.md; change both together.

export const palette = {
  skyTop: 0x439ac2,
  skyMid: 0x72d3ec,
  skyLow: 0xd6eef5,
  glare: 0xf5f6f6,
  haze: 0xd3e8ef,
  glass: 0x67a7c0,
  glassBand: 0x466e85,
  glassHighlight: 0x97ced9,
  deepSteel: 0x3f687e,
  navy: 0x263d4c,
  deepNavy: 0x161c29,
  cream: 0xe8dcd3,
  sand: 0xe4d6c8,
  warmGrey: 0xccc6c2,
  roseGrey: 0xb6a59f,
  road: 0x5e6d79,
  teal: 0x3aa592,
  brick: 0xb0473d,
  salmon: 0xf08c8c,
  salmonAlt: 0xe98a8f,
  amber: 0xf2a43a,
  signal: 0xe2453c,
  lime: 0x9be15d,
  cyan: 0x72d3ec,

  // Neon night theme: night-blue sky and haze, navy structure, warm light first, cyan as accent
  nightZenith: 0x0c1330,
  nightSky: 0x1b2a57,
  nightHorizon: 0x3d528f,
  nightFog: 0x1d2645,
  moon: 0x9fb4ff,
  cloudGlow: 0x7a5a7e,
  nightSand: 0x7d6a78,
  charcoal: 0x1e2333,
  gunmetal: 0x2f3648,
  slate: 0x4b5569,
  weatheredConcrete: 0x7e8992, // the telecom tower's old frame
  neonMagenta: 0xff2fb4,
  neonPink: 0xff5c8a,
  neonOrange: 0xff8a2a,
  neonViolet: 0x9b5cff,
  neonCyan: 0x3ff0ff,
  neonRed: 0xff3b3b,
  sodium: 0xffa733,
  warmWindow: 0xffc46b,
};

// A palette color as a CSS hex string, for canvases and the page.
export const css = (c) => `#${c.toString(16).padStart(6, '0')}`;

export const ui = {
  panel: 0x142130,
  border: 0x466e85,
  text: 0xf5f6f6,
  muted: 0xa9c6d3,
  accent: 0x72d3ec,
  live: 0xf08c8c,
};
