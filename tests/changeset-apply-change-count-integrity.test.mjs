import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ChangesetStore} from '../core/changesets.mjs';

function withStore(fn){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'taowind-apply-count-'));
  const runtime=path.join(root,'runtime');
  const workspace=path.join(root,'workspace');
  const store=new ChangesetStore(runtime,workspace);
  try{return fn(store,workspace)}finally{fs.rmSync(root,{recursive:true,force:true})}
}

test('apply rejects a persisted empty change list instead of reporting a no-op as applied',()=>withStore((store,workspace)=>{
  const staged=store.stage('run-empty',[{op:'write',path:'src/value.mjs',content:'x\n'}]);
  const doc=store.get(staged.id);
  doc.changes=[];
  fs.writeFileSync(store.file(staged.id),JSON.stringify(doc,null,2));
  assert.throws(()=>store.apply(staged.id),error=>error instanceof Error&&error.message==='CHANGES_REQUIRED');
  assert.equal(fs.existsSync(path.join(workspace,'src','value.mjs')),false);
}));

test('apply rejects a persisted change list above the stage-time file budget before any writes',()=>withStore((store,workspace)=>{
  const staged=store.stage('run-many',[{op:'write',path:'src/0.mjs',content:'x\n'}]);
  const doc=store.get(staged.id);
  const template=doc.changes[0];
  doc.changes=Array.from({length:129},(_,i)=>({...structuredClone(template),path:`src/${i}.mjs`}));
  fs.writeFileSync(store.file(staged.id),JSON.stringify(doc,null,2));
  assert.throws(()=>store.apply(staged.id),error=>error instanceof Error&&error.message==='TOO_MANY_CHANGES');
  assert.equal(fs.existsSync(path.join(workspace,'src','0.mjs')),false);
  assert.equal(fs.existsSync(path.join(workspace,'src','128.mjs')),false);
}));
