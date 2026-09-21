import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {WorkspaceService} from '../core/workspace.mjs';

test('context bundle deduplicates hard-link aliases by file identity when available',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'twc-context-hardlink-'));
  try{
    fs.mkdirSync(path.join(root,'src'),{recursive:true});
    fs.writeFileSync(path.join(root,'src','a.js'),'export const a=1;\n');
    try{fs.linkSync(path.join(root,'src','a.js'),path.join(root,'src','alias.js'));}catch(error){t.skip(`hard links unavailable: ${error.code||error.message}`);return;}
    const source=fs.lstatSync(path.join(root,'src','a.js'));
    const alias=fs.lstatSync(path.join(root,'src','alias.js'));
    if(!source.ino||!alias.ino||source.dev!==alias.dev||source.ino!==alias.ino){t.skip('stable file identity unavailable on this host');return;}
    const bundle=new WorkspaceService(root).contextBundle(['src/a.js','src/alias.js']);
    assert.deepEqual(bundle.files.map(x=>x.path),['src/a.js']);
    assert.equal(bundle.totalBytes,18);
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
