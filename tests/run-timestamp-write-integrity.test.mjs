import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {RunStore} from '../core/run-store.mjs';

function withStore(fn){const root=fs.mkdtempSync(path.join(os.tmpdir(),'taowind-run-time-write-'));const store=new RunStore(root);try{return fn(store)}finally{fs.rmSync(root,{recursive:true,force:true})}}

test('update rejects a createdAt value that the durable read boundary would reject',()=>withStore(store=>{const run=store.create({goal:'ship'});assert.throws(()=>store.update(run.id,{createdAt:'not-a-date'}),/INVALID_RUN_TIMESTAMP/);assert.equal(store.get(run.id).id,run.id)}));
test('update retains a canonical createdAt value while eventObject owns updatedAt',()=>withStore(store=>{const run=store.create({goal:'ship'});const createdAt='2026-09-23T07:30:00.123Z';const updated=store.update(run.id,{createdAt});assert.equal(updated.createdAt,createdAt);assert.match(updated.updatedAt,/\.\d{3}Z$/);assert.equal(store.get(run.id).createdAt,createdAt)}));
