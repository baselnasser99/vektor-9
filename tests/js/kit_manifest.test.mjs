// The detail kit's files (web/assets/models/kit-detail) are exactly the ones its manifest lists, byte for byte, so a
// regeneration in Blender (tools/blender/detail_*.py) has to update manifest.json on purpose, with the Blender
// version that made them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { KIT_DETAIL } from '../../web/src/parts.js';

const dir = join('web', 'assets', 'models', 'kit-detail');
const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json')));
const sha = (f) => createHash('sha256').update(readFileSync(join(dir, f))).digest('hex');

test('every kit-detail file matches its SHA-256 in the manifest, and the manifest lists every file', () => {
  const files = readdirSync(dir).filter((f) => f !== 'manifest.json').sort();
  assert.deepEqual(files, Object.keys(manifest.sha256).sort());
  for (const f of files) assert.equal(sha(f), manifest.sha256[f], `${f} differs from manifest.json: regenerated without updating it?`);
});

test('the manifest names the Blender build and covers every part the renderer loads', () => {
  assert.equal(manifest.blender, '5.2.5 LTS');
  for (const name of KIT_DETAIL) for (const ext of ['gltf', 'bin']) assert.ok(manifest.sha256[`${name.split('/')[1]}.${ext}`], `${name}.${ext}`);
});
