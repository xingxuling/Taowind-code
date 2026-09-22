import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {TaskStore} from '../core/tasks.mjs';

function withStore(fn){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'twc-task-write-'));try{return fn(new TaskStore(dir),dir)}finally{fs.rmSync(dir,{recursive:true,force:true})}}

test('replace rejects non-array task roots before corrupting durable state',()=>withStore((store)=>{
  const before=fs.readFileSync(store.file,'utf8');
  assert.throws(()=>store.replace({tasks:[]}),error=>error instanceof Error&&error.message==='TASKS_REQUIRED_ARRAY');
  assert.equal(fs.readFileSync(store.file,'utf8'),before);
  assert.deepEqual(store.list(),[]);
}));

test('array replacement remains supported',()=>withStore((store)=>{
  const tasks=[{id:'task-1',runId:'run-1',phase:'observe',title:'x',status:'running',progress:0.1,detail:'',mode:'NORTH_STAR'}];
  assert.deepEqual(store.replace(tasks),tasks);
  assert.deepEqual(store.list(),tasks);
}));
