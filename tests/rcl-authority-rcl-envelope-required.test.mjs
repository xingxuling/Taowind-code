import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {RclAuthorityGate} from '../core/rcl-authority.mjs';

const TEST_ID='auth-mgabc123-0123456789';
function withGate(fn){const root=fs.mkdtempSync(path.join(os.tmpdir(),'taowind-auth-rcl-envelope-'));const gate=new RclAuthorityGate({runtimeDir:root,policyPath:path.join(root,'policy.rcl')});try{return fn(gate,root)}finally{fs.rmSync(root,{recursive:true,force:true})}}
function base(overrides={}){return {id:TEST_ID,protocol:'taowind-code.rcl-authority-receipt.v0.1',at:'2026-09-23T09:25:00.123Z',requestId:'req',action:'workspace_write',approvalMode:'workspace',workspace:null,allowed:false,reason:'RCL_RUNTIME_UNBOUND',policyDigest:null,materializedDigest:null,context:null,rcl:{error:'RCL_RUNTIME_UNBOUND',message:'missing runtime'},metadata:{},...overrides}}

test('_record rejects a durable receipt without an RCL outcome envelope',()=>withGate(gate=>{assert.throws(()=>gate._record(base({rcl:null})),/INVALID_AUTHORITY_RECEIPT/)}));
test('_record preserves both current writer envelope families',()=>withGate((gate,root)=>{gate._record(base());const result=base({id:'auth-mgabc124-0123456789',allowed:false,reason:'RCL_TRANSITION_NOT_REALIZED',policyDigest:'a'.repeat(64),materializedDigest:'b'.repeat(64),context:{workspace_write:true,shell_execute:true,changeset_apply:true,validation_execute:true,git_delivery:false,mission_advance:true,workspace_boundary:true,explicit_approval:false},rcl:{stateRoot:null,rule:'authorize_workspace_write',actor:null,authority:null,witnesses:[],historyLength:1}});gate._record(result);assert.equal(JSON.parse(fs.readFileSync(path.join(root,'authority-receipts',`${result.id}.json`),'utf8')).rcl.historyLength,1)}));
