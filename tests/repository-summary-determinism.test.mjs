import test from 'node:test';
import assert from 'node:assert/strict';
import {repositorySummary} from '../core/repo-context.mjs';

test('bounded repository summary views are deterministic across manifest enumeration order',()=>{
  const manifest=Array.from({length:90},(_,i)=>({
    path:`dir-${String(i).padStart(2,'0')}/file.ext${String(i%20).padStart(2,'0')}`,
    size:1,
    ext:`.ext${String(i%20).padStart(2,'0')}`,
  }));
  const forward=repositorySummary(manifest);
  const reverse=repositorySummary([...manifest].reverse());
  assert.deepEqual(forward.extensions,reverse.extensions);
  assert.deepEqual(forward.topLevel,reverse.topLevel);
  assert.equal(forward.extensionsTruncated,true);
  assert.equal(forward.topLevelTruncated,true);
});
