import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {runAcceptance} from '../core/acceptance.mjs';

function fixture(){return fs.mkdtempSync(path.join(os.tmpdir(),'twc-validation-command-shape-'))}

test('explicit non-array validation command input fails closed instead of falling back to discovery',async()=>{const root=fixture();try{fs.writeFileSync(path.join(root,'pyproject.toml'),'[project]\nname="probe"\n');const result=await runAcceptance(root,'node -e "process.exit(0)"',{mode:'workspace'});assert.equal(result.passed,false);assert.equal(result.hardGate,'VALIDATION_COMMAND_INPUT_INVALID');assert.equal(result.blocker,'INVALID_VALIDATION_COMMANDS');assert.deepEqual(result.results,[])}finally{fs.rmSync(root,{recursive:true,force:true})}});

test('null validation commands retain automatic discovery semantics',async()=>{const root=fixture();try{const result=await runAcceptance(root,null,{mode:'workspace'});assert.equal(result.passed,false);assert.equal(result.hardGate,'VALIDATION_EVIDENCE_REQUIRED')}finally{fs.rmSync(root,{recursive:true,force:true})}});
