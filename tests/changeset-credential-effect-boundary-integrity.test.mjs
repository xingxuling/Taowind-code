import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ChangesetStore} from '../core/changesets.mjs';

function fixture(){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'taowind-credential-boundary-'));
  const workspace=path.join(root,'workspace');
  const runtime=path.join(root,'runtime');
  fs.mkdirSync(workspace,{recursive:true});
  return {root,workspace,runtime,store:new ChangesetStore(runtime,workspace)};
}

test('staging refuses credential-like write and delete paths',()=>{
  const fx=fixture();
  try{
    assert.throws(()=>fx.store.stage('run-test',[{op:'write',path:'.env',content:'TOKEN=secret'}]),/CREDENTIAL_CHANGE_PATH/);
    fs.writeFileSync(path.join(fx.workspace,'credentials.json'),'{}');
    assert.throws(()=>fx.store.stage('run-test',[{op:'delete',path:'credentials.json'}]),/CREDENTIAL_CHANGE_PATH/);
  }finally{fs.rmSync(fx.root,{recursive:true,force:true})}
});

test('apply rechecks credential boundary after durable changeset reload',()=>{
  const fx=fixture();
  try{
    const doc=fx.store.stage('run-test',[{op:'write',path:'safe.txt',content:'safe'}]);
    const file=fx.store.file(doc.id);
    const persisted=JSON.parse(fs.readFileSync(file,'utf8'));
    persisted.changes[0].path='.env';
    fs.writeFileSync(file,JSON.stringify(persisted,null,2));
    assert.throws(()=>fx.store.apply(doc.id),/CREDENTIAL_CHANGE_PATH/);
    assert.equal(fs.existsSync(path.join(fx.workspace,'.env')),false);
    assert.equal(fs.existsSync(path.join(fx.workspace,'safe.txt')),false);
  }finally{fs.rmSync(fx.root,{recursive:true,force:true})}
});
