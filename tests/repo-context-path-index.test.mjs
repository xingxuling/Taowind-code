import test from 'node:test';
import assert from 'node:assert/strict';
import {repositoryPathIndex,repositorySummary} from '../core/repo-context.mjs';

test('repository path index is deterministic, bounded, normalized and code-prioritized',()=>{
 const manifest=[
  {path:'docs/very-long-note.md',size:10,ext:'.md'},
  {path:'core\\engine.mjs',size:20,ext:'.mjs'},
  {path:'src/main.js',size:30,ext:'.js'},
  {path:'README.md',size:40,ext:'.md'},
  {path:'docs/very-long-note.md',size:10,ext:'.md'},
 ];
 const a=repositoryPathIndex(manifest,{maxPaths:3,maxBytes:1000});
 const b=repositoryPathIndex([...manifest].reverse(),{maxPaths:3,maxBytes:1000});
 assert.deepEqual(a,b);
 assert.deepEqual(a.paths,['core/engine.mjs','README.md','src/main.js']);
 assert.equal(a.totalPaths,4);
 assert.equal(a.truncated,true);
});

test('repository summary exposes bounded exact-path recovery contract without credential-like path hints',()=>{
 const manifest=[
  ...Array.from({length:60},(_,i)=>({path:`src/mod-${String(i).padStart(2,'0')}.js`,size:10,ext:'.js'})),
  {path:'.env.local',size:10,ext:'.local'},
  {path:'config/credentials.json',size:10,ext:'.json'},
  {path:'keys/service.pem',size:10,ext:'.pem'},
  {path:'.ssh/id_rsa',size:10,ext:''},
 ];
 const out=repositorySummary(manifest);
 assert.equal(out.fileCount,64);
 assert.equal(out.contextRecovery.protocol,'taowind.repo-context-recovery.v0.1');
 assert.equal(out.contextRecovery.indexedPaths,60);
 assert.equal(out.contextRecovery.totalManifestPaths,64);
 assert.equal(out.contextRecovery.truncated,false);
 assert.equal(out.contextRecovery.exactPathHints.length,60);
 assert.ok(out.contextRecovery.exactPathHints.every(x=>!/env|credential|\.pem|id_rsa/i.test(x)));
 assert.match(out.contextRecovery.rule,/needs_more_context/);
});

test('repository path index stops at byte budget without splitting path entries',()=>{
 const manifest=Array.from({length:20},(_,i)=>({path:`core/${'x'.repeat(20)}-${i}.mjs`,size:10,ext:'.mjs'}));
 const out=repositoryPathIndex(manifest,{maxPaths:20,maxBytes:100});
 assert.ok(out.paths.length>0&&out.paths.length<20);
 assert.equal(out.truncated,true);
 assert.ok(out.approxJsonBytes<=100);
});
