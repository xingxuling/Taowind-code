import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSemanticRepoGraph} from '../core/semantic-repo-graph.mjs';

test('semantic graph rejects Windows drive-relative paths from the repo-relative model',()=>{
  for(const filePath of ['C:outside.js','d:src/file.ts']){
    assert.throws(
      ()=>buildSemanticRepoGraph([{path:filePath,content:'export const outside = 1'}]),
      error=>error?.code==='SEMANTIC_PATH_OUTSIDE_REPOSITORY'
    );
  }
});
