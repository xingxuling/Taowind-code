import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSemanticRepoGraph} from '../core/semantic-repo-graph.mjs';

test('semantic graph links colocated .test/.spec files to their source stem',()=>{
  const graph=buildSemanticRepoGraph([
    {path:'src/widget.js',content:'export function widget(){}'},
    {path:'src/widget.test.js',content:'test("widget",()=>{})'},
    {path:'src/parser.ts',content:'export const parse=()=>0'},
    {path:'src/parser.spec.ts',content:'test("parser",()=>{})'},
  ]);
  assert.ok(graph.edges.some(edge=>edge.type==='tests'&&edge.from==='src/widget.test.js'&&edge.to==='src/widget.js'));
  assert.ok(graph.edges.some(edge=>edge.type==='tests'&&edge.from==='src/parser.spec.ts'&&edge.to==='src/parser.ts'));
});
