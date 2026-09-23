import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {RclAuthorityGate,authorityContextForMode} from '../core/rcl-authority.mjs';

const TEST_ID='auth-mgabc123-0123456789';
function withGate(fn){const root=fs.mkdtempSync(path.join(os.tmpdir(),'taowind-auth-context-'));const gate=new RclAuthorityGate({runtimeDir:root,policyPath:path.join(root,'policy.rcl')});try{return fn(gate,root)}finally{fs.rmSync(root,{recursive:true,force:true})}}
function receipt(overrides={}){return {id:TEST_ID,protocol:'taowind-code.rcl-authority-receipt.v0.1',at:'2026-09-23T08:00:00.123Z',requestId:'req',action:'workspace_write',approvalMode:'workspace',workspace:null,allowed:false,reason:'RCL_TRANSITION_NOT_REALIZED',policyDigest:'a'.repeat(64),materializedDigest:'b'.repeat(64),context:authorityContextForMode('workspace'),rcl:{stateRoot:null,rule:'authorize_workspace_write',actor:null,authority:null,witnesses:[],historyLength:1},metadata:{},...overrides}}

test('_record rejects incomplete or non-boolean authority contexts',()=>withGate(gate=>{
  assert.throws(()=>gate._record(receipt({context:{}})),/INVALID_AUTHORITY_RECEIPT/);
  const incomplete=authorityContextForMode('workspace');delete incomplete.git_delivery;assert.throws(()=>gate._record(receipt({context:incomplete})),/INVALID_AUTHORITY_RECEIPT/);
  const mistyped={...authorityContextForMode('workspace'),explicit_approval:'false'};assert.throws(()=>gate._record(receipt({context:mistyped})),/INVALID_AUTHORITY_RECEIPT/);
}));

test('_record preserves current writer-produced authority context shape',()=>withGate((gate,root)=>{
  const context=authorityContextForMode('workspace',{workspaceBoundary:false,explicitApproval:true});gate._record(receipt({context}));
  const durable=JSON.parse(fs.readFileSync(path.join(root,'authority-receipts',`${TEST_ID}.json`),'utf8'));assert.deepEqual(durable.context,context);
}));
