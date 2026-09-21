import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSemanticRepoGraph} from '../core/semantic-repo-graph.mjs';

test('semantic graph fails closed when canonical path aliases disagree on content',()=>{
  const files=[
    {path:'src/a.js',content:'export const alpha = 1'},
    {path:'src/./a.js',content:'export const beta = 2'},
  ];
  assert.throws(()=>buildSemanticRepoGraph(files,{goal:'source'}),error=>error?.code==='SEMANTIC_PATH_CONTENT_CONFLICT'&&error?.path==='src/a.js');
  assert.throws(()=>buildSemanticRepoGraph([...files].reverse(),{goal:'source'}),error=>error?.code==='SEMANTIC_PATH_CONTENT_CONFLICT'&&error?.path==='src/a.js');
});
