import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {gitRemoteDelivery,gitRemoteInfo,githubCreatePullRequest,githubMergePullRequest} from '../core/git.mjs';

function git(cwd,args){const r=spawnSync('git',args,{cwd,encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout.trim()}
function initRepo(dir){git(dir,['init']);git(dir,['config','user.name','Taowind Test']);git(dir,['config','user.email','taowind-test@example.invalid']);fs.writeFileSync(path.join(dir,'a.txt'),'a0\n');git(dir,['add','.']);git(dir,['commit','-m','base'])}

test('remote delivery requires explicit approval, expected head binding, and performs a non-force push when approved',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'taowind-remote-'));const repo=path.join(root,'repo');const bare=path.join(root,'remote.git');fs.mkdirSync(repo);
  try{
    initRepo(repo);git(root,['init','--bare',bare]);git(repo,['remote','add','origin',bare]);git(repo,['checkout','-b','feature/provider']);
    fs.writeFileSync(path.join(repo,'a.txt'),'a1\n');git(repo,['add','a.txt']);git(repo,['commit','-m','feature']);const expectedHeadSha=git(repo,['rev-parse','HEAD']);
    const denied=await gitRemoteDelivery(repo,{explicitApproval:false,push:true,expectedHeadSha});
    assert.equal(denied.error,'EXPLICIT_APPROVAL_REQUIRED');
    assert.equal(spawnSync('git',['--git-dir',bare,'show-ref','--verify','refs/heads/feature/provider']).status,128);
    const unbound=await gitRemoteDelivery(repo,{explicitApproval:true,push:true});
    assert.equal(unbound.error,'EXPECTED_HEAD_SHA_REQUIRED');assert.equal(unbound.pushPerformed,false);
    assert.equal(spawnSync('git',['--git-dir',bare,'show-ref','--verify','refs/heads/feature/provider']).status,128);
    const approved=await gitRemoteDelivery(repo,{explicitApproval:true,push:true,expectedHeadSha});
    assert.equal(approved.ok,true);assert.equal(approved.pushPerformed,true);assert.equal(approved.push.pushedHead,expectedHeadSha);
    assert.equal(git(root,['--git-dir',bare,'rev-parse','refs/heads/feature/provider']),expectedHeadSha);
  }finally{fs.rmSync(root,{recursive:true,force:true})}
});

test('remote delivery pushes the expected validated commit even if the local branch advances afterwards',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'taowind-remote-binding-'));const repo=path.join(root,'repo');const bare=path.join(root,'remote.git');fs.mkdirSync(repo);
  try{
    initRepo(repo);git(root,['init','--bare',bare]);git(repo,['remote','add','origin',bare]);git(repo,['checkout','-b','feature/bound']);
    fs.writeFileSync(path.join(repo,'a.txt'),'validated-a\n');git(repo,['add','a.txt']);git(repo,['commit','-m','validated']);const expectedHeadSha=git(repo,['rev-parse','HEAD']);
    fs.writeFileSync(path.join(repo,'a.txt'),'unvalidated-b\n');git(repo,['add','a.txt']);git(repo,['commit','-m','unvalidated']);const localHead=git(repo,['rev-parse','HEAD']);assert.notEqual(localHead,expectedHeadSha);
    const delivered=await gitRemoteDelivery(repo,{explicitApproval:true,push:true,expectedHeadSha});
    assert.equal(delivered.ok,true);assert.equal(delivered.push.pushedHead,expectedHeadSha);
    assert.equal(git(root,['--git-dir',bare,'rev-parse','refs/heads/feature/bound']),expectedHeadSha);
    assert.equal(git(repo,['rev-parse','HEAD']),localHead);
  }finally{fs.rmSync(root,{recursive:true,force:true})}
});

test('GitHub pull request merge requires and sends the expected head SHA without exposing credentials',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'taowind-pr-'));
  try{
    initRepo(dir);git(dir,['checkout','-b','feature/api']);git(dir,['remote','add','origin','https://secret-user:secret-pass@github.com/acme/demo.git']);
    const info=gitRemoteInfo(dir,{env:{GITHUB_TOKEN:'top-secret-token'}});
    assert.equal(info.repository,'acme/demo');assert.doesNotMatch(info.remoteUrl,/secret-user|secret-pass/);assert.equal(info.githubApiReady,true);
    const expectedHeadSha=git(dir,['rev-parse','HEAD']);const mergeSha='deadbeefdeadbeefdeadbeefdeadbeefdeadbeef';const calls=[];const fetchImpl=async(url,init)=>{calls.push({url,init});if(init.method==='GET')return {ok:true,status:200,text:async()=>JSON.stringify({object:{sha:expectedHeadSha}})};const isMerge=/\/merge$/.test(url);return {ok:true,status:isMerge?200:201,text:async()=>JSON.stringify(isMerge?{merged:true,sha:mergeSha,message:'merged'}:{number:42,html_url:'https://github.com/acme/demo/pull/42',state:'open',head:{sha:expectedHeadSha}})}};
    const env={GITHUB_TOKEN:'top-secret-token'};
    const pr=await githubCreatePullRequest(dir,{title:'feat: remote delivery',expectedHeadSha,env,fetchImpl});assert.equal(pr.ok,true);assert.equal(pr.number,42);
    const unbound=await githubMergePullRequest(dir,{number:42,env,fetchImpl});assert.equal(unbound.ok,false);assert.equal(unbound.error,'EXPECTED_HEAD_SHA_REQUIRED');assert.equal(calls.length,2);
    const malformed=await githubMergePullRequest(dir,{number:42,expectedHeadSha:'deadbeef',env,fetchImpl});assert.equal(malformed.ok,false);assert.equal(malformed.error,'EXPECTED_HEAD_SHA_INVALID');assert.equal(calls.length,2);
    const merged=await githubMergePullRequest(dir,{number:42,expectedHeadSha,env,fetchImpl});assert.equal(merged.ok,true);assert.equal(merged.sha,mergeSha);assert.equal(merged.expectedHeadSha,expectedHeadSha);
    assert.equal(calls.length,3);assert.equal(JSON.parse(calls[2].init.body).sha,expectedHeadSha);assert.match(calls[0].init.headers.authorization,/top-secret-token/);assert.doesNotMatch(JSON.stringify({pr,unbound,malformed,merged,info}),/top-secret-token|secret-pass/);
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
