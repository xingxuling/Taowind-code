import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {TaskStore} from '../core/tasks.mjs';

for(const [status,phase,expected] of [['ROLLED_BACK','apply','blocked'],['FAILED','repair','failed']]){
  test(`${status} does not leave an active task running`,()=>{
    const dir=fs.mkdtempSync(path.join(os.tmpdir(),'twc-task-terminal-'));
    try{
      const store=new TaskStore(dir);const runId=`run-${status.toLowerCase()}`;
      store.plan('terminal projection',{mode:'DEEP_DEVELOPMENT',runId});
      const tasks=store.syncRun({id:runId,status,mode:'DEEP_DEVELOPMENT',blocker:'terminal',message:null});
      const owned=tasks.filter(task=>task.runId===runId);const current=owned.find(task=>task.phase===phase);
      assert.equal(owned.some(task=>task.status==='running'),false);
      assert.equal(current?.status,expected);
      if(status==='FAILED')assert.equal(current?.progress,1);
    }finally{
      fs.rmSync(dir,{recursive:true,force:true});
    }
  });
}
