import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {RunStore} from '../core/run-store.mjs';

function withStore(fn){const root=fs.mkdtempSync(path.join(os.tmpdir(),'taowind-run-event-head-'));const store=new RunStore(root);try{return fn(store)}finally{fs.rmSync(root,{recursive:true,force:true})}}
function rewrite(store,id,mutate){const file=store.file(id);const doc=JSON.parse(fs.readFileSync(file,'utf8'));mutate(doc);fs.writeFileSync(file,JSON.stringify(doc,null,2))}
function shifted(value){return new Date(Date.parse(value)+1000).toISOString()}

test('get rejects a durable run whose updatedAt no longer matches the event head',()=>withStore(store=>{const run=store.create({goal:'ship'});rewrite(store,run.id,doc=>{doc.updatedAt=shifted(doc.updatedAt)});assert.throws(()=>store.get(run.id),/INVALID_RUN_EVENT_HEAD/)}));
test('get rejects an empty durable event ledger',()=>withStore(store=>{const run=store.create({goal:'ship'});rewrite(store,run.id,doc=>{doc.events=[]});assert.throws(()=>store.get(run.id),/INVALID_RUN_EVENT_HEAD/)}));
test('writer-produced create, update and evidence transitions keep event head bound to updatedAt',()=>withStore(store=>{let run=store.create({goal:'ship'});assert.equal(run.events.at(-1).at,run.updatedAt);run=store.update(run.id,{status:'PLANNED'},'PLAN_READY');assert.equal(run.events.at(-1).at,run.updatedAt);run=store.addEvidence(run.id,{kind:'probe'});assert.equal(store.get(run.id).events.at(-1).at,run.updatedAt)}));
