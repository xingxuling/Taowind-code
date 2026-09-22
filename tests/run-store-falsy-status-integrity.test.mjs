import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {RunStore} from '../core/run-store.mjs';

function withStore(fn){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'twc-run-status-'));try{return fn(new RunStore(dir))}finally{fs.rmSync(dir,{recursive:true,force:true})}}

test('update rejects falsy statuses outside the v0.2 enum',()=>withStore(store=>{
  for(const status of ['',null,0,false]){
    const run=store.create({goal:'x'});
    assert.throws(()=>store.update(run.id,{status}),error=>error instanceof Error&&error.message==='INVALID_RUN_STATUS');
    assert.equal(store.get(run.id).status,'OBSERVING');
  }
}));

test('declared status updates remain supported',()=>withStore(store=>{
  const run=store.create({goal:'x'});
  const updated=store.update(run.id,{status:'PLANNED'});
  assert.equal(updated.status,'PLANNED');
  assert.equal(store.get(run.id).status,'PLANNED');
}));
