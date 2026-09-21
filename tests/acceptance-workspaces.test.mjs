import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {inferValidationCommands,runAcceptance} from '../core/acceptance.mjs';

test('npm workspace validation does not let a passing root check mask a failing child test',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'twc-acc-workspaces-'));
  fs.mkdirSync(path.join(root,'packages','app'),{recursive:true});
  fs.writeFileSync(path.join(root,'package.json'),JSON.stringify({private:true,workspaces:['packages/*'],scripts:{check:'node -e "process.exit(0)"'}}));
  fs.writeFileSync(path.join(root,'packages','app','package.json'),JSON.stringify({name:'app',version:'1.0.0',scripts:{test:'node -e "process.exit(7)"'}}));
  const commands=inferValidationCommands(root);
  assert.equal(commands.length,5);
  assert.ok(commands.some(command=>command.includes('npm run test --workspaces --if-present')));
  const result=await runAcceptance(root,null,{mode:'workspace'});
  assert.equal(result.passed,false);
  assert.equal(result.hardGate,'COMMAND_FAILED');
  assert.equal(result.results.length,2);
  assert.equal(result.results[0].code,0);
  assert.notEqual(result.results[1].code,0);
});

test('npm workspace validation discovers child-only validation when root has no standard validation script',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'twc-acc-workspaces-child-only-'));
  fs.mkdirSync(path.join(root,'packages','app'),{recursive:true});
  fs.writeFileSync(path.join(root,'package.json'),JSON.stringify({private:true,workspaces:['packages/*']}));
  fs.writeFileSync(path.join(root,'packages','app','package.json'),JSON.stringify({name:'app',version:'1.0.0',scripts:{test:'node -e "process.exit(7)"'}}));
  const commands=inferValidationCommands(root);
  assert.deepEqual(commands,['npm run test --if-present && npm run test --workspaces --if-present']);
  const result=await runAcceptance(root,null,{mode:'workspace'});
  assert.equal(result.passed,false);
  assert.equal(result.hardGate,'COMMAND_FAILED');
  assert.equal(result.results.length,1);
  assert.notEqual(result.results[0].code,0);
});

test('npm workspace discovery does not convert missing validation scripts into no-op evidence',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'twc-acc-workspaces-empty-'));
  fs.mkdirSync(path.join(root,'packages','app'),{recursive:true});
  fs.writeFileSync(path.join(root,'package.json'),JSON.stringify({private:true,workspaces:['packages/*']}));
  fs.writeFileSync(path.join(root,'packages','app','package.json'),JSON.stringify({name:'app',version:'1.0.0',scripts:{start:'node app.js'}}));
  assert.deepEqual(inferValidationCommands(root),[]);
  const result=await runAcceptance(root,null,{mode:'workspace'});
  assert.equal(result.passed,false);
  assert.equal(result.hardGate,'VALIDATION_EVIDENCE_REQUIRED');
  assert.equal(result.results.length,0);
});
