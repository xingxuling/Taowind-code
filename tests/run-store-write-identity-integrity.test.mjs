import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {RunStore} from '../core/run-store.mjs';

function withStore(fn){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'twc-run-write-id-'));try{return fn(new RunStore(dir),dir)}finally{fs.rmSync(dir,{recursive:true,force:true})}}

test('update cannot rewrite durable run id',()=>withStore((store)=>{
  const run=store.create({goal:'x'});
  assert.throws(()=>store.update(run.id,{id:'run-forged'}),error=>error instanceof Error&&error.message==='RUN_ID_IMMUTABLE');
  assert.equal(store.get(run.id).id,run.id);
}));

test('update cannot rewrite durable run protocol',()=>withStore((store)=>{
  const run=store.create({goal:'x'});
  assert.throws(()=>store.update(run.id,{protocol:'taowind-code.north-star-run.v9'}),error=>error instanceof Error&&error.message==='RUN_PROTOCOL_IMMUTABLE');
  assert.equal(store.get(run.id).protocol,'taowind-code.north-star-run.v0.2');
}));
