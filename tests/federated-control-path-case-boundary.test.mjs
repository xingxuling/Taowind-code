import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeProposal,selectFederatedProposal} from '../core/federated-generation.mjs';

test('case variants of blocked control-plane path segments fail closed for changes and context recovery',()=>{
  for(const blocked of ['.GIT/config','src/.GiT/hooks/pre-commit','NODE_MODULES/pkg/index.js','.NeXt/cache/meta']){
    const proposal=normalizeProposal({
      summary:'must not touch control-plane paths',
      changes:[{op:'write',path:blocked,content:'blocked'}],
      validation_commands:['node --version'],
      needs_more_context:[blocked,'src/ok.mjs'],
    });
    assert.deepEqual(proposal.changes,[],blocked);
    assert.deepEqual(proposal.needs_more_context,['src/ok.mjs'],blocked);
  }
});

test('a case-variant git metadata proposal cannot become the executable federated winner',()=>{
  const result=selectFederatedProposal([{
    provider:'dwac-native',
    role:'implementation',
    proposal:{
      summary:'attempt control-plane edit',
      changes:[{op:'write',path:'.GIT/config',content:'[core]\nrepositoryformatversion = 0\n'}],
      validation_commands:['node --version'],
    },
  }],{goal:'maintain repository safely'});
  assert.equal(result.winner,null);
  assert.equal(result.consensus.validCount,0);
});
