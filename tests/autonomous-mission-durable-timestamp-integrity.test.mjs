import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {AutonomousMissionStore} from '../core/autonomous-supervisor.mjs';

function withStore(fn){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'twc-mission-time-'));try{return fn(new AutonomousMissionStore(dir),dir)}finally{fs.rmSync(dir,{recursive:true,force:true})}}
function rewrite(store,mission,mutate){const file=store.file(mission.id);const doc=JSON.parse(fs.readFileSync(file,'utf8'));mutate(doc);fs.writeFileSync(file,JSON.stringify(doc,null,2))}

test('mission updatedAt follows the durable event tail',()=>withStore(store=>{const mission=store.create('x');assert.match(mission.createdAt,/\S/);assert.equal(mission.updatedAt,mission.events.at(-1).at);const updated=store.update(mission.id,{blocker:'probe'},'MISSION_PROBE',{});assert.equal(updated.updatedAt,updated.events.at(-1).at)}));

test('durable mission timestamps fail closed when blank or detached from event tail',()=>withStore(store=>{for(const mutate of [doc=>{doc.createdAt=''},doc=>{doc.updatedAt=''},doc=>{doc.updatedAt='2000-01-01T00:00:00.000Z'}]){const mission=store.create('x');rewrite(store,mission,mutate);assert.throws(()=>store.get(mission.id),error=>error instanceof Error&&error.message==='INVALID_MISSION_SHAPE')}}));
