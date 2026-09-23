import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {RunStore} from '../core/run-store.mjs';

function withStore(fn){const root=fs.mkdtempSync(path.join(os.tmpdir(),'taowind-run-csid-'));const store=new RunStore(root);try{return fn(store)}finally{fs.rmSync(root,{recursive:true,force:true})}}
function rewrite(store,id,mutate){const file=store.file(id);const doc=JSON.parse(fs.readFileSync(file,'utf8'));mutate(doc);fs.writeFileSync(file,JSON.stringify(doc,null,2))}

test('get rejects a durable run with a non-changeset ledger reference',()=>withStore(store=>{const run=store.create({goal:'ship'});rewrite(store,run.id,doc=>{doc.changesets=['not-a-changeset']});assert.throws(()=>store.get(run.id),/INVALID_RUN_LEDGER/)}));
test('get rejects uppercase or malformed changeset references',()=>withStore(store=>{const run=store.create({goal:'ship'});for(const bad of ['CS-abc','cs-ABC','cs-']){rewrite(store,run.id,doc=>{doc.changesets=[bad]});assert.throws(()=>store.get(run.id),/INVALID_RUN_LEDGER/);rewrite(store,run.id,doc=>{doc.changesets=[]})}}));
test('update rejects a malformed changeset reference before persistence',()=>withStore(store=>{const run=store.create({goal:'ship'});assert.throws(()=>store.update(run.id,{changesets:['plain']}),/INVALID_RUN_LEDGER/);assert.deepEqual(store.get(run.id).changesets,[])}));
test('ChangesetStore-compatible references remain supported',()=>withStore(store=>{const run=store.create({goal:'ship'});const updated=store.update(run.id,{changesets:['cs-1','cs-a0f9']});assert.deepEqual(updated.changesets,['cs-1','cs-a0f9']);assert.deepEqual(store.get(run.id).changesets,['cs-1','cs-a0f9'])}));
