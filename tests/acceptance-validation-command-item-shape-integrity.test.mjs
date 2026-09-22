import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {runAcceptance} from '../core/acceptance.mjs';

function fixture(){return fs.mkdtempSync(path.join(os.tmpdir(),'twc-validation-command-item-'))}

test('validation rejects non-string command entries before shell execution',async()=>{const root=fixture();try{const result=await runAcceptance(root,['node -e "process.exit(0)"',null],{mode:'workspace'});assert.equal(result.passed,false);assert.equal(result.hardGate,'VALIDATION_COMMAND_INPUT_INVALID');assert.equal(result.blocker,'INVALID_VALIDATION_COMMAND');assert.deepEqual(result.results,[])}finally{fs.rmSync(root,{recursive:true,force:true})}});

test('whitespace-only command entries become no validation evidence instead of escaping the receipt path',async()=>{const root=fixture();try{const result=await runAcceptance(root,['   '],{mode:'workspace'});assert.equal(result.passed,false);assert.equal(result.hardGate,'VALIDATION_EVIDENCE_REQUIRED');assert.deepEqual(result.results,[])}finally{fs.rmSync(root,{recursive:true,force:true})}});
