import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {RunStore} from '../core/run-store.mjs';

function withStore(fn){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'twc-run-mode-'));try{return fn(new RunStore(dir))}finally{fs.rmSync(dir,{recursive:true,force:true})}}

test('create rejects modes outside the checked-in four-mode contract',()=>withStore(store=>{
  assert.throws(()=>store.create({goal:'x',mode:'MAGIC_MODE'}),error=>error instanceof Error&&error.message==='INVALID_RUN_MODE');
}));

test('update rejects modes outside the checked-in four-mode contract',()=>withStore(store=>{
  const run=store.create({goal:'x'});
  assert.throws(()=>store.update(run.id,{mode:'MAGIC_MODE'}),error=>error instanceof Error&&error.message==='INVALID_RUN_MODE');
  assert.equal(store.get(run.id).mode,'WHOLE_ARTIFACT');
}));

test('all four declared modes remain accepted',()=>withStore(store=>{
  for(const mode of ['NORTH_STAR','NORTH_STAR_BURST','WHOLE_ARTIFACT','DEEP_DEVELOPMENT']){
    const run=store.create({goal:mode,mode});
    assert.equal(run.mode,mode);
  }
}));
