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

test('north-star run schema requires the runtime cycle invariant',()=>{
  assert.ok(schema.required.includes('cycle'));
  assert.equal(schema.properties.cycle.type,'integer');
  assert.equal(schema.properties.cycle.minimum,1);
  assert.match(runtimeSource,/!Number\.isInteger\(run\?\.cycle\)\|\|run\.cycle<1/);
});

test('north-star run schema binds the durable storage id character contract',()=>{
  assert.equal(schema.properties.id.pattern,'^run-[A-Za-z0-9-]+$');
  const contract=new RegExp(schema.properties.id.pattern);
  assert.equal(contract.test('run-abc123'),true);
  assert.equal(contract.test('run-ABC-123'),true);
  assert.equal(contract.test('run-?'),false);
  assert.match(runtimeSource,/\^run-\[A-Za-z0-9-\]\+\$/);
});
