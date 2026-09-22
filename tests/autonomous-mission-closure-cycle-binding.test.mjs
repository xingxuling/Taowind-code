import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {AutonomousMissionStore} from '../core/autonomous-supervisor.mjs';

function withStore(fn){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'twc-mission-closure-'));try{return fn(new AutonomousMissionStore(dir),dir)}finally{fs.rmSync(dir,{recursive:true,force:true})}}
function rewrite(store,mission,mutate){const file=store.file(mission.id);const doc=JSON.parse(fs.readFileSync(file,'utf8'));mutate(doc);fs.writeFileSync(file,JSON.stringify(doc,null,2))}

test('mission closure runId tracks the latest completed cycle',()=>withStore(store=>{const mission=store.create('x');const completed=store.update(mission.id,{cycle:1,cycles:[{index:1,runId:'run-one'}],closure:{runId:'run-one'}},'MISSION_CYCLE_TEST',{});assert.equal(completed.closure.runId,'run-one');for(const mutate of [doc=>{doc.closure=null},doc=>{doc.closure={runId:'run-other'}}]){rewrite(store,completed,mutate);assert.throws(()=>store.get(mission.id),error=>error instanceof Error&&error.message==='INVALID_MISSION_SHAPE');rewrite(store,completed,doc=>Object.assign(doc,completed))}}));
