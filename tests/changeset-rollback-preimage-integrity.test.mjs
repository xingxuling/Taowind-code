import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ChangesetStore} from '../core/changesets.mjs';

function withStore(fn){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'taowind-rollback-preimage-'));
  const runtime=path.join(root,'runtime');
  const workspace=path.join(root,'workspace');
  const store=new ChangesetStore(runtime,workspace);
  try{return fn(store,workspace)}finally{fs.rmSync(root,{recursive:true,force:true})}
}

test('rollback rejects a persisted preimage whose bytes no longer match the recorded hash and leaves the applied file unchanged',()=>withStore((store,workspace)=>{
  fs.mkdirSync(path.join(workspace,'src'),{recursive:true});
  fs.writeFileSync(path.join(workspace,'src','value.mjs'),'export const value=1;\n');
  const staged=store.stage('run-preimage',[{op:'write',path:'src/value.mjs',content:'export const value=2;\n'}]);
  store.apply(staged.id);
  const doc=store.get(staged.id);
  doc.changes[0].before.contentBase64=Buffer.from('export const value=999;\n').toString('base64');
  fs.writeFileSync(store.file(staged.id),JSON.stringify(doc,null,2));
  assert.throws(()=>store.rollback(staged.id),error=>error instanceof Error&&error.message==='CHANGESET_PREIMAGE_CORRUPT:src/value.mjs');
  assert.equal(fs.readFileSync(path.join(workspace,'src','value.mjs'),'utf8'),'export const value=2;\n');
}));

test('an intact preimage still rolls an applied changeset back to the exact original bytes',()=>withStore((store,workspace)=>{
  fs.mkdirSync(path.join(workspace,'src'),{recursive:true});
  fs.writeFileSync(path.join(workspace,'src','value.mjs'),'export const value=1;\n');
  const staged=store.stage('run-intact-preimage',[{op:'write',path:'src/value.mjs',content:'export const value=2;\n'}]);
  store.apply(staged.id);
  const rolled=store.rollback(staged.id);
  assert.equal(rolled.status,'ROLLED_BACK');
  assert.equal(fs.readFileSync(path.join(workspace,'src','value.mjs'),'utf8'),'export const value=1;\n');
}));
