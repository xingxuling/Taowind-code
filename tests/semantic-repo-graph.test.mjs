import test from 'node:test';import assert from 'node:assert/strict';
import {buildSemanticRepoGraph,selectSemanticContext} from '../core/semantic-repo-graph.mjs';

test('semantic graph links imports/tests and prioritizes goal-related files',()=>{
  const files=[
    {path:'core/north-star-runner.mjs',content:"import {select} from './repo-context.mjs'; export class NorthStarRunner { synthesize(){} }"},
    {path:'core/repo-context.mjs',content:'export function select(){ return 1 }'},
    {path:'tests/repo-context.test.mjs',content:"import {select} from '../core/repo-context.mjs'; test('semantic context',()=>select())"},
    {path:'README.md',content:'hello'},
  ];
  const g=buildSemanticRepoGraph(files,{goal:'improve semantic repository context selection'});
  assert.equal(g.stats.files,4);assert.ok(g.stats.edges>=2);assert.ok(g.nodes[0].path.includes('repo-context'));
  const s=selectSemanticContext(g,{maxFiles:3,maxBytes:99999});assert.ok(s.paths.includes('core/repo-context.mjs'));assert.ok(s.paths.some(x=>x.startsWith('tests/')));
});
