// World measurements and shared lists for every builder. Grid numbers mirror sim/rules.py; all sizes in metres.
import { palette } from './palette.js';

export const TILE = 14; // metres per tile; buildings take up to 12.5 m of it
export const BLOCK = 8; // tiles per sector side (sim/rules.py BLOCK)
// Street kinds between sectors, a hierarchy (STYLE_GUIDE Street level): total width w (fixed: it places every
// tile, so it never changes), sidewalk `side` each side (inside w), traffic lane centres from the centre line (each
// way), `edge` where the traffic lanes end (local streets keep parking and loading bays between it and the kerb),
// median width, and cars per lane (streets.js CORNER rounds every block corner alike). 3.3 to 3.5 m lanes, like real city streets.
export const STREETS = {
  boulevard: { w: 34, side: 5, lanes: [3.67, 7, 10.33], edge: 12, median: 4, cars: 9 }, // type C: three lanes each way
  street: { w: 24, side: 5, lanes: [2.125, 5.375], edge: 7, median: 0, cars: 6 }, // type B, main: two each way
  local: { w: 24, side: 6, lanes: [1.75], edge: 3.5, median: 0, cars: 3 }, // type A: one each way, bays both sides
  lane: { w: 16, side: 4, lanes: [1.75], edge: 3.5, median: 0, cars: 2 }, // type A, narrow: one each way
  walk: { w: 16, side: 4, lanes: [], edge: 0, median: 0, cars: 0 }, // pedestrian street: paved, planted, no cars
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
// Street food on the pedestrian walks (streets.js food): stall names and cafe names, all invented.
export const FOOD = { noodle: ['NEO RAMEN', 'ODEN 24', 'KORU DUMPLING', 'NOODLE 9'], cart: ['HOT BUNS', 'ODEN 24', 'NOODLE 9'],
  grill: ['VAT BBQ', 'SOY GRILL', 'SKEWER 7'], drinks: ['ALGAE TEA', 'ICE KOFI', 'NEON SODA', 'SYNTH JUICE'] };
export const CAFES = ['NIGHT KISSA', 'STATIC TEA', 'KOFI 9', 'BLACK SALT', 'CAFE NULL', 'LOW ORBIT'];
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
