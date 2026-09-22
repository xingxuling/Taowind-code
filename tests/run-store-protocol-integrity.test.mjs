import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import {RunStore} from '../core/run-store.mjs';

function withStore(fn){const root=fs.mkdtempSync(`${os.tmpdir()}/twc-run-protocol-`);try{return fn(new RunStore(root),root)}finally{fs.rmSync(root,{recursive:true,force:true})}}

test('unknown durable run protocol fails closed',()=>withStore((store)=>{
  const created=store.create({goal:'bind run protocol'});
  const file=store.file(created.id);
  const doc=JSON.parse(fs.readFileSync(file,'utf8'));
  doc.protocol='taowind-code.north-star-run.v9';
  fs.writeFileSync(file,JSON.stringify(doc,null,2));
  assert.throws(()=>store.get(created.id),error=>error instanceof Error&&error.message==='UNSUPPORTED_RUN_PROTOCOL');
}));

test('current durable run protocol remains readable and updateable',()=>withStore((store)=>{
  const created=store.create({goal:'keep current run usable',mode:'NORTH_STAR'});
  assert.equal(store.get(created.id).protocol,'taowind-code.north-star-run.v0.2');
  assert.equal(store.update(created.id,{status:'PLANNED'}).status,'PLANNED');
}));
