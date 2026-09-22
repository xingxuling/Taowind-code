import test from 'node:test';
import assert from 'node:assert/strict';
import {selectContextPaths,repositoryPathIndex} from '../core/repo-context.mjs';

test('repository context canonicalizes lexical file aliases before bounded selection and indexing',()=>{
  const manifest=[
    {path:'src/a.js',size:10,ext:'.js'},
    {path:'src/a.js/',size:10,ext:'.js'},
    {path:'src/./a.js',size:10,ext:'.js'},
    {path:'src//a.js',size:10,ext:'.js'},
    {path:'src/tmp/../a.js',size:10,ext:'.js'},
    {path:'src/b.js',size:10,ext:'.js'},
  ];

  assert.deepEqual(selectContextPaths(manifest,{maxFiles:2}),['src/a.js','src/b.js']);
  const index=repositoryPathIndex(manifest,{maxPaths:10,maxBytes:1000});
  assert.deepEqual(index.paths,['src/a.js','src/b.js']);
  assert.equal(index.totalPaths,2);
  assert.equal(index.truncated,false);
});
