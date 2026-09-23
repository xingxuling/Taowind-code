import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {RunStore} from '../core/run-store.mjs';

function withStore(fn){const root=fs.mkdtempSync(path.join(os.tmpdir(),'taowind-run-events-'));const store=new RunStore(root);try{return fn(store)}finally{fs.rmSync(root,{recursive:true,force:true})}}
function rewrite(store,id,mutate){const file=store.file(id);const doc=JSON.parse(fs.readFileSync(file,'utf8'));mutate(doc);fs.writeFileSync(file,JSON.stringify(doc,null,2))}

test('get rejects a durable event ledger with a broken sequence',()=>withStore(store=>{const run=store.create({goal:'ship'});rewrite(store,run.id,doc=>{doc.events[0].seq=2});assert.throws(()=>store.get(run.id),/INVALID_RUN_LEDGER/)}));
test('get rejects a durable event ledger with an invalid timestamp or blank type',()=>withStore(store=>{const run=store.create({goal:'ship'});rewrite(store,run.id,doc=>{doc.events[0].at='not-a-date'});assert.throws(()=>store.get(run.id),/INVALID_RUN_LEDGER/)}));
test('update rejects a malformed replacement event ledger and eventObject rejects a blank type',()=>withStore(store=>{const run=store.create({goal:'ship'});assert.throws(()=>store.update(run.id,{events:[{seq:1,at:run.createdAt,type:'',data:{}}]}),/INVALID_RUN_LEDGER/);assert.throws(()=>store.update(run.id,{},'   '),/INVALID_RUN_EVENT_LEDGER/)}));
test('writer-produced event ledger remains readable and sequential',()=>withStore(store=>{let run=store.create({goal:'ship'});run=store.update(run.id,{status:'PLANNED'},'PLAN_READY',{step:1});const loaded=store.get(run.id);assert.deepEqual(loaded.events.map(x=>x.seq),[1,2]);assert.deepEqual(loaded.events.map(x=>x.type),['RUN_CREATED','PLAN_READY'])}));
