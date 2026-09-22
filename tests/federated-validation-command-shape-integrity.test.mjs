import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeProposal,selectFederatedProposal} from '../core/federated-generation.mjs';

const change={op:'write',path:'core/a.mjs',content:'export const a=1;'};

test('federated normalization rejects mixed string/non-string validation command plans instead of coercing them',()=>{
  const proposal=normalizeProposal({summary:'mixed validation',changes:[change],validation_commands:['node --check core/a.mjs',42]},{provider:'mixed'});
  assert.deepEqual(proposal.validation_commands,[]);
  assert.equal(proposal.invalid_validation_command_count,1);
  assert.ok(proposal.risks.includes('INVALID_VALIDATION_COMMAND_ENTRY:1'));
});

test('federated selection excludes malformed validation plans and preserves a valid alternative',()=>{
  const mixed={provider:'mixed',proposal:{summary:'mixed validation',changes:[change],validation_commands:['node --check core/a.mjs',{cmd:'node --test'}]}};
  const good={provider:'good',proposal:{summary:'valid validation',changes:[{op:'write',path:'core/b.mjs',content:'export const b=1;'}],validation_commands:['node --check core/b.mjs']}};
  const result=selectFederatedProposal([mixed,good],{goal:'implement validated change'});
  assert.equal(result.winner?.provider,'good');
  assert.equal(result.consensus.validCount,1);
  assert.equal(result.ranked.find(x=>x.provider==='mixed')?.invalid_validation_command_count,1);
});
