import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {AutonomousMissionStore} from '../core/autonomous-supervisor.mjs';

function withStore(fn){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'twc-mission-cycle-write-'));try{return fn(new AutonomousMissionStore(dir),dir)}finally{fs.rmSync(dir,{recursive:true,force:true})}}

test('mission cycle ledger only advances by one while preserving its durable prefix',()=>withStore(store=>{const mission=store.create('x');const first=store.update(mission.id,{cycle:1,cycles:[{index:1,runId:'run-one'}]},'MISSION_CYCLE_TEST',{});assert.equal(first.cycle,1);assert.equal(first.cycles.length,1);assert.throws(()=>store.update(mission.id,{cycle:1,cycles:[{index:1,runId:'run-forged'}]},'MISSION_CYCLE_TEST',{}),error=>error instanceof Error&&error.message==='MISSION_CYCLES_APPEND_ONLY');assert.throws(()=>store.update(mission.id,{cycle:3,cycles:[...first.cycles,{index:2,runId:'run-two'},{index:3,runId:'run-three'}]},'MISSION_CYCLE_TEST',{}),error=>error instanceof Error&&error.message==='MISSION_CYCLES_APPEND_ONLY');const second=store.update(mission.id,{cycle:2,cycles:[...first.cycles,{index:2,runId:'run-two'}]},'MISSION_CYCLE_TEST',{});assert.equal(second.cycle,2);assert.deepEqual(second.cycles.map(x=>x.runId),['run-one','run-two'])}));
