import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {RepositoryGraph} from '../core/repo-graph.mjs';

function fixture(){const root=fs.mkdtempSync(path.join(os.tmpdir(),'twc-graph-'));fs.mkdirSync(path.join(root,'src'));fs.mkdirSync(path.join(root,'tests'));fs.writeFileSync(path.join(root,'src','math.js'),"export function add(a,b){return a+b}\n");fs.writeFileSync(path.join(root,'src','app.js'),"import {add} from './math.js';\nexport const total=()=>add(1,2);\n");fs.writeFileSync(path.join(root,'tests','app.test.js'),"import {total} from '../src/app.js';\nconsole.log(total());\n");fs.writeFileSync(path.join(root,'README.md'),'Math application');return root}

test('builds symbol/import/test topology and reverse dependencies',()=>{const root=fixture();const graph=new RepositoryGraph(root).build();assert.equal(graph.summary.importEdges,2);assert.ok(graph.summary.symbols>=2);assert.equal(graph.summary.testFiles,1);assert.deepEqual(graph.reverse['src/math.js'],['src/app.js']);});

test('goal context expands symbols into dependencies and tests',()=>{const root=fixture();const r=new RepositoryGraph(root);const paths=r.contextPaths('change add math behavior',{maxFiles:10});assert.ok(paths.includes('src/math.js'));assert.ok(paths.includes('src/app.js'));assert.ok(paths.includes('tests/app.test.js'));assert.ok(paths.includes('README.md'));});

test('impact walks both imports and dependents with bounded depth',()=>{const root=fixture();const r=new RepositoryGraph(root);const impact=r.impact(['src/math.js'],{depth:2});assert.ok(impact.includes('src/app.js'));assert.ok(impact.includes('tests/app.test.js'));});
