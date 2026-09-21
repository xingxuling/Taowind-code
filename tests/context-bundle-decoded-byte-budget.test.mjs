import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {WorkspaceService} from '../core/workspace.mjs';

test('decoded context content cannot exceed maxBytes when invalid UTF-8 expands',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'twc-context-bytes-'));
  fs.mkdirSync(path.join(root,'src'),{recursive:true});
  fs.writeFileSync(path.join(root,'src','bad.txt'),Buffer.alloc(100,0xff));
  const out=new WorkspaceService(root).contextBundle(['src/bad.txt'],{maxFiles:4,maxBytes:150});
  assert.ok(out.totalBytes<=150);
  assert.deepEqual(out.files,[]);
});
