import test from 'node:test';
import assert from 'node:assert/strict';
import {selectFederatedProposal} from '../core/federated-generation.mjs';

const validated=(content,role='implementation')=>({
  provider:'dwac-native',role,
  proposal:{summary:'implement consensus target',changes:[{op:'write',path:'src/target.mjs',content}],validation_commands:['node --check src/target.mjs'],risks:[]}
});

test('exact cross-role agreement boosts the agreeing native proposal above a conflicting alternative',()=>{
  const out=selectFederatedProposal([
    validated('export const value=1;\n','implementation'),
    validated('export const value=1;\n','architecture'),
    validated('export const value=2;\n','verifier'),
  ],{goal:'implement consensus target',manifest:['src/target.mjs']});
  assert.equal(out.protocol,'taowind.federated-changeset-selection.v0.2');
  assert.equal(out.winner.proposal,undefined);
  assert.equal(out.winner.changes[0].content,'export const value=1;\n');
  assert.equal(out.winner.evaluation.agreedChanges,1);
  assert.equal(out.winner.evaluation.exactAgreement,1);
  assert.equal(out.consensus.exactAgreementCount,1);
  assert.equal(out.consensus.conflictedPathCount,1);
  assert.deepEqual(out.consensus.conflictedPaths,['src/target.mjs']);
});

test('a non-executable proposal cannot manufacture consensus support',()=>{
  const out=selectFederatedProposal([
    validated('export const value=1;\n','implementation'),
    {provider:'dwac-native',role:'architecture',proposal:{summary:'same guess without validation',changes:[{op:'write',path:'src/target.mjs',content:'export const value=1;\n'}],validation_commands:[]}},
  ],{goal:'implement consensus target'});
  assert.equal(out.winner.evaluation.exactAgreement,0);
  assert.equal(out.winner.evaluation.agreedChanges,0);
  assert.equal(out.consensus.executableCount,1);
  assert.equal(out.consensus.exactAgreementCount,0);
});

test('single-candidate behavior stays deterministic and consensus-neutral',()=>{
  const out=selectFederatedProposal([validated('export const value=1;\n')],{goal:'implement consensus target'});
  assert.equal(out.winner.role,'implementation');
  assert.equal(out.winner.evaluation.exactAgreement,0);
  assert.equal(out.winner.evaluation.conflictPaths,0);
  assert.equal(out.consensus.candidateCount,1);
  assert.equal(out.consensus.validCount,1);
  assert.equal(out.consensus.conflictedPathCount,0);
});
