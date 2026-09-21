import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSemanticRepoGraph,selectSemanticContext} from '../core/semantic-repo-graph.mjs';

test('semantic context admits a direct import neighbor before unrelated lower-ranked files consume the cap',()=>{
  const files=[
    {path:'src/feature.js',content:"import './helper.js'; export function featureGoal(){}"},
    {path:'src/helper.js',content:'export const helper = 1;'},
    {path:'index.js',content:'export const entry = 1;'},
  ];
  const graph=buildSemanticRepoGraph(files,{goal:'featureGoal'});
  const selection=selectSemanticContext(graph,{maxFiles:2,maxBytes:10000});
  assert.deepEqual(selection.paths,['src/feature.js','src/helper.js']);
});
