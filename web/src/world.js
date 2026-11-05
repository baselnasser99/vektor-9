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
export const HUB = 2; // tiles each way from the central crossing kept as the tower's plaza (sim/rules.py HUB_PLAZA)
export const F = 3.5; // floor height
export const TALL = 20; // floors; towers this tall get a crown (sim/rules.py TALL)
export const TERRAIN = ['rail', 'park', 'works']; // laid out by the sim, never built on (sim/rules.py TERRAIN)

// Market tiles are cybernetics shops: each gets a name (roof sign) and a short mark (corner sign), all invented.
export const SHOPS = [['KUROTECH', 'KURO'], ['ZENKO TECH', 'ZENKO'], ['NEXA PARTS', 'NEXA'], ['TOKU WORKS', 'TOKU'],
  ['SEIRA CYBER', 'SEIRA'], ['VX9 REPAIR', 'VX9']];
export const WORDS = ['ODEN 24', 'NOVA', 'VX9', 'KORU', 'SEIRA', 'ZENKO', 'NEXA', 'TOKU']; // invented sign text
// Invented corporations on the billboards (city.js billboards): brand, slogan, the product its ad shows
// (textures.js PRODUCTS), and the ad's two colours, off-white or muted amber with an occasional red or cyan.
export const BRANDS = [['HALDEN', 'CYBER ARMS', 'arm', palette.cream, palette.signal],
  ['OKTAV', 'SEE FURTHER', 'eye', palette.cream, palette.coldCyan], ['ZEPHA', 'ICE COLD COLA', 'drink', palette.signal, palette.cream],
  ['MOGU', 'HOT NOODLES 24H', 'noodles', palette.cream, palette.agedAmber],
  ['ORVEX', 'DRONE FREIGHT', 'drone', palette.agedAmber, palette.coldCyan], ['KAZEMURA', 'GRID POWER', 'cell', palette.agedAmber, palette.cream]];
// Invented corporations on the large corporate signs (city.js corpSigns): name, division, its mark (textures.js
// MARKS) and the two lines of its amber info display.
export const CORPS = [['TARKO', 'SECURE NETWORKS', 'hex', ['NETWORK', 'NOMINAL']],
  ['OBELIN', 'GRID AUTHORITY', 'bars', ['GRID LOAD', '91%']], ['VESTRA', 'BIOSYSTEMS', 'ring', ['AIR INDEX', 'POOR']],
  ['MAREK', 'HEAVY INDUSTRY', 'chevron', ['SHIFT 3', 'ON TIME']], ['SOLMEN', 'ORBITAL FREIGHT', 'tri', ['LAUNCH', 'T-04:12']],
  ['IKARO', 'OBSERVATION', 'eye', ['YOU ARE', 'SEEN']], ['HELIX-9', 'GENOME BANK', 'wave', ['DEPOSITS', 'OPEN']],
  ['KAISEN', 'DATA ARBITRAGE', 'grid', ['INDEX', '+0.4%']]];
// Odd ads on the ordinary rooftop billboards and blade signs (tiles.js dress): a product, its slogan, a mark
// (textures.js MARKS), and its ink and mark colours, kept to the city's restrained palette.
export const ADS = [['MEMORY BACKUP', 'NEVER LOSE A DAY AGAIN', 'ring', palette.windowWhite, palette.crimson],
  ['RENT-A-LUNG', 'BREATHE NOW, PAY LATER', 'bars', palette.agedAmber, palette.crimson],
  ['DREAMSAFE', 'INSURED SLEEP 24/7', 'eye', palette.windowWhite, palette.agedAmber],
  ['SYNTH SUN', 'DAYLIGHT BY SUBSCRIPTION', 'ring', palette.agedAmber, palette.agedAmber],
  ['CLONE-LEGAL', 'YOUR SECOND YOU, CERTIFIED', 'tri', palette.windowWhite, palette.crimson],
  ['OXY+', 'AIR, NOW 12% CLEANER', 'wave', palette.coldCyan, palette.windowWhite],
  ['MINDLEASE', 'RENT OUT YOUR SPARE THOUGHTS', 'grid', palette.coldCyan, palette.crimson],
  ['QUIET PILL', 'SILENCE THE CITY', 'hex', palette.windowWhite, palette.crimson]];
// Messages on the electronic traffic signs (city.js streetProps), invented: one or two short lines each.
export const MESSAGES = [['SPEED', '40'], ['DRONE', 'ZONE'], ['KEEP', 'LEFT'], ['TOLL', 'ACTIVE']];
export const WARM = [palette.neonRed, palette.neonPink, palette.sodium, palette.neonOrange];
export const CAR_COLORS = [palette.charcoal, palette.slate, palette.sodium, palette.gunmetal, palette.cream];

export const pick = (rand, list) => list[Math.floor(rand() * list.length)];
