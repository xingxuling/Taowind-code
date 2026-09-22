import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const schema=JSON.parse(fs.readFileSync(path.join(root,'contracts','north-star-run.schema.json'),'utf8'));
const runtimeSource=fs.readFileSync(path.join(root,'core','run-store.mjs'),'utf8');

test('north-star run schema binds the runtime protocol',()=>{
  assert.ok(schema.required.includes('protocol'));
  assert.equal(schema.properties.protocol.const,'taowind-code.north-star-run.v0.2');
  assert.match(runtimeSource,/protocol:'taowind-code\.north-star-run\.v0\.2'/);
});

test('north-star run schema admits all four runtime development modes',()=>{
  assert.deepEqual(new Set(schema.properties.mode.enum),new Set(['NORTH_STAR','NORTH_STAR_BURST','WHOLE_ARTIFACT','DEEP_DEVELOPMENT']));
});
