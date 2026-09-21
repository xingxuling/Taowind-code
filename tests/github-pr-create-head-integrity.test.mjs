import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {gitRemoteDelivery,githubCreatePullRequest} from '../core/git.mjs';

function git(cwd,args){const r=spawnSync('git',args,{cwd,encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout.trim()}
function initRepo(dir){git(dir,['init']);git(dir,['config','user.name','Taowind Test']);git(dir,['config','user.email','taowind-test@example.invalid']);fs.writeFileSync(path.join(dir,'a.txt'),'a0\n');git(dir,['add','.']);git(dir,['commit','-m','base']);git(dir,['checkout','-b','feature/head-bound']);git(dir,['remote','add','origin','https://github.com/acme/demo.git']);return git(dir,['rev-parse','HEAD'])}

test('GitHub PR creation rejects a response whose created PR head is not the expected validated commit',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'taowind-pr-head-mismatch-'));
  try{
    const expectedHeadSha=initRepo(dir);const moved='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const fetchImpl=async(url,init)=>init.method==='GET'?{ok:true,status:200,text:async()=>JSON.stringify({object:{sha:expectedHeadSha}})}:{ok:true,status:201,text:async()=>JSON.stringify({number:62,html_url:'https://github.com/acme/demo/pull/62',state:'open',head:{sha:moved}})};
    const result=await githubCreatePullRequest(dir,{title:'feat: head bound',expectedHeadSha,env:{GITHUB_TOKEN:'test-token'},fetchImpl});
    assert.equal(result.ok,false);assert.equal(result.prPerformed,true);assert.equal(result.externalSideEffectPerformed,true);assert.equal(result.number,62);assert.equal(result.expectedHeadSha,expectedHeadSha);assert.equal(result.headSha,moved);assert.equal(result.error,'PR_CREATE_HEAD_MISMATCH');
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
});

test('GitHub PR creation accepts a response bound to the expected validated commit',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'taowind-pr-head-match-'));
  try{
    const expectedHeadSha=initRepo(dir);
    const fetchImpl=async(url,init)=>init.method==='GET'?{ok:true,status:200,text:async()=>JSON.stringify({object:{sha:expectedHeadSha}})}:{ok:true,status:201,text:async()=>JSON.stringify({number:63,html_url:'https://github.com/acme/demo/pull/63',state:'open',head:{sha:expectedHeadSha}})};
    const result=await githubCreatePullRequest(dir,{title:'feat: head bound',expectedHeadSha,env:{GITHUB_TOKEN:'test-token'},fetchImpl});
    assert.equal(result.ok,true);assert.equal(result.prPerformed,true);assert.equal(result.number,63);assert.equal(result.expectedHeadSha,expectedHeadSha);assert.equal(result.headSha,expectedHeadSha);assert.equal(result.error,null);
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
});

test('remote delivery forwards expected head binding into PR creation',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'taowind-pr-head-forward-'));
  try{
    const expectedHeadSha=initRepo(dir);const moved='bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    const fetchImpl=async(url,init)=>init.method==='GET'?{ok:true,status:200,text:async()=>JSON.stringify({object:{sha:expectedHeadSha}})}:{ok:true,status:201,text:async()=>JSON.stringify({number:64,html_url:'https://github.com/acme/demo/pull/64',state:'open',head:{sha:moved}})};
    const result=await gitRemoteDelivery(dir,{explicitApproval:true,push:false,createPullRequest:true,expectedHeadSha,title:'feat: head bound',env:{GITHUB_TOKEN:'test-token'},fetchImpl});
    assert.equal(result.ok,false);assert.equal(result.prPerformed,true);assert.equal(result.externalSideEffectPerformed,true);assert.equal(result.pullRequest.error,'PR_CREATE_HEAD_MISMATCH');
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
});

test('GitHub PR creation fails before POST when the remote branch already drifted from the validated head',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'taowind-pr-head-preflight-drift-'));
  try{
    const expectedHeadSha=initRepo(dir);const moved='cccccccccccccccccccccccccccccccccccccccc';let calls=0;let posts=0;
    const fetchImpl=async(url,init)=>{calls+=1;if(init.method==='POST')posts+=1;return {ok:true,status:200,text:async()=>JSON.stringify({object:{sha:moved}})}};
    const result=await githubCreatePullRequest(dir,{title:'feat: preflight',expectedHeadSha,env:{GITHUB_TOKEN:'test-token'},fetchImpl});
    assert.equal(result.ok,false);assert.equal(result.prPerformed,false);assert.equal(result.externalSideEffectPerformed,false);assert.equal(result.remoteHeadSha,moved);assert.equal(result.error,'PR_CREATE_HEAD_DRIFT');assert.equal(calls,1);assert.equal(posts,0);
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
