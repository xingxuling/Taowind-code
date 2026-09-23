import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {AutonomousMissionStore} from '../core/autonomous-supervisor.mjs';

function withStore(fn){const root=fs.mkdtempSync(path.join(os.tmpdir(),'taowind-mission-event-'));const store=new AutonomousMissionStore(root);try{return fn(store)}finally{fs.rmSync(root,{recursive:true,force:true})}}

test('update rejects an empty event type before persistence',()=>withStore(store=>{const mission=store.create('goal');assert.throws(()=>store.update(mission.id,{blocker:'changed'},'',{}),/INVALID_MISSION_EVENT/);const durable=store.get(mission.id);assert.equal(durable.blocker,null);assert.equal(durable.events.length,1)}));
test('non-empty event types remain writable',()=>withStore(store=>{const mission=store.create('goal');const updated=store.update(mission.id,{blocker:'x'},'MISSION_TEST',{});assert.equal(updated.events.at(-1).type,'MISSION_TEST');assert.equal(store.get(mission.id).events.at(-1).type,'MISSION_TEST')}));
