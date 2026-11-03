// World measurements and shared lists for every builder. Grid numbers mirror sim/rules.py; all sizes in metres.
import { palette } from './palette.js';

export const TILE = 14; // metres per tile; buildings fill 12 m of it
export const STREET = 17; // street width between sectors
export const BLOCK = 8; // tiles per sector side (sim/rules.py BLOCK)
export const F = 3.5; // floor height
export const TALL = 20; // floors; towers this tall get a crown (sim/rules.py TALL)

export const WORDS = ['ODEN 24', 'NOVA', 'VX9', 'KORU', 'SEIRA', 'ZENKO', 'NEXA', 'TOKU']; // invented sign text
export const WARM = [palette.neonRed, palette.neonPink, palette.sodium, palette.neonOrange];
export const AD_COLORS = [[palette.neonPink, palette.neonViolet], [palette.neonOrange, palette.neonRed],
  [palette.neonCyan, palette.neonViolet], [palette.sodium, palette.neonPink]];
export const CAR_COLORS = [palette.charcoal, palette.slate, palette.sodium, palette.gunmetal, palette.cream];

export const pick = (rand, list) => list[Math.floor(rand() * list.length)];
