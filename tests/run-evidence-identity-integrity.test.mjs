import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {RunStore} from '../core/run-store.mjs';

function withStore(fn){const root=fs.mkdtempSync(path.join(os.tmpdir(),'taowind-run-evidence-'));const store=new RunStore(root);try{return fn(store)}finally{fs.rmSync(root,{recursive:true,force:true})}}
function rewrite(store,id,mutate){const file=store.file(id);const doc=JSON.parse(fs.readFileSync(file,'utf8'));mutate(doc);fs.writeFileSync(file,JSON.stringify(doc,null,2))}

test('get rejects a durable evidence item with a forged id',()=>withStore(store=>{let run=store.create({goal:'ship'});run=store.addEvidence(run.id,{kind:'probe'});rewrite(store,run.id,doc=>{doc.evidence[0].id='ev-forged'});assert.throws(()=>store.get(run.id),/INVALID_RUN_LEDGER/)}));
test('get rejects a durable evidence item with a non-writer timestamp',()=>withStore(store=>{let run=store.create({goal:'ship'});run=store.addEvidence(run.id,{kind:'probe'});rewrite(store,run.id,doc=>{doc.evidence[0].at='not-a-date'});assert.throws(()=>store.get(run.id),/INVALID_RUN_LEDGER/)}));
test('update rejects a malformed replacement evidence ledger',()=>withStore(store=>{const run=store.create({goal:'ship'});assert.throws(()=>store.update(run.id,{evidence:[null]}),/INVALID_RUN_LEDGER/)}));
test('addEvidence owns id/time while preserving arbitrary payload',()=>withStore(store=>{const run=store.create({goal:'ship'});const updated=store.addEvidence(run.id,{id:'ev-forged',at:'yesterday',kind:'probe',payload:{x:1}});assert.match(updated.evidence[0].id,/^ev-[a-f0-9]{12}$/);assert.notEqual(updated.evidence[0].at,'yesterday');assert.deepEqual(updated.evidence[0].payload,{x:1});assert.equal(store.get(run.id).evidence[0].kind,'probe')}));
