import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {taoAIStatus} from '../core/tao-ai-adapter.mjs';
import {providerStatus} from '../core/providers.mjs';

function temp(prefix){return fs.mkdtempSync(path.join(os.tmpdir(),prefix))}
function snapshotEnv(){return {...process.env}}
function restoreEnv(before){for(const key of Object.keys(process.env))if(!(key in before))delete process.env[key];for(const [key,value] of Object.entries(before))process.env[key]=value}

test('DWAC native cognition is connected without external AI endpoint',()=>{
  const before=snapshotEnv();
  try{
    const dwac=temp('taowind-dwac-');
    fs.mkdirSync(path.join(dwac,'structural_generation'));
    fs.writeFileSync(path.join(dwac,'natural_conversation_runtime.py'),'# fixture\n');
    process.env.TAOWIND_DWAC_ROOT=dwac;
    delete process.env.TAO_AI_ENDPOINT;delete process.env.TAO_AI_ENDPOINTS;delete process.env.DWAC_LANGUAGE_ENDPOINT;delete process.env.DWAC_LANGUAGE_ENDPOINTS;
    const status=taoAIStatus();
    assert.equal(status.connected,true);
    assert.equal(status.nativeConnected,true);
    assert.equal(status.acceleratorConnected,false);
    assert.equal(status.required,false);
  }finally{restoreEnv(before)}
});

test('core readiness is DWAC plus RCL, not external AI',()=>{
  const before=snapshotEnv();
  try{
    const dwac=temp('taowind-dwac-');
    fs.mkdirSync(path.join(dwac,'structural_generation'));
    fs.writeFileSync(path.join(dwac,'natural_conversation_runtime.py'),'# fixture\n');
    const rcl=temp('taowind-rcl-');
    fs.mkdirSync(path.join(rcl,'src'));
    fs.writeFileSync(path.join(rcl,'src','index.mjs'),'export {}\n');
    process.env.TAOWIND_DWAC_ROOT=dwac;process.env.TAOWIND_RCL_ROOT=rcl;
    delete process.env.TAO_AI_ENDPOINT;delete process.env.TAO_AI_ENDPOINTS;delete process.env.DWAC_LANGUAGE_ENDPOINT;delete process.env.DWAC_LANGUAGE_ENDPOINTS;
    const status=providerStatus();
    assert.equal(status.core.connected,true);
    assert.equal(status.core.readyCount,2);
    assert.equal(status.core.totalCount,2);
    assert.equal(status.externalAI.connected,false);
    assert.equal(status.externalAI.required,false);
    assert.equal(status.cognition.connected,true);
  }finally{restoreEnv(before)}
});

test('external AI is represented only as an optional accelerator',()=>{
  const before=snapshotEnv();
  try{
    process.env.TAO_AI_ENDPOINT='http://127.0.0.1:1234';
    process.env.TAO_AI_MODEL='fixture-model';
    delete process.env.TAOWIND_DWAC_ROOT;delete process.env.TAOWIND_RCL_ROOT;
    const status=providerStatus();
    assert.equal(status.externalAI.connected,true);
    assert.equal(status.externalAI.required,false);
    assert.equal(status.core.connected,false);
  }finally{restoreEnv(before)}
});
