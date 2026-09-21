import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {githubCreatePullRequest} from '../core/git.mjs';

function git(cwd,args){const r=spawnSync('git',args,{cwd,encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout.trim()}
function initRepo(dir){git(dir,['init']);git(dir,['config','user.name','Taowind Test']);git(dir,['config','user.email','taowind-test@example.invalid']);fs.writeFileSync(path.join(dir,'a.txt'),'a0\n');git(dir,['add','.']);git(dir,['commit','-m','base']);git(dir,['checkout','-b','feature/receipt']);git(dir,['remote','add','origin','https://github.com/acme/demo.git'])}

test('GitHub PR create receipt rejects successful HTTP without a usable PR number while preserving side-effect truth',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'taowind-pr-create-receipt-missing-'));
  try{
    initRepo(dir);const fetchImpl=async()=>({ok:true,status:201,text:async()=>JSON.stringify({html_url:'https://github.com/acme/demo/pull/unknown',state:'open'})});
    const result=await githubCreatePullRequest(dir,{title:'feat: receipt',env:{GITHUB_TOKEN:'test-token'},fetchImpl});
    assert.equal(result.ok,false);assert.equal(result.prPerformed,true);assert.equal(result.externalSideEffectPerformed,true);assert.equal(result.number,null);assert.equal(result.error,'PR_CREATE_RECEIPT_INVALID');
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
});

test('GitHub PR create receipt accepts a positive immutable repository-scoped PR number',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'taowind-pr-create-receipt-valid-'));
  try{
    initRepo(dir);const fetchImpl=async()=>({ok:true,status:201,text:async()=>JSON.stringify({number:61,html_url:'https://github.com/acme/demo/pull/61',state:'open'})});
    const result=await githubCreatePullRequest(dir,{title:'feat: receipt',env:{GITHUB_TOKEN:'test-token'},fetchImpl});
    assert.equal(result.ok,true);assert.equal(result.prPerformed,true);assert.equal(result.externalSideEffectPerformed,true);assert.equal(result.number,61);assert.equal(result.error,null);
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
