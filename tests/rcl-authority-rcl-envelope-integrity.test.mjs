import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {RclAuthorityGate} from '../core/rcl-authority.mjs';

const TEST_ID='auth-mgabc123-0123456789';
const context={workspace_write:true,shell_execute:true,changeset_apply:true,validation_execute:true,git_delivery:false,mission_advance:true,workspace_boundary:true,explicit_approval:false};
function withGate(fn){const root=fs.mkdtempSync(path.join(os.tmpdir(),'taowind-auth-rcl-envelope-'));const gate=new RclAuthorityGate({runtimeDir:root,policyPath:path.join(root,'policy.rcl')});try{return fn(gate,root)}finally{fs.rmSync(root,{recursive:true,force:true})}}
function errorReceipt(overrides={}){return {id:TEST_ID,protocol:'taowind-code.rcl-authority-receipt.v0.1',at:'2026-09-23T08:00:00.123Z',requestId:'req',action:'workspace_write',approvalMode:'workspace',workspace:null,allowed:false,reason:'RCL_POLICY_NOT_FOUND',policyDigest:null,materializedDigest:null,context:null,rcl:{error:'RCL_POLICY_NOT_FOUND',message:'missing policy'},metadata:{},...overrides}}
const runtimePayload={stateRoot:null,rule:null,actor:null,authority:null,witnesses:[],historyLength:0};
function resultReceipt(overrides={}){return {id:'auth-mgabc125-0123456789',protocol:'taowind-code.rcl-authority-receipt.v0.1',at:'2026-09-23T08:00:00.123Z',requestId:'req',action:'workspace_write',approvalMode:'workspace',workspace:null,allowed:false,reason:'RCL_TRANSITION_NOT_REALIZED',policyDigest:'a'.repeat(64),materializedDigest:'b'.repeat(64),context,rcl:runtimePayload,metadata:{},...overrides}}

test('_record rejects impossible RCL payload envelopes',()=>withGate(gate=>{
  assert.throws(()=>gate._record(errorReceipt({rcl:{}})),/INVALID_AUTHORITY_RECEIPT/);
  assert.throws(()=>gate._record(errorReceipt({rcl:{error:'RCL_RUNTIME_UNBOUND'}})),/INVALID_AUTHORITY_RECEIPT/);
  assert.throws(()=>gate._record(resultReceipt({rcl:{...runtimePayload,witnesses:{}}})),/INVALID_AUTHORITY_RECEIPT/);
  assert.throws(()=>gate._record(resultReceipt({rcl:{...runtimePayload,historyLength:-1}})),/INVALID_AUTHORITY_RECEIPT/);
}));

test('_record preserves current RCL error and runtime-result envelopes',()=>withGate((gate,root)=>{
  const errorValue=errorReceipt({id:'auth-mgabc124-0123456789'});gate._record(errorValue);
  const resultValue=resultReceipt();gate._record(resultValue);
  for(const value of [errorValue,resultValue])assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root,'authority-receipts',`${value.id}.json`),'utf8')).rcl,value.rcl);
}));
