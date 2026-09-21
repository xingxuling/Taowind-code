import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSemanticRepoGraph,selectSemanticContext} from '../core/semantic-repo-graph.mjs';

function selection(files){
  const graph=buildSemanticRepoGraph(files,{goal:'targetFeature'});
  return selectSemanticContext(graph,{maxFiles:2,maxBytes:10000}).paths;
}

test('semantic neighborhood selection is stable across equivalent file enumeration order',()=>{
  const target={path:'src/target.js',content:'export function targetFeature(){}'};
  const a={path:'src/a.js',content:"import './target.js'; export const aaa=1;"};
  const b={path:'src/b.js',content:"import './target.js'; export const bbb=1;"};
  const forward=selection([target,a,b]);
  const reverse=selection([target,b,a]);
  assert.deepEqual(forward,reverse);
});
