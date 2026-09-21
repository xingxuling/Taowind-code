import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ChangesetStore} from '../core/changesets.mjs';

test('rollback restores original non-UTF8 file bytes exactly',()=>{
  const base=fs.mkdtempSync(path.join(os.tmpdir(),'twc-binary-rollback-'));
  const workspace=path.join(base,'repo'),runtime=path.join(base,'runtime');
  fs.mkdirSync(workspace);
  const original=Buffer.from([0xff,0xfe,0x00,0x80,0x41,0xc3,0x28]);
  fs.writeFileSync(path.join(workspace,'asset.bin'),original);
  const store=new ChangesetStore(runtime,workspace);
  const cs=store.stage('run-binary-rollback',[{op:'write',path:'asset.bin',content:'replacement'}]);
  store.apply(cs.id);
  store.rollback(cs.id);
  assert.deepEqual(fs.readFileSync(path.join(workspace,'asset.bin')),original);
});
