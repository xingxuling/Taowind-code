import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {AutonomousMissionStore} from '../core/autonomous-supervisor.mjs';

function withStore(fn){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'twc-mission-events-'));try{return fn(new AutonomousMissionStore(dir),dir)}finally{fs.rmSync(dir,{recursive:true,force:true})}}
function rewriteEvents(store,mission,events){const file=store.file(mission.id);const doc=JSON.parse(fs.readFileSync(file,'utf8'));doc.events=events;fs.writeFileSync(file,JSON.stringify(doc,null,2))}

test('generated mission events carry contiguous store-owned sequence metadata',()=>withStore(store=>{const mission=store.create('x');const updated=store.update(mission.id,{blocker:'probe'},'MISSION_PROBE',{ok:true});assert.equal(updated.events.length,2);assert.deepEqual(updated.events.map(event=>event.seq),[1,2]);assert.equal(updated.events[1].type,'MISSION_PROBE');assert.deepEqual(updated.events[1].data,{ok:true});assert.match(updated.events[1].at,/\S/)}));

test('durable mission events fail closed on forged sequence or missing envelope fields',()=>withStore(store=>{for(const mutate of [events=>{events[0].seq=2},events=>{events[0].at=''},events=>{events[0].type=''},events=>{delete events[0].data},events=>events.push(null)]){const mission=store.create('x');const events=structuredClone(mission.events);const result=mutate(events);rewriteEvents(store,mission,result||events);assert.throws(()=>store.get(mission.id),error=>error instanceof Error&&error.message==='INVALID_MISSION_SHAPE')}}));
