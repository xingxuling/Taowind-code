import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {AutonomousMissionStore} from '../core/autonomous-supervisor.mjs';

function withStore(fn){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'twc-mission-created-at-'));try{return fn(new AutonomousMissionStore(dir),dir)}finally{fs.rmSync(dir,{recursive:true,force:true})}}

test('mission createdAt is store-owned and immutable through update',()=>withStore(store=>{const mission=store.create('x');const original=mission.createdAt;assert.throws(()=>store.update(mission.id,{createdAt:'2000-01-01T00:00:00.000Z'},'MISSION_PROBE',{}),error=>error instanceof Error&&error.message==='MISSION_CREATED_AT_IMMUTABLE');assert.equal(store.get(mission.id).createdAt,original);const same=store.update(mission.id,{createdAt:original,blocker:'probe'},'MISSION_PROBE',{});assert.equal(same.createdAt,original);assert.equal(same.blocker,'probe')}));
