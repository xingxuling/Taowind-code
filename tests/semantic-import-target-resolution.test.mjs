import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSemanticRepoGraph} from '../core/semantic-repo-graph.mjs';

test('extensionless relative imports prefer the direct source file over decorated prefix matches',()=>{
  const graph=buildSemanticRepoGraph([
    {path:'src/foo.test.js',content:'export const testHelper=1'},
    {path:'src/foo.js',content:'export const foo=1'},
    {path:'src/main.js',content:"import {foo} from './foo';\nexport const main=foo;"},
  ]);
  assert.ok(graph.edges.some(edge=>edge.type==='imports'&&edge.from==='src/main.js'&&edge.to==='src/foo.js'));
  assert.equal(graph.edges.some(edge=>edge.type==='imports'&&edge.from==='src/main.js'&&edge.to==='src/foo.test.js'),false);
});

test('explicit extension imports do not fall through to an extra suffix or index fallback',()=>{
  const graph=buildSemanticRepoGraph([
    {path:'src/foo.js.map',content:'export const sourceMapLookalike=1'},
    {path:'src/foo.js/index.js',content:'export const indexLookalike=1'},
    {path:'src/main.js',content:"import {foo} from './foo.js';\nexport const main=foo;"},
  ]);
  assert.equal(graph.edges.some(edge=>edge.type==='imports'&&edge.from==='src/main.js'),false);
});

test('explicit extension imports still resolve the exact requested path',()=>{
  const graph=buildSemanticRepoGraph([
    {path:'src/foo.js',content:'export const foo=1'},
    {path:'src/foo.js.map',content:'export const sourceMapLookalike=1'},
    {path:'src/main.js',content:"import {foo} from './foo.js';\nexport const main=foo;"},
  ]);
  assert.ok(graph.edges.some(edge=>edge.type==='imports'&&edge.from==='src/main.js'&&edge.to==='src/foo.js'));
  assert.equal(graph.edges.some(edge=>edge.type==='imports'&&edge.from==='src/main.js'&&edge.to==='src/foo.js.map'),false);
});
