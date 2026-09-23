import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ChangesetStore} from '../core/changesets.mjs';

function withStore(fn){const root=fs.mkdtempSync(path.join(os.tmpdir(),'taowind-absent-preimage-'));const store=new ChangesetStore(path.join(root,'runtime'),path.join(root,'workspace'));try{return fn(store)}finally{fs.rmSync(root,{recursive:true,force:true})}}
function rewriteBefore(store,id,mutate){const file=store.file(id);const doc=JSON.parse(fs.readFileSync(file,'utf8'));mutate(doc.changes[0].before);fs.writeFileSync(file,JSON.stringify(doc,null,2))}

test('get rejects absent preimage carrying a forged type',()=>withStore(store=>{const staged=store.stage('run-absent-type',[{op:'write',path:'new.txt',content:'x'}]);rewriteBefore(store,staged.id,b=>{b.type='file'});assert.throws(()=>store.get(staged.id),/CHANGESET_PREIMAGE_CORRUPT/)}));
test('get rejects absent preimage carrying a forged identity',()=>withStore(store=>{const staged=store.stage('run-absent-id',[{op:'write',path:'new.txt',content:'x'}]);rewriteBefore(store,staged.id,b=>{b.identity='1:2'});assert.throws(()=>store.get(staged.id),/CHANGESET_PREIMAGE_CORRUPT/)}));
test('get rejects absent preimage carrying a forged mode',()=>withStore(store=>{const staged=store.stage('run-absent-mode',[{op:'write',path:'new.txt',content:'x'}]);rewriteBefore(store,staged.id,b=>{b.mode=420});assert.throws(()=>store.get(staged.id),/CHANGESET_PREIMAGE_CORRUPT/)}));
test('writer-produced absent preimage remains readable',()=>withStore(store=>{const staged=store.stage('run-absent-ok',[{op:'write',path:'new.txt',content:'x'}]);assert.equal(store.get(staged.id).changes[0].before.exists,false)}));
