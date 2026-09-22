import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ChangesetStore} from '../core/changesets.mjs';

function withStore(fn){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'taowind-apply-pathset-'));
  const runtime=path.join(root,'runtime');
  const workspace=path.join(root,'workspace');
  const store=new ChangesetStore(runtime,workspace);
  try{return fn(store,workspace)}finally{fs.rmSync(root,{recursive:true,force:true})}
}

test('apply rejects duplicated persisted paths before workspace mutation',()=>withStore((store,workspace)=>{
  fs.mkdirSync(path.join(workspace,'src'),{recursive:true});
  fs.writeFileSync(path.join(workspace,'src','value.mjs'),'one\n');
  const staged=store.stage('run-dup',[{op:'write',path:'src/value.mjs',content:'two\n'}]);
  const doc=store.get(staged.id);
  doc.changes.push(structuredClone(doc.changes[0]));
  fs.writeFileSync(store.file(staged.id),JSON.stringify(doc,null,2));
  assert.throws(()=>store.apply(staged.id),error=>error instanceof Error&&error.message==='DUPLICATE_CHANGE_PATH:src/value.mjs');
  assert.equal(fs.readFileSync(path.join(workspace,'src','value.mjs'),'utf8'),'one\n');
}));

test('apply rejects persisted overlapping paths before any partial write',()=>withStore((store,workspace)=>{
  const staged=store.stage('run-overlap',[{op:'write',path:'src/dir',content:'parent\n'},{op:'write',path:'src/other/file.mjs',content:'child\n'}]);
  const doc=store.get(staged.id);
  doc.changes[1].path='src/dir/file.mjs';
  fs.writeFileSync(store.file(staged.id),JSON.stringify(doc,null,2));
  assert.throws(()=>store.apply(staged.id),error=>error instanceof Error&&error.message==='OVERLAPPING_CHANGE_PATH:src/dir:src/dir/file.mjs');
  assert.equal(fs.existsSync(path.join(workspace,'src','dir')),false);
  assert.equal(fs.existsSync(path.join(workspace,'src','dir','file.mjs')),false);
}));
