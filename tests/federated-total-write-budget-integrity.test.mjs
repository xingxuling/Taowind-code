import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeProposal,selectFederatedProposal} from '../core/federated-generation.mjs';

const validation=['node --check core/a.mjs'];
function writes(sizes,prefix='generated'){
  return sizes.map((size,i)=>({op:'write',path:`${prefix}/file-${i}.txt`,content:'a'.repeat(size)}));
}

test('federated normalization fails closed when proposed write bytes alone exceed the existing 8,000,000-byte ChangeSet total budget',()=>{
  const overflow=normalizeProposal({summary:'oversized write set',changes:writes([1_700_000,1_700_000,1_700_000,1_700_000,1_700_000]),validation_commands:validation},{provider:'overflow'});
  assert.deepEqual(overflow.changes,[]);
  assert.equal(overflow.total_write_byte_overflow,true);
  assert.equal(overflow.observed_write_bytes,8_500_000);
  assert.ok(overflow.risks.includes('CHANGESET_TOTAL_WRITE_BUDGET_EXCEEDED:8500000>8000000'));
  const boundary=normalizeProposal({summary:'boundary write set',changes:writes([2_000_000,2_000_000,2_000_000,2_000_000],'boundary'),validation_commands:validation},{provider:'boundary'});
  assert.equal(boundary.total_write_byte_overflow,false);
  assert.equal(boundary.observed_write_bytes,8_000_000);
  assert.equal(boundary.changes.length,4);
});

test('federated selection excludes a plan guaranteed to exceed total ChangeSet bytes before staging',()=>{
  const overflow={provider:'overflow',proposal:{summary:'oversized write set',changes:writes([1_700_000,1_700_000,1_700_000,1_700_000,1_700_000]),validation_commands:validation}};
  const good={provider:'good',proposal:{summary:'bounded write set',changes:writes([64],'good'),validation_commands:validation}};
  const result=selectFederatedProposal([overflow,good],{goal:'implement bounded write set'});
  assert.equal(result.winner?.provider,'good');
  assert.equal(result.consensus.validCount,1);
  assert.equal(result.ranked.find(x=>x.provider==='overflow')?.total_write_byte_overflow,true);
});
