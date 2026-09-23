import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {RclAuthorityGate} from '../core/rcl-authority.mjs';

const context={workspace_write:true,shell_execute:true,changeset_apply:true,validation_execute:true,git_delivery:false,mission_advance:true,workspace_boundary:true,explicit_approval:false};
function withGate(fn){const root=fs.mkdtempSync(path.join(os.tmpdir(),'taowind-auth-result-shape-'));const gate=new RclAuthorityGate({runtimeDir:root,policyPath:path.join(root,'policy.rcl')});try{return fn(gate)}finally{fs.rmSync(root,{recursive:true,force:true})}}
function receipt(rcl){return {id:'auth-mgabc132-0123456789',protocol:'taowind-code.rcl-authority-receipt.v0.1',at:'2026-09-23T10:30:00.123Z',requestId:'req',action:'workspace_write',approvalMode:'workspace',workspace:null,allowed:false,reason:'RCL_TRANSITION_NOT_REALIZED',policyDigest:'a'.repeat(64),materializedDigest:'b'.repeat(64),context,rcl,metadata:{}}}
const base={stateRoot:'c'.repeat(64),rule:null,actor:null,authority:null,witnesses:[],historyLength:0};

test('_record rejects result scalar and witness shapes the formal RCL runtime cannot emit',()=>withGate(gate=>{
  for(const rcl of [{...base,rule:7},{...base,actor:{}},{...base,witnesses:['ok',7]}])assert.throws(()=>gate._record(receipt(rcl)),/INVALID_AUTHORITY_RECEIPT/);
}));
test('_record preserves writer-shaped null/string transition fields and string witnesses',()=>withGate(gate=>{
  gate._record(receipt(base));
  gate._record({...receipt({...base,rule:'authorize_workspace_write',actor:'builder',witnesses:['witness:one']}),id:'auth-mgabc133-0123456789'});
}));
