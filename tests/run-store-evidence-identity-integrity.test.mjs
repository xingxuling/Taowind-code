import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {RunStore} from '../core/run-store.mjs';

function withStore(fn){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'twc-evidence-id-'));try{return fn(new RunStore(dir))}finally{fs.rmSync(dir,{recursive:true,force:true})}}

test('addEvidence owns evidence id and timestamp',()=>withStore(store=>{
  const run=store.create({goal:'x'});
  const updated=store.addEvidence(run.id,{id:'ev-forged',at:'2000-01-01T00:00:00.000Z',kind:'test',value:'pass'});
  const item=updated.evidence[0];
  assert.notEqual(item.id,'ev-forged');
  assert.match(item.id,/^ev-[0-9a-f]+$/);
  assert.notEqual(item.at,'2000-01-01T00:00:00.000Z');
  assert.equal(updated.events.at(-1).data.evidenceId,item.id);
}));

test('ordinary evidence payload remains preserved',()=>withStore(store=>{
  const run=store.create({goal:'x'});
  const updated=store.addEvidence(run.id,{kind:'test',value:'pass'});
  assert.equal(updated.evidence[0].kind,'test');
  assert.equal(updated.evidence[0].value,'pass');
}));
