import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ChangesetStore} from '../core/changesets.mjs';

function withStore(fn){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'taowind-staged-postimage-'));
  const runtime=path.join(root,'runtime');
  const workspace=path.join(root,'workspace');
  const store=new ChangesetStore(runtime,workspace);
  try{return fn(store,workspace)}finally{fs.rmSync(root,{recursive:true,force:true})}
}

test('apply rejects a persisted write whose staged content no longer matches its recorded postimage',()=>withStore((store,workspace)=>{
  const staged=store.stage('run-postimage',[{op:'write',path:'src/value.mjs',content:'export const value=1;\n'}]);
  const doc=store.get(staged.id);
  doc.changes[0].after.contentBase64=Buffer.from('export const value=999;\n').toString('base64');
  fs.writeFileSync(store.file(staged.id),JSON.stringify(doc,null,2));
  assert.throws(()=>store.apply(staged.id),error=>error instanceof Error&&error.message==='CHANGESET_POSTIMAGE_CORRUPT:src/value.mjs');
  assert.equal(fs.existsSync(path.join(workspace,'src','value.mjs')),false);
}));

test('an intact staged postimage still applies normally',()=>withStore((store,workspace)=>{
  const staged=store.stage('run-intact',[{op:'write',path:'src/value.mjs',content:'export const value=1;\n'}]);
  const applied=store.apply(staged.id);
  assert.equal(applied.status,'APPLIED');
  assert.equal(fs.readFileSync(path.join(workspace,'src','value.mjs'),'utf8'),'export const value=1;\n');
}));
