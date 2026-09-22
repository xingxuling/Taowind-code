import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSemanticRepoGraph} from '../core/semantic-repo-graph.mjs';

test('semantic graph rejects paths that escape the repository-relative model',()=>{
  const badPaths=['../outside.js','src/../../outside.js','/tmp/outside.js','C:/outside.js','C:\\outside.js'];
  for(const filePath of badPaths){
    assert.throws(
      ()=>buildSemanticRepoGraph([{path:filePath,content:'export const outside = 1'}]),
      error=>error?.code==='SEMANTIC_PATH_OUTSIDE_REPOSITORY'
    );
  }
});

test('semantic graph keeps valid parent-segment aliases inside the repository',()=>{
  const graph=buildSemanticRepoGraph([
    {path:'src/a.js',content:'export const inside = 1'},
    {path:'src/tmp/../a.js',content:'export const inside = 1'},
  ]);
  assert.equal(graph.stats.files,1);
  assert.equal(graph.nodes[0].path,'src/a.js');
});
