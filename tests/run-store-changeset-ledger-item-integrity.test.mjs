import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {RunStore} from '../core/run-store.mjs';

function withStore(fn){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'twc-run-cs-ledger-'));try{return fn(new RunStore(dir))}finally{fs.rmSync(dir,{recursive:true,force:true})}}

test('durable changeset ledger rejects non-string entries',()=>withStore(store=>{const run=store.create({goal:'x'});const file=store.file(run.id);const doc=JSON.parse(fs.readFileSync(file,'utf8'));doc.changesets=[{id:'cs-forged'}];fs.writeFileSync(file,JSON.stringify(doc,null,2));assert.throws(()=>store.get(run.id),error=>error instanceof Error&&error.message==='INVALID_RUN_LEDGER')}));
test('update rejects non-string changeset ledger entries before persistence',()=>withStore(store=>{const run=store.create({goal:'x'});assert.throws(()=>store.update(run.id,{changesets:['cs-1',{id:'cs-forged'}]}),error=>error instanceof Error&&error.message==='INVALID_RUN_LEDGER');assert.deepEqual(store.get(run.id).changesets,[])}));
test('string changeset ids remain supported',()=>withStore(store=>{const run=store.create({goal:'x'});const updated=store.update(run.id,{changesets:['cs-a','cs-b']});assert.deepEqual(updated.changesets,['cs-a','cs-b']);assert.deepEqual(store.get(run.id).changesets,['cs-a','cs-b'])}));
