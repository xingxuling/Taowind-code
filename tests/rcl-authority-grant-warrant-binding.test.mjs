import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {RclAuthorityGate} from '../core/rcl-authority.mjs';

const context={workspace_write:true,shell_execute:true,changeset_apply:true,validation_execute:true,git_delivery:false,mission_advance:true,workspace_boundary:true,explicit_approval:false};
function withGate(fn){const root=fs.mkdtempSync(path.join(os.tmpdir(),'taowind-auth-grant-binding-'));const gate=new RclAuthorityGate({runtimeDir:root,policyPath:path.join(root,'policy.rcl')});try{return fn(gate)}finally{fs.rmSync(root,{recursive:true,force:true})}}
function receipt({actor='builder',needs=[{capability:'workspace.write',target:'workspace'}],activeWarrants=[{subject:'builder',capability:'workspace.write',target:'workspace'}]}={}){return {id:'auth-mgabc135-0123456789',protocol:'taowind-code.rcl-authority-receipt.v0.1',at:'2026-09-23T10:45:00.123Z',requestId:'req',action:'workspace_write',approvalMode:'workspace',workspace:null,allowed:true,reason:'RCL_AUTHORITY_GRANTED',policyDigest:'a'.repeat(64),materializedDigest:'b'.repeat(64),context,rcl:{stateRoot:'c'.repeat(64),rule:'authorize_workspace_write',actor,authority:{needs,activeWarrants},witnesses:[],historyLength:1},metadata:{}}}

test('_record rejects granted authority evidence that canonical RCL could not realize',()=>withGate(gate=>{
  const invalid=[
    receipt({activeWarrants:[]}),
    receipt({actor:null}),
    receipt({activeWarrants:[{subject:'operator',capability:'workspace.write',target:'workspace'}]}),
    receipt({activeWarrants:[{subject:'builder',capability:'shell.execute',target:'workspace'}]}),
    receipt({activeWarrants:[{subject:'builder',capability:'workspace.write',target:'workspace.src'}]}),
    receipt({activeWarrants:[{subject:'builder',capability:'workspace.write',target:'*'}]}),
  ];
  for(const value of invalid)assert.throws(()=>gate._record(value),/INVALID_AUTHORITY_RECEIPT/);
}));

test('_record preserves exact and ancestor-scope grants emitted by canonical RCL source semantics',()=>withGate(gate=>{
  gate._record(receipt());
  gate._record(receipt({needs:[{capability:'workspace.write',target:'workspace.src'}],activeWarrants:[{subject:'builder',capability:'workspace.write',target:'workspace'}]}));
}));
