import test from 'node:test';
import assert from 'node:assert/strict';
import {nativeProposalExecutable,nativeFallbackRoles} from '../core/tao-ai-adapter.mjs';

const unresolved={changes:[],validation_commands:[],needs_more_context:['core/a.mjs']};
const ready={changes:[{op:'write',path:'core/a.mjs',content:'x'}],validation_commands:['node --check core/a.mjs']};

test('native proposal executable requires both repository changes and real validation commands',()=>{
  assert.equal(nativeProposalExecutable(unresolved),false);
  assert.equal(nativeProposalExecutable({...ready,validation_commands:[]}),false);
  assert.equal(nativeProposalExecutable(ready),true);
});

test('native cognition expands to existing architecture/verifier roles only after the first native miss',()=>{
  assert.deepEqual(nativeFallbackRoles(unresolved),['architecture','verifier']);
  assert.deepEqual(nativeFallbackRoles(ready),[]);
});

test('explicit candidate count remains a bounded operator override',()=>{
  assert.deepEqual(nativeFallbackRoles(unresolved,{configuredCount:'1'}),[]);
  assert.deepEqual(nativeFallbackRoles(unresolved,{configuredCount:'2'}),['architecture']);
  assert.deepEqual(nativeFallbackRoles(ready,{configuredCount:'3'}),['architecture','verifier']);
  assert.deepEqual(nativeFallbackRoles(unresolved,{configuredCount:'invalid'}),[]);
});
