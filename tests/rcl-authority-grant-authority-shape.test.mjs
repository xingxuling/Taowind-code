import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {RclAuthorityGate} from '../core/rcl-authority.mjs';

const context={workspace_write:true,shell_execute:true,changeset_apply:true,validation_execute:true,git_delivery:false,mission_advance:true,workspace_boundary:true,explicit_approval:false};
function withGate(fn){const root=fs.mkdtempSync(path.join(os.tmpdir(),'taowind-auth-grant-shape-'));const gate=new RclAuthorityGate({runtimeDir:root,policyPath:path.join(root,'policy.rcl')});try{return fn(gate)}finally{fs.rmSync(root,{recursive:true,force:true})}}
function receipt(authority){return {id:'auth-mgabc134-0123456789',protocol:'taowind-code.rcl-authority-receipt.v0.1',at:'2026-09-23T10:35:00.123Z',requestId:'req',action:'workspace_write',approvalMode:'workspace',workspace:null,allowed:true,reason:'RCL_AUTHORITY_GRANTED',policyDigest:'a'.repeat(64),materializedDigest:'b'.repeat(64),context,rcl:{stateRoot:'c'.repeat(64),rule:'authorize_workspace_write',actor:'builder',authority,witnesses:[],historyLength:1},metadata:{}}}
const valid={needs:[{capability:'workspace.write',target:'workspace'}],activeWarrants:[{subject:'builder',capability:'workspace.write',target:'workspace'}]};

test('_record rejects grant authority shapes the formal RCL runtime cannot emit',()=>withGate(gate=>{
  for(const authority of [{needs:[{}],activeWarrants:[]},{needs:[{capability:'workspace.write',target:'workspace'}]},{needs:[{capability:'workspace.write',target:'workspace'}],activeWarrants:[{subject:'builder',capability:7,target:'workspace'}]}])assert.throws(()=>gate._record(receipt(authority)),/INVALID_AUTHORITY_RECEIPT/);
}));
test('_record preserves the canonical RCL grant authority shape',()=>withGate(gate=>{gate._record(receipt(valid))}));
