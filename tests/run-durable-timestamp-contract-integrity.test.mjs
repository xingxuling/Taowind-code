import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {RunStore} from '../core/run-store.mjs';

function withStore(fn){const root=fs.mkdtempSync(path.join(os.tmpdir(),'taowind-run-time-'));const store=new RunStore(root);try{return fn(store)}finally{fs.rmSync(root,{recursive:true,force:true})}}
function rewrite(store,id,mutate){const file=store.file(id);const doc=JSON.parse(fs.readFileSync(file,'utf8'));mutate(doc);fs.writeFileSync(file,JSON.stringify(doc,null,2))}

test('get rejects a durable run with a non-writer createdAt timestamp',()=>withStore(store=>{const run=store.create({goal:'ship'});rewrite(store,run.id,doc=>{doc.createdAt='not-a-date'});assert.throws(()=>store.get(run.id),/INVALID_RUN_TIMESTAMP/)}));
test('get rejects a durable run with an impossible updatedAt timestamp',()=>withStore(store=>{const run=store.create({goal:'ship'});rewrite(store,run.id,doc=>{doc.updatedAt='2026-02-30T00:00:00.000Z'});assert.throws(()=>store.get(run.id),/INVALID_RUN_TIMESTAMP/)}));
test('writer-produced run timestamps remain readable',()=>withStore(store=>{const run=store.create({goal:'ship'});const loaded=store.get(run.id);assert.match(loaded.createdAt,/\.\d{3}Z$/);assert.match(loaded.updatedAt,/\.\d{3}Z$/)}));
