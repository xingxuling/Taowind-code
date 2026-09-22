import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {TaskStore} from '../core/tasks.mjs';

test('DELIVERED_LOCAL closes every task for the delivered run',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'twc-task-delivery-'));
  try{
    const store=new TaskStore(dir);
    store.plan('ship the validated result',{mode:'DEEP_DEVELOPMENT',runId:'run-delivered'});
    const tasks=store.syncRun({id:'run-delivered',status:'DELIVERED_LOCAL',mode:'DEEP_DEVELOPMENT',blocker:null,message:null});
    const owned=tasks.filter(task=>task.runId==='run-delivered');
    assert.equal(owned.length,7);
    assert.ok(owned.every(task=>task.status==='done'));
    assert.ok(owned.every(task=>task.progress===1));
  }finally{
    fs.rmSync(dir,{recursive:true,force:true});
  }
});
