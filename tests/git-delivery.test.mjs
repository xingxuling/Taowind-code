import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {gitLocalCommit,gitStatus} from '../core/git.mjs';

function git(cwd,args){const r=spawnSync('git',args,{cwd,encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout.trim()}

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
