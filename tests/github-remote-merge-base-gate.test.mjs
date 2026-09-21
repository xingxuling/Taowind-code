import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {gitRemoteDelivery} from '../core/git.mjs';

function git(cwd,args){const r=spawnSync('git',args,{cwd,encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout.trim()}
function initRepo(dir){
  git(dir,['init']);git(dir,['config','user.name','Taowind Test']);git(dir,['config','user.email','taowind-test@example.invalid']);
  fs.writeFileSync(path.join(dir,'a.txt'),'a0\n');git(dir,['add','.']);git(dir,['commit','-m','base']);
  git(dir,['remote','add','origin','https://github.com/acme/demo.git']);
  return git(dir,['rev-parse','HEAD']);
}
const expectedBaseSha='1111111111111111111111111111111111111111';
const movedBaseSha='2222222222222222222222222222222222222222';
const mergeSha='3333333333333333333333333333333333333333';

test('remote merge requires an expected base identity before any GitHub request when local base is unavailable',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'taowind-merge-base-required-'));
  try{
    const expectedHeadSha=initRepo(dir);let calls=0;const fetchImpl=async()=>{calls+=1;throw new Error('must not call')};
    const result=await gitRemoteDelivery(dir,{explicitApproval:true,push:false,merge:true,prNumber:71,expectedHeadSha,env:{GITHUB_TOKEN:'test-token'},fetchImpl});
    assert.equal(result.ok,false);assert.equal(result.error,'EXPECTED_BASE_SHA_REQUIRED');assert.equal(result.mergePerformed,false);assert.equal(result.externalSideEffectPerformed,false);assert.equal(calls,0);
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
});

test('remote merge rejects already-observable remote base drift before any write side effect',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'taowind-merge-base-drift-'));
  try{
    const expectedHeadSha=initRepo(dir);let calls=0;
    const fetchImpl=async(url,init)=>{calls+=1;assert.equal(init.method,'GET');assert.match(url,/\/git\/ref\/heads\/main$/);return {ok:true,status:200,text:async()=>JSON.stringify({object:{sha:movedBaseSha}})}};
    const result=await gitRemoteDelivery(dir,{explicitApproval:true,push:false,merge:true,prNumber:72,expectedHeadSha,expectedBaseSha,env:{GITHUB_TOKEN:'test-token'},fetchImpl});
    assert.equal(result.ok,false);assert.equal(result.error,'PR_MERGE_BASE_DRIFT');assert.equal(result.mergePerformed,false);assert.equal(result.externalSideEffectPerformed,false);assert.equal(result.basePreflight.baseSha,movedBaseSha);assert.equal(calls,1);
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
});

test('remote merge binds both remote base and PR base before preserving the expected-head merge precondition',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'taowind-merge-base-match-'));
  try{
    const expectedHeadSha=initRepo(dir);const calls=[];
    const fetchImpl=async(url,init)=>{
      calls.push({url,init});
      if(/\/git\/ref\/heads\/main$/.test(url))return {ok:true,status:200,text:async()=>JSON.stringify({object:{sha:expectedBaseSha}})};
      if(init.method==='GET')return {ok:true,status:200,text:async()=>JSON.stringify({base:{sha:expectedBaseSha}})};
      return {ok:true,status:200,text:async()=>JSON.stringify({merged:true,sha:mergeSha,message:'merged'})};
    };
    const result=await gitRemoteDelivery(dir,{explicitApproval:true,push:false,merge:true,prNumber:73,expectedHeadSha,expectedBaseSha,env:{GITHUB_TOKEN:'test-token'},fetchImpl});
    assert.equal(result.ok,true);assert.equal(result.mergePerformed,true);assert.equal(result.expectedBaseSha,expectedBaseSha);assert.equal(result.merge.baseSha,expectedBaseSha);assert.equal(result.merge.sha,mergeSha);assert.equal(calls.length,3);
    assert.equal(calls[0].init.method,'GET');assert.match(calls[0].url,/\/git\/ref\/heads\/main$/);
    assert.equal(calls[1].init.method,'GET');assert.match(calls[1].url,/\/pulls\/73$/);
    assert.equal(calls[2].init.method,'PUT');assert.equal(JSON.parse(calls[2].init.body).sha,expectedHeadSha);
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
