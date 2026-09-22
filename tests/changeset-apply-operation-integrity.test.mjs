import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ChangesetStore} from '../core/changesets.mjs';

function withStore(fn){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'taowind-apply-op-'));
  const runtime=path.join(root,'runtime');
  const workspace=path.join(root,'workspace');
  const store=new ChangesetStore(runtime,workspace);
  try{return fn(store,workspace)}finally{fs.rmSync(root,{recursive:true,force:true})}
}

test('apply rejects a persisted unsupported operation before workspace mutation',()=>withStore((store,workspace)=>{
  fs.mkdirSync(path.join(workspace,'src'),{recursive:true});
  fs.writeFileSync(path.join(workspace,'src','value.mjs'),'one\n');
  const staged=store.stage('run-op',[{op:'write',path:'src/value.mjs',content:'two\n'}]);
  const doc=store.get(staged.id);
  doc.changes[0].op='copy';
  fs.writeFileSync(store.file(staged.id),JSON.stringify(doc,null,2));
  assert.throws(()=>store.apply(staged.id),error=>error instanceof Error&&error.message==='UNSUPPORTED_CHANGE_OPERATION');
  assert.equal(fs.readFileSync(path.join(workspace,'src','value.mjs'),'utf8'),'one\n');
}));

test('supported persisted write still applies and rolls back',()=>withStore((store,workspace)=>{
  fs.mkdirSync(path.join(workspace,'src'),{recursive:true});
  fs.writeFileSync(path.join(workspace,'src','value.mjs'),'one\n');
  const staged=store.stage('run-op-ok',[{op:'write',path:'src/value.mjs',content:'two\n'}]);
  store.apply(staged.id);
  store.rollback(staged.id);
  assert.equal(fs.readFileSync(path.join(workspace,'src','value.mjs'),'utf8'),'one\n');
}));
