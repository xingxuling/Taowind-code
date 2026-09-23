import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ChangesetStore} from '../core/changesets.mjs';
import {sha256Buffer} from '../core/hash.mjs';

function withStore(fn){const root=fs.mkdtempSync(path.join(os.tmpdir(),'taowind-changeset-preimage-budget-'));const store=new ChangesetStore(path.join(root,'runtime'),path.join(root,'workspace'));try{return fn(store)}finally{fs.rmSync(root,{recursive:true,force:true})}}
function rewriteBefore(store,id,bytes){const file=store.file(id);const doc=JSON.parse(fs.readFileSync(file,'utf8'));doc.changes[0].before.sha256=sha256Buffer(bytes);doc.changes[0].before.size=bytes.length;doc.changes[0].before.contentBase64=bytes.toString('base64');fs.writeFileSync(file,JSON.stringify(doc,null,2))}

test('get rejects a self-consistent durable preimage above the existing per-file budget',()=>withStore(store=>{store.workspace.write('a.txt','seed');const staged=store.stage('run-preimage-budget-over',[{op:'write',path:'a.txt',content:'next'}]);rewriteBefore(store,staged.id,Buffer.alloc(2_000_001,0x61));assert.throws(()=>store.get(staged.id),/CHANGE_FILE_TOO_LARGE/)}));
test('get accepts a self-consistent durable preimage exactly at the existing per-file budget',()=>withStore(store=>{store.workspace.write('a.txt','seed');const staged=store.stage('run-preimage-budget-edge',[{op:'write',path:'a.txt',content:'next'}]);rewriteBefore(store,staged.id,Buffer.alloc(2_000_000,0x61));assert.equal(store.get(staged.id).changes[0].before.size,2_000_000)}));
