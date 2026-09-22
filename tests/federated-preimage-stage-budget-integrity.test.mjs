import test from 'node:test';
import assert from 'node:assert/strict';
import {selectFederatedProposal} from '../core/federated-generation.mjs';

const validation=['node --check src/app.mjs'];
const candidate=(provider,changes)=>({provider,proposal:{summary:provider,changes,validation_commands:validation}});

test('known oversized existing targets are rejected before selection',()=>{
  const result=selectFederatedProposal([
    candidate('oversized-existing',[{op:'write',path:'src/huge.mjs',content:'x'}]),
    candidate('good',[{op:'write',path:'src/app.mjs',content:'ok'}])
  ],{manifest:[{path:'src/huge.mjs',size:2_000_001},{path:'src/app.mjs',size:100}]});
  const bad=result.ranked.find(x=>x.provider==='oversized-existing');
  assert.equal(bad.existing_file_byte_overflow,true);
  assert.equal(bad.oversized_existing_file_count,1);
  assert.equal(result.winner?.provider,'good');
});

test('known preimage plus proposed postimage total over downstream budget is rejected',()=>{
  const changes=[0,1,2].map(i=>({op:'write',path:`src/f${i}.mjs`,content:'x'.repeat(1_800_000)}));
  const manifest=[0,1,2].map(i=>({path:`src/f${i}.mjs`,size:1_000_000}));
  const result=selectFederatedProposal([
    candidate('stage-overflow',changes),
    candidate('good',[{op:'write',path:'src/app.mjs',content:'ok'}])
  ],{manifest:[...manifest,{path:'src/app.mjs',size:100}]});
  const bad=result.ranked.find(x=>x.provider==='stage-overflow');
  assert.equal(bad.total_write_byte_overflow,false);
  assert.equal(bad.observed_write_bytes,5_400_000);
  assert.equal(bad.observed_preimage_bytes,3_000_000);
  assert.equal(bad.observed_stage_bytes,8_400_000);
  assert.equal(bad.stage_total_byte_overflow,true);
  assert.equal(result.winner?.provider,'good');
});

test('exact downstream byte boundaries remain eligible',()=>{
  const content='x'.repeat(2_000_000);
  const manifest=[{path:'src/a.mjs',size:2_000_000},{path:'src/b.mjs',size:2_000_000}];
  const result=selectFederatedProposal([
    candidate('boundary',[
      {op:'write',path:'src/a.mjs',content},
      {op:'write',path:'src/b.mjs',content}
    ])
  ],{manifest});
  assert.equal(result.winner?.provider,'boundary');
  assert.equal(result.winner?.existing_file_byte_overflow,false);
  assert.equal(result.winner?.stage_total_byte_overflow,false);
  assert.equal(result.winner?.observed_stage_bytes,8_000_000);
});
