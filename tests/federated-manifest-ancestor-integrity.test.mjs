import test from 'node:test';
import assert from 'node:assert/strict';
import {selectFederatedProposal} from '../core/federated-generation.mjs';

const validation=['node --check src/app.mjs'];
const candidate=(provider,path)=>({provider,proposal:{summary:provider,changes:[{op:'write',path,content:'ok'}],validation_commands:validation}});

test('known file ancestors make a federated candidate non-executable before ChangeSet staging',()=>{
  const result=selectFederatedProposal([
    candidate('blocked','src/config/app.mjs'),
    candidate('good','src/app.mjs')
  ],{manifest:[{path:'src/config',size:123},{path:'src/app.mjs',size:10}]});
  const blocked=result.ranked.find(x=>x.provider==='blocked');
  assert.equal(blocked.ancestor_conflict,true);
  assert.deepEqual(blocked.non_directory_ancestor_paths,['src/config']);
  assert.equal(result.winner?.provider,'good');
});

test('an existing file at the exact target remains editable',()=>{
  const result=selectFederatedProposal([candidate('edit','src/config')],{manifest:[{path:'src/config',size:123}]});
  assert.equal(result.winner?.provider,'edit');
  assert.equal(result.winner?.ancestor_conflict,false);
});
