import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {RclAuthorityGate} from '../core/rcl-authority.mjs';

const TEST_ID='auth-mgabc123-0123456789';
const context={workspace_write:true,shell_execute:true,changeset_apply:true,validation_execute:true,git_delivery:false,mission_advance:true,workspace_boundary:true,explicit_approval:false};
function withGate(fn){const root=fs.mkdtempSync(path.join(os.tmpdir(),'taowind-auth-stage-'));const gate=new RclAuthorityGate({runtimeDir:root,policyPath:path.join(root,'policy.rcl')});try{return fn(gate,root)}finally{fs.rmSync(root,{recursive:true,force:true})}}
function receipt(overrides={}){return {id:TEST_ID,protocol:'taowind-code.rcl-authority-receipt.v0.1',at:'2026-09-23T10:20:00.123Z',requestId:'req',action:'workspace_write',approvalMode:'workspace',workspace:null,allowed:false,reason:'RCL_POLICY_NOT_FOUND',policyDigest:null,materializedDigest:null,context:null,rcl:{error:'RCL_POLICY_NOT_FOUND',message:'missing policy'},metadata:{},...overrides}}

test('_record rejects impossible policy/context/materialization stage combinations',()=>withGate(gate=>{
  assert.throws(()=>gate._record(receipt({policyDigest:'a'.repeat(64)})),/INVALID_AUTHORITY_RECEIPT/);
  assert.throws(()=>gate._record(receipt({context,reason:'RCL_POLICY_INVALID',rcl:{error:'RCL_POLICY_INVALID',message:'invalid policy'}})),/INVALID_AUTHORITY_RECEIPT/);
  assert.throws(()=>gate._record(receipt({materializedDigest:'b'.repeat(64)})),/INVALID_AUTHORITY_RECEIPT/);
}));

test('_record preserves writer-reachable pre- and post-materialization error stages',()=>withGate((gate,root)=>{
  const pre=receipt({id:'auth-mgabc124-0123456789',policyDigest:'a'.repeat(64),context,reason:'RCL_POLICY_INVALID',rcl:{error:'RCL_POLICY_INVALID',message:'invalid policy'}});gate._record(pre);
  const post=receipt({id:'auth-mgabc125-0123456789',policyDigest:'a'.repeat(64),materializedDigest:'b'.repeat(64),context,reason:'RCL_RUNTIME_UNBOUND',rcl:{error:'RCL_RUNTIME_UNBOUND',message:'missing runtime'}});gate._record(post);
  assert.equal(JSON.parse(fs.readFileSync(path.join(root,'authority-receipts',`${pre.id}.json`),'utf8')).materializedDigest,null);
  assert.equal(JSON.parse(fs.readFileSync(path.join(root,'authority-receipts',`${post.id}.json`),'utf8')).context.workspace_boundary,true);
}));
