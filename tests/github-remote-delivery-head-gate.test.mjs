import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {gitRemoteDelivery} from '../core/git.mjs';

function git(cwd,args){const r=spawnSync('git',args,{cwd,encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout.trim()}
function initRepo(dir){git(dir,['init']);git(dir,['config','user.name','Taowind Test']);git(dir,['config','user.email','taowind-test@example.invalid']);fs.writeFileSync(path.join(dir,'a.txt'),'a0\n');git(dir,['add','.']);git(dir,['commit','-m','base']);git(dir,['checkout','-b','feature/head-gate']);git(dir,['remote','add','origin','https://github.com/acme/demo.git']);return git(dir,['rev-parse','HEAD'])}

test('remote PR creation requires expected validated head before any GitHub side effect',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'taowind-pr-head-gate-'));
  try{
    initRepo(dir);let calls=0;const fetchImpl=async()=>{calls+=1;return {ok:true,status:201,text:async()=>JSON.stringify({number:65})}};
    const result=await gitRemoteDelivery(dir,{explicitApproval:true,push:false,createPullRequest:true,title:'feat: gate',env:{GITHUB_TOKEN:'test-token'},fetchImpl});
    assert.equal(result.ok,false);assert.equal(result.error,'EXPECTED_HEAD_SHA_REQUIRED');assert.equal(result.prPerformed,false);assert.equal(result.externalSideEffectPerformed,false);assert.equal(calls,0);
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
});

test('remote PR creation proceeds when expected validated head is supplied and receipt matches',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'taowind-pr-head-gate-valid-'));
  try{
    const expectedHeadSha=initRepo(dir);let calls=0;const fetchImpl=async()=>{calls+=1;return {ok:true,status:201,text:async()=>JSON.stringify({number:66,html_url:'https://github.com/acme/demo/pull/66',state:'open',head:{sha:expectedHeadSha}})}};
    const result=await gitRemoteDelivery(dir,{explicitApproval:true,push:false,createPullRequest:true,expectedHeadSha,title:'feat: gate',env:{GITHUB_TOKEN:'test-token'},fetchImpl});
    assert.equal(result.ok,true);assert.equal(result.prPerformed,true);assert.equal(result.pullRequest.number,66);assert.equal(calls,1);
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
