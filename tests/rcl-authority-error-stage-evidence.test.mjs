import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {RclAuthorityGate,authorityContextForMode} from '../core/rcl-authority.mjs';

const ID='auth-mgabc123-0123456789';
function withGate(fn){const root=fs.mkdtempSync(path.join(os.tmpdir(),'taowind-auth-stage-'));const gate=new RclAuthorityGate({runtimeDir:root,policyPath:path.join(root,'policy.rcl')});try{return fn(gate,root)}finally{fs.rmSync(root,{recursive:true,force:true})}}
function errorReceipt(overrides={}){return {id:ID,protocol:'taowind-code.rcl-authority-receipt.v0.1',at:'2026-09-23T10:05:00.123Z',requestId:'req',action:'workspace_write',approvalMode:'workspace',workspace:null,allowed:false,reason:'RCL_AUTHORITY_ERROR',policyDigest:null,materializedDigest:null,context:null,rcl:{error:'RCL_AUTHORITY_ERROR',message:'error'},metadata:{},...overrides}}

test('_record preserves reachable error-stage evidence prefixes',()=>withGate(gate=>{
  assert.doesNotThrow(()=>gate._record(errorReceipt()));
  assert.doesNotThrow(()=>gate._record(errorReceipt({id:'auth-mgabc124-0123456789',policyDigest:'a'.repeat(64)})));
  assert.doesNotThrow(()=>gate._record(errorReceipt({id:'auth-mgabc125-0123456789',policyDigest:'a'.repeat(64),context:authorityContextForMode('workspace')})));
  assert.doesNotThrow(()=>gate._record(errorReceipt({id:'auth-mgabc126-0123456789',policyDigest:'a'.repeat(64),context:authorityContextForMode('workspace'),materializedDigest:'b'.repeat(64)})));
}));

test('_record rejects error evidence that skips writer stages',()=>withGate(gate=>{
  assert.throws(()=>gate._record(errorReceipt({id:'auth-mgabc127-0123456789',context:authorityContextForMode('workspace')})),/INVALID_AUTHORITY_RECEIPT/);
  assert.throws(()=>gate._record(errorReceipt({id:'auth-mgabc128-0123456789',materializedDigest:'b'.repeat(64)})),/INVALID_AUTHORITY_RECEIPT/);
  assert.throws(()=>gate._record(errorReceipt({id:'auth-mgabc129-0123456789',policyDigest:'a'.repeat(64),materializedDigest:'b'.repeat(64)})),/INVALID_AUTHORITY_RECEIPT/);
}));
