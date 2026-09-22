import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSemanticRepoGraph} from '../core/semantic-repo-graph.mjs';

test('semantic graph canonicalizes a trailing separator to the regular-file identity',()=>{
  const graph=buildSemanticRepoGraph([
    {path:'src/a.js',content:'export const a = 1'},
    {path:'src/a.js/',content:'export const a = 1'},
  ]);
  assert.equal(graph.stats.files,1);
  assert.equal(graph.nodes[0].path,'src/a.js');
});

test('semantic graph fails closed when a trailing-separator alias disagrees on content',()=>{
  assert.throws(()=>buildSemanticRepoGraph([
    {path:'src/a.js',content:'export const a = 1'},
    {path:'src/a.js/',content:'export const a = 2'},
  ]),error=>error?.code==='SEMANTIC_PATH_CONTENT_CONFLICT'&&error?.path==='src/a.js');
});

test('semantic graph rejects path spellings that collapse to an empty file identity',()=>{
  for(const filePath of ['./','src/../']){
    assert.throws(()=>buildSemanticRepoGraph([{path:filePath,content:'x'}]),error=>error?.code==='SEMANTIC_PATH_OUTSIDE_REPOSITORY');
  }
});
