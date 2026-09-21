import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {WorkspaceService} from '../core/workspace.mjs';

test('context bundle rejects invalid UTF-8 text instead of synthesizing replacement characters',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'twc-invalid-utf8-'));
  try{
    fs.writeFileSync(path.join(root,'broken.js'),Buffer.from([0x65,0x78,0x70,0x6f,0x72,0x74,0x20,0xff,0xfe]));
    const bundle=new WorkspaceService(root).contextBundle(['broken.js']);
    assert.equal(bundle.files.length,0);
    assert.equal(bundle.totalBytes,0);
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
