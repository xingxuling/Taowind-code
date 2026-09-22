import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {RunStore} from '../core/run-store.mjs';

test('run storage id preserves lowercase published prefix semantics',()=>{
  const base=fs.mkdtempSync(path.join(os.tmpdir(),'twc-run-id-prefix-'));
  try{
    const store=new RunStore(base);
    assert.doesNotThrow(()=>store.file('run-abc123'));
    assert.doesNotThrow(()=>store.file('run-ABC123'));
    assert.throws(()=>store.file('RUN-abc123'),error=>error?.message==='INVALID_RUN_ID');
  }finally{fs.rmSync(base,{recursive:true,force:true});}
});
