import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {RclAuthorityGate} from '../core/rcl-authority.mjs';

const TEST_ID='auth-mgabc123-0123456789';
function withGate(fn){const root=fs.mkdtempSync(path.join(os.tmpdir(),'taowind-auth-rcl-outcome-'));const gate=new RclAuthorityGate({runtimeDir:root,policyPath:path.join(root,'policy.rcl')});try{return fn(gate,root)}finally{fs.rmSync(root,{recursive:true,force:true})}}
function receipt(overrides={}){return {id:TEST_ID,protocol:'taowind-code.rcl-authority-receipt.v0.1',at:'2026-09-23T08:00:00.123Z',requestId:'req',action:'workspace_write',approvalMode:'workspace',workspace:null,allowed:false,reason:'RCL_RUNTIME_UNBOUND',policyDigest:null,materializedDigest:null,context:null,rcl:{error:'RCL_RUNTIME_UNBOUND',message:'missing runtime'},metadata:{},...overrides}}

test('_record rejects an RCL error envelope that claims an allowed outcome',()=>withGate(gate=>{assert.throws(()=>gate._record(receipt({allowed:true,reason:'RCL_AUTHORITY_GRANTED'})),/INVALID_AUTHORITY_RECEIPT/)}));
test('_record preserves the current denied error outcome',()=>withGate((gate,root)=>{const value=receipt();gate._record(value);assert.equal(JSON.parse(fs.readFileSync(path.join(root,'authority-receipts',`${TEST_ID}.json`),'utf8')).allowed,false)}));
