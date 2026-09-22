import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {AutonomousMissionStore} from '../core/autonomous-supervisor.mjs';

function withStore(fn){const root=fs.mkdtempSync(path.join(os.tmpdir(),'twc-mission-id-'));try{return fn(new AutonomousMissionStore(root),root)}finally{fs.rmSync(root,{recursive:true,force:true})}}

test('durable mission body id must match selected storage id',()=>withStore((store)=>{
  const created=store.create('keep mission identity bound');
  const file=store.file(created.id);
  const doc=JSON.parse(fs.readFileSync(file,'utf8'));
  doc.id=`${created.id}-other`;
  fs.writeFileSync(file,JSON.stringify(doc,null,2));
  assert.throws(()=>store.get(created.id),error=>error instanceof Error&&error.message==='MISSION_ID_MISMATCH');
}));

test('matching durable mission id remains readable',()=>withStore((store)=>{
  const created=store.create('keep intact mission usable');
  assert.equal(store.get(created.id).id,created.id);
}));
