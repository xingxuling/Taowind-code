import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

function observe(root,lang){
  const moduleHref=new URL('../core/workspace.mjs',import.meta.url).href;
  const script=`import {WorkspaceService} from ${JSON.stringify(moduleHref)}; const ws=new WorkspaceService(${JSON.stringify(root)}); console.log(JSON.stringify({manifest:ws.manifest({maxFiles:1}).map(x=>x.path),tree:ws.tree('.').map(x=>x.path)}));`;
  const child=spawnSync(process.execPath,['--input-type=module','-e',script],{encoding:'utf8',env:{...process.env,LANG:lang,LC_ALL:lang}});
  assert.equal(child.status,0,child.stderr);
  return JSON.parse(child.stdout.trim());
}

test('bounded workspace observation is independent of host locale collation',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'taowind-workspace-locale-'));
  try{
    fs.writeFileSync(path.join(root,'ä.js'),'a');
    fs.writeFileSync(path.join(root,'z.js'),'z');
    const en=observe(root,'en_US.UTF-8');
    const sv=observe(root,'sv_SE.UTF-8');
    assert.deepEqual(sv,en);
    assert.deepEqual(en.manifest,['z.js']);
    assert.deepEqual(en.tree,['z.js','ä.js']);
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
