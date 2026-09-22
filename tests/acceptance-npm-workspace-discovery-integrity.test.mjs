import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {inferValidationCommands,runAcceptance} from '../core/acceptance.mjs';

function fixture(){return fs.mkdtempSync(path.join(os.tmpdir(),'twc-acceptance-workspace-discovery-'))}

test('automatic npm workspace validation discovery fails closed when npm inspection is unavailable',async()=>{const root=fixture();const oldPath=process.env.PATH;try{const emptyBin=path.join(root,'empty-bin');fs.mkdirSync(emptyBin);process.env.PATH=emptyBin;fs.writeFileSync(path.join(root,'package.json'),JSON.stringify({private:true,workspaces:['packages/*']}));assert.throws(()=>inferValidationCommands(root),error=>error instanceof Error&&error.code==='NPM_WORKSPACE_DISCOVERY_FAILED');const result=await runAcceptance(root,null,{mode:'workspace'});assert.equal(result.passed,false);assert.equal(result.hardGate,'VALIDATION_DISCOVERY_FAILED');assert.equal(result.blocker,'NPM_WORKSPACE_DISCOVERY_FAILED');assert.deepEqual(result.results,[])}finally{if(oldPath===undefined)delete process.env.PATH;else process.env.PATH=oldPath;fs.rmSync(root,{recursive:true,force:true})}});

test('root validation scripts do not depend on npm workspace inspection during discovery',()=>{const root=fixture();const oldPath=process.env.PATH;try{const emptyBin=path.join(root,'empty-bin');fs.mkdirSync(emptyBin);process.env.PATH=emptyBin;fs.writeFileSync(path.join(root,'package.json'),JSON.stringify({private:true,workspaces:['packages/*'],scripts:{test:'node test.mjs'}}));const commands=inferValidationCommands(root);assert.ok(commands.includes('npm run test --if-present && npm run test --workspaces --if-present'))}finally{if(oldPath===undefined)delete process.env.PATH;else process.env.PATH=oldPath;fs.rmSync(root,{recursive:true,force:true})}});
