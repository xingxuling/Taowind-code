import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {ChangesetStore} from '../core/changesets.mjs';

const sha256=value=>crypto.createHash('sha256').update(value).digest('hex');
function withStore(fn){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'taowind-apply-total-budget-'));
  const runtime=path.join(root,'runtime');
  const workspace=path.join(root,'workspace');
  const store=new ChangesetStore(runtime,workspace);
  try{return fn(store,workspace)}finally{fs.rmSync(root,{recursive:true,force:true})}
}

test('apply rejects a coherently expanded persisted changeset above the stage-time aggregate byte budget before any writes',()=>withStore((store,workspace)=>{
  const staged=store.stage('run-total-budget',[{op:'write',path:'src/0.mjs',content:'x\n'}]);
  const doc=store.get(staged.id);
  const template=doc.changes[0];
  const payload=Buffer.alloc(1_700_000,0x61);
  doc.changes=Array.from({length:5},(_,i)=>{
    const c=structuredClone(template);
    c.path=`src/${i}.mjs`;
    c.after.contentBase64=payload.toString('base64');
    c.after.size=payload.length;
    c.after.sha256=sha256(payload);
    return c;
  });
  fs.writeFileSync(store.file(staged.id),JSON.stringify(doc));
  assert.throws(()=>store.apply(staged.id),error=>error instanceof Error&&error.message==='CHANGESET_TOO_LARGE');
  assert.equal(fs.existsSync(path.join(workspace,'src','0.mjs')),false);
  assert.equal(fs.existsSync(path.join(workspace,'src','4.mjs')),false);
}));

test('aggregate persisted postimages at the stage-time budget still apply',()=>withStore((store,workspace)=>{
  const payload='a'.repeat(1_600_000);
  const changes=Array.from({length:5},(_,i)=>({op:'write',path:`src/${i}.mjs`,content:payload}));
  const staged=store.stage('run-total-budget-ok',changes);
  const applied=store.apply(staged.id);
  assert.equal(applied.status,'APPLIED');
  assert.equal(fs.statSync(path.join(workspace,'src','4.mjs')).size,1_600_000);
}));
