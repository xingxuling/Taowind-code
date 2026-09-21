import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeProposal,selectFederatedProposal} from '../core/federated-generation.mjs';

test('federation does not select a proposal that is guaranteed to exceed acceptance validation budget',()=>{
  const overflowCommands=Array.from({length:9},(_,i)=>`node --test tests/case-${i+1}.test.mjs`);
  const overflow=normalizeProposal({changes:[{op:'write',path:'core/a.mjs',content:'export const a=1;'}],validation_commands:overflowCommands},{provider:'overflow'});
  assert.equal(overflow.validation_commands.length,9);
  assert.equal(overflow.validation_overflow,true);
  assert.ok(overflow.risks.some(x=>x.startsWith('VALIDATION_COMMAND_BUDGET_EXCEEDED:')));
  const result=selectFederatedProposal([
    {provider:'overflow',role:'implementation',proposal:{summary:'high evidence candidate',changes:[{op:'write',path:'core/a.mjs',content:'export const a=1;'}],validation_commands:overflowCommands}},
    {provider:'bounded',role:'implementation',proposal:{summary:'bounded candidate',changes:[{op:'write',path:'core/b.mjs',content:'export const b=1;'}],validation_commands:['node --test tests/b.test.mjs']}}
  ],{goal:'change code safely',manifest:[{path:'core/a.mjs'},{path:'core/b.mjs'}]});
  assert.equal(result.winner.provider,'bounded');
  assert.equal(result.consensus.validCount,1);
  assert.equal(result.consensus.executableCount,1);
});
