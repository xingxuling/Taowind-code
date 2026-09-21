import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {WorkspaceService} from '../core/workspace.mjs';

test('context bundle blocks benign hard-link aliases of credential-like files',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'twc-context-hardlink-secret-'));
  try{
    fs.mkdirSync(path.join(root,'src'),{recursive:true});
    fs.writeFileSync(path.join(root,'.env'),'API_KEY=synthetic-secret\n');
    try{fs.linkSync(path.join(root,'.env'),path.join(root,'src','config.txt'));}catch(error){t.skip(`hard links unavailable: ${error.code||error.message}`);return;}
    const secret=fs.lstatSync(path.join(root,'.env'));
    const alias=fs.lstatSync(path.join(root,'src','config.txt'));
    if(!secret.ino||!alias.ino||secret.dev!==alias.dev||secret.ino!==alias.ino){t.skip('stable file identity unavailable on this host');return;}
    const bundle=new WorkspaceService(root).contextBundle(['src/config.txt']);
    assert.deepEqual(bundle.files,[]);
    assert.equal(bundle.totalBytes,0);
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
