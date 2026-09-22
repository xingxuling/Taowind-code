import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ChangesetStore} from '../core/changesets.mjs';

function withStore(fn){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'taowind-apply-path-'));
  const runtime=path.join(root,'runtime');
  const workspace=path.join(root,'workspace');
  const store=new ChangesetStore(runtime,workspace);
  try{return fn(store,workspace)}finally{fs.rmSync(root,{recursive:true,force:true})}
}

test('apply rejects a persisted non-canonical path before it can redirect a new-file write',()=>withStore((store,workspace)=>{
  const staged=store.stage('run-path',[{op:'write',path:'src/original.mjs',content:'value\n'}]);
  const doc=store.get(staged.id);
  doc.changes[0].path='src/../redirected.mjs';
  fs.writeFileSync(store.file(staged.id),JSON.stringify(doc,null,2));
  assert.throws(()=>store.apply(staged.id),error=>error instanceof Error&&error.message==='INVALID_CHANGE_PATH');
  assert.equal(fs.existsSync(path.join(workspace,'src','original.mjs')),false);
  assert.equal(fs.existsSync(path.join(workspace,'redirected.mjs')),false);
}));

test('a canonical persisted path still applies and rolls back',()=>withStore((store,workspace)=>{
  const staged=store.stage('run-path-ok',[{op:'write',path:'src/value.mjs',content:'value\n'}]);
  store.apply(staged.id);
  assert.equal(fs.readFileSync(path.join(workspace,'src','value.mjs'),'utf8'),'value\n');
  store.rollback(staged.id);
  assert.equal(fs.existsSync(path.join(workspace,'src','value.mjs')),false);
}));
