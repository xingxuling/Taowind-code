import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSemanticRepoGraph} from '../core/semantic-repo-graph.mjs';

test('semantic graph links relative JavaScript re-export dependencies',()=>{
  const graph=buildSemanticRepoGraph([
    {path:'src/leaf.js',content:'export const leaf=1'},
    {path:'src/index.js',content:"export {leaf} from './leaf.js';"},
  ]);
  assert.ok(graph.edges.some(edge=>edge.type==='imports'&&edge.from==='src/index.js'&&edge.to==='src/leaf.js'));
});
