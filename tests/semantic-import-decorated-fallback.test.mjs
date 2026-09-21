import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSemanticRepoGraph} from '../core/semantic-repo-graph.mjs';

test('extensionless relative imports do not fabricate decorated filename targets',()=>{
  const graph=buildSemanticRepoGraph([
    {path:'src/foo.test.js',content:'export const helper=1'},
    {path:'src/main.js',content:"import {foo} from './foo';\nexport const main=foo;"},
  ]);
  assert.equal(graph.edges.some(edge=>edge.type==='imports'&&edge.from==='src/main.js'),false);
});

test('extensionless directory imports do not fabricate decorated index targets',()=>{
  const graph=buildSemanticRepoGraph([
    {path:'src/foo/index.test.js',content:'export const helper=1'},
    {path:'src/main.js',content:"import {foo} from './foo';\nexport const main=foo;"},
  ]);
  assert.equal(graph.edges.some(edge=>edge.type==='imports'&&edge.from==='src/main.js'),false);
});
