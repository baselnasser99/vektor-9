// The fusion plant, SECTOR 07, used for every plant tile and on the sample page.
import { palette } from './palette.js';

// Modelled in Blender by tools/blender/power_plant.py (its proportions live there) and loaded as a glTF (ADR-0005): an
// aging power-generation block on a 12 m plinth that reads as machinery, not neon. A reactor (blackened concrete drum,
// armoured band with grilled inspection slots, a tall gunmetal shell with coil-block and bolted armour bands, coolant
// pipes), two discharge towers (welded collars, a painted hazard band, sooted heads, platforms, red aviation lamps), a
// windowless control block with a restricted entrance and a small worn sign, transformers, pipework. Light is only
// small dim amber lamps, cold-white indicators and red; almost every surface is unlit, worn metal and concrete. Each
// mesh is named by its material role and gets a palette material here; its "detail" node (slats, bolts, gauges,
// labels) is drawn only near the camera, like every building's (city.js). About 15k triangles, 4k more up close.
export function powerPlant(kit) {
  const worn = (color, roughness) => kit.mat('rusty_painted_metal', color, roughness); // scuffed, rust-streaked paint
  const dark = kit.steel(palette.charcoal, 0.6), red = kit.glow(palette.signal, 4);
  const ice = kit.glow(palette.coldWhite, 0.8), lamp = kit.glow(palette.dirtyAmber, 1.2);
  const g = kit.model('power_plant', {
    soot: kit.concrete(palette.blackenedConcrete), steel: worn(palette.gunmetal, 0.7),
    titanium: worn(palette.weatheredTitanium, 0.6), scorch: worn(palette.scorched, 0.85),
    dark, mech: kit.steel(palette.slate, 0.6), hazard: kit.steel(palette.hazardPaint, 0.7),
    yellow: kit.steel(palette.warningYellow, 0.7), stencil: kit.steel(palette.stencilPaint, 0.8), ice, lamp, red,
  });
  // Detail is merged per sector, so every material in it is a draw call in every sector with a plant: its small metal
  // parts share two common steels, and its few tiny lights move out to the always-drawn part.
  const detail = g.getObjectByName('detail'), metal = kit.steel(palette.gunmetal, 0.6);
  for (const o of [...detail.children]) {
    if ([ice, lamp, red].includes(o.material)) g.add(o);
    else if (o.material !== dark && o.material !== kit.steel(palette.hazardPaint, 0.7)) o.material = metal;
  }
  return g;
}
