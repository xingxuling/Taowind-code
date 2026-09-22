import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeProposal,selectFederatedProposal} from '../core/federated-generation.mjs';

const validation=['node --check core/a.mjs'];

function candidate(size,provider='candidate'){
  return {provider,proposal:{summary:'bounded generated file',changes:[{op:'write',path:`generated/${provider}.txt`,content:'a'.repeat(size)}],validation_commands:validation}};
}

test('federated normalization fails closed when one proposed write exceeds the existing 2,000,000-byte ChangeSet file budget',()=>{
  const overflow=normalizeProposal(candidate(2_000_001).proposal,{provider:'overflow'});
  assert.deepEqual(overflow.changes,[]);
  assert.equal(overflow.file_byte_overflow,true);
  assert.equal(overflow.oversized_file_count,1);
  assert.ok(overflow.risks.includes('CHANGE_FILE_BUDGET_EXCEEDED:1:2000000'));
  const boundary=normalizeProposal(candidate(2_000_000).proposal,{provider:'boundary'});
  assert.equal(boundary.file_byte_overflow,false);
  assert.equal(Buffer.byteLength(boundary.changes[0].content,'utf8'),2_000_000);
});

test('federated selection excludes a guaranteed-too-large file before ChangeSet staging',()=>{
  const overflow=candidate(2_000_001,'overflow');
  const good=candidate(64,'good');
  const result=selectFederatedProposal([overflow,good],{goal:'implement bounded generated file'});
  assert.equal(result.winner?.provider,'good');
  assert.equal(result.consensus.validCount,1);
  assert.equal(result.ranked.find(x=>x.provider==='overflow')?.file_byte_overflow,true);
});
