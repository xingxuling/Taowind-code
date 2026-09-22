import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {RunStore} from '../core/run-store.mjs';

function withStore(fn){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'twc-run-enum-'));try{return fn(new RunStore(dir))}finally{fs.rmSync(dir,{recursive:true,force:true})}}
function rewrite(store,id,mutate){const file=store.file(id);const doc=JSON.parse(fs.readFileSync(file,'utf8'));mutate(doc);fs.writeFileSync(file,JSON.stringify(doc,null,2));}

test('get rejects a persisted mode outside the v0.2 contract',()=>withStore(store=>{
  const run=store.create({goal:'x'});
  rewrite(store,run.id,doc=>doc.mode='MAGIC_MODE');
  assert.throws(()=>store.get(run.id),error=>error instanceof Error&&error.message==='INVALID_RUN_MODE');
}));

test('get rejects a persisted status outside the v0.2 contract',()=>withStore(store=>{
  const run=store.create({goal:'x'});
  rewrite(store,run.id,doc=>doc.status='MAGIC_STATUS');
  assert.throws(()=>store.get(run.id),error=>error instanceof Error&&error.message==='INVALID_RUN_STATUS');
}));

test('declared mode and status remain readable',()=>withStore(store=>{
  const run=store.create({goal:'x',mode:'NORTH_STAR'});
  store.update(run.id,{status:'PLANNED'});
  const got=store.get(run.id);
  assert.equal(got.mode,'NORTH_STAR');
  assert.equal(got.status,'PLANNED');
}));
