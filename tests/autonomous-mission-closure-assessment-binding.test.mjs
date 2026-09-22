import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {AutonomousMissionStore} from '../core/autonomous-supervisor.mjs';

function withStore(fn){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'twc-mission-closure-assessment-'));try{return fn(new AutonomousMissionStore(dir),dir)}finally{fs.rmSync(dir,{recursive:true,force:true})}}
function rewrite(store,mission,mutate){const file=store.file(mission.id);const doc=JSON.parse(fs.readFileSync(file,'utf8'));mutate(doc);fs.writeFileSync(file,JSON.stringify(doc,null,2))}
function record(assessment){return {index:1,runId:'run-one',goal:'ship',mode:'DEEP_DEVELOPMENT',status:'READY_FOR_DELIVERY',closedAt:'2026-09-22T00:00:00.000Z',assessment}}

test('completed mission closure assessment matches the latest cycle assessment',()=>withStore(store=>{const mission=store.create('x');const assessment={closed:false,confidence:.6,gaps:[{problem:'x'}]};const completed=store.update(mission.id,{cycle:1,cycles:[record(assessment)],closure:{runId:'run-one',at:'2026-09-22T00:00:01.000Z',assessment}},'MISSION_CYCLE_TEST',{});assert.deepEqual(completed.closure.assessment,completed.cycles[0].assessment)}));

test('durable mission fails closed when closure assessment drifts from the latest cycle',()=>withStore(store=>{const mission=store.create('x');const assessment={closed:false,confidence:.6};const completed=store.update(mission.id,{cycle:1,cycles:[record(assessment)],closure:{runId:'run-one',at:'2026-09-22T00:00:01.000Z',assessment}},'MISSION_CYCLE_TEST',{});rewrite(store,completed,doc=>{doc.closure.assessment={closed:true,confidence:1}});assert.throws(()=>store.get(mission.id),error=>error instanceof Error&&error.message==='INVALID_MISSION_SHAPE')}));
