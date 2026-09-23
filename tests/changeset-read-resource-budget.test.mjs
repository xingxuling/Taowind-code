import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ChangesetStore} from '../core/changesets.mjs';
import {sha256Buffer} from '../core/hash.mjs';

function withStore(fn){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'taowind-read-budget-'));
  const runtime=path.join(root,'runtime');
  const workspace=path.join(root,'workspace');
  const store=new ChangesetStore(runtime,workspace);
  try{return fn(store)}finally{fs.rmSync(root,{recursive:true,force:true})}
}

function rewriteAfterImages(store,id,sizes){
  const file=store.file(id);
  const doc=JSON.parse(fs.readFileSync(file,'utf8'));
  for(let i=0;i<sizes.length;i++){
    const bytes=Buffer.alloc(sizes[i],97+i);
    doc.changes[i].after={sha256:sha256Buffer(bytes),size:bytes.length,contentBase64:bytes.toString('base64')};
  }
  fs.writeFileSync(file,JSON.stringify(doc,null,2));
}

test('get rejects a self-consistent durable postimage above the established per-file budget',()=>withStore((store)=>{
  const staged=store.stage('run-read-file-budget',[{op:'write',path:'src/value.bin',content:'x'}]);
  rewriteAfterImages(store,staged.id,[2_000_001]);
  assert.throws(()=>store.get(staged.id),error=>error instanceof Error&&error.message==='CHANGE_FILE_TOO_LARGE');
}));

test('get rejects self-consistent durable images above the established aggregate budget',()=>withStore((store)=>{
  const changes=Array.from({length:5},(_,i)=>({op:'write',path:`src/value-${i}.bin`,content:'x'}));
  const staged=store.stage('run-read-total-budget',changes);
  rewriteAfterImages(store,staged.id,Array(5).fill(1_700_000));
  assert.throws(()=>store.get(staged.id),error=>error instanceof Error&&error.message==='CHANGESET_TOO_LARGE');
}));

test('get preserves the exact aggregate boundary accepted by the existing transaction budget',()=>withStore((store)=>{
  const changes=Array.from({length:4},(_,i)=>({op:'write',path:`src/boundary-${i}.bin`,content:'x'}));
  const staged=store.stage('run-read-budget-boundary',changes);
  rewriteAfterImages(store,staged.id,Array(4).fill(2_000_000));
  assert.equal(store.get(staged.id).id,staged.id);
}));
