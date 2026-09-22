import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {inferValidationCommands,runAcceptance} from '../core/acceptance.mjs';

function fixture(){return fs.mkdtempSync(path.join(os.tmpdir(),'twc-acceptance-manifest-'))}

test('automatic validation discovery fails closed on malformed package.json',async()=>{const root=fixture();try{fs.writeFileSync(path.join(root,'package.json'),'{ broken json');fs.writeFileSync(path.join(root,'pyproject.toml'),'[project]\nname="probe"\n');assert.throws(()=>inferValidationCommands(root),error=>error instanceof Error&&error.code==='INVALID_PACKAGE_JSON');const result=await runAcceptance(root,null,{mode:'workspace'});assert.equal(result.passed,false);assert.equal(result.status,'FAILED');assert.equal(result.hardGate,'VALIDATION_DISCOVERY_FAILED');assert.equal(result.blocker,'INVALID_PACKAGE_JSON');assert.deepEqual(result.commands,[]);assert.deepEqual(result.results,[])}finally{fs.rmSync(root,{recursive:true,force:true})}});

test('explicit validation commands remain explicit even when package discovery is unusable',async()=>{const root=fixture();try{fs.writeFileSync(path.join(root,'package.json'),'{ broken json');const result=await runAcceptance(root,['node -e "process.exit(0)"'],{mode:'workspace'});assert.equal(result.passed,true);assert.equal(result.hardGate,'PASS')}finally{fs.rmSync(root,{recursive:true,force:true})}});
