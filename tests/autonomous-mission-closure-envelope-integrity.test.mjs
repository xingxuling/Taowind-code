import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {AutonomousMissionStore} from '../core/autonomous-supervisor.mjs';

function withStore(fn){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'twc-mission-closure-envelope-'));try{return fn(new AutonomousMissionStore(dir),dir)}finally{fs.rmSync(dir,{recursive:true,force:true})}}
function rewrite(store,mission,mutate){const file=store.file(mission.id);const doc=JSON.parse(fs.readFileSync(file,'utf8'));mutate(doc);fs.writeFileSync(file,JSON.stringify(doc,null,2))}
function record(assessment){return {index:1,runId:'run-one',goal:'ship',mode:'DEEP_DEVELOPMENT',status:'READY_FOR_DELIVERY',closedAt:'2026-09-22T00:00:00.000Z',assessment}}

test('completed mission closure keeps the supervisor envelope',()=>withStore(store=>{const mission=store.create('x');const assessment={closed:false,confidence:.6};const completed=store.update(mission.id,{cycle:1,cycles:[record(assessment)],closure:{runId:'run-one',at:'2026-09-22T00:00:01.000Z',assessment}},'MISSION_CYCLE_TEST',{});assert.equal(completed.closure.runId,'run-one');assert.match(completed.closure.at,/\S/);assert.ok(Object.prototype.hasOwnProperty.call(completed.closure,'assessment'))}));

test('completed mission closure fails closed when timestamp or assessment is missing',()=>withStore(store=>{for(const mutate of [doc=>{doc.closure.at=''},doc=>{delete doc.closure.assessment}]){const mission=store.create('x');const assessment={closed:false,confidence:.6};const completed=store.update(mission.id,{cycle:1,cycles:[record(assessment)],closure:{runId:'run-one',at:'2026-09-22T00:00:01.000Z',assessment}},'MISSION_CYCLE_TEST',{});rewrite(store,completed,mutate);assert.throws(()=>store.get(mission.id),error=>error instanceof Error&&error.message==='INVALID_MISSION_SHAPE')}}));
