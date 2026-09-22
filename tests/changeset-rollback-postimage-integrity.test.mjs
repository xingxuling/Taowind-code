import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {ChangesetStore} from '../core/changesets.mjs';

const sha256=value=>crypto.createHash('sha256').update(value).digest('hex');
function withStore(fn){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'taowind-rollback-postimage-'));
  const runtime=path.join(root,'runtime');
  const workspace=path.join(root,'workspace');
  const store=new ChangesetStore(runtime,workspace);
  try{return fn(store,workspace)}finally{fs.rmSync(root,{recursive:true,force:true})}
}

test('rollback rejects a persisted postimage whose metadata was coherently rebound away from its staged bytes before restoring anything',()=>withStore((store,workspace)=>{
  fs.mkdirSync(path.join(workspace,'src'),{recursive:true});
  fs.writeFileSync(path.join(workspace,'src','value.mjs'),'export const value=1;\n');
  const staged=store.stage('run-rollback-postimage',[{op:'write',path:'src/value.mjs',content:'export const value=2;\n'}]);
  store.apply(staged.id);
  const external=Buffer.from('export const value=3;\n');
  fs.writeFileSync(path.join(workspace,'src','value.mjs'),external);
  const doc=store.get(staged.id);
  doc.changes[0].after.sha256=sha256(external);
  doc.applyReceipt.files[0].sha256=sha256(external);
  doc.applyReceipt.receiptSha256=sha256(Buffer.from(JSON.stringify(doc.applyReceipt.files),'utf8'));
  fs.writeFileSync(store.file(staged.id),JSON.stringify(doc,null,2));
  assert.throws(()=>store.rollback(staged.id),error=>error instanceof Error&&error.message==='CHANGESET_POSTIMAGE_CORRUPT:src/value.mjs');
  assert.equal(fs.readFileSync(path.join(workspace,'src','value.mjs'),'utf8'),'export const value=3;\n');
}));

test('an intact persisted postimage still permits rollback to the exact original bytes',()=>withStore((store,workspace)=>{
  fs.mkdirSync(path.join(workspace,'src'),{recursive:true});
  fs.writeFileSync(path.join(workspace,'src','value.mjs'),'export const value=1;\n');
  const staged=store.stage('run-intact-rollback-postimage',[{op:'write',path:'src/value.mjs',content:'export const value=2;\n'}]);
  store.apply(staged.id);
  const rolled=store.rollback(staged.id);
  assert.equal(rolled.status,'ROLLED_BACK');
  assert.equal(fs.readFileSync(path.join(workspace,'src','value.mjs'),'utf8'),'export const value=1;\n');
}));
