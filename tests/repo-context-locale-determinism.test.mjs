import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

function observe(lang){
  const moduleHref=new URL('../core/repo-context.mjs',import.meta.url).href;
  const script=`import {selectContextPaths,repositoryPathIndex,repositorySummary} from ${JSON.stringify(moduleHref)}; const manifest=[{path:'ä/a.ä',size:1,ext:'.ä'},{path:'z/a.z',size:1,ext:'.z'}]; console.log(JSON.stringify({selected:selectContextPaths(manifest,{maxFiles:1}),index:repositoryPathIndex(manifest,{maxPaths:1}).paths,summary:repositorySummary(manifest)}));`;
  const child=spawnSync(process.execPath,['--input-type=module','-e',script],{encoding:'utf8',env:{...process.env,LANG:lang,LC_ALL:lang}});
  assert.equal(child.status,0,child.stderr);
  return JSON.parse(child.stdout.trim());
}

test('repository context ordering is independent of host locale collation',()=>{
  assert.deepEqual(observe('sv_SE.UTF-8'),observe('en_US.UTF-8'));
});
