import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSemanticRepoGraph} from '../core/semantic-repo-graph.mjs';

function edges(files){return buildSemanticRepoGraph(files).edges}

test('semantic edge order is deterministic across repository input enumeration order',()=>{
  const files=[
    {path:'src/a.js',content:"import './x.js'; export const a=1;"},
    {path:'src/b.js',content:"import './y.js'; export const b=1;"},
    {path:'src/x.js',content:'export const x=1;'},
    {path:'src/y.js',content:'export const y=1;'},
  ];
  const forward=edges(files);
  const reversed=edges([...files].reverse());
  assert.deepEqual(reversed,forward);
  assert.deepEqual(forward,[
    {from:'src/a.js',to:'src/x.js',type:'imports'},
    {from:'src/b.js',to:'src/y.js',type:'imports'},
  ]);
});
