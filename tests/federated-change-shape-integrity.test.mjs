import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeProposal,selectFederatedProposal} from '../core/federated-generation.mjs';

const validation=['node --check core/a.mjs'];

test('federated normalization rejects a mixed valid/malformed change plan instead of silently dropping the malformed entry',()=>{
  const raw={summary:'mixed plan',changes:[{op:'write',path:'core/a.mjs',content:'export const a=1;'}, {op:'copy',path:'core/b.mjs',content:'export const b=1;'}],validation_commands:validation};
  const proposal=normalizeProposal(raw,{provider:'mixed'});
  assert.deepEqual(proposal.changes,[]);
  assert.equal(proposal.invalid_change_count,1);
  assert.ok(proposal.risks.includes('INVALID_CHANGE_ENTRY:1'));
});

test('federated selection excludes malformed mixed plans and can choose a valid alternative',()=>{
  const mixed={provider:'mixed',proposal:{summary:'mixed plan',changes:[{op:'write',path:'core/a.mjs',content:'export const a=1;'}, {op:'copy',path:'core/b.mjs',content:'export const b=1;'}],validation_commands:validation}};
  const good={provider:'good',proposal:{summary:'valid plan',changes:[{op:'write',path:'core/c.mjs',content:'export const c=1;'}],validation_commands:validation}};
  const result=selectFederatedProposal([mixed,good],{goal:'implement valid change'});
  assert.equal(result.winner?.provider,'good');
  assert.equal(result.consensus.validCount,1);
  assert.equal(result.ranked.find(x=>x.provider==='mixed')?.invalid_change_count,1);
});
