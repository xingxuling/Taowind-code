import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {AutonomousMissionStore} from '../core/autonomous-supervisor.mjs';

const ISO=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
function withStore(fn){const root=fs.mkdtempSync(path.join(os.tmpdir(),'taowind-mission-time-'));const store=new AutonomousMissionStore(root);try{return fn(store)}finally{fs.rmSync(root,{recursive:true,force:true})}}
function rewrite(store,id,mutate){const file=store.file(id);const doc=JSON.parse(fs.readFileSync(file,'utf8'));mutate(doc);fs.writeFileSync(file,JSON.stringify(doc,null,2))}
function seedCycle(doc){const assessment={closed:false};const runId='run-a';doc.cycle=1;doc.cycles=[{index:1,runId,goal:doc.rootGoal,mode:'WHOLE_ARTIFACT',status:'READY_FOR_DELIVERY',closedAt:doc.updatedAt,assessment}];doc.closure={runId,at:doc.updatedAt,assessment}}

test('get rejects a non-canonical mission createdAt',()=>withStore(store=>{const mission=store.create('goal');rewrite(store,mission.id,doc=>{doc.createdAt='not-a-date'});assert.throws(()=>store.get(mission.id),/INVALID_MISSION_SHAPE/)}));
test('get rejects a non-canonical event timestamp',()=>withStore(store=>{const mission=store.create('goal');rewrite(store,mission.id,doc=>{doc.events[0].at='2026-01-01T00:00:00Z'});assert.throws(()=>store.get(mission.id),/INVALID_MISSION_SHAPE/)}));
test('get rejects a non-canonical evidence timestamp',()=>withStore(store=>{const mission=store.create('goal');store.addEvidence(mission.id,{kind:'test'});rewrite(store,mission.id,doc=>{doc.evidence[0].at='bad'});assert.throws(()=>store.get(mission.id),/INVALID_MISSION_SHAPE/)}));
test('get rejects non-canonical cycle and closure timestamps',()=>withStore(store=>{const mission=store.create('goal');rewrite(store,mission.id,doc=>{seedCycle(doc);doc.cycles[0].closedAt='bad'});assert.throws(()=>store.get(mission.id),/INVALID_MISSION_SHAPE/)}));
test('writer-produced mission timestamps remain canonical ISO UTC milliseconds',()=>withStore(store=>{let mission=store.create('goal');mission=store.addEvidence(mission.id,{kind:'test'});assert.ok(ISO.test(mission.createdAt));assert.ok(ISO.test(mission.updatedAt));assert.ok(mission.events.every(event=>ISO.test(event.at)));assert.ok(mission.evidence.every(item=>ISO.test(item.at)))}));
