import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {RclAuthorityGate,authorityContextForMode} from '../core/rcl-authority.mjs';

const TEST_ID='auth-mgabc123-0123456789';
function withGate(fn){const root=fs.mkdtempSync(path.join(os.tmpdir(),'taowind-auth-context-mode-'));const gate=new RclAuthorityGate({runtimeDir:root,policyPath:path.join(root,'policy.rcl')});try{return fn(gate,root)}finally{fs.rmSync(root,{recursive:true,force:true})}}
function receipt(overrides={}){return {id:TEST_ID,protocol:'taowind-code.rcl-authority-receipt.v0.1',at:'2026-09-23T08:00:00.123Z',requestId:'req',action:'workspace_write',approvalMode:'workspace',workspace:null,allowed:false,reason:'TEST_REASON',policyDigest:null,materializedDigest:null,context:null,rcl:null,metadata:{},...overrides}}

test('_record rejects authority contexts that contradict approvalMode capabilities',()=>withGate(gate=>{
  const readOnlyEscalated={...authorityContextForMode('read_only'),workspace_write:true};assert.throws(()=>gate._record(receipt({approvalMode:'read_only',context:readOnlyEscalated})),/INVALID_AUTHORITY_RECEIPT/);
  const workspaceEscalated={...authorityContextForMode('workspace'),git_delivery:true};assert.throws(()=>gate._record(receipt({approvalMode:'workspace',context:workspaceEscalated})),/INVALID_AUTHORITY_RECEIPT/);
}));

test('_record preserves current approval-mode capability projections',()=>withGate((gate,root)=>{
  for(const approvalMode of ['read_only','workspace','full_access']){const value=receipt({id:`auth-mgabc12${approvalMode.length}-${'0123456789'.slice(0,10)}`,approvalMode,context:authorityContextForMode(approvalMode,{workspaceBoundary:false,explicitApproval:true})});gate._record(value);assert.deepEqual(value.context,authorityContextForMode(approvalMode,{workspaceBoundary:false,explicitApproval:true}))}
}));
