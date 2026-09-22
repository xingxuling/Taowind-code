import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {ChangesetStore} from '../core/changesets.mjs';

const sha256=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function withStore(fn){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'taowind-legacy-changeset-'));
  const runtime=path.join(root,'runtime');
  const workspace=path.join(root,'workspace');
  const store=new ChangesetStore(runtime,workspace);
  try{return fn(store,workspace)}finally{fs.rmSync(root,{recursive:true,force:true})}
}
function writeDoc(store,doc){fs.writeFileSync(store.file(doc.id),JSON.stringify(doc,null,2))}

test('apply revalidates the control-path boundary for a legacy staged changeset',()=>withStore((store,workspace)=>{
  const gitDir=path.join(workspace,'.git');fs.mkdirSync(gitDir,{recursive:true});
  const target=path.join(gitDir,'config');const beforeBytes=Buffer.from('original\n');const afterBytes=Buffer.from('mutated\n');fs.writeFileSync(target,beforeBytes);
  const before=store.workspace.stat('.git/config');
  writeDoc(store,{id:'cs-deadbeef',status:'STAGED',changes:[{op:'write',path:'.git/config',before:{exists:true,type:'file',sha256:before.sha256,size:before.size,identity:before.identity,mode:before.mode,contentBase64:beforeBytes.toString('base64')},after:{sha256:sha256(afterBytes),size:afterBytes.length,contentBase64:afterBytes.toString('base64')}}]});
  assert.throws(()=>store.apply('cs-deadbeef'),error=>error instanceof Error&&error.message==='BLOCKED_CHANGE_PATH:.git/config');
  assert.equal(fs.readFileSync(target,'utf8'),'original\n');
}));

test('rollback remains available for an already-applied legacy control-path changeset',()=>withStore((store,workspace)=>{
  const gitDir=path.join(workspace,'.git');fs.mkdirSync(gitDir,{recursive:true});
  const target=path.join(gitDir,'config');const beforeBytes=Buffer.from('original\n');const afterBytes=Buffer.from('mutated\n');fs.writeFileSync(target,afterBytes);
  const current=store.workspace.stat('.git/config');
  writeDoc(store,{id:'cs-feedface',status:'APPLIED',changes:[{op:'write',path:'.git/config',before:{exists:true,type:'file',sha256:sha256(beforeBytes),size:beforeBytes.length,identity:null,mode:current.mode,contentBase64:beforeBytes.toString('base64')},after:{sha256:current.sha256,size:afterBytes.length,contentBase64:afterBytes.toString('base64')}}],applyReceipt:{files:[{path:'.git/config',op:'write',sha256:current.sha256,exists:true,identity:current.identity,mode:current.mode}]}});
  const rolled=store.rollback('cs-feedface');
  assert.equal(rolled.status,'ROLLED_BACK');
  assert.equal(fs.readFileSync(target,'utf8'),'original\n');
}));
