import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSemanticRepoGraph} from '../core/semantic-repo-graph.mjs';

test('semantic graph does not fabricate test ownership when one stem matches multiple source files',()=>{
  const graph=buildSemanticRepoGraph([
    {path:'src/index.js',content:'export const srcIndex=1'},
    {path:'lib/index.js',content:'export const libIndex=1'},
    {path:'tests/index.test.js',content:'test("index",()=>{})'},
  ]);
  const testEdges=graph.edges.filter(edge=>edge.type==='tests'&&edge.from==='tests/index.test.js');
  assert.deepEqual(testEdges,[]);
});
