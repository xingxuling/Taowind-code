import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeProposal,selectFederatedProposal} from '../core/federated-generation.mjs';

const command='node --check src/app.mjs';
const proposal=path=>({summary:`change ${path}`,changes:[{op:'write',path,content:'x'}],validation_commands:[command]});

test('credential-like change paths are rejected before federated selection',()=>{
  for(const path of ['.env','config/credentials.json','keys/id_rsa','certs/client.pem']){
    const normalized=normalizeProposal(proposal(path),{provider:'credential-candidate'});
    assert.equal(normalized.invalid_change_count,1,path);
    assert.deepEqual(normalized.changes,[],path);
    assert.equal(selectFederatedProposal([{provider:'credential-candidate',proposal:proposal(path)}],{goal:'change config'}).winner,null,path);
  }
});

test('ordinary source changes remain federated candidates',()=>{
  const safe=proposal('src/app.mjs');
  const normalized=normalizeProposal(safe,{provider:'safe'});
  assert.equal(normalized.invalid_change_count,0);
  assert.equal(normalized.changes.length,1);
  assert.equal(selectFederatedProposal([{provider:'safe',proposal:safe}],{goal:'change app'}).winner?.provider,'safe');
});
