import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {gitLocalCommit,gitStatus} from '../core/git.mjs';

function git(cwd,args){const r=spawnSync('git',args,{cwd,encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout.trim()}
function receipt(dir,rel){
  const file=path.join(dir,rel);if(!fs.existsSync(file))return {path:rel,exists:false,type:null,sha256:null,identity:null,mode:null};
  const st=fs.statSync(file);return {path:rel,exists:true,type:'file',sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex'),identity:`${st.dev}:${st.ino}`,mode:st.mode&0o7777};
}

test('local delivery commit stages only run-owned paths',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'taowind-git-'));
  try{
    git(dir,['init']);
    git(dir,['config','user.name','Taowind Test']);
    git(dir,['config','user.email','taowind-test@example.invalid']);
    fs.writeFileSync(path.join(dir,'a.txt'),'a0\n');
    fs.writeFileSync(path.join(dir,'b.txt'),'b0\n');
    git(dir,['add','.']);git(dir,['commit','-m','base']);
    fs.writeFileSync(path.join(dir,'a.txt'),'a1\n');
    fs.writeFileSync(path.join(dir,'b.txt'),'b1\n');
    const result=gitLocalCommit(dir,'agent change',['a.txt']);
    assert.equal(result.ok,true);
    assert.deepEqual(result.paths,['a.txt']);
    assert.equal(git(dir,['show','--name-only','--pretty=format:','HEAD']).trim(),'a.txt');
    const status=gitStatus(dir).status.join('\n');
    assert.match(status,/b\.txt/);
    assert.doesNotMatch(status,/a\.txt/);
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
});

test('validated local delivery fails closed when staged bytes drift from validation receipt',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'taowind-git-integrity-'));
  try{
    git(dir,['init']);git(dir,['config','user.name','Taowind Test']);git(dir,['config','user.email','taowind-test@example.invalid']);
    fs.writeFileSync(path.join(dir,'a.txt'),'a0\n');git(dir,['add','.']);git(dir,['commit','-m','base']);
    fs.writeFileSync(path.join(dir,'a.txt'),'validated\n');const validated=[receipt(dir,'a.txt')];
    fs.writeFileSync(path.join(dir,'a.txt'),'unvalidated\n');
    const before=git(dir,['rev-parse','HEAD']);const result=gitLocalCommit(dir,'must not commit',['a.txt'],validated);
    assert.equal(result.ok,false);assert.equal(result.error,'GIT_INDEX_POSTIMAGE_DRIFT');assert.equal(result.indexIntegrity.passed,false);
    assert.equal(git(dir,['rev-parse','HEAD']),before);assert.equal(git(dir,['diff','--cached','--name-only']),'');
    assert.equal(fs.readFileSync(path.join(dir,'a.txt'),'utf8'),'unvalidated\n');
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
});

test('validated local delivery commits the Git index only when it matches validation receipt',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'taowind-git-integrity-pass-'));
  try{
    git(dir,['init']);git(dir,['config','user.name','Taowind Test']);git(dir,['config','user.email','taowind-test@example.invalid']);
    fs.writeFileSync(path.join(dir,'a.txt'),'a0\n');git(dir,['add','.']);git(dir,['commit','-m','base']);
    fs.writeFileSync(path.join(dir,'a.txt'),'validated\n');const validated=[receipt(dir,'a.txt')];
    const result=gitLocalCommit(dir,'validated commit',['a.txt'],validated);
    assert.equal(result.ok,true);assert.equal(result.indexIntegrity.passed,true);assert.equal(result.indexOwnership.passed,true);assert.equal(git(dir,['show','HEAD:a.txt']),'validated');
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
});

test('local delivery fails closed without consuming unrelated preexisting staged work',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'taowind-git-index-ownership-'));
  try{
    git(dir,['init']);git(dir,['config','user.name','Taowind Test']);git(dir,['config','user.email','taowind-test@example.invalid']);
    fs.writeFileSync(path.join(dir,'a.txt'),'a0\n');fs.writeFileSync(path.join(dir,'b.txt'),'b0\n');git(dir,['add','.']);git(dir,['commit','-m','base']);
    fs.writeFileSync(path.join(dir,'b.txt'),'b1-user-staged\n');git(dir,['add','b.txt']);
    fs.writeFileSync(path.join(dir,'a.txt'),'a1-agent\n');const validated=[receipt(dir,'a.txt')];
    const before=git(dir,['rev-parse','HEAD']);const cachedBefore=git(dir,['show',':b.txt']);
    const result=gitLocalCommit(dir,'agent change',['a.txt'],validated);
    assert.equal(result.ok,false);assert.equal(result.error,'GIT_INDEX_PREEXISTING_STAGED_CHANGES');assert.equal(result.indexIntegrity.passed,false);
    assert.deepEqual(result.indexOwnership.stagedPaths,['b.txt']);assert.equal(git(dir,['rev-parse','HEAD']),before);
    assert.equal(git(dir,['show',':b.txt']),cachedBefore);assert.equal(git(dir,['diff','--cached','--name-only']),'b.txt');
    assert.equal(fs.readFileSync(path.join(dir,'a.txt'),'utf8'),'a1-agent\n');
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
});

test('local delivery does not overwrite a preexisting staged version of a run-owned path',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'taowind-git-index-overlap-'));
  try{
    git(dir,['init']);git(dir,['config','user.name','Taowind Test']);git(dir,['config','user.email','taowind-test@example.invalid']);
    fs.writeFileSync(path.join(dir,'a.txt'),'a0\n');git(dir,['add','.']);git(dir,['commit','-m','base']);
    fs.writeFileSync(path.join(dir,'a.txt'),'user-staged\n');git(dir,['add','a.txt']);const cachedBefore=git(dir,['show',':a.txt']);
    fs.writeFileSync(path.join(dir,'a.txt'),'validated-agent\n');const validated=[receipt(dir,'a.txt')];
    const result=gitLocalCommit(dir,'agent change',['a.txt'],validated);
    assert.equal(result.ok,false);assert.equal(result.error,'GIT_INDEX_PREEXISTING_STAGED_CHANGES');
    assert.equal(git(dir,['show',':a.txt']),cachedBefore);assert.equal(fs.readFileSync(path.join(dir,'a.txt'),'utf8'),'validated-agent\n');
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
