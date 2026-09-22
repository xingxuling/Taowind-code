import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {runAcceptance} from '../core/acceptance.mjs';

function fixture(){return fs.mkdtempSync(path.join(os.tmpdir(),'twc-browser-budget-'))}
function checks(count){return Array.from({length:count},(_,i)=>({url:`https://example.invalid/${i}`,forbidConsoleErrors:true}))}

test('browser validation rejects more than eight checks instead of truncating them',async()=>{const root=fixture();let calls=0;try{const observer={observe:async()=>{calls++;return {evaluation:{passed:true}}}};const result=await runAcceptance(root,[],{browserObserver:observer,browserChecks:checks(9)});assert.equal(result.passed,false);assert.equal(result.hardGate,'BROWSER_CHECK_BUDGET_EXCEEDED');assert.equal(result.browserBudget.limit,8);assert.equal(result.browserBudget.observed,9);assert.equal(result.browser.checks.length,8);assert.equal(calls,0)}finally{fs.rmSync(root,{recursive:true,force:true})}});

test('eight browser checks remain executable validation evidence',async()=>{const root=fixture();let calls=0;try{const observer={observe:async check=>{calls++;return {check,evaluation:{passed:true}}}};const result=await runAcceptance(root,[],{browserObserver:observer,browserChecks:checks(8)});assert.equal(result.passed,true);assert.equal(result.hardGate,'PASS');assert.equal(result.browser.results.length,8);assert.equal(calls,8)}finally{fs.rmSync(root,{recursive:true,force:true})}});
