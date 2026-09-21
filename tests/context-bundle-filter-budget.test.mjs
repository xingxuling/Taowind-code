import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {WorkspaceService} from '../core/workspace.mjs';

test('rejected context paths do not consume the maxFiles admission budget',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'twc-context-budget-'));
  fs.mkdirSync(path.join(root,'src'),{recursive:true});
  fs.writeFileSync(path.join(root,'src','main.js'),'export const ok=true;\n');
  const rejected=Array.from({length:32},(_,i)=>`secrets/token-${i}.txt`);
  const out=new WorkspaceService(root).contextBundle([...rejected,'src/main.js'],{maxFiles:32,maxBytes:100000});
  assert.deepEqual(out.files.map(x=>x.path),['src/main.js']);
});
