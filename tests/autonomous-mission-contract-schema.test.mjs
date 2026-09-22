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

test('autonomous mission schema rejects whitespace-only root goals like the runtime',()=>{
  assert.equal(schema.properties.rootGoal.pattern,'\\S');
  const contract=new RegExp(schema.properties.rootGoal.pattern);
  assert.equal(contract.test('maintain real software'),true);
  assert.equal(contract.test('   '),false);
  assert.match(runtimeSource,/typeof mission\?\.rootGoal!=='string'\|\|!mission\.rootGoal\.trim\(\)/);
});

test('autonomous mission config contract publishes runtime bounds and boolean commit policy',()=>{
  const config=schema.properties.config;
  assert.deepEqual(config.required,['maxCycles','maxRepairs','closureThreshold','autoCommit']);
  assert.deepEqual(config.properties.maxCycles,{type:'number',minimum:1,maximum:64});
  assert.deepEqual(config.properties.maxRepairs,{type:'number',minimum:0,maximum:8});
  assert.deepEqual(config.properties.closureThreshold,{type:'number',minimum:0.5,maximum:1});
  assert.deepEqual(config.properties.autoCommit,{type:'boolean'});
  assert.match(runtimeSource,/function boundedNumber\(value,min,max,fallback\)/);
  assert.match(runtimeSource,/function validMissionConfig\(config\)/);
});

test('autonomous mission currentRunId follows the durable run identity contract',()=>{
  const alternatives=schema.properties.currentRunId.anyOf;
  const runRef=alternatives.find(item=>item.type==='string');
  assert.equal(runRef.pattern,'^run-[A-Za-z0-9-]+$');
  const contract=new RegExp(runRef.pattern);
  assert.equal(contract.test('run-abc123'),true);
  assert.equal(contract.test('run-ABC-123'),true);
  assert.equal(contract.test('RUN-abc123'),false);
  assert.equal(contract.test('not-a-run'),false);
  assert.match(runtimeSource,/function validRunReference\(value\)/);
});
