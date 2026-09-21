import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const bridge=process.env.TAOWIND_BRIDGE||path.resolve(here,'../bridge/dwac_bridge.py');
function write(file,content){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,content)}
function git(root,args){const r=spawnSync('git',['-C',root,...args],{encoding:'utf8'});assert.equal(r.status,0,r.stderr||r.stdout);return r.stdout.trim()}
function fakeDwac(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'twc-causality-dwac-'));
 const pkg=path.join(root,'structural_generation','dwac_structural');
 write(path.join(pkg,'software_production_pipeline.py'),`class Stage:\n def __init__(self,i): self.stage_id=f's{i}'\nclass Plan:\n plan_id='plan-causality'\n stages=[Stage(0)]\n def topological_order(self): return [x.stage_id for x in self.stages]\nclass SoftwareProductionPipelineCompiler:\n def compile(self,prompt,profile='application'): return Plan()\n`);
 write(path.join(pkg,'aaa_game_factory.py'),`class AAAGameFactoryCompiler:\n def compile(self,prompt): raise RuntimeError('not used')\n`);
 write(path.join(pkg,'north_star_self_development.py'),`from dataclasses import dataclass,field\nfrom enum import Enum\nclass DevelopmentMode(str,Enum): WHOLE_ARTIFACT='WHOLE_ARTIFACT';DEEP_DEVELOPMENT='DEEP_DEVELOPMENT'\nclass Gate(str,Enum): AUTONOMOUS='AUTONOMOUS';EXPLICIT_APPROVAL='EXPLICIT_APPROVAL'\n@dataclass\nclass NorthStarSpec: goal:str\n@dataclass\nclass Observation:\n observation_id:str;domain:str;signal:str;severity:float;centrality:float;recurrence:float;evidence:tuple=();externally_blocked:bool=False;metadata:dict=field(default_factory=dict)\n @property\n def pressure(self): return round(self.severity*.45+self.centrality*.35+self.recurrence*.20,6)\n@dataclass\nclass BottleneckCandidate:\n candidate_id:str;domain:str;problem:str;expected_goal_gain:float;reuse_gain:float;autonomy_gain:float;evidence_gain:float;implementation_cost:float;regression_risk:float;externally_blocked:bool=False;evidence:tuple=();metadata:dict=field(default_factory=dict)\n @property\n def score(self): return float('-inf') if self.externally_blocked else round(self.expected_goal_gain*.32+self.reuse_gain*.14+self.autonomy_gain*.28+self.evidence_gain*.16-self.implementation_cost*.06-self.regression_risk*.04,6)\nclass D: pass\nclass NorthStarSelfDevelopmentController:\n def __init__(self,spec): self.spec=spec\n def diagnose(self,signals,candidates):\n  ranked=tuple(sorted([x for x in candidates if not x.externally_blocked],key=lambda x:(x.score,x.autonomy_gain,x.evidence_gain),reverse=True))\n  if not ranked: raise ValueError('no actionable self-development candidate')\n  d=D();d.selected=ranked[0];d.mode=DevelopmentMode.DEEP_DEVELOPMENT;d.reason='native';d.sovereignty_gate=Gate.AUTONOMOUS;d.cycle_id='NSC-causality';d.ranked_candidates=ranked;d.portfolio=ranked[:8];return d\n`);
 return root;
}
function baseWorkspace(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'twc-causality-ws-'));
 for(const dir of ['core','bridge','evidence'])fs.mkdirSync(path.join(root,dir),{recursive:true});
 write(path.join(root,'core','repo-graph.mjs'),'export const graph=1');
 write(path.join(root,'core','changesets.mjs'),'export function rollback(){}');
 write(path.join(root,'core','acceptance.mjs'),'export const acceptance=1');
 write(path.join(root,'core','north-star-runner.mjs'),'export const runner=1');
 write(path.join(root,'core','rcl-authority.mjs'),'export const rcl=1');
 write(path.join(root,'core','browser-observation.mjs'),'export const browser=1');
 write(path.join(root,'core','terminal.mjs'),'const conpty=true');
 write(path.join(root,'core','git.mjs'),'export function push(){}; export function pullRequest(){}; // pull request');
 write(path.join(root,'bridge','dwac_bridge.py'),fs.readFileSync(bridge,'utf8'));
 git(root,['init']);git(root,['config','user.email','test@example.invalid']);git(root,['config','user.name','Taowind Test']);
 return root;
}
function run(root){
 const r=spawnSync(process.env.PYTHON||'python',[bridge,'--dwac-root',fakeDwac(),'--workspace',root,'--prompt','build app'],{encoding:'utf8'});
 assert.equal(r.status,0,r.stderr||r.stdout);return JSON.parse(r.stdout);
}

test('an evidence revision cannot resolve its own boundary row',()=>{
 const root=baseWorkspace();
 write(path.join(root,'evidence','self.json'),JSON.stringify({resolves:[{source:'evidence/self.json',path:'truth_boundaries[0]'}],truth_boundaries:['UNRESOLVED: same revision must stay visible']}));
 git(root,['add','.']);git(root,['commit','-m','self resolving evidence']);
 const out=run(root);
 assert.match(out.selected_problem,/same revision must stay visible/i);
 assert.ok(out.workspace_observation.truth_boundaries.some(row=>row.source==='evidence/self.json'&&row.path==='truth_boundaries[0]'));
 assert.equal(out.sovereignty_gate,'AUTONOMOUS');
});

test('a newer evidence revision still resolves an older referenced boundary',()=>{
 const root=baseWorkspace();
 write(path.join(root,'evidence','old.json'),JSON.stringify({truth_boundaries:['UNRESOLVED: closed historical gap']}));
 git(root,['add','.']);git(root,['commit','-m','old boundary']);
 write(path.join(root,'evidence','new.json'),JSON.stringify({resolves:[{source:'evidence/old.json',path:'truth_boundaries[0]'}],truth_boundaries:['MISSING: current gap remains']}));
 git(root,['add','evidence/new.json']);git(root,['commit','-m','new closure evidence']);
 const out=run(root);
 assert.match(out.selected_problem,/current gap remains/i);
 assert.doesNotMatch(out.selected_problem,/closed historical gap/i);
 assert.ok(!out.workspace_observation.truth_boundaries.some(row=>row.source==='evidence/old.json'&&row.path==='truth_boundaries[0]'));
});
