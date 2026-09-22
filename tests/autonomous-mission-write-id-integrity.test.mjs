import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {AutonomousMissionStore} from '../core/autonomous-supervisor.mjs';

function withStore(fn){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'twc-mission-id-write-'));try{return fn(new AutonomousMissionStore(dir),dir)}finally{fs.rmSync(dir,{recursive:true,force:true})}}

test('update cannot rewrite mission durable id',()=>withStore(store=>{const mission=store.create('x');assert.throws(()=>store.update(mission.id,{id:`${mission.id}-other`}),error=>error instanceof Error&&error.message==='MISSION_ID_IMMUTABLE');assert.equal(store.get(mission.id).id,mission.id)}));
test('same-id update remains supported',()=>withStore(store=>{const mission=store.create('x');const updated=store.update(mission.id,{id:mission.id,nextGoal:'y'});assert.equal(updated.id,mission.id);assert.equal(store.get(mission.id).nextGoal,'y')}));
