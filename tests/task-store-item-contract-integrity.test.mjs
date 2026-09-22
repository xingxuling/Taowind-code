import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {TaskStore} from '../core/tasks.mjs';

function withStore(fn){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'twc-task-contract-'));try{return fn(new TaskStore(dir),dir)}finally{fs.rmSync(dir,{recursive:true,force:true})}}

test('durable task items must satisfy the published required fields and status enum',()=>withStore((store,dir)=>{fs.writeFileSync(path.join(dir,'tasks.json'),JSON.stringify([{id:'task-x',status:'queued'}]));assert.throws(()=>store.load(),error=>error instanceof Error&&error.message==='TASK_STORE_CORRUPT')}));
test('write boundary rejects invalid task status, progress, and evidence items before persistence',()=>withStore(store=>{const valid={id:'task-x',title:'x',status:'queued',progress:0,evidence:['ev-1']};store.replace([valid]);for(const bad of [{...valid,status:'mystery'},{...valid,progress:2},{...valid,evidence:[{id:'ev'}]}])assert.throws(()=>store.replace([bad]),error=>error instanceof Error&&error.message==='INVALID_TASK');assert.deepEqual(store.load(),[valid])}));
test('planned tasks remain valid under the published contract',()=>withStore(store=>{const tasks=store.plan('x',{mode:'NORTH_STAR'});assert.equal(tasks.length,7);assert.deepEqual(store.load(),tasks);for(const task of tasks){assert.equal(typeof task.id,'string');assert.equal(typeof task.title,'string');assert.ok(['queued','running','blocked','done','failed'].includes(task.status));assert.ok(task.progress>=0&&task.progress<=1)}}));
