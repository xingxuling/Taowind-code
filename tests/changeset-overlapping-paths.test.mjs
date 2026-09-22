import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ChangesetStore} from '../core/changesets.mjs';

function fixture(){
  const base=fs.mkdtempSync(path.join(os.tmpdir(),'twc-cs-overlap-'));
  const workspace=path.join(base,'repo'),runtime=path.join(base,'runtime');
  fs.mkdirSync(workspace);return {workspace,runtime};
}

test('stage rejects a new file path that is also an ancestor of another change',()=>{
  const f=fixture(),store=new ChangesetStore(f.runtime,f.workspace);
  assert.throws(()=>store.stage('run-overlap-parent-first',[
    {op:'write',path:'node',content:'parent file'},
    {op:'write',path:'node/child.txt',content:'child file'},
  ]),/OVERLAPPING_CHANGE_PATH:node:node\/child\.txt/);
  assert.equal(fs.existsSync(path.join(f.workspace,'node')),false);
});

test('stage rejects the same hierarchical collision independent of change order',()=>{
  const f=fixture(),store=new ChangesetStore(f.runtime,f.workspace);
  assert.throws(()=>store.stage('run-overlap-child-first',[
    {op:'write',path:'node/child.txt',content:'child file'},
    {op:'write',path:'node',content:'parent file'},
  ]),/OVERLAPPING_CHANGE_PATH:node\/child\.txt:node/);
  assert.equal(fs.existsSync(path.join(f.workspace,'node')),false);
});
