import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const schema=JSON.parse(fs.readFileSync(path.join(root,'contracts','autonomous-mission.schema.json'),'utf8'));
const runtimeSource=fs.readFileSync(path.join(root,'core','autonomous-supervisor.mjs'),'utf8');

test('autonomous mission schema binds the runtime protocol',()=>{assert.ok(schema.required.includes('protocol'));assert.equal(schema.properties.protocol?.const,'taowind-code.autonomous-mission.v0.1');assert.match(runtimeSource,/taowind-code\.autonomous-mission\.v0\.1/)});

test('autonomous mission schema binds the durable storage id character contract',()=>{
  assert.equal(schema.properties.id.pattern,'^mission-[A-Za-z0-9-]+$');
  const contract=new RegExp(schema.properties.id.pattern);
  assert.equal(contract.test('mission-abc123'),true);
  assert.equal(contract.test('mission-ABC-123'),true);
  assert.equal(contract.test('mission-?'),false);
  assert.match(runtimeSource,/\^mission-\[A-Za-z0-9-\]\+\$/);
});
