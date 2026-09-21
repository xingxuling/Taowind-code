import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {WorkspaceService} from '../core/workspace.mjs';
import {repositorySummary} from '../core/repo-context.mjs';

test('manifest exposes truncation when the repository exceeds maxFiles',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'twc-manifest-truncated-'));
  try{
    fs.writeFileSync(path.join(root,'a.js'),'a');
    fs.writeFileSync(path.join(root,'b.js'),'b');
    fs.writeFileSync(path.join(root,'c.js'),'c');
    const manifest=new WorkspaceService(root).manifest({maxFiles:2});
    assert.equal(manifest.length,2);
    assert.equal(manifest.truncated,true);
    const summary=repositorySummary(manifest);
    assert.equal(summary.fileCount,2);
    assert.equal(summary.manifestTruncated,true);
    assert.equal(summary.contextRecovery.manifestTruncated,true);
    assert.equal(summary.contextRecovery.truncated,true);
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('manifest does not claim truncation when file count exactly equals maxFiles',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'twc-manifest-complete-'));
  try{
    fs.writeFileSync(path.join(root,'a.js'),'a');
    fs.writeFileSync(path.join(root,'b.js'),'b');
    const manifest=new WorkspaceService(root).manifest({maxFiles:2});
    assert.equal(manifest.length,2);
    assert.equal(manifest.truncated,false);
    assert.equal(repositorySummary(manifest).manifestTruncated,false);
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
