import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {runAcceptance} from '../core/acceptance.mjs';

function fixture(){return fs.mkdtempSync(path.join(os.tmpdir(),'twc-browser-check-shape-'))}

test('browser validation fails closed instead of dropping malformed check entries',async()=>{const root=fixture();let calls=0;try{const observer={observe:async()=>{calls++;return {evaluation:{passed:true}}}};const result=await runAcceptance(root,['node -e "process.exit(0)"'],{browserObserver:observer,browserChecks:[{url:'https://example.invalid'},null]});assert.equal(result.passed,false);assert.equal(result.hardGate,'BROWSER_CHECK_INPUT_INVALID');assert.equal(result.blocker,'INVALID_BROWSER_CHECK');assert.equal(calls,0)}finally{fs.rmSync(root,{recursive:true,force:true})}});

test('well-shaped browser check arrays retain existing execution behavior',async()=>{const root=fixture();let calls=0;try{const observer={observe:async check=>{calls++;return {check,evaluation:{passed:true}}}};const result=await runAcceptance(root,[],{browserObserver:observer,browserChecks:[{url:'https://example.invalid'}]});assert.equal(result.passed,true);assert.equal(result.hardGate,'PASS');assert.equal(calls,1)}finally{fs.rmSync(root,{recursive:true,force:true})}});
