import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeProposal,selectFederatedProposal} from '../core/federated-generation.mjs';

const check={url:'https://example.invalid/',requiredSelectors:['#app'],forbidConsoleErrors:true,screenshot:true};
const base={summary:'browser-facing change',changes:[{op:'write',path:'src/app.mjs',content:'export const app=true;'}],validation_commands:['node --check src/app.mjs'],browser_checks:[check]};

test('federated normalization preserves a provider-authored browser validation plan',()=>{
  const proposal=normalizeProposal(base,{provider:'browser-provider'});
  assert.deepEqual(proposal.browser_checks,[check]);
});

test('federated winner keeps browser checks for NorthStarRunner browser acceptance',()=>{
  const out=selectFederatedProposal([{provider:'browser-provider',proposal:base}],{goal:'ship browser-facing change'});
  assert.equal(out.winner?.provider,'browser-provider');
  assert.deepEqual(out.winner?.browser_checks,[check]);
});
