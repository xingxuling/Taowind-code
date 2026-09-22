import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {inferValidationCommands,runAcceptance} from '../core/acceptance.mjs';

function fixture(){return fs.mkdtempSync(path.join(os.tmpdir(),'twc-package-workspaces-shape-'))}

test('automatic validation discovery fails closed on invalid package workspaces shape',async()=>{const root=fixture();try{fs.writeFileSync(path.join(root,'package.json'),JSON.stringify({workspaces:'packages/*',scripts:{test:'node --test'}}));assert.throws(()=>inferValidationCommands(root),error=>error instanceof Error&&error.code==='INVALID_PACKAGE_WORKSPACES');const result=await runAcceptance(root,null,{mode:'workspace'});assert.equal(result.passed,false);assert.equal(result.hardGate,'VALIDATION_DISCOVERY_FAILED');assert.equal(result.blocker,'INVALID_PACKAGE_WORKSPACES');assert.deepEqual(result.results,[])}finally{fs.rmSync(root,{recursive:true,force:true})}});

test('established workspace array shape remains compatible',()=>{const root=fixture();try{fs.writeFileSync(path.join(root,'package.json'),JSON.stringify({workspaces:['packages/*'],scripts:{test:'node --test'}}));const commands=inferValidationCommands(root);assert.ok(commands.includes('npm run test --if-present && npm run test --workspaces --if-present'))}finally{fs.rmSync(root,{recursive:true,force:true})}});
