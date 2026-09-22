import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {WorkspaceService} from '../core/workspace.mjs';

test('workspace observation excludes case variants of control-plane directories',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'twc-workspace-control-'));
  try{
    for(const [rel,content] of [
      ['src/main.js','export const ok=1;'],
      ['.GIT/config','[core]\nrepositoryformatversion = 0\n'],
      ['NoDe_MoDuLeS/pkg/index.js','module.exports=1;'],
      ['DIST/out.js','compiled();'],
    ]){
      const file=path.join(root,...rel.split('/'));
      fs.mkdirSync(path.dirname(file),{recursive:true});
      fs.writeFileSync(file,content);
    }
    const workspace=new WorkspaceService(root);
    const treeNames=workspace.tree('.',0).map(x=>x.name);
    assert.deepEqual(treeNames,['src']);
    assert.deepEqual(workspace.manifest().map(x=>x.path),['src/main.js']);
    assert.deepEqual(
      workspace.contextBundle(['.GIT/config','NoDe_MoDuLeS/pkg/index.js','DIST/out.js','src/main.js']).files.map(x=>x.path),
      ['src/main.js'],
    );
  }finally{
    fs.rmSync(root,{recursive:true,force:true});
  }
});
