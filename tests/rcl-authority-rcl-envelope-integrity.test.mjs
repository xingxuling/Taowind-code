import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {RclAuthorityGate} from '../core/rcl-authority.mjs';

const TEST_ID='auth-mgabc123-0123456789';
function withGate(fn){const root=fs.mkdtempSync(path.join(os.tmpdir(),'taowind-auth-rcl-envelope-'));const gate=new RclAuthorityGate({runtimeDir:root,policyPath:path.join(root,'policy.rcl')});try{return fn(gate,root)}finally{fs.rmSync(root,{recursive:true,force:true})}}
function receipt(overrides={}){return {id:TEST_ID,protocol:'taowind-code.rcl-authority-receipt.v0.1',at:'2026-09-23T08:00:00.123Z',requestId:'req',action:'workspace_write',approvalMode:'workspace',workspace:null,allowed:false,reason:'TEST_REASON',policyDigest:null,materializedDigest:null,context:null,rcl:null,metadata:{},...overrides}}

const runtimePayload={stateRoot:null,rule:null,actor:null,authority:null,witnesses:[],historyLength:0};

test('_record rejects impossible RCL payload envelopes',()=>withGate(gate=>{
  for(const rcl of [{},{error:'RCL_RUNTIME_UNBOUND'},{...runtimePayload,witnesses:{}},{...runtimePayload,historyLength:-1}])assert.throws(()=>gate._record(receipt({rcl})),/INVALID_AUTHORITY_RECEIPT/);
}));

test('_record preserves current RCL error and runtime-result envelopes',()=>withGate((gate,root)=>{
  const errorValue=receipt({id:'auth-mgabc124-0123456789',rcl:{error:'RCL_RUNTIME_UNBOUND',message:'missing runtime'}});gate._record(errorValue);
  const resultValue=receipt({id:'auth-mgabc125-0123456789',rcl:runtimePayload});gate._record(resultValue);
  for(const value of [errorValue,resultValue])assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root,'authority-receipts',`${value.id}.json`),'utf8')).rcl,value.rcl);
}));
