import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {TaskStore} from '../core/tasks.mjs';

function withStore(fn){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'twc-task-store-'));try{return fn(new TaskStore(dir),dir)}finally{fs.rmSync(dir,{recursive:true,force:true})}}

test('malformed durable task JSON fails closed',()=>withStore((store)=>{
  fs.writeFileSync(store.file,'{"broken":');
  assert.throws(()=>store.load(),error=>error instanceof Error&&error.message==='TASK_STORE_CORRUPT');
}));

test('non-array durable task JSON fails closed',()=>withStore((store)=>{
  fs.writeFileSync(store.file,JSON.stringify({tasks:[]}));
  assert.throws(()=>store.list(),error=>error instanceof Error&&error.message==='TASK_STORE_CORRUPT');
}));

test('valid task planning and listing remain usable',()=>withStore((store)=>{
  const tasks=store.plan('ship real code',{mode:'NORTH_STAR_BURST',runId:'run-test'});
  assert.equal(tasks.length,7);
  assert.equal(store.list().length,7);
  assert.equal(store.list()[1].mode,'NORTH_STAR_BURST');
}));
