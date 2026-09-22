import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeProposal,selectFederatedProposal} from '../core/federated-generation.mjs';

const validation=['node --check src/a.mjs'];

test('federated proposal canonicalizes trailing separators before consensus and context identity',()=>{
  const normalized=normalizeProposal({
    summary:'same target',
    changes:[{op:'write',path:'src/a.mjs/',content:'export const a=1;\n'}],
    validation_commands:validation,
    needs_more_context:['src/a.mjs/'],
  },{provider:'dwac-native',role:'implementation'});
  assert.equal(normalized.changes[0].path,'src/a.mjs');
  assert.deepEqual(normalized.needs_more_context,['src/a.mjs']);
});

test('trailing-separator aliases contribute exact consensus as one canonical target',()=>{
  const out=selectFederatedProposal([
    {provider:'provider-a',role:'implementation',proposal:{summary:'same target',changes:[{op:'write',path:'src/a.mjs/',content:'export const a=1;\n'}],validation_commands:validation}},
    {provider:'provider-b',role:'architecture',proposal:{summary:'same target',changes:[{op:'write',path:'src/a.mjs',content:'export const a=1;\n'}],validation_commands:validation}},
  ],{goal:'same target',manifest:['src/a.mjs']});
  assert.equal(out.consensus.exactAgreementCount,1);
  assert.equal(out.consensus.conflictedPathCount,0);
  assert.equal(out.winner.changes[0].path,'src/a.mjs');
});
