import test from 'node:test';
import assert from 'node:assert/strict';
import {repositorySummary} from '../core/repo-context.mjs';

test('repository summary marks top-level hints as truncated when the 80-entry view is incomplete',()=>{
  const manifest=Array.from({length:81},(_,i)=>({path:`dir-${String(i).padStart(2,'0')}/file.js`,size:1,ext:'.js'}));
  const out=repositorySummary(manifest);
  assert.equal(out.topLevel.length,80);
  assert.equal(out.contextRecovery.truncated,false);
  assert.equal(out.topLevelTruncated,true);
});
