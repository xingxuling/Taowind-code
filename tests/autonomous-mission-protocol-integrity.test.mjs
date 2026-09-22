import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {AutonomousMissionStore} from '../core/autonomous-supervisor.mjs';

function withStore(fn){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'twc-mission-protocol-'));try{return fn(new AutonomousMissionStore(dir),dir)}finally{fs.rmSync(dir,{recursive:true,force:true})}}

test('durable mission rejects unknown protocol',()=>withStore(store=>{const mission=store.create('x');const file=store.file(mission.id);const doc=JSON.parse(fs.readFileSync(file,'utf8'));doc.protocol='taowind-code.autonomous-mission.v9';fs.writeFileSync(file,JSON.stringify(doc,null,2));assert.throws(()=>store.get(mission.id),error=>error instanceof Error&&error.message==='UNSUPPORTED_MISSION_PROTOCOL')}));
test('update cannot rewrite mission protocol',()=>withStore(store=>{const mission=store.create('x');assert.throws(()=>store.update(mission.id,{protocol:'taowind-code.autonomous-mission.v9'}),error=>error instanceof Error&&error.message==='MISSION_PROTOCOL_IMMUTABLE');assert.equal(store.get(mission.id).protocol,'taowind-code.autonomous-mission.v0.1')}));
test('current mission protocol remains readable',()=>withStore(store=>{const mission=store.create('x');assert.equal(store.get(mission.id).protocol,'taowind-code.autonomous-mission.v0.1')}));
