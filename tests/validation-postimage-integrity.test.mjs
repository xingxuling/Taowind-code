import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {WorkspaceService} from '../core/workspace.mjs';
import {captureValidationPostimage,compareValidationPostimage,enforceValidationPostimage} from '../core/validation-integrity.mjs';

function fixture(){const root=fs.mkdtempSync(path.join(os.tmpdir(),'twc-validation-integrity-'));fs.writeFileSync(path.join(root,'a.txt'),'applied\n');return {root,workspace:new WorkspaceService(root)}}

test('validation postimage integrity passes when protected paths remain unchanged',()=>{
  const f=fixture(),snapshot=captureValidationPostimage(f.workspace,['a.txt']);
  const result=compareValidationPostimage(f.workspace,snapshot);
  assert.equal(result.passed,true);assert.equal(result.checked,1);assert.deepEqual(result.drift,[]);
});

test('validation postimage integrity detects content mutation of a protected path',()=>{
  const f=fixture(),snapshot=captureValidationPostimage(f.workspace,['a.txt']);
  fs.writeFileSync(path.join(f.root,'a.txt'),'validator mutation\n');
  const integrity=compareValidationPostimage(f.workspace,snapshot);
  assert.equal(integrity.passed,false);assert.equal(integrity.drift.length,1);assert.equal(integrity.drift[0].path,'a.txt');assert.equal(integrity.drift[0].changed.includes('sha256'),true);
  const guarded=enforceValidationPostimage({status:'PASSED',passed:true,hardGate:'PASS',results:[],browser:{results:[]}},integrity);
  assert.equal(guarded.passed,false);assert.equal(guarded.status,'FAILED');assert.equal(guarded.hardGate,'VALIDATION_POSTIMAGE_DRIFT');
});

test('validation postimage integrity detects mode-only mutation on POSIX',t=>{
  if(process.platform==='win32'){t.skip('POSIX mode semantics are not equivalent on Windows');return}
  const f=fixture();fs.chmodSync(path.join(f.root,'a.txt'),0o644);const snapshot=captureValidationPostimage(f.workspace,['a.txt']);
  fs.chmodSync(path.join(f.root,'a.txt'),0o600);
  const result=compareValidationPostimage(f.workspace,snapshot);
  assert.equal(result.passed,false);assert.equal(result.drift[0].changed.includes('mode'),true);
});
