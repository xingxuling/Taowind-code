import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ChangesetStore} from '../core/changesets.mjs';

function withStore(fn){const root=fs.mkdtempSync(path.join(os.tmpdir(),'taowind-path-safety-'));const store=new ChangesetStore(path.join(root,'runtime'),path.join(root,'workspace'));try{return fn(store)}finally{fs.rmSync(root,{recursive:true,force:true})}}
function rewritePath(store,id,paths){const file=store.file(id);const doc=JSON.parse(fs.readFileSync(file,'utf8'));paths.forEach((value,index)=>{doc.changes[index].path=value});fs.writeFileSync(file,JSON.stringify(doc,null,2))}

test('get rejects a non-canonical relative path',()=>withStore(store=>{const staged=store.stage('run-path-dot',[{op:'write',path:'src/a.txt',content:'a'}]);rewritePath(store,staged.id,['./src/a.txt']);assert.throws(()=>store.get(staged.id),/INVALID_CHANGE_PATH/)}));
test('get rejects a path escaping the workspace',()=>withStore(store=>{const staged=store.stage('run-path-parent',[{op:'write',path:'src/a.txt',content:'a'}]);rewritePath(store,staged.id,['../a.txt']);assert.throws(()=>store.get(staged.id),/INVALID_CHANGE_PATH/)}));
test('get rejects a blocked runtime path',()=>withStore(store=>{const staged=store.stage('run-path-blocked',[{op:'write',path:'src/a.txt',content:'a'}]);rewritePath(store,staged.id,['node_modules/a.txt']);assert.throws(()=>store.get(staged.id),/BLOCKED_CHANGE_PATH/)}));
test('get rejects duplicate and overlapping durable paths',()=>withStore(store=>{const staged=store.stage('run-path-overlap',[{op:'write',path:'a.txt',content:'a'},{op:'write',path:'b.txt',content:'b'}]);rewritePath(store,staged.id,['a','a/b']);assert.throws(()=>store.get(staged.id),/OVERLAPPING_CHANGE_PATH/)}));
test('canonical safe paths remain readable',()=>withStore(store=>{const staged=store.stage('run-path-ok',[{op:'write',path:'src/a.txt',content:'a'}]);assert.equal(store.get(staged.id).changes[0].path,'src/a.txt')}));
