import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {RclAuthorityGate} from '../core/rcl-authority.mjs';

function withGate(fn){const root=fs.mkdtempSync(path.join(os.tmpdir(),'taowind-auth-id-'));const gate=new RclAuthorityGate({runtimeDir:root,policyPath:path.join(root,'policy.rcl')});try{return fn(gate,root)}finally{fs.rmSync(root,{recursive:true,force:true})}}
function receipt(id){return {id,protocol:'taowind-code.rcl-authority-receipt.v0.1',at:'2026-09-23T08:00:00.123Z',requestId:'req',action:'workspace_write',approvalMode:'workspace',workspace:null,allowed:false,reason:'RCL_POLICY_NOT_FOUND',policyDigest:null,materializedDigest:null,context:null,rcl:{error:'RCL_POLICY_NOT_FOUND',message:'missing policy'},metadata:{}}}

test('_record rejects ids outside the store-owned writer shape before path construction',()=>withGate((gate,root)=>{for(const id of ['auth-','auth-test','AUTH-abc-0123456789','auth-abc-012345678A','auth-x/../../escaped'])assert.throws(()=>gate._record(receipt(id)),/INVALID_AUTHORITY_RECEIPT/);assert.equal(fs.existsSync(path.join(root,'escaped.json')),false);assert.deepEqual(fs.readdirSync(path.join(root,'authority-receipts')),[])}));
test('_record persists writer-compatible authority ids inside the receipt directory',()=>withGate((gate,root)=>{const id='auth-mgabc123-0123456789';gate._record(receipt(id));assert.equal(fs.existsSync(path.join(root,'authority-receipts',`${id}.json`)),true)}));
