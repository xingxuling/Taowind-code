import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeProposal} from '../core/federated-generation.mjs';

const base={summary:'repair',changes:[{op:'write',path:'src/app.mjs',content:'export const app=true;'}],validation_commands:['node --check src/app.mjs']};
const previous=[{url:'https://example.invalid/',requiredSelectors:['#app']}];
const chooseChecks=(proposal,prior)=>Array.isArray(proposal.browser_checks)?proposal.browser_checks:Array.isArray(prior)?prior:[];

test('omitted browser_checks remain absent so repair can inherit previous hard evidence plan',()=>{
  const proposal=normalizeProposal(base);
  assert.equal(proposal.browser_checks,undefined);
  assert.deepEqual(chooseChecks(proposal,previous),previous);
});

test('explicit empty browser_checks remain an explicit empty plan',()=>{
  const proposal=normalizeProposal({...base,browser_checks:[]});
  assert.deepEqual(proposal.browser_checks,[]);
  assert.deepEqual(chooseChecks(proposal,previous),[]);
});

test('present browser_checks are still normalized and preserved',()=>{
  const proposal=normalizeProposal({...base,browser_checks:previous});
  assert.equal(Array.isArray(proposal.browser_checks),true);
  assert.equal(proposal.browser_checks.length,1);
  assert.equal(proposal.browser_checks[0].url,'https://example.invalid/');
});
