import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {RunStore} from '../core/run-store.mjs';

function withStore(fn){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'twc-run-shape-'));try{return fn(new RunStore(dir))}finally{fs.rmSync(dir,{recursive:true,force:true})}}
function rewrite(store,id,mutate){const file=store.file(id);const doc=JSON.parse(fs.readFileSync(file,'utf8'));mutate(doc);fs.writeFileSync(file,JSON.stringify(doc,null,2));}

test('get rejects blank durable goal',()=>withStore(store=>{const run=store.create({goal:'x'});rewrite(store,run.id,doc=>doc.goal='');assert.throws(()=>store.get(run.id),error=>error instanceof Error&&error.message==='INVALID_RUN_GOAL')}));
test('get rejects invalid durable cycle',()=>withStore(store=>{const run=store.create({goal:'x'});rewrite(store,run.id,doc=>doc.cycle=0);assert.throws(()=>store.get(run.id),error=>error instanceof Error&&error.message==='INVALID_RUN_CYCLE')}));
test('get rejects non-array durable ledgers',()=>withStore(store=>{for(const field of ['events','evidence','changesets']){const run=store.create({goal:field});rewrite(store,run.id,doc=>doc[field]={});assert.throws(()=>store.get(run.id),error=>error instanceof Error&&error.message==='INVALID_RUN_LEDGER')}}));
test('valid durable shape remains readable',()=>withStore(store=>{const run=store.create({goal:'x'});assert.equal(store.get(run.id).id,run.id)}));
