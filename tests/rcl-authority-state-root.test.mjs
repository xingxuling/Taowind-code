import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {RclAuthorityGate} from '../core/rcl-authority.mjs';

const context={workspace_write:true,shell_execute:true,changeset_apply:true,validation_execute:true,git_delivery:false,mission_advance:true,workspace_boundary:true,explicit_approval:false};
function withGate(fn){const root=fs.mkdtempSync(path.join(os.tmpdir(),'taowind-auth-state-root-'));const gate=new RclAuthorityGate({runtimeDir:root,policyPath:path.join(root,'policy.rcl')});try{return fn(gate,root)}finally{fs.rmSync(root,{recursive:true,force:true})}}
function receipt(stateRoot){return {id:'auth-mgabc131-0123456789',protocol:'taowind-code.rcl-authority-receipt.v0.1',at:'2026-09-23T10:25:00.123Z',requestId:'req',action:'workspace_write',approvalMode:'workspace',workspace:null,allowed:false,reason:'RCL_TRANSITION_NOT_REALIZED',policyDigest:'a'.repeat(64),materializedDigest:'b'.repeat(64),context,rcl:{stateRoot,rule:null,actor:null,authority:null,witnesses:[],historyLength:0},metadata:{}}}

test('_record rejects a runtime-result envelope whose stateRoot is not an RCL realityRoot',()=>withGate(gate=>{for(const value of [null,'not-a-root','A'.repeat(64),'a'.repeat(63)])assert.throws(()=>gate._record(receipt(value)),/INVALID_AUTHORITY_RECEIPT/)}));
test('_record preserves a lowercase SHA-256 RCL realityRoot',()=>withGate((gate,root)=>{const value=receipt('c'.repeat(64));gate._record(value);const durable=JSON.parse(fs.readFileSync(path.join(root,'authority-receipts',`${value.id}.json`),'utf8'));assert.equal(durable.rcl.stateRoot,'c'.repeat(64))}));
