import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {WorkspaceService} from '../core/workspace.mjs';

test('context bundle canonicalizes path aliases before deduplication',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'twc-context-dedup-'));
  try{
    fs.mkdirSync(path.join(root,'src'),{recursive:true});
    fs.writeFileSync(path.join(root,'src','a.js'),'export const a=1;\n');
    const bundle=new WorkspaceService(root).contextBundle(['./src/a.js','src\\a.js','src/a.js']);
    assert.deepEqual(bundle.files.map(x=>x.path),['src/a.js']);
    assert.equal(bundle.totalBytes,18);
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
