import test from 'node:test';
import assert from 'node:assert/strict';
import {nativeProposalExecutable,nativeFallbackRoles} from '../core/tao-ai-adapter.mjs';

const cmd='node --check core/a.mjs';

test('native fallback expands when the first raw proposal will be rejected by federation',()=>{
  const unsafe={changes:[{op:'write',path:'../escape.mjs',content:'x'}],validation_commands:[cmd]};
  const overflow={changes:[{op:'write',path:'core/a.mjs',content:'x'}],validation_commands:Array.from({length:9},(_,i)=>`echo ${i}`)};
  const ambiguous={changes:[{op:'write',path:'core/a.mjs',content:'a'},{op:'write',path:'core/a.mjs',content:'b'}],validation_commands:[cmd]};
  for(const proposal of [unsafe,overflow,ambiguous]){
    assert.equal(nativeProposalExecutable(proposal),false);
    assert.deepEqual(nativeFallbackRoles(proposal),['architecture','verifier']);
  }
});
