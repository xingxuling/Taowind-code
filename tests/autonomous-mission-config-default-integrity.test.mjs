import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {AutonomousMissionStore} from '../core/autonomous-supervisor.mjs';

function withStore(fn){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'twc-mission-config-default-'));try{return fn(new AutonomousMissionStore(dir))}finally{fs.rmSync(dir,{recursive:true,force:true})}}

test('mission config preserves historical empty/null defaults while rejecting non-finite propagation',()=>withStore(store=>{
  const a=store.create('x',{maxCycles:null,maxRepairs:null,closureThreshold:null});
  assert.equal(a.config.maxCycles,8);
  assert.equal(a.config.maxRepairs,2);
  assert.equal(a.config.closureThreshold,.8);
  const b=store.create('x',{maxCycles:'',closureThreshold:''});
  assert.equal(b.config.maxCycles,8);
  assert.equal(b.config.closureThreshold,.8);
  const c=store.create('x',{maxCycles:'not-a-number',maxRepairs:'not-a-number',closureThreshold:'not-a-number'});
  assert.equal(c.config.maxCycles,8);
  assert.equal(c.config.maxRepairs,2);
  assert.equal(c.config.closureThreshold,.8);
}));
