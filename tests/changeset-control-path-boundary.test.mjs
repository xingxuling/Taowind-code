import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ChangesetStore} from '../core/changesets.mjs';

function withStore(fn){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'taowind-changeset-boundary-'));
  const runtime=path.join(root,'runtime');
  const workspace=path.join(root,'workspace');
  try{return fn(new ChangesetStore(runtime,workspace),workspace)}finally{fs.rmSync(root,{recursive:true,force:true})}
}

test('changeset staging fails closed on case variants of control-plane path segments',()=>withStore(store=>{
  for(const blocked of ['.git/config','.GIT/config','src/.GiT/hooks/pre-commit','NODE_MODULES/pkg/index.js','.NeXt/cache/meta']){
    assert.throws(
      ()=>store.stage('run-boundary',[{op:'write',path:blocked,content:'blocked'}]),
      error=>error instanceof Error&&error.message===`BLOCKED_CHANGE_PATH:${blocked}`,
      blocked,
    );
  }
}));

test('changeset staging still accepts an ordinary repository file',()=>withStore(store=>{
  const staged=store.stage('run-ordinary',[{op:'write',path:'src/ok.mjs',content:'export const ok=true;\n'}]);
  assert.equal(staged.status,'STAGED');
  assert.deepEqual(staged.changes.map(change=>change.path),['src/ok.mjs']);
}));
