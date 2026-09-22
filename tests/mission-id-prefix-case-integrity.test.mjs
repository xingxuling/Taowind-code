import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {AutonomousMissionStore} from '../core/autonomous-supervisor.mjs';

test('mission storage id preserves lowercase published prefix semantics',()=>{
  const base=fs.mkdtempSync(path.join(os.tmpdir(),'twc-mission-id-prefix-'));
  try{
    const store=new AutonomousMissionStore(base);
    assert.doesNotThrow(()=>store.file('mission-abc123'));
    assert.doesNotThrow(()=>store.file('mission-ABC123'));
    assert.throws(()=>store.file('MISSION-abc123'),error=>error?.message==='INVALID_MISSION_ID');
  }finally{fs.rmSync(base,{recursive:true,force:true});}
});
