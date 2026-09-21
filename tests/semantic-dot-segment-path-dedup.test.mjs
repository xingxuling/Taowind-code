import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSemanticRepoGraph,selectSemanticContext} from '../core/semantic-repo-graph.mjs';

test('semantic graph deduplicates dot-segment aliases before ranking and budgeting',()=>{
  const graph=buildSemanticRepoGraph([
    {path:'src/a.js',content:'export const a = 1'},
    {path:'src/./a.js',content:'export const a = 1'},
    {path:'src/b.js',content:'export const b = 1'},
  ],{goal:'source'});
  assert.equal(graph.stats.files,2);
  assert.equal(graph.nodes.filter(n=>n.path==='src/a.js').length,1);
  const selected=selectSemanticContext(graph,{maxFiles:2,maxBytes:99999});
  assert.deepEqual(new Set(selected.paths).size,selected.paths.length);
});
