import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {RclAuthorityGate} from '../core/rcl-authority.mjs';

const context={workspace_write:true,shell_execute:true,changeset_apply:true,validation_execute:true,git_delivery:false,mission_advance:true,workspace_boundary:true,explicit_approval:false};
function withGate(fn){const root=fs.mkdtempSync(path.join(os.tmpdir(),'taowind-auth-rcl-lexical-'));const gate=new RclAuthorityGate({runtimeDir:root,policyPath:path.join(root,'policy.rcl')});try{return fn(gate)}finally{fs.rmSync(root,{recursive:true,force:true})}}
function receipt({actor='builder',needCapability='workspace.write',needTarget='workspace',subject=actor,warrantCapability=needCapability,warrantTarget=needTarget}={}){return {id:'auth-mgabc136-0123456789',protocol:'taowind-code.rcl-authority-receipt.v0.1',at:'2026-09-23T10:55:00.123Z',requestId:'req',action:'workspace_write',approvalMode:'workspace',workspace:null,allowed:true,reason:'RCL_AUTHORITY_GRANTED',policyDigest:'a'.repeat(64),materializedDigest:'b'.repeat(64),context,rcl:{stateRoot:'c'.repeat(64),rule:'authorize_workspace_write',actor,authority:{needs:[{capability:needCapability,target:needTarget}],activeWarrants:[{subject,capability:warrantCapability,target:warrantTarget}]},witnesses:[],historyLength:1},metadata:{}}}

test('_record rejects lexical identities canonical RCL source cannot parse',()=>withGate(gate=>{
  const invalid=[
    receipt({actor:'1builder',subject:'1builder'}),
    receipt({actor:'bad-actor',subject:'bad-actor'}),
    receipt({needCapability:'workspace..write',warrantCapability:'workspace..write'}),
    receipt({needCapability:'workspace/write',warrantCapability:'workspace/write'}),
    receipt({needTarget:'workspace path',warrantTarget:'workspace path'}),
    receipt({needTarget:'*',warrantTarget:'*'}),
  ];
  for(const value of invalid)assert.throws(()=>gate._record(value),/INVALID_AUTHORITY_RECEIPT/);
}));

test('_record preserves ASCII, underscore and Unicode identifiers emitted by canonical RCL lexer',()=>withGate(gate=>{
  gate._record(receipt());
  gate._record(receipt({actor:'_builder1',subject:'_builder1',needCapability:'workspace.write2',warrantCapability:'workspace.write2'}));
  gate._record(receipt({actor:'构建者',subject:'构建者',needCapability:'工作区.写入',warrantCapability:'工作区.写入',needTarget:'世界.代码',warrantTarget:'世界'}));
}));
