import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {RunStore} from '../core/run-store.mjs';

function withStore(fn){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'twc-run-write-shape-'));try{return fn(new RunStore(dir))}finally{fs.rmSync(dir,{recursive:true,force:true})}}

test('update rejects blank goal before corrupting durable state',()=>withStore(store=>{const run=store.create({goal:'x'});assert.throws(()=>store.update(run.id,{goal:''}),error=>error instanceof Error&&error.message==='INVALID_RUN_GOAL');assert.equal(store.get(run.id).goal,'x')}));
test('update rejects invalid cycle before corrupting durable state',()=>withStore(store=>{const run=store.create({goal:'x'});assert.throws(()=>store.update(run.id,{cycle:0}),error=>error instanceof Error&&error.message==='INVALID_RUN_CYCLE');assert.equal(store.get(run.id).cycle,1)}));
test('update rejects non-array ledgers before corrupting durable state',()=>withStore(store=>{for(const field of ['events','evidence','changesets']){const run=store.create({goal:field});assert.throws(()=>store.update(run.id,{[field]:{}}),error=>error instanceof Error&&error.message==='INVALID_RUN_LEDGER');assert.ok(Array.isArray(store.get(run.id)[field]))}}));
test('valid structural updates remain supported',()=>withStore(store=>{const run=store.create({goal:'x'});const updated=store.update(run.id,{goal:'y',cycle:2,changesets:['cs-1']});assert.equal(updated.goal,'y');assert.equal(updated.cycle,2);assert.deepEqual(updated.changesets,['cs-1'])}));
