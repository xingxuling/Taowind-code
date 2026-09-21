import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {WorkspaceService} from '../core/workspace.mjs';

test('strict UTF-8 reads preserve an explicit UTF-8 BOM byte-for-text mapping',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'twc-bom-'));
  try{
    fs.writeFileSync(path.join(root,'bom.js'),Buffer.from([0xef,0xbb,0xbf,0x61]));
    const ws=new WorkspaceService(root);
    assert.equal(ws.read('bom.js').codePointAt(0),0xfeff);
    const bundle=ws.contextBundle(['bom.js']);
    assert.equal(bundle.files[0].content.codePointAt(0),0xfeff);
    assert.equal(bundle.totalBytes,4);
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
