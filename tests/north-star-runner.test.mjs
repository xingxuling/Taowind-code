import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {TaskStore} from '../core/tasks.mjs';import {NorthStarRunner} from '../core/north-star-runner.mjs';
const allowGate={assert:async(action)=>({id:`auth-${action}`,allowed:true,action})};
test('fails honestly to WAITING_PROVIDER when local DWAC is unbound',()=>{const old=process.env.TAOWIND_DWAC_ROOT;delete process.env.TAOWIND_DWAC_ROOT;const base=fs.mkdtempSync(path.join(os.tmpdir(),'twc-ns-')),workspace=path.join(base,'repo'),runtime=path.join(base,'runtime');fs.mkdirSync(workspace);const runner=new NorthStarRunner({workspace,runtimeDir:runtime,taskStore:new TaskStore(runtime)});const run=runner.create('make it real');assert.equal(run.status,'WAITING_PROVIDER');assert.equal(run.dwac.connected,false);assert.match(run.blocker,/DWAC/);if(old)process.env.TAOWIND_DWAC_ROOT=old});
test('manual API changeset can close apply -> validate -> rollback path through authority',async()=>{const old=process.env.TAOWIND_DWAC_ROOT;delete process.env.TAOWIND_DWAC_ROOT;const base=fs.mkdtempSync(path.join(os.tmpdir(),'twc-ns-')),workspace=path.join(base,'repo'),runtime=path.join(base,'runtime');fs.mkdirSync(workspace);fs.writeFileSync(path.join(workspace,'a.js'),'export const n=1;\n');const runner=new NorthStarRunner({workspace,runtimeDir:runtime,taskStore:new TaskStore(runtime),authorityGate:allowGate});let run=runner.create('change n');const staged=runner.stage(run.id,[{op:'write',path:'a.js',content:'export const n=2;\n'}],['node --check a.js']);assert.equal(staged.run.status,'CHANGESET_STAGED');await runner.apply(run.id,{approvalMode:'workspace'});run=await runner.validate(run.id,{approvalMode:'workspace'});assert.equal(run.status,'READY_FOR_DELIVERY');run=await runner.rollback(run.id,{approvalMode:'workspace'});assert.equal(run.status,'ROLLED_BACK');assert.equal(fs.readFileSync(path.join(workspace,'a.js'),'utf8'),'export const n=1;\n');assert.equal(run.evidence.filter(x=>x.kind==='rcl-authority').length>=3,true);if(old)process.env.TAOWIND_DWAC_ROOT=old});
test('RCL denial stops changeset before any repository mutation',async()=>{const base=fs.mkdtempSync(path.join(os.tmpdir(),'twc-rcl-deny-')),workspace=path.join(base,'repo'),runtime=path.join(base,'runtime');fs.mkdirSync(workspace);fs.writeFileSync(path.join(workspace,'a.txt'),'before');const denyGate={assert:async()=>{throw Object.assign(new Error('denied'),{code:'RCL_AUTHORITY_DENIED',receipt:{id:'auth-deny',allowed:false,reason:'RCL_AUTHORITY_DENIED'}})}};const runner=new NorthStarRunner({workspace,runtimeDir:runtime,taskStore:new TaskStore(runtime),authorityGate:denyGate});const run=runner.create('mutate');runner.stage(run.id,[{op:'write',path:'a.txt',content:'after'}],['node -e "process.exit(0)"']);await assert.rejects(()=>runner.apply(run.id,{approvalMode:'workspace'}),/denied/);assert.equal(fs.readFileSync(path.join(workspace,'a.txt'),'utf8'),'before');const after=runner.get(run.id);assert.equal(after.status,'CHANGESET_STAGED');assert.equal(after.evidence.some(x=>x.kind==='rcl-authority-denied'),true)});

test('repair gate is real and fails closed when Tao AI is unbound',async()=>{
  const oldDwac=process.env.TAOWIND_DWAC_ROOT,oldTao=process.env.TAO_AI_ENDPOINT;
  delete process.env.TAO_AI_ENDPOINT;
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'taowind-repair-'));const runtime=path.join(dir,'.runtime');
  try{
    const fakeTasks={plan:()=>[],syncRun:()=>{}};
    const runner=new NorthStarRunner({workspace:dir,runtimeDir:runtime,taskStore:fakeTasks,authorityGate:allowGate});
    const run=runner.runs.create({goal:'repair me',mode:'DEEP_DEVELOPMENT',dwac:{connected:true,status:'COMPILED'}});
    runner.runs.update(run.id,{status:'REPAIR_REQUIRED',validation:{status:'FAILED',commands:['node -e "process.exit(1)"']}},'TEST_FAILURE');
    const repaired=await runner.repair(run.id,{approvalMode:'workspace'});
    assert.equal(repaired.status,'WAITING_PROVIDER');
    assert.equal(repaired.mode,'DEEP_DEVELOPMENT');
    assert.match(repaired.blocker,/Repair/);
  }finally{
    if(oldDwac===undefined)delete process.env.TAOWIND_DWAC_ROOT;else process.env.TAOWIND_DWAC_ROOT=oldDwac;
    if(oldTao===undefined)delete process.env.TAO_AI_ENDPOINT;else process.env.TAO_AI_ENDPOINT=oldTao;
    fs.rmSync(dir,{recursive:true,force:true});
  }
});
