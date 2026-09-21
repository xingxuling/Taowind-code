import test from 'node:test';
import assert from 'node:assert/strict';
import {repositorySummary} from '../core/repo-context.mjs';

test('repository summary excludes credential-like extension and count metadata',()=>{
  const out=repositorySummary([
    {path:'src/main.js',size:1,ext:'.js'},
    {path:'.env.local',size:1,ext:'.local'},
    {path:'config/credentials.json',size:1,ext:'.json'},
    {path:'keys/service.pem',size:1,ext:'.pem'},
    {path:'.ssh/id_rsa',size:1,ext:''},
  ]);
  assert.deepEqual(out.extensions,[['.js',1]]);
  assert.equal(out.extensionsTruncated,false);
  assert.equal(out.fileCount,1);
  assert.equal(out.contextRecovery.totalManifestPaths,1);
});
