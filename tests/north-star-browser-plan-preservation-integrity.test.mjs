import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {runAcceptance} from '../core/acceptance.mjs';

function fixture(){return fs.mkdtempSync(path.join(os.tmpdir(),'twc-browser-plan-preservation-'))}

test('NorthStar runner preserves proposal browser checks for downstream acceptance hard gates',async()=>{const source=fs.readFileSync(new URL('../core/north-star-runner.mjs',import.meta.url),'utf8');assert.doesNotMatch(source,/proposal\.browser_checks\.filter\(Boolean\)\.slice\(0,8\)/);assert.match(source,/Array\.isArray\(proposal\.browser_checks\)\?proposal\.browser_checks:Array\.isArray\(previous\.browserChecks\)/);const root=fixture();let calls=0;try{const checks=Array.from({length:9},(_,i)=>({url:`https://example.invalid/${i}`}));const observer={observe:async()=>{calls++;return {evaluation:{passed:true}}}};const result=await runAcceptance(root,[],{browserObserver:observer,browserChecks:checks});assert.equal(result.passed,false);assert.equal(result.hardGate,'BROWSER_CHECK_BUDGET_EXCEEDED');assert.equal(result.browserBudget.observed,9);assert.equal(calls,0)}finally{fs.rmSync(root,{recursive:true,force:true})}});
