import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {TaskStore} from '../core/tasks.mjs';

test('WAITING_PROVIDER projects the develop task as blocked',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'twc-task-provider-'));
  try{
    const store=new TaskStore(dir);const runId='run-wait-provider';
    store.plan('wait for cognition provider',{mode:'DEEP_DEVELOPMENT',runId});
    const tasks=store.syncRun({id:runId,status:'WAITING_PROVIDER',mode:'DEEP_DEVELOPMENT',blocker:'provider unavailable',message:null});
    const owned=tasks.filter(task=>task.runId===runId);const develop=owned.find(task=>task.phase==='develop');
    assert.equal(owned.some(task=>task.status==='running'),false);
    assert.equal(develop?.status,'blocked');
    assert.equal(develop?.detail,'provider unavailable');
  }finally{
    fs.rmSync(dir,{recursive:true,force:true});
  }
});
