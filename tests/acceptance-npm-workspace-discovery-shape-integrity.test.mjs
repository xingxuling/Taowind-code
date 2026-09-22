import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {inferValidationCommands,runAcceptance} from '../core/acceptance.mjs';

function fixture(){return fs.mkdtempSync(path.join(os.tmpdir(),'twc-workspace-shape-'))}
function installFakeNpm(bin,output){fs.mkdirSync(bin,{recursive:true});const file=path.join(bin,process.platform==='win32'?'npm.cmd':'npm');if(process.platform==='win32')fs.writeFileSync(file,`@echo off\r\necho ${output}\r\n`);else{fs.writeFileSync(file,`#!/bin/sh\nprintf '%s' '${output}'\n`);fs.chmodSync(file,0o755)}return file}

test('npm workspace discovery rejects valid JSON with the wrong top-level shape',async()=>{const root=fixture();const oldPath=process.env.PATH;try{const bin=path.join(root,'bin');installFakeNpm(bin,'[]');process.env.PATH=bin;fs.writeFileSync(path.join(root,'package.json'),JSON.stringify({private:true,workspaces:['packages/*']}));assert.throws(()=>inferValidationCommands(root),error=>error instanceof Error&&error.code==='INVALID_NPM_WORKSPACE_DISCOVERY_SHAPE');const result=await runAcceptance(root,null,{mode:'workspace'});assert.equal(result.passed,false);assert.equal(result.hardGate,'VALIDATION_DISCOVERY_FAILED');assert.equal(result.blocker,'INVALID_NPM_WORKSPACE_DISCOVERY_SHAPE');assert.deepEqual(result.results,[])}finally{if(oldPath===undefined)delete process.env.PATH;else process.env.PATH=oldPath;fs.rmSync(root,{recursive:true,force:true})}});
