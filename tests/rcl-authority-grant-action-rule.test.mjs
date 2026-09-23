import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {RclAuthorityGate} from '../core/rcl-authority.mjs';

const TEST_ID='auth-mgabc123-0123456789';
const context={workspace_write:true,shell_execute:true,changeset_apply:true,validation_execute:true,git_delivery:false,mission_advance:true,workspace_boundary:true,explicit_approval:false};
function withGate(fn){const root=fs.mkdtempSync(path.join(os.tmpdir(),'taowind-auth-grant-rule-'));const gate=new RclAuthorityGate({runtimeDir:root,policyPath:path.join(root,'policy.rcl')});try{return fn(gate,root)}finally{fs.rmSync(root,{recursive:true,force:true})}}
function receipt(overrides={}){return {id:TEST_ID,protocol:'taowind-code.rcl-authority-receipt.v0.1',at:'2026-09-23T09:10:00.123Z',requestId:'req',action:'workspace_write',approvalMode:'workspace',workspace:null,allowed:true,reason:'RCL_AUTHORITY_GRANTED',policyDigest:'a'.repeat(64),materializedDigest:'b'.repeat(64),context,rcl:{stateRoot:null,rule:'authorize_workspace_write',actor:null,authority:{needs:['workspace.write']},witnesses:[],historyLength:1},metadata:{},...overrides}}

test('_record rejects a granted receipt whose runtime rule does not match the requested action',()=>withGate(gate=>{assert.throws(()=>gate._record(receipt({rcl:{stateRoot:null,rule:'authorize_shell_execute',actor:null,authority:{needs:['shell.execute']},witnesses:[],historyLength:1}})),/INVALID_AUTHORITY_RECEIPT/)}));
test('_record preserves the current granted action/rule pairing',()=>withGate((gate,root)=>{const value=receipt();gate._record(value);assert.equal(JSON.parse(fs.readFileSync(path.join(root,'authority-receipts',`${TEST_ID}.json`),'utf8')).rcl.rule,'authorize_workspace_write')}));
