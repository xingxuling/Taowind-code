import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ChangesetStore} from '../core/changesets.mjs';
import {sha256Text} from '../core/hash.mjs';

function withStore(fn){const root=fs.mkdtempSync(path.join(os.tmpdir(),'taowind-rollback-binding-'));const workspace=path.join(root,'workspace');const store=new ChangesetStore(path.join(root,'runtime'),workspace);try{return fn(store,workspace)}finally{fs.rmSync(root,{recursive:true,force:true})}}
function rewrite(store,id,mutate){const file=store.file(id);const doc=JSON.parse(fs.readFileSync(file,'utf8'));mutate(doc);doc.rollbackReceipt.receiptSha256=sha256Text(JSON.stringify(doc.rollbackReceipt.files));fs.writeFileSync(file,JSON.stringify(doc,null,2))}

test('get rejects coherently rehashed rollback receipt with a forged path',()=>withStore((store,workspace)=>{fs.writeFileSync(path.join(workspace,'a.txt'),'before');const staged=store.stage('run-rb-path',[{op:'write',path:'a.txt',content:'after'}]);store.apply(staged.id);store.rollback(staged.id);rewrite(store,staged.id,doc=>{doc.rollbackReceipt.files[0].path='forged.txt'});assert.throws(()=>store.get(staged.id),/CHANGESET_ROLLBACK_RECEIPT_CORRUPT/)}));
test('get rejects rollback receipt whose restored hash disagrees with the staged preimage',()=>withStore((store,workspace)=>{fs.writeFileSync(path.join(workspace,'a.txt'),'before');const staged=store.stage('run-rb-hash',[{op:'write',path:'a.txt',content:'after'}]);store.apply(staged.id);store.rollback(staged.id);rewrite(store,staged.id,doc=>{doc.rollbackReceipt.files[0].sha256='0'.repeat(64)});assert.throws(()=>store.get(staged.id),/CHANGESET_ROLLBACK_RECEIPT_CORRUPT/)}));
test('get rejects rollback receipt with duplicate path coverage',()=>withStore((store)=>{const staged=store.stage('run-rb-dup',[{op:'write',path:'a.txt',content:'a'},{op:'write',path:'b.txt',content:'b'}]);store.apply(staged.id);store.rollback(staged.id);rewrite(store,staged.id,doc=>{doc.rollbackReceipt.files[1].path=doc.rollbackReceipt.files[0].path});assert.throws(()=>store.get(staged.id),/CHANGESET_ROLLBACK_RECEIPT_CORRUPT/)}));
test('intact rollback receipt remains readable',()=>withStore((store,workspace)=>{fs.writeFileSync(path.join(workspace,'a.txt'),'before');const staged=store.stage('run-rb-ok',[{op:'write',path:'a.txt',content:'after'}]);store.apply(staged.id);store.rollback(staged.id);assert.equal(store.get(staged.id).status,'ROLLED_BACK')}));
