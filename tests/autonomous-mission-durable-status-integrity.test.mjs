import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {AutonomousMissionStore} from '../core/autonomous-supervisor.mjs';

function withStore(fn){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'twc-mission-status-read-'));try{return fn(new AutonomousMissionStore(dir),dir)}finally{fs.rmSync(dir,{recursive:true,force:true})}}

test('durable mission rejects unknown and falsy invalid statuses',()=>withStore(store=>{for(const value of ['MYSTERY','',null,0,false]){const mission=store.create(`status-${String(value)}`);const file=store.file(mission.id);const doc=JSON.parse(fs.readFileSync(file,'utf8'));doc.status=value;fs.writeFileSync(file,JSON.stringify(doc,null,2));assert.throws(()=>store.get(mission.id),error=>error instanceof Error&&error.message==='INVALID_MISSION_STATUS')}}));
test('current durable mission status remains readable',()=>withStore(store=>{const mission=store.create('valid');assert.equal(store.get(mission.id).status,'ACTIVE')}));
