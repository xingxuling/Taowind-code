import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ChangesetStore} from '../core/changesets.mjs';

function withStore(fn){const root=fs.mkdtempSync(path.join(os.tmpdir(),'taowind-cs-run-ref-'));const store=new ChangesetStore(path.join(root,'runtime'),path.join(root,'workspace'));try{return fn(store)}finally{fs.rmSync(root,{recursive:true,force:true})}}
function rewrite(store,id,mutate){const file=store.file(id);const doc=JSON.parse(fs.readFileSync(file,'utf8'));mutate(doc);fs.writeFileSync(file,JSON.stringify(doc,null,2))}

test('stage rejects a run reference outside the canonical RunStore identity syntax',()=>withStore(store=>{assert.throws(()=>store.stage('plain',[{op:'write',path:'a.txt',content:'a'}]),/INVALID_CHANGESET_RUN_ID/)}));
test('get rejects a durable changeset whose run reference no longer has run identity syntax',()=>withStore(store=>{const staged=store.stage('run-abc',[{op:'write',path:'a.txt',content:'a'}]);rewrite(store,staged.id,doc=>{doc.runId='plain'});assert.throws(()=>store.get(staged.id),/INVALID_CHANGESET_ENVELOPE/)}));
test('RunStore-compatible references remain stageable and readable',()=>withStore(store=>{for(const runId of ['run-a','run-ABC-123']){const staged=store.stage(runId,[{op:'write',path:`${runId}.txt`,content:'a'}]);assert.equal(store.get(staged.id).runId,runId)}}));
