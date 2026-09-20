import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeProposal,selectFederatedProposal} from '../core/federated-generation.mjs';

const validated=(content,role='implementation',provider='dwac-native',expectedSha256=null,path='src/target.mjs')=>({
  provider,role,
  proposal:{summary:'implement consensus target',changes:[{op:'write',path,content,...(expectedSha256?{expectedSha256}:{})}],validation_commands:['node --check src/target.mjs'],risks:[]}
});

test('exact independent cross-role agreement boosts the agreeing native proposal above a conflicting alternative',()=>{
  const out=selectFederatedProposal([
    validated('export const value=1;\n','implementation'),
    validated('export const value=1;\n','architecture'),
    validated('export const value=2;\n','verifier'),
  ],{goal:'implement consensus target',manifest:['src/target.mjs']});
  assert.equal(out.protocol,'taowind.federated-changeset-selection.v0.7');
  assert.equal(out.winner.proposal,undefined);
  assert.equal(out.winner.changes[0].content,'export const value=1;\n');
  assert.equal(out.winner.evaluation.agreedChanges,1);
  assert.equal(out.winner.evaluation.exactAgreement,1);
  assert.equal(out.consensus.independentOriginCount,3);
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
  assert.equal(out.consensus.independentOriginCount,1);
  assert.equal(out.consensus.exactAgreementCount,0);
});

test('repeating the same provider and role cannot manufacture independent consensus',()=>{
  const out=selectFederatedProposal([
    validated('export const value=1;\n','implementation','dwac-native'),
    validated('export const value=1;\n','implementation','dwac-native'),
    validated('export const value=2;\n','verifier','dwac-native'),
  ],{goal:'implement consensus target'});
  const implementation=out.ranked.find(x=>x.role==='implementation'&&x.changes[0]?.content==='export const value=1;\n');
  assert.equal(implementation.evaluation.exactAgreement,0);
  assert.equal(implementation.evaluation.agreedChanges,0);
  assert.equal(out.consensus.independentOriginCount,2);
  assert.equal(out.consensus.exactAgreementCount,0);
  assert.equal(out.consensus.conflictedPathCount,1);
});

test('the same exact change from different independent provider-role origins can support consensus',()=>{
  const out=selectFederatedProposal([
    validated('export const value=1;\n','implementation','dwac-native'),
    validated('export const value=1;\n','implementation','external-1'),
  ],{goal:'implement consensus target'});
  assert.equal(out.winner.evaluation.exactAgreement,1);
  assert.equal(out.winner.evaluation.agreedChanges,1);
  assert.equal(out.consensus.independentOriginCount,2);
  assert.equal(out.consensus.exactAgreementCount,1);
});

test('same content on the same path with different preimage gates is not exact consensus',()=>{
  const out=selectFederatedProposal([
    validated('export const value=1;\n','implementation','dwac-native','sha-old'),
    validated('export const value=1;\n','architecture','dwac-native','sha-new'),
  ],{goal:'implement consensus target',manifest:['src/target.mjs']});
  assert.equal(out.winner.evaluation.exactAgreement,0);
  assert.equal(out.winner.evaluation.agreedChanges,0);
  assert.equal(out.consensus.exactAgreementCount,0);
  assert.equal(out.consensus.conflictedPathCount,1);
  assert.deepEqual(out.consensus.conflictedPaths,['src/target.mjs']);
});

test('same content and matching preimage gate remains exact independent consensus',()=>{
  const out=selectFederatedProposal([
    validated('export const value=1;\n','implementation','dwac-native','sha-current'),
    validated('export const value=1;\n','architecture','dwac-native','sha-current'),
  ],{goal:'implement consensus target',manifest:['src/target.mjs']});
  assert.equal(out.winner.evaluation.exactAgreement,1);
  assert.equal(out.winner.evaluation.agreedChanges,1);
  assert.equal(out.consensus.exactAgreementCount,1);
  assert.equal(out.consensus.conflictedPathCount,0);
});

test('single-candidate behavior stays deterministic and consensus-neutral',()=>{
  const out=selectFederatedProposal([validated('export const value=1;\n')],{goal:'implement consensus target'});
  assert.equal(out.winner.role,'implementation');
  assert.equal(out.winner.evaluation.exactAgreement,0);
  assert.equal(out.winner.evaluation.conflictPaths,0);
  assert.equal(out.consensus.candidateCount,1);
  assert.equal(out.consensus.validCount,1);
  assert.equal(out.consensus.independentOriginCount,1);
  assert.equal(out.consensus.conflictedPathCount,0);
});

