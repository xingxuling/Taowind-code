import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ChangesetStore} from '../core/changesets.mjs';

function fixture(){
  const base=fs.mkdtempSync(path.join(os.tmpdir(),'twc-changeset-id-case-'));
  const runtime=path.join(base,'runtime');
  const workspace=path.join(base,'workspace');
  fs.mkdirSync(runtime);fs.mkdirSync(workspace);
  return {base,runtime,workspace};
}

test('changeset storage id follows the published lowercase v0.3 pattern',()=>{
  const f=fixture();
  try{
    const store=new ChangesetStore(f.runtime,f.workspace);
    assert.doesNotThrow(()=>store.file('cs-abc123'));
    for(const id of ['cs-ABC123','CS-abc123']){
      assert.throws(()=>store.file(id),error=>error?.message==='INVALID_CHANGESET_ID');
    }
  }finally{fs.rmSync(f.base,{recursive:true,force:true});}
});
