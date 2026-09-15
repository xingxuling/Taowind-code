import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeProposal,selectFederatedProposal} from '../core/federated-generation.mjs';

test('proposal normalization rejects traversal and build outputs',()=>{
 const p=normalizeProposal({changes:[{op:'write',path:'../x',content:'x'},{op:'write',path:'dist/a.js',content:'x'},{op:'write',path:'core/a.mjs',content:'ok'}],validation_commands:['node --test','node --test']});
 assert.deepEqual(p.changes.map(x=>x.path),['core/a.mjs']);assert.deepEqual(p.validation_commands,['node --test']);
});

test('federation selects bounded candidate with validation over unsafe or plan-only outputs',()=>{
 const result=selectFederatedProposal([
  {provider:'planner',role:'architecture',proposal:{summary:'semantic repository design',changes:[],validation_commands:[]}},
  {provider:'impl',role:'implementation',proposal:{summary:'implement semantic repository graph and tests',changes:[{op:'write',path:'core/semantic-repo-graph.mjs',content:'export const x=1'}],validation_commands:['node --test tests/semantic-repo-graph.test.mjs'],risks:[]}},
  {provider:'bad',proposal:{summary:'semantic repo',changes:[{op:'write',path:'package-lock.json',content:'huge'}],validation_commands:[]}},
 ],{goal:'implement semantic repository graph with tests',manifest:[{path:'core/semantic-repo-graph.mjs'}]});
 assert.equal(result.winner.provider,'impl');assert.equal(result.consensus.candidateCount,3);assert.equal(result.consensus.validCount,1);
});
