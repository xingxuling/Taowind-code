import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {inferValidationCommands,runAcceptance} from '../core/acceptance.mjs';

function fixture(){return fs.mkdtempSync(path.join(os.tmpdir(),'twc-package-scripts-shape-'))}

test('automatic validation discovery fails closed on invalid package scripts shape',async()=>{const root=fixture();try{fs.writeFileSync(path.join(root,'package.json'),JSON.stringify({scripts:'not-an-object'}));fs.writeFileSync(path.join(root,'pyproject.toml'),'[project]\nname="probe"\n');assert.throws(()=>inferValidationCommands(root),error=>error instanceof Error&&error.code==='INVALID_PACKAGE_SCRIPTS');const result=await runAcceptance(root,null,{mode:'workspace'});assert.equal(result.passed,false);assert.equal(result.hardGate,'VALIDATION_DISCOVERY_FAILED');assert.equal(result.blocker,'INVALID_PACKAGE_SCRIPTS');assert.deepEqual(result.results,[])}finally{fs.rmSync(root,{recursive:true,force:true})}});

test('omitted package scripts remain compatible with other validation discovery',()=>{const root=fixture();try{fs.writeFileSync(path.join(root,'package.json'),JSON.stringify({name:'probe'}));fs.writeFileSync(path.join(root,'pyproject.toml'),'[project]\nname="probe"\n');assert.deepEqual(inferValidationCommands(root),['python -m pytest -q'])}finally{fs.rmSync(root,{recursive:true,force:true})}});
