import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ChangesetStore} from '../core/changesets.mjs';

function withStore(fn){const root=fs.mkdtempSync(path.join(os.tmpdir(),'taowind-changeset-time-'));const store=new ChangesetStore(path.join(root,'runtime'),path.join(root,'workspace'));try{return fn(store)}finally{fs.rmSync(root,{recursive:true,force:true})}}
function rewrite(store,id,mutate){const file=store.file(id);const doc=JSON.parse(fs.readFileSync(file,'utf8'));mutate(doc);fs.writeFileSync(file,JSON.stringify(doc,null,2))}

test('get rejects a durable changeset with a non-writer createdAt timestamp',()=>withStore(store=>{const staged=store.stage('run-time-created',[{op:'write',path:'a.txt',content:'a'}]);rewrite(store,staged.id,doc=>{doc.createdAt='not-a-date'});assert.throws(()=>store.get(staged.id),/INVALID_CHANGESET_ENVELOPE/)}));
test('get rejects a durable changeset with an impossible updatedAt timestamp',()=>withStore(store=>{const staged=store.stage('run-time-updated',[{op:'write',path:'a.txt',content:'a'}]);rewrite(store,staged.id,doc=>{doc.updatedAt='2026-02-30T00:00:00.000Z'});assert.throws(()=>store.get(staged.id),/INVALID_CHANGESET_ENVELOPE/)}));
test('get rejects an apply receipt with a non-writer timestamp',()=>withStore(store=>{const staged=store.stage('run-time-receipt',[{op:'write',path:'a.txt',content:'a'}]);store.apply(staged.id);rewrite(store,staged.id,doc=>{doc.applyReceipt.at='yesterday'});assert.throws(()=>store.get(staged.id),/INVALID_CHANGESET_RECEIPT_SHAPE/)}));
test('writer-produced durable timestamps remain readable',()=>withStore(store=>{const staged=store.stage('run-time-ok',[{op:'write',path:'a.txt',content:'a'}]);assert.equal(store.get(staged.id).id,staged.id);store.apply(staged.id);assert.equal(store.get(staged.id).status,'APPLIED')}));
