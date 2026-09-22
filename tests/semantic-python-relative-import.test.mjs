import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSemanticRepoGraph} from '../core/semantic-repo-graph.mjs';

const importEdges=graph=>graph.edges.filter(edge=>edge.type==='imports').map(edge=>`${edge.from}->${edge.to}`);

test('semantic graph links same-package Python relative imports',()=>{
  const graph=buildSemanticRepoGraph([
    {path:'pkg/helper.py',content:'value = 1'},
    {path:'pkg/main.py',content:'from .helper import value\nprint(value)'},
  ]);
  assert.deepEqual(importEdges(graph),['pkg/main.py->pkg/helper.py']);
});

test('semantic graph links parent-package Python relative imports',()=>{
  const graph=buildSemanticRepoGraph([
    {path:'pkg/shared.py',content:'value = 1'},
    {path:'pkg/sub/main.py',content:'from ..shared import value\nprint(value)'},
  ]);
  assert.deepEqual(importEdges(graph),['pkg/sub/main.py->pkg/shared.py']);
});

test('semantic graph resolves dotted Python relative module paths',()=>{
  const graph=buildSemanticRepoGraph([
    {path:'pkg/tools/helper.py',content:'value = 1'},
    {path:'pkg/main.py',content:'from .tools.helper import value\nprint(value)'},
  ]);
  assert.deepEqual(importEdges(graph),['pkg/main.py->pkg/tools/helper.py']);
});

test('Python relative imports cannot fabricate an edge above the package boundary',()=>{
  const graph=buildSemanticRepoGraph([
    {path:'outside.py',content:'value = 1'},
    {path:'pkg/main.py',content:'from ..outside import value\nprint(value)'},
  ]);
  assert.deepEqual(importEdges(graph),[]);
});
