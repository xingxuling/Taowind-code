import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {RclAuthorityGate} from '../core/rcl-authority.mjs';

const TEST_ID='auth-mgabc123-0123456789';
function withGate(fn){const root=fs.mkdtempSync(path.join(os.tmpdir(),'taowind-auth-request-'));const gate=new RclAuthorityGate({runtimeDir:root,policyPath:path.join(root,'policy.rcl')});try{return fn(gate,root)}finally{fs.rmSync(root,{recursive:true,force:true})}}
function receipt(requestId){return {id:TEST_ID,protocol:'taowind-code.rcl-authority-receipt.v0.1',at:'2026-09-23T08:00:00.123Z',requestId,action:'workspace_write',approvalMode:'workspace',workspace:null,allowed:false,reason:'TEST_REASON',policyDigest:null,materializedDigest:null,context:null,rcl:null,metadata:{}}}

test('_record rejects empty or non-string request ids',()=>withGate(gate=>{for(const requestId of ['',null,123])assert.throws(()=>gate._record(receipt(requestId)),/INVALID_AUTHORITY_RECEIPT/)}));
test('_record persists a writer-compatible request id',()=>withGate((gate,root)=>{gate._record(receipt('req'));const durable=JSON.parse(fs.readFileSync(path.join(root,'authority-receipts',`${TEST_ID}.json`),'utf8'));assert.equal(durable.requestId,'req')}));
