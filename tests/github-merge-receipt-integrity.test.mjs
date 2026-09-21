import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {githubMergePullRequest} from '../core/git.mjs';

function git(cwd,args){const r=spawnSync('git',args,{cwd,encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout.trim()}
function initRepo(dir){git(dir,['init']);git(dir,['config','user.name','Taowind Test']);git(dir,['config','user.email','taowind-test@example.invalid']);fs.writeFileSync(path.join(dir,'a.txt'),'a0\n');git(dir,['add','.']);git(dir,['commit','-m','base']);git(dir,['remote','add','origin','https://github.com/acme/demo.git'])}
const expectedHeadSha='0123456789abcdef0123456789abcdef01234567';

test('GitHub merge receipt fails closed on successful HTTP without explicit merged=true',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'taowind-pr-receipt-missing-'));
  try{
    initRepo(dir);let calls=0;const fetchImpl=async()=>{calls+=1;return {ok:true,status:200,text:async()=>JSON.stringify({})}};
    const result=await githubMergePullRequest(dir,{number:59,expectedHeadSha,env:{GITHUB_TOKEN:'test-token'},fetchImpl});
    assert.equal(calls,1);assert.equal(result.ok,false);assert.equal(result.mergePerformed,false);assert.equal(result.externalSideEffectPerformed,false);assert.equal(result.error,'PR_MERGE_NOT_CONFIRMED');assert.equal(result.sha,null);
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
});

test('GitHub merge receipt preserves performed side effect but rejects missing immutable merge SHA',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'taowind-pr-receipt-sha-'));
  try{
    initRepo(dir);const fetchImpl=async()=>({ok:true,status:200,text:async()=>JSON.stringify({merged:true,message:'merged'})});
    const result=await githubMergePullRequest(dir,{number:59,expectedHeadSha,env:{GITHUB_TOKEN:'test-token'},fetchImpl});
    assert.equal(result.ok,false);assert.equal(result.mergePerformed,true);assert.equal(result.externalSideEffectPerformed,true);assert.equal(result.error,'PR_MERGE_SHA_INVALID');assert.equal(result.sha,null);
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
});

test('GitHub merge receipt accepts explicit merged=true with immutable merge SHA',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'taowind-pr-receipt-valid-'));
  try{
    initRepo(dir);const mergeSha='abcdef0123456789abcdef0123456789abcdef01';const fetchImpl=async()=>({ok:true,status:200,text:async()=>JSON.stringify({merged:true,sha:mergeSha,message:'merged'})});
    const result=await githubMergePullRequest(dir,{number:59,expectedHeadSha,env:{GITHUB_TOKEN:'test-token'},fetchImpl});
    assert.equal(result.ok,true);assert.equal(result.mergePerformed,true);assert.equal(result.externalSideEffectPerformed,true);assert.equal(result.error,null);assert.equal(result.sha,mergeSha);
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
