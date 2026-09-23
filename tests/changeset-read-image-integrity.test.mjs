import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ChangesetStore} from '../core/changesets.mjs';

function withStore(fn){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'taowind-read-image-'));
  const runtime=path.join(root,'runtime');
  const workspace=path.join(root,'workspace');
  const store=new ChangesetStore(runtime,workspace);
  try{return fn(store,workspace)}finally{fs.rmSync(root,{recursive:true,force:true})}
}

function rewrite(store,id,mutate){
  const file=store.file(id);
  const doc=JSON.parse(fs.readFileSync(file,'utf8'));
  mutate(doc);
  fs.writeFileSync(file,JSON.stringify(doc,null,2));
}

test('get rejects a durable postimage whose bytes disagree with its recorded hash',()=>withStore((store)=>{
  const staged=store.stage('run-read-postimage',[{op:'write',path:'src/value.txt',content:'f'}]);
  rewrite(store,staged.id,doc=>{doc.changes[0].after.sha256='0'.repeat(64)});
  assert.throws(()=>store.get(staged.id),error=>error instanceof Error&&error.message==='CHANGESET_POSTIMAGE_CORRUPT:src/value.txt');
}));

test('get rejects a durable preimage whose recorded size disagrees with its bytes',()=>withStore((store,workspace)=>{
  fs.mkdirSync(path.join(workspace,'src'),{recursive:true});
  fs.writeFileSync(path.join(workspace,'src','value.txt'),'f');
  const staged=store.stage('run-read-preimage',[{op:'write',path:'src/value.txt',content:'g'}]);
  rewrite(store,staged.id,doc=>{doc.changes[0].before.size=2});
  assert.throws(()=>store.get(staged.id),error=>error instanceof Error&&error.message==='CHANGESET_PREIMAGE_CORRUPT:src/value.txt');
}));

test('get still returns an intact durable changeset',()=>withStore((store)=>{
  const staged=store.stage('run-read-intact',[{op:'write',path:'src/value.txt',content:'f'}]);
  assert.equal(store.get(staged.id).id,staged.id);
}));
