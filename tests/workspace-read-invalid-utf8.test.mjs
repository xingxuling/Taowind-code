import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {WorkspaceService} from '../core/workspace.mjs';

test('workspace text read fails closed on invalid UTF-8',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'twc-read-invalid-utf8-'));
  try{
    fs.writeFileSync(path.join(root,'broken.js'),Buffer.from([0x61,0xff,0x62]));
    assert.throws(()=>new WorkspaceService(root).read('broken.js'),/FILE_NOT_READABLE/);
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
