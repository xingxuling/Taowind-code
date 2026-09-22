import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {AutonomousMissionStore} from '../core/autonomous-supervisor.mjs';

function withStore(fn){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'twc-mission-evidence-'));try{return fn(new AutonomousMissionStore(dir),dir)}finally{fs.rmSync(dir,{recursive:true,force:true})}}

test('mission evidence keeps store-owned id and timestamp',()=>withStore(store=>{const mission=store.create('x');const forgedAt='2000-01-01T00:00:00.000Z';const updated=store.addEvidence(mission.id,{id:'mev-forged',at:forgedAt,kind:'probe',payload:{ok:true}});const item=updated.evidence.at(-1);assert.match(item.id,/^mev-[0-9a-f]{12}$/);assert.notEqual(item.id,'mev-forged');assert.notEqual(item.at,forgedAt);assert.equal(item.kind,'probe');assert.deepEqual(item.payload,{ok:true});const event=updated.events.at(-1);assert.equal(event.type,'MISSION_EVIDENCE');assert.equal(event.data.evidenceId,item.id)}));

test('ordinary mission evidence payload remains intact',()=>withStore(store=>{const mission=store.create('x');const updated=store.addEvidence(mission.id,{kind:'goal-closure-assessment',runId:'run-demo',assessment:{closed:false,confidence:.4}});const item=updated.evidence.at(-1);assert.equal(item.kind,'goal-closure-assessment');assert.equal(item.runId,'run-demo');assert.deepEqual(item.assessment,{closed:false,confidence:.4})}));
