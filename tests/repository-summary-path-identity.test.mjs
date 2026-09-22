import test from 'node:test';
import assert from 'node:assert/strict';
import {repositorySummary} from '../core/repo-context.mjs';

test('repository summary counts canonical lexical file identities once',()=>{
  const out=repositorySummary([
    {path:'src/a.js',size:10,ext:'.js'},
    {path:'src/a.js/',size:10,ext:'.js'},
    {path:'src/./a.js',size:10,ext:'.js'},
    {path:'src//a.js',size:10,ext:'.js'},
    {path:'src/tmp/../a.js',size:10,ext:'.js'},
    {path:'src/b.js',size:10,ext:'.js'},
  ]);
  assert.equal(out.fileCount,2);
  assert.deepEqual(out.extensions,[['.js',2]]);
  assert.deepEqual(out.topLevel,['src']);
  assert.equal(out.contextRecovery.indexedPaths,2);
  assert.equal(out.contextRecovery.totalManifestPaths,2);
  assert.deepEqual(out.contextRecovery.exactPathHints,['src/a.js','src/b.js']);
});
