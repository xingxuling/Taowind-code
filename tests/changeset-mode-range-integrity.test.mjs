import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ChangesetStore} from '../core/changesets.mjs';

function withStore(fn){const root=fs.mkdtempSync(path.join(os.tmpdir(),'taowind-cs-mode-'));const workspace=path.join(root,'workspace');const store=new ChangesetStore(path.join(root,'runtime'),workspace);try{return fn(store,workspace)}finally{fs.rmSync(root,{recursive:true,force:true})}}
function rewrite(store,id,mutate){const file=store.file(id);const doc=JSON.parse(fs.readFileSync(file,'utf8'));mutate(doc);fs.writeFileSync(file,JSON.stringify(doc,null,2))}

test('get rejects a durable preimage mode outside the writer-observable 0o7777 range',()=>withStore((store,workspace)=>{fs.writeFileSync(path.join(workspace,'a.txt'),'before');const staged=store.stage('run-mode-before',[{op:'write',path:'a.txt',content:'after'}]);rewrite(store,staged.id,doc=>{doc.changes[0].before.mode=4096});assert.throws(()=>store.get(staged.id),/INVALID_CHANGESET_CHANGE_SHAPE/)}));
test('get rejects an apply receipt mode outside the writer-observable range',()=>withStore(store=>{const staged=store.stage('run-mode-apply',[{op:'write',path:'a.txt',content:'a'}]);store.apply(staged.id);rewrite(store,staged.id,doc=>{doc.applyReceipt.files[0].mode=-1});assert.throws(()=>store.get(staged.id),/INVALID_CHANGESET_RECEIPT_SHAPE/)}));
test('get rejects a rollback receipt mode outside the writer-observable range',()=>withStore((store,workspace)=>{fs.writeFileSync(path.join(workspace,'a.txt'),'before');const staged=store.stage('run-mode-rollback',[{op:'write',path:'a.txt',content:'after'}]);store.apply(staged.id);store.rollback(staged.id);rewrite(store,staged.id,doc=>{doc.rollbackReceipt.files[0].mode=4096});assert.throws(()=>store.get(staged.id),/INVALID_CHANGESET_RECEIPT_SHAPE/)}));
test('writer-produced filesystem modes remain nullable or within 0..4095',()=>withStore((store,workspace)=>{fs.writeFileSync(path.join(workspace,'a.txt'),'before');const staged=store.stage('run-mode-ok',[{op:'write',path:'a.txt',content:'after'}]);const before=store.get(staged.id).changes[0].before.mode;assert.ok(before===null||(Number.isInteger(before)&&before>=0&&before<=4095));store.apply(staged.id);const applied=store.get(staged.id).applyReceipt.files[0].mode;assert.ok(applied===null||(Number.isInteger(applied)&&applied>=0&&applied<=4095))}));
