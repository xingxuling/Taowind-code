import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeProposal,selectFederatedProposal} from '../core/federated-generation.mjs';

const change={op:'write',path:'src/app.mjs',content:'export const app=true;'};
const command='node --check src/app.mjs';
const validCheck={url:'https://example.invalid/',requiredSelectors:['#app'],requiredText:['Ready'],titleIncludes:'Example',urlIncludes:'example.invalid',forbidConsoleErrors:true,forbidPageExceptions:true,forbidCriticalNetworkErrors:true,screenshot:false};
const base={summary:'browser-facing change',changes:[change],validation_commands:[command],browser_checks:[validCheck]};

test('valid browser plans remain executable through federation',()=>{
  const proposal=normalizeProposal(base,{provider:'browser-provider'});
  assert.equal(proposal.invalid_browser_check_count,0);
  assert.equal(proposal.browser_check_overflow,false);
  assert.equal(proposal.browser_checks.length,1);
  assert.equal(proposal.browser_checks[0].url,'https://example.invalid/');
  assert.equal(selectFederatedProposal([{provider:'browser-provider',proposal:base}],{goal:'ship browser-facing change'}).winner?.provider,'browser-provider');
});

test('browser plans with invalid shape are not executable federation winners',()=>{
  const proposal=normalizeProposal({...base,browser_checks:[{...validCheck,requiredSelectors:'#app'}]});
  assert.equal(proposal.invalid_browser_check_count,1);
  assert.equal(selectFederatedProposal([{provider:'bad',proposal:{...base,browser_checks:[{...validCheck,requiredSelectors:'#app'}]}}],{goal:'ship browser-facing change'}).winner,null);
});

test('browser plan count obeys the existing acceptance hard budget',()=>{
  const checks=Array.from({length:9},(_,i)=>({...validCheck,url:`https://example${i}.invalid/`}));
  const proposal=normalizeProposal({...base,browser_checks:checks});
  assert.equal(proposal.browser_check_overflow,true);
  assert.equal(proposal.observed_browser_check_count,9);
  assert.equal(selectFederatedProposal([{provider:'too-many',proposal:{...base,browser_checks:checks}}],{goal:'ship browser-facing change'}).winner,null);
});

test('browser plans rejected by the existing observer URL boundary are not selected',()=>{
  const invalid={...validCheck,url:'file:///tmp/index.html'};
  const proposal=normalizeProposal({...base,browser_checks:[invalid]});
  assert.equal(proposal.invalid_browser_check_count,1);
  assert.equal(selectFederatedProposal([{provider:'bad-url',proposal:{...base,browser_checks:[invalid]}}],{goal:'ship browser-facing change'}).winner,null);
});
