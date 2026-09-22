import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {AutonomousMissionStore} from '../core/autonomous-supervisor.mjs';

function withStore(fn){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'twc-mission-ledger-write-'));try{return fn(new AutonomousMissionStore(dir),dir)}finally{fs.rmSync(dir,{recursive:true,force:true})}}

test('generic mission update cannot replace store-owned event or evidence ledgers',()=>withStore(store=>{const mission=store.create('x');const before=store.get(mission.id);assert.throws(()=>store.update(mission.id,{events:[...before.events]},'MISSION_PROBE',{}),error=>error instanceof Error&&error.message==='MISSION_EVENTS_STORE_OWNED');assert.throws(()=>store.update(mission.id,{evidence:[{id:'mev-0123456789ab',at:'2026-01-01T00:00:00.000Z',kind:'forged'}]},'MISSION_PROBE',{}),error=>error instanceof Error&&error.message==='MISSION_EVIDENCE_STORE_OWNED');const after=store.get(mission.id);assert.deepEqual(after.events,before.events);assert.deepEqual(after.evidence,before.evidence)}));

test('dedicated writers still append events and evidence',()=>withStore(store=>{const mission=store.create('x');const withEvidence=store.addEvidence(mission.id,{kind:'probe'});assert.equal(withEvidence.evidence.length,1);assert.equal(withEvidence.events.at(-1).type,'MISSION_EVIDENCE');const updated=store.update(mission.id,{blocker:'probe'},'MISSION_PROBE',{ok:true});assert.equal(updated.blocker,'probe');assert.equal(updated.events.at(-1).type,'MISSION_PROBE')}));
