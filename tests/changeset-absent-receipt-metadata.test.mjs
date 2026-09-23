import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ChangesetStore} from '../core/changesets.mjs';
import {sha256Text} from '../core/hash.mjs';

function withStore(fn){const root=fs.mkdtempSync(path.join(os.tmpdir(),'taowind-absent-receipt-'));const workspace=path.join(root,'workspace');const store=new ChangesetStore(path.join(root,'runtime'),workspace);try{return fn(store,workspace)}finally{fs.rmSync(root,{recursive:true,force:true})}}
function rewrite(store,id,receiptKey,mutate){const file=store.file(id);const doc=JSON.parse(fs.readFileSync(file,'utf8'));mutate(doc[receiptKey].files[0]);doc[receiptKey].receiptSha256=sha256Text(JSON.stringify(doc[receiptKey].files));fs.writeFileSync(file,JSON.stringify(doc,null,2))}

test('get rejects deleted apply receipt carrying identity for an absent post-state',()=>withStore((store,workspace)=>{fs.writeFileSync(path.join(workspace,'a.txt'),'before');const staged=store.stage('run-apply-absent-id',[{op:'delete',path:'a.txt'}]);store.apply(staged.id);rewrite(store,staged.id,'applyReceipt',file=>{file.identity='1:2'});assert.throws(()=>store.get(staged.id),/CHANGESET_APPLY_RECEIPT_CORRUPT/)}));
test('get rejects deleted apply receipt carrying mode for an absent post-state',()=>withStore((store,workspace)=>{fs.writeFileSync(path.join(workspace,'a.txt'),'before');const staged=store.stage('run-apply-absent-mode',[{op:'delete',path:'a.txt'}]);store.apply(staged.id);rewrite(store,staged.id,'applyReceipt',file=>{file.mode=420});assert.throws(()=>store.get(staged.id),/CHANGESET_APPLY_RECEIPT_CORRUPT/)}));
test('get rejects rollback receipt carrying metadata when restoration is absence',()=>withStore((store)=>{const staged=store.stage('run-rollback-absent-id',[{op:'write',path:'new.txt',content:'x'}]);store.apply(staged.id);store.rollback(staged.id);rewrite(store,staged.id,'rollbackReceipt',file=>{file.identity='1:2'});assert.throws(()=>store.get(staged.id),/CHANGESET_ROLLBACK_RECEIPT_CORRUPT/)}));
test('writer-produced absent receipt metadata remains null',()=>withStore((store,workspace)=>{fs.writeFileSync(path.join(workspace,'a.txt'),'before');const staged=store.stage('run-apply-absent-ok',[{op:'delete',path:'a.txt'}]);store.apply(staged.id);const file=store.get(staged.id).applyReceipt.files[0];assert.equal(file.exists,false);assert.equal(file.identity,null);assert.equal(file.mode,null)}));
