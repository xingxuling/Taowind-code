import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeProposal} from '../core/federated-generation.mjs';

test('nested credential directories are rejected at federation context admission',()=>{
  const p=normalizeProposal({needs_more_context:['secrets/token.txt','credentials/service.json','.env.local/nested.txt','src/ok.mjs']});
  assert.deepEqual(p.needs_more_context,['src/ok.mjs']);
});
