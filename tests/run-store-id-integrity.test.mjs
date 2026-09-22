import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {RunStore} from '../core/run-store.mjs';

function withStore(fn){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'taowind-run-store-'));
  try{return fn(new RunStore(root),root)}finally{fs.rmSync(root,{recursive:true,force:true})}
}

test('durable run body id must match selected storage id',()=>withStore((store)=>{
  const created=store.create({goal:'keep identity bound'});
  const file=store.file(created.id);
  const doc=JSON.parse(fs.readFileSync(file,'utf8'));
  doc.id=`${created.id}-other`;
  fs.writeFileSync(file,JSON.stringify(doc,null,2));
  assert.throws(()=>store.get(created.id),error=>error instanceof Error&&error.message==='RUN_ID_MISMATCH');
}));

test('matching durable run id remains readable and updateable',()=>withStore((store)=>{
  const created=store.create({goal:'keep valid run usable'});
  assert.equal(store.get(created.id).id,created.id);
  const updated=store.update(created.id,{status:'PLANNED'});
  assert.equal(updated.id,created.id);
  assert.equal(updated.status,'PLANNED');
}));
