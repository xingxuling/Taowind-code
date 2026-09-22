import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {AutonomousMissionStore} from '../core/autonomous-supervisor.mjs';

function withStore(fn){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'twc-mission-closure-ref-'));try{return fn(new AutonomousMissionStore(dir))}finally{fs.rmSync(dir,{recursive:true,force:true})}}
function rewrite(store,mission,closure){const file=store.file(mission.id);const doc=JSON.parse(fs.readFileSync(file,'utf8'));doc.closure=closure;fs.writeFileSync(file,JSON.stringify(doc,null,2))}

test('durable mission closure rejects impossible run references',()=>withStore(store=>{
  const valid=store.create('x');rewrite(store,valid,{runId:'run-abc123'});assert.equal(store.get(valid.id).closure.runId,'run-abc123');
  for(const runId of ['RUN-abc123','not-a-run','']){const mission=store.create('x');rewrite(store,mission,{runId});assert.throws(()=>store.get(mission.id),error=>error instanceof Error&&error.message==='INVALID_MISSION_SHAPE')}
  const extensible=store.create('x');rewrite(store,extensible,{assessment:{closed:false}});assert.deepEqual(store.get(extensible.id).closure.assessment,{closed:false});
}));
