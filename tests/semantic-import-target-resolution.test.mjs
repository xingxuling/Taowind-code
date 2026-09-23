import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSemanticRepoGraph} from '../core/semantic-repo-graph.mjs';

test('extensionless relative imports prefer the direct source file over decorated prefix matches',()=>{
  const graph=buildSemanticRepoGraph([
    {path:'src/foo.test.js',content:'export const testHelper=1'},
    {path:'src/foo.js',content:'export const foo=1'},
    {path:'src/main.js',content:"import {foo} from './foo';\nexport const main=foo;"},
  ]);
  assert.ok(graph.edges.some(edge=>edge.type==='imports'&&edge.from==='src/main.js'&&edge.to==='src/foo.js'));
  assert.equal(graph.edges.some(edge=>edge.type==='imports'&&edge.from==='src/main.js'&&edge.to==='src/foo.test.js'),false);
});

test('explicit extension imports do not fall through to an extra suffix or index fallback',()=>{
  const graph=buildSemanticRepoGraph([
    {path:'src/foo.js.map',content:'export const sourceMapLookalike=1'},
    {path:'src/foo.js/index.js',content:'export const indexLookalike=1'},
    {path:'src/main.js',content:"import {foo} from './foo.js';\nexport const main=foo;"},
  ]);
  assert.equal(graph.edges.some(edge=>edge.type==='imports'&&edge.from==='src/main.js'),false);
});

test('explicit extension imports still resolve the exact requested path',()=>{
  const graph=buildSemanticRepoGraph([
    {path:'src/foo.js',content:'export const foo=1'},
    {path:'src/foo.js.map',content:'export const sourceMapLookalike=1'},
    {path:'src/main.js',content:"import {foo} from './foo.js';\nexport const main=foo;"},
  ]);
  assert.ok(graph.edges.some(edge=>edge.type==='imports'&&edge.from==='src/main.js'&&edge.to==='src/foo.js'));
  assert.equal(graph.edges.some(edge=>edge.type==='imports'&&edge.from==='src/main.js'&&edge.to==='src/foo.js.map'),false);
});

test('trailing slash relative imports preserve directory intent and resolve only index targets',()=>{
  const graph=buildSemanticRepoGraph([
    {path:'src/foo.js',content:'export const fileLookalike=1'},
    {path:'src/foo/index.js',content:'export const directoryEntry=1'},
    {path:'src/main.js',content:"import {directoryEntry} from './foo/';\nexport const main=directoryEntry;"},
  ]);
  assert.ok(graph.edges.some(edge=>edge.type==='imports'&&edge.from==='src/main.js'&&edge.to==='src/foo/index.js'));
  assert.equal(graph.edges.some(edge=>edge.type==='imports'&&edge.from==='src/main.js'&&edge.to==='src/foo.js'),false);
});

test('trailing slash directory intent survives dotted directory names',()=>{
  const graph=buildSemanticRepoGraph([
    {path:'src/foo.bar/index.js',content:'export const directoryEntry=1'},
    {path:'src/main.js',content:"import {directoryEntry} from './foo.bar/';\nexport const main=directoryEntry;"},
  ]);
  assert.ok(graph.edges.some(edge=>edge.type==='imports'&&edge.from==='src/main.js'&&edge.to==='src/foo.bar/index.js'));
});

test('terminal dot relative imports preserve current-directory intent',()=>{
  const graph=buildSemanticRepoGraph([
    {path:'src.js',content:'export const siblingFile=1'},
    {path:'src/index.js',content:'export const directoryEntry=1'},
    {path:'src/main.cjs',content:"const directoryEntry=require('.');\nmodule.exports=directoryEntry;"},
  ]);
  assert.ok(graph.edges.some(edge=>edge.type==='imports'&&edge.from==='src/main.cjs'&&edge.to==='src/index.js'));
  assert.equal(graph.edges.some(edge=>edge.type==='imports'&&edge.from==='src/main.cjs'&&edge.to==='src.js'),false);
});

test('terminal parent segment can resolve the repository-root index',()=>{
  const graph=buildSemanticRepoGraph([
    {path:'index.js',content:'export const rootEntry=1'},
    {path:'src/main.cjs',content:"const rootEntry=require('..');\nmodule.exports=rootEntry;"},
  ]);
  assert.ok(graph.edges.some(edge=>edge.type==='imports'&&edge.from==='src/main.cjs'&&edge.to==='index.js'));
});
