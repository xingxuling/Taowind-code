import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSemanticRepoGraph} from '../core/semantic-repo-graph.mjs';

test('extensionless relative imports fail closed when multiple direct source extensions are equally plausible',()=>{
  const graph=buildSemanticRepoGraph([
    {path:'src/foo.js',content:'export const jsFoo=1'},
    {path:'src/foo.ts',content:'export const tsFoo=1'},
    {path:'src/main.ts',content:"import {foo} from './foo';\nexport const main=foo;"},
  ]);
  const edges=graph.edges.filter(edge=>edge.type==='imports'&&edge.from==='src/main.ts');
  assert.deepEqual(edges,[]);
});
