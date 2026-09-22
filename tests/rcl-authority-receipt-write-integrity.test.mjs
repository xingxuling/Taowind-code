import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {RclAuthorityGate} from '../core/rcl-authority.mjs';

const policyPath=path.resolve('contracts/approval-policy.rcl');
function withGate(){const runtime=fs.mkdtempSync(path.join(os.tmpdir(),'twc-rcl-receipt-'));const gate=new RclAuthorityGate({policyPath,runtimeDir:runtime,rclRoot:path.join(runtime,'missing-rcl')});return {runtime,gate}}
function cleanup(runtime){fs.rmSync(runtime,{recursive:true,force:true})}

test('valid denied authority receipt still persists',async()=>{const {runtime,gate}=withGate();try{const receipt=await gate.decide('workspace_write',{approvalMode:'workspace',workspace:'/repo',metadata:{kind:'probe'}});assert.equal(receipt.allowed,false);assert.equal(receipt.reason,'RCL_RUNTIME_UNBOUND');assert.equal(receipt.protocol,'taowind-code.rcl-authority-receipt.v0.1');assert.equal(fs.existsSync(path.join(runtime,'authority-receipts',`${receipt.id}.json`)),true)}finally{cleanup(runtime)}});
for(const [name,action,context] of [
  ['unknown action','not_registered',{approvalMode:'workspace'}],
  ['unknown approval mode','workspace_write',{approvalMode:'owner'}],
  ['non-string request id','workspace_write',{approvalMode:'workspace',requestId:123}],
  ['non-string workspace','workspace_write',{approvalMode:'workspace',workspace:123}],
  ['non-object metadata','workspace_write',{approvalMode:'workspace',metadata:[]}]
])test(`authority receipt rejects ${name}`,async()=>{const {runtime,gate}=withGate();try{await assert.rejects(gate.decide(action,context),error=>error instanceof Error&&error.message==='INVALID_AUTHORITY_RECEIPT');assert.deepEqual(fs.readdirSync(path.join(runtime,'authority-receipts')),[])}finally{cleanup(runtime)}});
