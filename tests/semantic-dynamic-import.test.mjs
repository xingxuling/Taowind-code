import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSemanticRepoGraph} from '../core/semantic-repo-graph.mjs';

test('semantic graph links relative JavaScript dynamic imports',()=>{
  const graph=buildSemanticRepoGraph([
    {path:'src/lazy.js',content:'export const lazy=1'},
    {path:'src/main.js',content:"export async function load(){ return import('./lazy.js') }"},
  ]);
  assert.ok(graph.edges.some(edge=>edge.type==='imports'&&edge.from==='src/main.js'&&edge.to==='src/lazy.js'));
});
