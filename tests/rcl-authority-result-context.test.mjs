import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {RclAuthorityGate} from '../core/rcl-authority.mjs';

const TEST_ID='auth-mgabc123-0123456789';
const context={workspace_write:true,shell_execute:true,changeset_apply:true,validation_execute:true,git_delivery:false,mission_advance:true,workspace_boundary:true,explicit_approval:false};
function withGate(fn){const root=fs.mkdtempSync(path.join(os.tmpdir(),'taowind-auth-result-context-'));const gate=new RclAuthorityGate({runtimeDir:root,policyPath:path.join(root,'policy.rcl')});try{return fn(gate,root)}finally{fs.rmSync(root,{recursive:true,force:true})}}
function result(overrides={}){return {id:TEST_ID,protocol:'taowind-code.rcl-authority-receipt.v0.1',at:'2026-09-23T09:30:00.123Z',requestId:'req',action:'workspace_write',approvalMode:'workspace',workspace:null,allowed:false,reason:'RCL_TRANSITION_NOT_REALIZED',policyDigest:'a'.repeat(64),materializedDigest:'b'.repeat(64),context,rcl:{stateRoot:null,rule:'authorize_workspace_write',actor:null,authority:null,witnesses:[],historyLength:1},metadata:{},...overrides}}

test('_record rejects a runtime-result envelope without authority context',()=>withGate(gate=>{assert.throws(()=>gate._record(result({context:null})),/INVALID_AUTHORITY_RECEIPT/)}));
test('_record preserves current result and error writer context behavior',()=>withGate((gate,root)=>{const value=result();gate._record(value);const error=result({id:'auth-mgabc124-0123456789',context:null,policyDigest:null,materializedDigest:null,rcl:{error:'RCL_POLICY_NOT_FOUND',message:'missing policy'},reason:'RCL_POLICY_NOT_FOUND'});gate._record(error);assert.equal(JSON.parse(fs.readFileSync(path.join(root,'authority-receipts',`${value.id}.json`),'utf8')).context.workspace_boundary,true);assert.equal(JSON.parse(fs.readFileSync(path.join(root,'authority-receipts',`${error.id}.json`),'utf8')).context,null)}));
