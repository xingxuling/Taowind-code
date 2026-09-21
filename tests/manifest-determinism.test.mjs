import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {WorkspaceService} from '../core/workspace.mjs';

test('bounded manifest is stable across filesystem directory enumeration order',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'taowind-manifest-order-'));
  try{
    for(const name of ['a.js','b.js','c.js'])fs.writeFileSync(path.join(root,name),name);
    const ws=new WorkspaceService(root);
    const forward=ws.manifest({maxFiles:2}).map(x=>x.path);
    const original=fs.readdirSync;
    try{
      fs.readdirSync=function(dir,options){
        const rows=original.call(fs,dir,options);
        return path.resolve(String(dir))===path.resolve(root)?[...rows].reverse():rows;
      };
      const reversed=ws.manifest({maxFiles:2}).map(x=>x.path);
      assert.deepEqual(reversed,forward);
    }finally{fs.readdirSync=original;}
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
