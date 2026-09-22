import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {RunStore} from '../core/run-store.mjs';

function withStore(){const runtime=fs.mkdtempSync(path.join(os.tmpdir(),'twc-run-object-'));return {runtime,store:new RunStore(runtime)}}
function cleanup(runtime){fs.rmSync(runtime,{recursive:true,force:true})}

test('run create rejects non-object dwac contract payload',()=>{const {runtime,store}=withStore();try{assert.throws(()=>store.create({goal:'probe',dwac:[]}),/INVALID_RUN_OPTIONAL_OBJECT/)}finally{cleanup(runtime)}});

test('run read rejects persisted optional object shape drift',()=>{const {runtime,store}=withStore();try{const run=store.create({goal:'probe'});const file=store.file(run.id);const doc=JSON.parse(fs.readFileSync(file,'utf8'));doc.dwac=[];fs.writeFileSync(file,JSON.stringify(doc));assert.throws(()=>store.get(run.id),/INVALID_RUN_OPTIONAL_OBJECT/)}finally{cleanup(runtime)}});

test('run update rejects optional object shape drift before persistence',()=>{const {runtime,store}=withStore();try{const run=store.create({goal:'probe'});assert.throws(()=>store.update(run.id,{validation:[]}),/INVALID_RUN_OPTIONAL_OBJECT/);assert.equal(store.get(run.id).validation,null)}finally{cleanup(runtime)}});

test('run optional object fields preserve object and null values',()=>{const {runtime,store}=withStore();try{const run=store.create({goal:'probe',dwac:{provider:'dwac'}});const updated=store.update(run.id,{validation:{ok:true},delivery:null});assert.deepEqual(updated.dwac,{provider:'dwac'});assert.deepEqual(updated.validation,{ok:true});assert.equal(updated.delivery,null)}finally{cleanup(runtime)}});
