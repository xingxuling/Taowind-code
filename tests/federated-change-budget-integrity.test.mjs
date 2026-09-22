import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeProposal,selectFederatedProposal} from '../core/federated-generation.mjs';

const validation=['node --check core/a.mjs'];
const changes=count=>Array.from({length:count},(_,i)=>({op:'write',path:`generated/file-${String(i).padStart(3,'0')}.mjs`,content:`export const v${i}=${i};\n`}));

test('federated normalization fails closed when a proposal exceeds the existing 128-change ChangeSet hard budget',()=>{
  const overflow=normalizeProposal({summary:'oversized plan',changes:changes(129),validation_commands:validation},{provider:'overflow'});
  assert.deepEqual(overflow.changes,[]);
  assert.equal(overflow.change_overflow,true);
  assert.equal(overflow.observed_change_count,129);
  assert.ok(overflow.risks.includes('CHANGESET_FILE_BUDGET_EXCEEDED:129>128'));
  const boundary=normalizeProposal({summary:'boundary plan',changes:changes(128),validation_commands:validation},{provider:'boundary'});
  assert.equal(boundary.change_overflow,false);
  assert.equal(boundary.changes.length,128);
});

test('federated selection excludes guaranteed-too-large plans before ChangeSet staging',()=>{
  const overflow={provider:'overflow',proposal:{summary:'oversized plan',changes:changes(129),validation_commands:validation}};
  const good={provider:'good',proposal:{summary:'bounded plan',changes:[{op:'write',path:'core/a.mjs',content:'export const a=1;'}],validation_commands:validation}};
  const result=selectFederatedProposal([overflow,good],{goal:'implement bounded validated changes'});
  assert.equal(result.winner?.provider,'good');
  assert.equal(result.consensus.validCount,1);
  assert.equal(result.ranked.find(x=>x.provider==='overflow')?.change_overflow,true);
});
