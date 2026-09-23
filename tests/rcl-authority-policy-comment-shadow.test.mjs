import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {authorityContextForMode,materializeAuthorityPolicy} from '../core/rcl-authority.mjs';

const policy=fs.readFileSync(path.resolve('contracts/approval-policy.rcl'),'utf8');

test('materialization ignores commented facet lookalikes and rewrites the real declaration',()=>{
  const source=`# facet authority.workspace_write : Truth = true\n// facet authority.shell_execute : Truth = true\n${policy}`;
  const out=materializeAuthorityPolicy(source,authorityContextForMode('read_only'),'workspace_write');
  assert.match(out,/^# facet authority\.workspace_write : Truth = true$/m);
  assert.match(out,/^\/\/ facet authority\.shell_execute : Truth = true$/m);
  assert.match(out,/^\s*facet authority\.workspace_write\s*:\s*Truth\s*=\s*false$/m);
  assert.match(out,/^\s*facet authority\.shell_execute\s*:\s*Truth\s*=\s*false$/m);
});

test('a comment cannot satisfy a missing required authority facet',()=>{
  const withoutReal=policy.replace(/^\s*facet authority\.workspace_write[^\n]*\n/m,'');
  const source=`# facet authority.workspace_write : Truth = false\n${withoutReal}`;
  assert.throws(()=>materializeAuthorityPolicy(source,authorityContextForMode('workspace'),'workspace_write'),/RCL_POLICY_FACET_MISSING:authority\.workspace_write/);
});
