import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ChangesetStore} from '../core/changesets.mjs';

function fixture(){
  const base=fs.mkdtempSync(path.join(os.tmpdir(),'twc-file-mode-'));
  const workspace=path.join(base,'repo'),runtime=path.join(base,'runtime');
  fs.mkdirSync(workspace);
  return {workspace,runtime};
}
function mode(file){return fs.statSync(file).mode&0o7777}

test('transactional write preserves an existing executable file mode through apply and rollback',t=>{
  if(process.platform==='win32'){t.skip('POSIX mode semantics are not equivalent on Windows');return}
  const f=fixture(),file=path.join(f.workspace,'tool.sh');
  fs.writeFileSync(file,'#!/bin/sh\necho old\n');fs.chmodSync(file,0o755);
  const store=new ChangesetStore(f.runtime,f.workspace);
  const cs=store.stage('run-mode-write',[{op:'write',path:'tool.sh',content:'#!/bin/sh\necho new\n'}]);
  store.apply(cs.id);assert.equal(mode(file),0o755);
  store.rollback(cs.id);assert.equal(mode(file),0o755);assert.equal(fs.readFileSync(file,'utf8'),'#!/bin/sh\necho old\n');
});

test('rollback restores the original mode of a deleted regular file',t=>{
  if(process.platform==='win32'){t.skip('POSIX mode semantics are not equivalent on Windows');return}
  const f=fixture(),file=path.join(f.workspace,'tool.sh');
  fs.writeFileSync(file,'#!/bin/sh\necho old\n');fs.chmodSync(file,0o750);
  const store=new ChangesetStore(f.runtime,f.workspace);
  const cs=store.stage('run-mode-delete',[{op:'delete',path:'tool.sh'}]);
  store.apply(cs.id);assert.equal(fs.existsSync(file),false);
  store.rollback(cs.id);assert.equal(mode(file),0o750);assert.equal(fs.readFileSync(file,'utf8'),'#!/bin/sh\necho old\n');
});

test('apply fails closed when a staged file mode changes before mutation',t=>{
  if(process.platform==='win32'){t.skip('POSIX mode semantics are not equivalent on Windows');return}
  const f=fixture(),file=path.join(f.workspace,'tool.sh');
  fs.writeFileSync(file,'#!/bin/sh\necho old\n');fs.chmodSync(file,0o755);
  const store=new ChangesetStore(f.runtime,f.workspace);
  const cs=store.stage('run-mode-conflict',[{op:'write',path:'tool.sh',content:'#!/bin/sh\necho new\n'}]);
  fs.chmodSync(file,0o700);
  assert.throws(()=>store.apply(cs.id),/APPLY_CONFLICT:tool\.sh/);
  assert.equal(mode(file),0o700);assert.equal(fs.readFileSync(file,'utf8'),'#!/bin/sh\necho old\n');assert.equal(store.get(cs.id).status,'STAGED');
});
