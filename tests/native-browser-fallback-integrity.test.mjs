import test from 'node:test';
import assert from 'node:assert/strict';
import {nativeProposalExecutable,nativeFallbackRoles} from '../core/tao-ai-adapter.mjs';

const base={summary:'browser change',changes:[{op:'write',path:'src/app.mjs',content:'export const app=true;'}],validation_commands:['node --check src/app.mjs']};
const valid={...base,browser_checks:[{url:'https://example.invalid/',requiredSelectors:['#app']}]};
const invalid={...base,browser_checks:[{url:'file:///tmp/index.html',requiredSelectors:['#app']}]};
const overflow={...base,browser_checks:Array.from({length:9},(_,i)=>({url:`https://example${i}.invalid/`}))};

test('valid native browser proposal remains executable without fallback roles',()=>{
  assert.equal(nativeProposalExecutable(valid),true);
  assert.deepEqual(nativeFallbackRoles(valid),[]);
});

test('invalid native browser proposal is non-executable and triggers alternate native roles',()=>{
  assert.equal(nativeProposalExecutable(invalid),false);
  assert.deepEqual(nativeFallbackRoles(invalid),['architecture','verifier']);
});

test('over-budget native browser proposal triggers alternate native roles',()=>{
  assert.equal(nativeProposalExecutable(overflow),false);
  assert.deepEqual(nativeFallbackRoles(overflow),['architecture','verifier']);
});
