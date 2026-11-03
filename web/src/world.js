// World measurements and shared lists for every builder. Grid numbers mirror sim/rules.py; all sizes in metres.
import { palette } from './palette.js';

export const TILE = 14; // metres per tile; buildings take up to 12.5 m of it
export const BLOCK = 8; // tiles per sector side (sim/rules.py BLOCK)
export const SIDEWALK = 4; // every street has a 4 m sidewalk on each side, included in its width
// Street kinds between sectors: width in metres, traffic lane centres from the centre line (each way), cars per lane.
export const STREETS = {
  boulevard: { w: 34, lanes: [4.9, 8.2, 11.5], cars: 4 }, // 6 m planted median, three lanes each way
  street: { w: 24, lanes: [1.9, 5.7], cars: 3 }, // two lanes each way, double centre line
  lane: { w: 16, lanes: [2.1], cars: 2 }, // one lane each way, dashed centre line
  walk: { w: 16, lanes: [], cars: 0 }, // pedestrian street: paved, planted, no cars
};
export const ALLEY = 5; // service alley through the middle of every sector, after HALF tiles
export const HALF = 4;
export const F = 3.5; // floor height
export const TALL = 20; // floors; towers this tall get a crown (sim/rules.py TALL)
export const TERRAIN = ['rail', 'park', 'works']; // laid out by the sim, never built on (sim/rules.py TERRAIN)

export const WORDS = ['ODEN 24', 'NOVA', 'VX9', 'KORU', 'SEIRA', 'ZENKO', 'NEXA', 'TOKU']; // invented sign text
export const WARM = [palette.neonRed, palette.neonPink, palette.sodium, palette.neonOrange];
export const AD_COLORS = [[palette.neonPink, palette.neonViolet], [palette.neonOrange, palette.neonRed],
  [palette.neonCyan, palette.neonViolet], [palette.sodium, palette.neonPink]];
export const CAR_COLORS = [palette.charcoal, palette.slate, palette.sodium, palette.gunmetal, palette.cream];

export const pick = (rand, list) => list[Math.floor(rand() * list.length)];
