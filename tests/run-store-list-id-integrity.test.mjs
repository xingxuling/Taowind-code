import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {RunStore} from '../core/run-store.mjs';

function withStore(fn){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'taowind-run-list-'));
  try{return fn(new RunStore(root),root)}finally{fs.rmSync(root,{recursive:true,force:true})}
}

test('list fails closed when a durable run body id does not match its filename id',()=>withStore((store)=>{
  const created=store.create({goal:'list only identity-bound runs'});
  const file=store.file(created.id);
  const doc=JSON.parse(fs.readFileSync(file,'utf8'));
  doc.id=`${created.id}-forged`;
  fs.writeFileSync(file,JSON.stringify(doc,null,2));
  assert.throws(()=>store.list(),error=>error instanceof Error&&error.message==='RUN_ID_MISMATCH');
}));

test('list still returns intact runs ordered by updatedAt',()=>withStore((store)=>{
  const first=store.create({goal:'first'});
  const second=store.create({goal:'second'});
  store.update(first.id,{message:'newer'});
  const rows=store.list();
  assert.equal(rows.length,2);
  assert.equal(rows[0].id,first.id);
  assert.equal(rows[1].id,second.id);
}));
