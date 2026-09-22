import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ChangesetStore} from '../core/changesets.mjs';

function fixture(){
  const base=fs.mkdtempSync(path.join(os.tmpdir(),'twc-cs-trailing-'));
  const workspace=path.join(base,'repo'),runtime=path.join(base,'runtime');
  fs.mkdirSync(workspace);return {workspace,runtime};
}

test('stage canonicalizes a trailing separator to the file identity used by apply and delivery',()=>{
  const f=fixture(),store=new ChangesetStore(f.runtime,f.workspace);
  const cs=store.stage('run-trailing',[{op:'write',path:'node/',content:'value\n'}]);
  assert.equal(cs.changes[0].path,'node');
  store.apply(cs.id);
  assert.equal(fs.readFileSync(path.join(f.workspace,'node'),'utf8'),'value\n');
});

test('trailing-separator alias is rejected as the same canonical change target',()=>{
  const f=fixture(),store=new ChangesetStore(f.runtime,f.workspace);
  assert.throws(()=>store.stage('run-trailing-duplicate',[
    {op:'write',path:'node',content:'first\n'},
    {op:'write',path:'node/',content:'second\n'},
  ]),/DUPLICATE_CHANGE_PATH:node/);
});
