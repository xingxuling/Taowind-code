import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {AutonomousMissionStore} from '../core/autonomous-supervisor.mjs';

function withStore(fn){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'twc-mission-cycle-'));try{return fn(new AutonomousMissionStore(dir),dir)}finally{fs.rmSync(dir,{recursive:true,force:true})}}
function rewrite(store,mission,mutate){const file=store.file(mission.id);const doc=JSON.parse(fs.readFileSync(file,'utf8'));mutate(doc);fs.writeFileSync(file,JSON.stringify(doc,null,2))}

test('mission cycle ledger starts aligned at zero',()=>withStore(store=>{const mission=store.create('x');assert.equal(mission.cycle,0);assert.deepEqual(mission.cycles,[])}));

test('durable mission cycle ledger fails closed on count or index drift',()=>withStore(store=>{const cases=[doc=>{doc.cycle=1},doc=>{doc.cycles=[{index:2,runId:'run-demo'}];doc.cycle=1},doc=>{doc.cycles=[{runId:'run-demo'}];doc.cycle=1}];for(const mutate of cases){const mission=store.create('x');rewrite(store,mission,mutate);assert.throws(()=>store.get(mission.id),error=>error instanceof Error&&error.message==='INVALID_MISSION_SHAPE')}}));
