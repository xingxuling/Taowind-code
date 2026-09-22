import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const schema=JSON.parse(fs.readFileSync(path.join(root,'contracts','authority-receipt.schema.json'),'utf8'));
const runtimeSource=fs.readFileSync(path.join(root,'core','rcl-authority.mjs'),'utf8');

test('authority receipt schema requires the runtime request identity',()=>{
  assert.ok(schema.required.includes('requestId'));
  assert.equal(schema.properties.requestId.type,'string');
  assert.match(runtimeSource,/typeof receipt\.requestId!=='string'/);
  assert.match(runtimeSource,/requestId:requestId\|\|id/);
});
