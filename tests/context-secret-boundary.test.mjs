import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {WorkspaceService} from '../core/workspace.mjs';
import {isCredentialLikePath,selectContextPaths} from '../core/repo-context.mjs';

function fixture(){const root=fs.mkdtempSync(path.join(os.tmpdir(),'twc-context-secret-'));fs.writeFileSync(path.join(root,'.env'),'API_KEY=super-secret\n');fs.writeFileSync(path.join(root,'safe.txt'),'public\n');return root}

test('credential-like paths are shared by selection and content-bundle policy',()=>{
  assert.equal(isCredentialLikePath('.env'),true);
  assert.equal(isCredentialLikePath('config/credentials.json'),true);
  assert.equal(isCredentialLikePath('keys/service.pem'),true);
  assert.equal(isCredentialLikePath('src/main.js'),false);
  const selected=selectContextPaths([{path:'.env',size:10,ext:''},{path:'config/credentials.json',size:10,ext:'.json'},{path:'src/main.js',size:20,ext:'.js'}]);
  assert.deepEqual(selected,['src/main.js']);
});

test('context bundle never reads credential-like content even when requested explicitly',()=>{
  const root=fixture(),ws=new WorkspaceService(root);const bundle=ws.contextBundle(['.env','safe.txt']);
  assert.deepEqual(bundle.files,[{path:'safe.txt',content:'public\n'}]);
  assert.equal(bundle.totalBytes,7);
});

test('context bundle rejects final symlink aliases instead of following them into sensitive content',t=>{
  const root=fixture();try{fs.symlinkSync('.env',path.join(root,'notes.txt'))}catch(error){if(error?.code==='EPERM'||error?.code==='EACCES'){t.skip('symlink creation unavailable on this host');return}throw error}
  const bundle=new WorkspaceService(root).contextBundle(['notes.txt']);
  assert.deepEqual(bundle.files,[]);assert.equal(bundle.totalBytes,0);
});

test('context bundle rejects symlink ancestors instead of reading through an alias directory',t=>{
  const root=fixture(),secretDir=path.join(root,'private');fs.mkdirSync(secretDir);fs.writeFileSync(path.join(secretDir,'notes.txt'),'sensitive-but-benign-name\n');
  try{fs.symlinkSync('private',path.join(root,'alias'),'dir')}catch(error){if(error?.code==='EPERM'||error?.code==='EACCES'){t.skip('symlink creation unavailable on this host');return}throw error}
  const bundle=new WorkspaceService(root).contextBundle(['alias/notes.txt']);
  assert.deepEqual(bundle.files,[]);assert.equal(bundle.totalBytes,0);
});
