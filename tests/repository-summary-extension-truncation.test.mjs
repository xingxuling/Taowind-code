import test from 'node:test';
import assert from 'node:assert/strict';
import {repositorySummary} from '../core/repo-context.mjs';

test('repository summary marks extension histogram as truncated when more than 16 extensions are observed',()=>{
  const manifest=Array.from({length:17},(_,i)=>({path:`file-${i}.ext${i}`,size:1,ext:`.ext${i}`}));
  const out=repositorySummary(manifest);
  assert.equal(out.extensions.length,16);
  assert.equal(out.extensionsTruncated,true);
});
