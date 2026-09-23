import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ChangesetStore} from '../core/changesets.mjs';
import {sha256Text} from '../core/hash.mjs';

function withStore(fn){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'taowind-read-receipt-'));
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

test('get rejects a durable apply receipt with a mismatched receipt hash',()=>withStore((store)=>{
  const staged=store.stage('run-read-apply-receipt-hash',[{op:'write',path:'src/value.txt',content:'x'}]);
  store.apply(staged.id);
  rewrite(store,staged.id,doc=>{doc.applyReceipt.receiptSha256='0'.repeat(64)});
  assert.throws(()=>store.get(staged.id),error=>error instanceof Error&&error.message==='CHANGESET_APPLY_RECEIPT_CORRUPT');
}));

test('get rejects a coherently rehashed apply receipt that no longer binds to changes',()=>withStore((store)=>{
  const staged=store.stage('run-read-apply-receipt-binding',[{op:'write',path:'src/value.txt',content:'x'}]);
  store.apply(staged.id);
  rewrite(store,staged.id,doc=>{
    doc.applyReceipt.files[0].path='src/forged.txt';
    doc.applyReceipt.receiptSha256=sha256Text(JSON.stringify(doc.applyReceipt.files));
  });
  assert.throws(()=>store.get(staged.id),error=>error instanceof Error&&error.message==='CHANGESET_APPLY_RECEIPT_CORRUPT');
}));

test('get rejects a durable rollback receipt with a mismatched receipt hash',()=>withStore((store)=>{
  const staged=store.stage('run-read-rollback-receipt-hash',[{op:'write',path:'src/value.txt',content:'x'}]);
  store.apply(staged.id);
  store.rollback(staged.id);
  rewrite(store,staged.id,doc=>{doc.rollbackReceipt.receiptSha256='0'.repeat(64)});
  assert.throws(()=>store.get(staged.id),error=>error instanceof Error&&error.message==='CHANGESET_ROLLBACK_RECEIPT_CORRUPT');
}));

test('get still returns an intact rolled-back changeset',()=>withStore((store)=>{
  const staged=store.stage('run-read-receipt-intact',[{op:'write',path:'src/value.txt',content:'x'}]);
  store.apply(staged.id);
  store.rollback(staged.id);
  assert.equal(store.get(staged.id).status,'ROLLED_BACK');
}));
