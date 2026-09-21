import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {runAcceptance} from '../core/acceptance.mjs';

test('fails closed when explicit validation evidence exceeds the execution budget',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'twc-acc-budget-'));
  const commands=Array.from({length:8},()=>`node -e "process.exit(0)"`);
  commands.push(`node -e "process.exit(9)"`);
  const result=await runAcceptance(root,commands,{mode:'workspace'});
  assert.equal(result.passed,false);
  assert.equal(result.hardGate,'VALIDATION_COMMAND_BUDGET_EXCEEDED');
  assert.equal(result.results.length,0);
  assert.equal(result.commands.length,8);
  assert.deepEqual(result.validationBudget,{limit:8,observedAtLeast:9});
});
