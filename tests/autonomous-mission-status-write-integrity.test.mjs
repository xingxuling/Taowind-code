import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {AutonomousMissionStore} from '../core/autonomous-supervisor.mjs';

function withStore(fn){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'twc-mission-status-write-'));try{return fn(new AutonomousMissionStore(dir),dir)}finally{fs.rmSync(dir,{recursive:true,force:true})}}

test('update rejects explicit falsy invalid mission statuses before persistence',()=>withStore(store=>{for(const value of ['',null,0,false]){const mission=store.create(`status-${String(value)}`);assert.throws(()=>store.update(mission.id,{status:value}),error=>error instanceof Error&&error.message==='INVALID_MISSION_STATUS');assert.equal(store.get(mission.id).status,'ACTIVE')}}));
test('terminal mission rejects explicit falsy status transitions',()=>withStore(store=>{const mission=store.create('terminal');store.update(mission.id,{status:'FAILED'});assert.throws(()=>store.update(mission.id,{status:null}),error=>error instanceof Error&&error.message==='MISSION_TERMINAL');assert.equal(store.get(mission.id).status,'FAILED')}));
test('valid mission status transitions remain supported',()=>withStore(store=>{const mission=store.create('valid');const updated=store.update(mission.id,{status:'WAITING_PROVIDER'});assert.equal(updated.status,'WAITING_PROVIDER');assert.equal(store.get(mission.id).status,'WAITING_PROVIDER')}));
