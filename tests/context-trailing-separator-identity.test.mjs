import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {WorkspaceService} from '../core/workspace.mjs';

function fixture(){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'twc-context-trailing-'));
  fs.mkdirSync(path.join(root,'src'));
  fs.writeFileSync(path.join(root,'src/a.js'),'export const a=1;\n');
  return {root,workspace:new WorkspaceService(root)};
}

test('context bundle canonicalizes a trailing separator to the regular-file path identity',()=>{
  const {workspace}=fixture();
  const out=workspace.contextBundle(['src/a.js/']);
  assert.deepEqual(out.files,[{path:'src/a.js',content:'export const a=1;\n'}]);
});

test('plain and trailing-separator aliases consume one context slot',()=>{
  const {workspace}=fixture();
  const out=workspace.contextBundle(['src/a.js/','src/a.js'],{maxFiles:2});
  assert.equal(out.files.length,1);
  assert.equal(out.files[0].path,'src/a.js');
});
