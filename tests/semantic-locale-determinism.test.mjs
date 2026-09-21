import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

function observe(lang){
  const moduleHref=new URL('../core/semantic-repo-graph.mjs',import.meta.url).href;
  const script=`import {buildSemanticRepoGraph,selectSemanticContext} from ${JSON.stringify(moduleHref)}; const files=[{path:'ä.js',content:'const aaa=1'},{path:'z.js',content:'const zzz=1'}]; const graph=buildSemanticRepoGraph(files,{goal:''}); console.log(JSON.stringify({nodes:graph.nodes.map(x=>x.path),selected:selectSemanticContext(graph,{maxFiles:1}).paths}));`;
  const child=spawnSync(process.execPath,['--input-type=module','-e',script],{encoding:'utf8',env:{...process.env,LANG:lang,LC_ALL:lang}});
  assert.equal(child.status,0,child.stderr);
  return JSON.parse(child.stdout.trim());
}

test('semantic graph ranking is independent of host locale collation',()=>{
  assert.deepEqual(observe('sv_SE.UTF-8'),observe('en_US.UTF-8'));
});
