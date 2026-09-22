import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {WorkspaceService} from '../core/workspace.mjs';

test('workspace tree does not misclassify symlinks as regular files',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'twc-workspace-tree-special-'));
  try{
    fs.mkdirSync(path.join(root,'src'));
    fs.writeFileSync(path.join(root,'plain.txt'),'ok');
    try{fs.symlinkSync('plain.txt',path.join(root,'link.txt'));}catch(error){t.skip(`symlink unavailable: ${error?.code||error}`);return;}
    const workspace=new WorkspaceService(root);
    const tree=workspace.tree('.',0);
    assert.deepEqual(tree.map(item=>({name:item.name,type:item.type})),[
      {name:'src',type:'dir'},
      {name:'plain.txt',type:'file'},
    ]);
    assert.equal(workspace.manifest().some(item=>item.path==='link.txt'),false);
    assert.equal(workspace.contextBundle(['link.txt','plain.txt']).files.some(item=>item.path==='link.txt'),false);
  }finally{
    fs.rmSync(root,{recursive:true,force:true});
  }
});
