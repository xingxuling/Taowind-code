import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {AutonomousMissionStore} from '../core/autonomous-supervisor.mjs';

function withStore(fn){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'twc-mission-shape-'));try{return fn(new AutonomousMissionStore(dir),dir)}finally{fs.rmSync(dir,{recursive:true,force:true})}}
function rewrite(store,mission,patch){const file=store.file(mission.id);const doc=JSON.parse(fs.readFileSync(file,'utf8'));Object.assign(doc,patch);fs.writeFileSync(file,JSON.stringify(doc,null,2))}

test('durable mission rejects invalid root goal, cycle, config, and ledgers',()=>withStore(store=>{const invalid=[{rootGoal:''},{cycle:-1},{cycle:1.5},{config:{}},{cycles:{}},{events:null},{evidence:'bad'}];for(const patch of invalid){const mission=store.create('x');rewrite(store,mission,patch);assert.throws(()=>store.get(mission.id),error=>error instanceof Error&&error.message==='INVALID_MISSION_SHAPE')}}));
test('durable mission rejects invalid optional declared property shapes',()=>withStore(store=>{const invalid=[{nextGoal:null},{currentRunId:4},{closure:[]},{blocker:{}}];for(const patch of invalid){const mission=store.create('x');rewrite(store,mission,patch);assert.throws(()=>store.get(mission.id),error=>error instanceof Error&&error.message==='INVALID_MISSION_SHAPE')}}));
test('update rejects contract-invalid mission shape before persistence',()=>withStore(store=>{const mission=store.create('x');assert.throws(()=>store.update(mission.id,{events:{}}),error=>error instanceof Error&&error.message==='INVALID_MISSION_SHAPE');assert.ok(Array.isArray(store.get(mission.id).events))}));
test('current mission shape remains readable and writable',()=>withStore(store=>{const mission=store.create('x');const updated=store.update(mission.id,{cycle:1,nextGoal:'next'});assert.equal(updated.cycle,1);assert.equal(store.get(mission.id).nextGoal,'next')}));
