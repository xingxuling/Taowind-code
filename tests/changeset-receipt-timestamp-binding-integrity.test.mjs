import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ChangesetStore} from '../core/changesets.mjs';

function withStore(fn){const root=fs.mkdtempSync(path.join(os.tmpdir(),'taowind-changeset-receipt-time-'));const store=new ChangesetStore(path.join(root,'runtime'),path.join(root,'workspace'));try{return fn(store)}finally{fs.rmSync(root,{recursive:true,force:true})}}
function rewrite(store,id,mutate){const file=store.file(id);const doc=JSON.parse(fs.readFileSync(file,'utf8'));mutate(doc);fs.writeFileSync(file,JSON.stringify(doc,null,2))}
function shifted(value){return new Date(Date.parse(value)+1000).toISOString()}

test('get rejects an applied changeset whose apply receipt timestamp no longer matches updatedAt',()=>withStore(store=>{const staged=store.stage('run-receipt-time-apply',[{op:'write',path:'a.txt',content:'a'}]);store.apply(staged.id);rewrite(store,staged.id,doc=>{doc.applyReceipt.at=shifted(doc.updatedAt)});assert.throws(()=>store.get(staged.id),/INVALID_CHANGESET_RECEIPT_TIMESTAMP_BINDING/)}));
test('get rejects a rolled-back changeset whose rollback receipt timestamp no longer matches updatedAt',()=>withStore(store=>{const staged=store.stage('run-receipt-time-rollback',[{op:'write',path:'a.txt',content:'a'}]);store.apply(staged.id);store.rollback(staged.id);rewrite(store,staged.id,doc=>{doc.rollbackReceipt.at=shifted(doc.updatedAt)});assert.throws(()=>store.get(staged.id),/INVALID_CHANGESET_RECEIPT_TIMESTAMP_BINDING/)}));
test('writer-produced applied and rolled-back timestamp bindings remain readable',()=>withStore(store=>{const staged=store.stage('run-receipt-time-ok',[{op:'write',path:'a.txt',content:'a'}]);store.apply(staged.id);const applied=store.get(staged.id);assert.equal(applied.applyReceipt.at,applied.updatedAt);store.rollback(staged.id);const rolled=store.get(staged.id);assert.equal(rolled.rollbackReceipt.at,rolled.updatedAt)}));
