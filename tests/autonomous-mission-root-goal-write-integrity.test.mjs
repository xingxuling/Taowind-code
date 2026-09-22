import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {AutonomousMissionStore} from '../core/autonomous-supervisor.mjs';

function withStore(fn){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'twc-mission-root-goal-'));try{return fn(new AutonomousMissionStore(dir),dir)}finally{fs.rmSync(dir,{recursive:true,force:true})}}

test('mission rootGoal is immutable while nextGoal remains evolvable',()=>withStore(store=>{const mission=store.create('root');assert.throws(()=>store.update(mission.id,{rootGoal:'replacement'},'MISSION_PROBE',{}),error=>error instanceof Error&&error.message==='MISSION_ROOT_GOAL_IMMUTABLE');assert.equal(store.get(mission.id).rootGoal,'root');const updated=store.update(mission.id,{rootGoal:'root',nextGoal:'derived'},'MISSION_PROBE',{});assert.equal(updated.rootGoal,'root');assert.equal(updated.nextGoal,'derived')}));
