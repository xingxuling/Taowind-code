import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {WorkspaceService} from '../core/workspace.mjs';

test('manifest maxFiles remains a hard cap across recursive unwinding',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'twc-manifest-budget-'));
  try{
    let dir=root;
    for(let depth=0;depth<6;depth++){
      const child=path.join(dir,'a');
      fs.mkdirSync(child);
      fs.writeFileSync(path.join(dir,`z${depth}.js`),'x');
      dir=child;
    }
    fs.writeFileSync(path.join(dir,'leaf.js'),'x');
    const manifest=new WorkspaceService(root).manifest({maxFiles:1});
    assert.equal(manifest.length,1);
  }finally{
    fs.rmSync(root,{recursive:true,force:true});
  }
});
