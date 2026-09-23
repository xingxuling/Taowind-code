import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {RclAuthorityGate} from '../core/rcl-authority.mjs';

const TEST_ID='auth-mgabc123-0123456789';
function withGate(fn){const root=fs.mkdtempSync(path.join(os.tmpdir(),'taowind-auth-error-reason-'));const gate=new RclAuthorityGate({runtimeDir:root,policyPath:path.join(root,'policy.rcl')});try{return fn(gate,root)}finally{fs.rmSync(root,{recursive:true,force:true})}}
function receipt(overrides={}){return {id:TEST_ID,protocol:'taowind-code.rcl-authority-receipt.v0.1',at:'2026-09-23T10:10:00.123Z',requestId:'req',action:'workspace_write',approvalMode:'workspace',workspace:null,allowed:false,reason:'RCL_POLICY_NOT_FOUND',policyDigest:null,materializedDigest:null,context:null,rcl:{error:'RCL_POLICY_NOT_FOUND',message:'missing policy'},metadata:{},...overrides}}

test('_record rejects an error envelope whose durable reason disagrees with rcl.error',()=>withGate(gate=>{assert.throws(()=>gate._record(receipt({reason:'RCL_RUNTIME_UNBOUND'})),/INVALID_AUTHORITY_RECEIPT/)}));
test('_record preserves the writer-owned matching error reason',()=>withGate((gate,root)=>{const value=receipt();gate._record(value);const durable=JSON.parse(fs.readFileSync(path.join(root,'authority-receipts',`${TEST_ID}.json`),'utf8'));assert.equal(durable.reason,durable.rcl.error)}));
