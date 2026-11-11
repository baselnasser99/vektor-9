// Lets Node resolve the browser's bare 'three' imports (web/index.html's import map) to the vendored copy.
import { register } from 'node:module';

const vendor = new URL('../../web/vendor/three/', import.meta.url).href;
register(
  'data:text/javascript,' +
    encodeURIComponent(`
  const vendor = ${JSON.stringify(vendor)};
  export async function resolve(spec, ctx, next) {
    if (spec === 'three') return { url: vendor + 'three.module.js', shortCircuit: true };
    if (spec.startsWith('three/addons/')) return { url: vendor + 'addons/' + spec.slice(13), shortCircuit: true };
    return next(spec, ctx);
  }`),
);
