import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ChangesetStore} from '../core/changesets.mjs';

function withStore(fn){const root=fs.mkdtempSync(path.join(os.tmpdir(),'taowind-receipt-state-'));const store=new ChangesetStore(path.join(root,'runtime'),path.join(root,'workspace'));try{return fn(store)}finally{fs.rmSync(root,{recursive:true,force:true})}}
function rewrite(store,id,mutate){const file=store.file(id);const doc=JSON.parse(fs.readFileSync(file,'utf8'));mutate(doc);fs.writeFileSync(file,JSON.stringify(doc,null,2))}

test('get rejects STAGED with a receipt',()=>withStore(store=>{const staged=store.stage('run-staged-receipt',[{op:'write',path:'x.txt',content:'x'}]);rewrite(store,staged.id,doc=>{doc.applyReceipt={at:doc.updatedAt,files:[],receiptSha256:'0'.repeat(64)}});assert.throws(()=>store.get(staged.id),/INVALID_CHANGESET_RECEIPT_STATE/)}));
test('get rejects APPLIED without apply receipt',()=>withStore(store=>{const staged=store.stage('run-applied-no-receipt',[{op:'write',path:'x.txt',content:'x'}]);store.apply(staged.id);rewrite(store,staged.id,doc=>{doc.applyReceipt=null});assert.throws(()=>store.get(staged.id),/INVALID_CHANGESET_RECEIPT_STATE/)}));
test('get rejects APPLIED with rollback receipt',()=>withStore(store=>{const staged=store.stage('run-applied-rollback',[{op:'write',path:'x.txt',content:'x'}]);store.apply(staged.id);rewrite(store,staged.id,doc=>{doc.rollbackReceipt={at:doc.updatedAt,files:[],receiptSha256:'0'.repeat(64)}});assert.throws(()=>store.get(staged.id),/INVALID_CHANGESET_RECEIPT_STATE/)}));
test('get rejects ROLLED_BACK missing either receipt',()=>withStore(store=>{const staged=store.stage('run-rolled-missing',[{op:'write',path:'x.txt',content:'x'}]);store.apply(staged.id);store.rollback(staged.id);rewrite(store,staged.id,doc=>{doc.rollbackReceipt=null});assert.throws(()=>store.get(staged.id),/INVALID_CHANGESET_RECEIPT_STATE/)}));
test('normal STAGED APPLIED ROLLED_BACK lifecycle stays readable',()=>withStore(store=>{const staged=store.stage('run-lifecycle-valid',[{op:'write',path:'x.txt',content:'x'}]);assert.equal(store.get(staged.id).status,'STAGED');store.apply(staged.id);assert.equal(store.get(staged.id).status,'APPLIED');store.rollback(staged.id);assert.equal(store.get(staged.id).status,'ROLLED_BACK')}));
