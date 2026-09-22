import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {ChangesetStore} from '../core/changesets.mjs';

const sha256=value=>crypto.createHash('sha256').update(value).digest('hex');
function withStore(fn){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'taowind-apply-file-budget-'));
  const runtime=path.join(root,'runtime');
  const workspace=path.join(root,'workspace');
  const store=new ChangesetStore(runtime,workspace);
  try{return fn(store,workspace)}finally{fs.rmSync(root,{recursive:true,force:true})}
}

test('apply rejects a coherently enlarged persisted postimage above the stage-time single-file budget',()=>withStore((store,workspace)=>{
  const staged=store.stage('run-file-budget',[{op:'write',path:'src/value.mjs',content:'x\n'}]);
  const doc=store.get(staged.id);
  const big=Buffer.alloc(2_000_001,0x61);
  doc.changes[0].after.contentBase64=big.toString('base64');
  doc.changes[0].after.size=big.length;
  doc.changes[0].after.sha256=sha256(big);
  fs.writeFileSync(store.file(staged.id),JSON.stringify(doc));
  assert.throws(()=>store.apply(staged.id),error=>error instanceof Error&&error.message==='CHANGE_FILE_TOO_LARGE');
  assert.equal(fs.existsSync(path.join(workspace,'src','value.mjs')),false);
}));

test('a persisted postimage at the stage-time single-file limit still applies',()=>withStore((store,workspace)=>{
  const payload='a'.repeat(2_000_000);
  const staged=store.stage('run-file-budget-ok',[{op:'write',path:'src/value.mjs',content:payload}]);
  const applied=store.apply(staged.id);
  assert.equal(applied.status,'APPLIED');
  assert.equal(fs.statSync(path.join(workspace,'src','value.mjs')).size,2_000_000);
}));
