import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {AutonomousMissionStore} from '../core/autonomous-supervisor.mjs';

function withStore(fn){const root=fs.mkdtempSync(path.join(os.tmpdir(),'twc-mission-list-'));try{return fn(new AutonomousMissionStore(root),root)}finally{fs.rmSync(root,{recursive:true,force:true})}}

test('mission list fails closed when durable body id differs from filename id',()=>withStore((store)=>{
  const created=store.create('list only identity-bound missions');
  const file=store.file(created.id);
  const doc=JSON.parse(fs.readFileSync(file,'utf8'));
  doc.id=`${created.id}-forged`;
  fs.writeFileSync(file,JSON.stringify(doc,null,2));
  assert.throws(()=>store.list(),error=>error instanceof Error&&error.message==='MISSION_ID_MISMATCH');
}));

test('mission list still returns intact missions',()=>withStore((store)=>{
  const first=store.create('first');
  const second=store.create('second');
  const rows=store.list();
  assert.equal(rows.length,2);
  assert.deepEqual(new Set(rows.map(row=>row.id)),new Set([first.id,second.id]));
}));
