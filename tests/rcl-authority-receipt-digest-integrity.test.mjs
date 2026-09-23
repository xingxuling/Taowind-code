import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {RclAuthorityGate} from '../core/rcl-authority.mjs';

const TEST_ID='auth-mgabc123-0123456789';
function withGate(fn){const root=fs.mkdtempSync(path.join(os.tmpdir(),'taowind-auth-digest-'));const gate=new RclAuthorityGate({runtimeDir:root,policyPath:path.join(root,'policy.rcl')});try{return fn(gate,root)}finally{fs.rmSync(root,{recursive:true,force:true})}}
function receipt(overrides={}){return {id:TEST_ID,protocol:'taowind-code.rcl-authority-receipt.v0.1',at:'2026-09-23T08:00:00.123Z',requestId:'req',action:'workspace_write',approvalMode:'workspace',workspace:null,allowed:false,reason:null,policyDigest:null,materializedDigest:null,context:null,rcl:null,metadata:{},...overrides}}

test('_record rejects non-SHA-256 digest representations',()=>withGate(gate=>{for(const value of ['abc','A'.repeat(64),'g'.repeat(64),'a'.repeat(63),'a'.repeat(65)])assert.throws(()=>gate._record(receipt({policyDigest:value})),/INVALID_AUTHORITY_RECEIPT/);assert.throws(()=>gate._record(receipt({materializedDigest:'b'.repeat(63)})),/INVALID_AUTHORITY_RECEIPT/)}));
test('_record persists null or lowercase 64-hex digest values',()=>withGate((gate,root)=>{const policyDigest='a'.repeat(64);const materializedDigest='b'.repeat(64);gate._record(receipt({policyDigest,materializedDigest}));const durable=JSON.parse(fs.readFileSync(path.join(root,'authority-receipts',`${TEST_ID}.json`),'utf8'));assert.equal(durable.policyDigest,policyDigest);assert.equal(durable.materializedDigest,materializedDigest)}));
