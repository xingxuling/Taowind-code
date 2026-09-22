import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeProposal,selectFederatedProposal} from '../core/federated-generation.mjs';

const validation=['node --check src/ok.mjs'];

test('proposal normalization fails closed on ancestor-descendant change targets',()=>{
  const proposal=normalizeProposal({summary:'hierarchy collision',changes:[
    {op:'write',path:'node',content:'parent file'},
    {op:'write',path:'node/child.txt',content:'child file'},
  ],validation_commands:validation});
  assert.deepEqual(proposal.changes,[]);
  assert.deepEqual(proposal.overlapping_paths,['node','node/child.txt']);
  assert.ok(proposal.risks.includes('OVERLAPPING_CHANGE_PATH:node'));
  assert.ok(proposal.risks.includes('OVERLAPPING_CHANGE_PATH:node/child.txt'));
});

test('federation skips a hierarchy-colliding proposal and selects an executable alternative',()=>{
  const out=selectFederatedProposal([
    {provider:'dwac-native',role:'implementation',proposal:{summary:'colliding implementation',changes:[
      {op:'write',path:'node/child.txt',content:'child file'},
      {op:'write',path:'node',content:'parent file'},
    ],validation_commands:validation}},
    {provider:'dwac-native',role:'architecture',proposal:{summary:'valid alternative',changes:[
      {op:'write',path:'src/ok.mjs',content:'export const ok=true;\n'},
    ],validation_commands:validation}},
  ],{goal:'valid alternative'});
  assert.equal(out.winner.role,'architecture');
  assert.equal(out.consensus.validCount,1);
  const rejected=out.ranked.find(x=>x.role==='implementation');
  assert.equal(rejected.evaluation.overlappingPaths,2);
  assert.deepEqual(rejected.overlapping_paths,['node','node/child.txt']);
});
