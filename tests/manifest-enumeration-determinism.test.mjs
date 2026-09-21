import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {WorkspaceService} from '../core/workspace.mjs';

test('bounded manifest is stable when filesystem enumeration order changes',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'twc-manifest-order-'));
  const original=fs.readdirSync;
  try{
    for(const name of ['a.js','b.js','c.js'])fs.writeFileSync(path.join(root,name),name);
    const ws=new WorkspaceService(root);
    const normal=ws.manifest({maxFiles:2});
    fs.readdirSync=function(...args){const rows=original.apply(this,args);return Array.isArray(rows)?[...rows].reverse():rows};
    const reversed=ws.manifest({maxFiles:2});
    assert.deepEqual(normal.map(x=>x.path),['a.js','b.js']);
    assert.deepEqual(reversed.map(x=>x.path),normal.map(x=>x.path));
    assert.equal(normal.truncated,true);
    assert.equal(reversed.truncated,true);
  }finally{
    fs.readdirSync=original;
    fs.rmSync(root,{recursive:true,force:true});
  }
});
