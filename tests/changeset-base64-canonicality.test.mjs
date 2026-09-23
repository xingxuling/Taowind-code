import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ChangesetStore} from '../core/changesets.mjs';

function withStore(fn){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'taowind-base64-canonicality-'));
  const runtime=path.join(root,'runtime');
  const workspace=path.join(root,'workspace');
  const store=new ChangesetStore(runtime,workspace);
  try{return fn(store,workspace)}finally{fs.rmSync(root,{recursive:true,force:true})}
}

test('apply rejects a noncanonical persisted postimage base64 representation',()=>withStore((store,workspace)=>{
  const staged=store.stage('run-postimage-base64',[{op:'write',path:'src/value.txt',content:'f'}]);
  const doc=store.get(staged.id);
  assert.equal(doc.changes[0].after.contentBase64,'Zg==');
  doc.changes[0].after.contentBase64='Zg';
  fs.writeFileSync(store.file(staged.id),JSON.stringify(doc,null,2));
  assert.throws(()=>store.apply(staged.id),error=>error instanceof Error&&error.message==='CHANGESET_POSTIMAGE_CORRUPT:src/value.txt');
  assert.equal(fs.existsSync(path.join(workspace,'src','value.txt')),false);
}));

test('apply rejects a noncanonical persisted preimage base64 representation',()=>withStore((store,workspace)=>{
  fs.mkdirSync(path.join(workspace,'src'),{recursive:true});
  fs.writeFileSync(path.join(workspace,'src','value.txt'),'f');
  const staged=store.stage('run-preimage-base64',[{op:'write',path:'src/value.txt',content:'g'}]);
  const doc=store.get(staged.id);
  assert.equal(doc.changes[0].before.contentBase64,'Zg==');
  doc.changes[0].before.contentBase64='Zg';
  fs.writeFileSync(store.file(staged.id),JSON.stringify(doc,null,2));
  assert.throws(()=>store.apply(staged.id),error=>error instanceof Error&&error.message==='CHANGESET_PREIMAGE_CORRUPT:src/value.txt');
  assert.equal(fs.readFileSync(path.join(workspace,'src','value.txt'),'utf8'),'f');
}));

test('canonical staged base64 still applies normally',()=>withStore((store,workspace)=>{
  const staged=store.stage('run-canonical-base64',[{op:'write',path:'src/value.txt',content:'f'}]);
  const applied=store.apply(staged.id);
  assert.equal(applied.status,'APPLIED');
  assert.equal(fs.readFileSync(path.join(workspace,'src','value.txt'),'utf8'),'f');
}));
