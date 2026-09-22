import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeProposal,selectFederatedProposal} from '../core/federated-generation.mjs';

const validation=['node --check core/a.mjs'];
const goodHash='a'.repeat(64);

test('federated normalization rejects malformed explicit expectedSha256 instead of omitting or coercing the preimage assertion',()=>{
  for(const expectedSha256 of ['',42,'A'.repeat(64),'not-a-sha']){
    const proposal=normalizeProposal({summary:'guarded change',changes:[{op:'write',path:'core/a.mjs',content:'export const a=1;',expectedSha256}],validation_commands:validation},{provider:'bad-preimage'});
    assert.deepEqual(proposal.changes,[]);
    assert.equal(proposal.invalid_change_count,1);
  }
  const valid=normalizeProposal({summary:'guarded change',changes:[{op:'write',path:'core/a.mjs',content:'export const a=1;',expectedSha256:goodHash}],validation_commands:validation},{provider:'good-preimage'});
  assert.equal(valid.invalid_change_count,0);
  assert.equal(valid.changes[0]?.expectedSha256,goodHash);
});

test('federated selection excludes malformed preimage assertions and can choose a valid guarded alternative',()=>{
  const bad={provider:'bad',proposal:{summary:'bad guard',changes:[{op:'write',path:'core/a.mjs',content:'export const a=1;',expectedSha256:false}],validation_commands:validation}};
  const good={provider:'good',proposal:{summary:'good guard',changes:[{op:'write',path:'core/b.mjs',content:'export const b=1;',expectedSha256:goodHash}],validation_commands:['node --check core/b.mjs']}};
  const result=selectFederatedProposal([bad,good],{goal:'apply concurrency-safe change'});
  assert.equal(result.winner?.provider,'good');
  assert.equal(result.consensus.validCount,1);
});
