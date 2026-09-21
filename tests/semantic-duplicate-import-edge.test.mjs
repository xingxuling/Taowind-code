import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSemanticRepoGraph} from '../core/semantic-repo-graph.mjs';

test('semantic graph emits one dependency relation when distinct import spellings resolve to the same target',()=>{
  const graph=buildSemanticRepoGraph([
    {path:'src/foo.js',content:'export const foo=1;'},
    {path:'src/main.js',content:"import './foo';\nimport './foo.js';\n"},
  ]);
  assert.deepEqual(graph.edges.filter(e=>e.type==='imports'),[
    {from:'src/main.js',to:'src/foo.js',type:'imports'},
  ]);
  assert.equal(graph.stats.edges,1);
});
