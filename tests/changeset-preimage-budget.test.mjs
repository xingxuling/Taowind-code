import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ChangesetStore} from '../core/changesets.mjs';

test('stage total byte budget includes rollback preimage snapshots',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'twc-preimage-budget-'));
  const runtime=fs.mkdtempSync(path.join(os.tmpdir(),'twc-preimage-runtime-'));
  try{
    const changes=[];
    for(let i=0;i<5;i++){
      const p=`file-${i}.bin`;
      fs.writeFileSync(path.join(root,p),Buffer.alloc(1_800_000,i));
      changes.push({op:'delete',path:p});
    }
    const store=new ChangesetStore(runtime,root);
    assert.throws(()=>store.stage('run-preimage-budget',changes),/CHANGESET_TOO_LARGE/);
    assert.deepEqual(fs.readdirSync(path.join(runtime,'changesets')),[]);
  }finally{
    fs.rmSync(root,{recursive:true,force:true});
    fs.rmSync(runtime,{recursive:true,force:true});
  }
});
