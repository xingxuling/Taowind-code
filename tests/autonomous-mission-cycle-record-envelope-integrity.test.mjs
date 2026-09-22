import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {AutonomousMissionStore} from '../core/autonomous-supervisor.mjs';

function withStore(fn){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'twc-mission-cycle-record-'));try{return fn(new AutonomousMissionStore(dir),dir)}finally{fs.rmSync(dir,{recursive:true,force:true})}}
function rewrite(store,mission,mutate){const file=store.file(mission.id);const doc=JSON.parse(fs.readFileSync(file,'utf8'));mutate(doc);fs.writeFileSync(file,JSON.stringify(doc,null,2))}
function validRecord(){return {index:1,runId:'run-one',goal:'ship a real artifact',mode:'DEEP_DEVELOPMENT',status:'READY_FOR_DELIVERY',closedAt:'2026-09-22T00:00:00.000Z',assessment:{closed:false,confidence:.6}}}

test('durable mission cycle record keeps the supervisor envelope',()=>withStore(store=>{const mission=store.create('x');const record=validRecord();const completed=store.update(mission.id,{cycle:1,cycles:[record],closure:{runId:'run-one'}},'MISSION_CYCLE_TEST',{});assert.equal(completed.cycles[0].goal,record.goal);assert.equal(completed.cycles[0].mode,record.mode);assert.equal(completed.cycles[0].status,record.status)}));

test('durable mission cycle record fails closed on envelope drift',()=>withStore(store=>{const cases=[doc=>{doc.cycles[0].goal='   '},doc=>{doc.cycles[0].mode='UNKNOWN'},doc=>{doc.cycles[0].status='FAILED'},doc=>{doc.cycles[0].closedAt=''},doc=>{delete doc.cycles[0].assessment}];for(const mutate of cases){const mission=store.create('x');const record=validRecord();const completed=store.update(mission.id,{cycle:1,cycles:[record],closure:{runId:'run-one'}},'MISSION_CYCLE_TEST',{});rewrite(store,completed,mutate);assert.throws(()=>store.get(mission.id),error=>error instanceof Error&&error.message==='INVALID_MISSION_SHAPE')}}));