test('canonical path aliases count as the same exact change',()=>{
  const out=selectFederatedProposal([
    validated('export const value=1;\n','implementation','dwac-native',null,'src/../src/target.mjs'),
    validated('export const value=1;\n','architecture','dwac-native',null,'src/target.mjs'),
  ],{goal:'implement consensus target',manifest:['./src/target.mjs']});
  assert.equal(out.consensus.exactAgreementCount,1);
  assert.equal(out.consensus.conflictedPathCount,0);
  assert.equal(out.winner.changes[0].path,'src/target.mjs');
  assert.equal(out.winner.evaluation.existingEdits,1);
});

test('canonical path aliases expose same-file conflicts instead of evading them',()=>{
  const out=selectFederatedProposal([
    validated('export const value=1;\n','implementation','dwac-native',null,'src/../src/target.mjs'),
    validated('export const value=2;\n','architecture','dwac-native',null,'src/target.mjs'),
  ],{goal:'implement consensus target'});
  assert.equal(out.consensus.exactAgreementCount,0);
  assert.equal(out.consensus.conflictedPathCount,1);
  assert.deepEqual(out.consensus.conflictedPaths,['src/target.mjs']);
});

test('context requests are canonicalized and deduplicated before recovery',()=>{
  const p=normalizeProposal({changes:[],validation_commands:[],needs_more_context:['src/../src/target.mjs','src/target.mjs','../escape.txt','.git/config']});
  assert.deepEqual(p.needs_more_context,['src/target.mjs']);
});

test('context recovery aggregates requests from non-winning candidates',()=>{
  const out=selectFederatedProposal([
    validated('export const value=1;\n','implementation','dwac-native'),
    {provider:'dwac-native',role:'architecture',proposal:{summary:'need repository context',changes:[],validation_commands:[],needs_more_context:['src/critical.mjs']}},
  ],{goal:'implement consensus target'});
  assert.equal(out.winner.role,'implementation');
  assert.deepEqual(out.contextRequests,['src/critical.mjs']);
});

test('credential-like context requests are rejected before recovery',()=>{
  const p=normalizeProposal({changes:[],validation_commands:[],needs_more_context:['.env','.env.local','secrets.json','credentials.yaml','id_rsa','cert.pem','src/ok.mjs']});
  assert.deepEqual(p.needs_more_context,['src/ok.mjs']);
});

test('identical duplicate changes on one canonical path collapse deterministically',()=>{
  const p=normalizeProposal({summary:'duplicate exact write',changes:[
    {op:'write',path:'src/../src/target.mjs',content:'export const value=1;\n',expectedSha256:'sha-current'},
    {op:'write',path:'src/target.mjs',content:'export const value=1;\n',expectedSha256:'sha-current'},
  ],validation_commands:['node --check src/target.mjs']});
  assert.equal(p.changes.length,1);
  assert.deepEqual(p.ambiguous_paths,[]);
  assert.equal(p.changes[0].path,'src/target.mjs');
});

test('conflicting writes inside one proposal fail closed instead of last-write-wins',()=>{
  const p=normalizeProposal({summary:'conflicting writes',changes:[
    {op:'write',path:'src/../src/target.mjs',content:'export const value=1;\n'},
    {op:'write',path:'src/target.mjs',content:'export const value=2;\n'},
  ],validation_commands:['node --check src/target.mjs']});
  assert.deepEqual(p.changes,[]);
  assert.deepEqual(p.ambiguous_paths,['src/target.mjs']);
  assert.ok(p.risks.includes('AMBIGUOUS_CHANGE_PATH:src/target.mjs'));
});

test('write-delete ambiguity inside one proposal fails closed',()=>{
  const p=normalizeProposal({summary:'conflicting ops',changes:[
    {op:'write',path:'src/target.mjs',content:'export const value=1;\n'},
    {op:'delete',path:'src/target.mjs'},
  ],validation_commands:['node --check src/target.mjs']});
  assert.deepEqual(p.changes,[]);
  assert.deepEqual(p.ambiguous_paths,['src/target.mjs']);
});

test('federation skips an ambiguous proposal and selects an executable alternative',()=>{
  const out=selectFederatedProposal([
    {provider:'dwac-native',role:'implementation',proposal:{summary:'implement consensus target with conflict',changes:[
      {op:'write',path:'src/target.mjs',content:'export const value=1;\n'},
      {op:'write',path:'src/target.mjs',content:'export const value=2;\n'},
    ],validation_commands:['node --check src/target.mjs']}},
    validated('export const value=3;\n','architecture','dwac-native'),
  ],{goal:'implement consensus target'});
  assert.equal(out.winner.role,'architecture');
  assert.equal(out.consensus.validCount,1);
  const ambiguous=out.ranked.find(x=>x.role==='implementation');
  assert.equal(ambiguous.evaluation.ambiguousPaths,1);
  assert.deepEqual(ambiguous.ambiguous_paths,['src/target.mjs']);
});
