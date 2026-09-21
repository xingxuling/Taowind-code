import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const bridge=process.env.TAOWIND_BRIDGE||path.resolve(path.dirname(new URL(import.meta.url).pathname),'../bridge/dwac_bridge.py');
function write(file,content){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,content)}
function git(root,args){const r=spawnSync('git',['-C',root,...args],{encoding:'utf8'});assert.equal(r.status,0,r.stderr||r.stdout);return r.stdout.trim()}
function fakeDwac(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'twc-cap-dwac-'));const pkg=path.join(root,'structural_generation','dwac_structural');
 write(path.join(pkg,'software_production_pipeline.py'),`class Stage:\n def __init__(self,i): self.stage_id=f's{i}'\nclass Plan:\n plan_id='p'\n stages=[Stage(0)]\n def topological_order(self): return [x.stage_id for x in self.stages]\nclass SoftwareProductionPipelineCompiler:\n def compile(self,prompt,profile='application'): return Plan()\n`);
 write(path.join(pkg,'aaa_game_factory.py'),`class AAAGameFactoryCompiler:\n def compile(self,prompt): raise RuntimeError('not used')\n`);
 write(path.join(pkg,'north_star_self_development.py'),`from dataclasses import dataclass,field\nfrom enum import Enum\nclass DevelopmentMode(str,Enum): WHOLE_ARTIFACT='WHOLE_ARTIFACT';DEEP_DEVELOPMENT='DEEP_DEVELOPMENT'\nclass Gate(str,Enum): AUTONOMOUS='AUTONOMOUS';EXPLICIT_APPROVAL='EXPLICIT_APPROVAL'\n@dataclass\nclass NorthStarSpec: goal:str\n@dataclass\nclass Observation:\n observation_id:str;domain:str;signal:str;severity:float;centrality:float;recurrence:float;evidence:tuple=();externally_blocked:bool=False;metadata:dict=field(default_factory=dict)\n @property\n def pressure(self): return 1\n@dataclass\nclass BottleneckCandidate:\n candidate_id:str;domain:str;problem:str;expected_goal_gain:float;reuse_gain:float;autonomy_gain:float;evidence_gain:float;implementation_cost:float;regression_risk:float;externally_blocked:bool=False;evidence:tuple=();metadata:dict=field(default_factory=dict)\n @property\n def score(self): return float('-inf') if self.externally_blocked else self.expected_goal_gain\nclass D: pass\nclass NorthStarSelfDevelopmentController:\n def __init__(self,spec): pass\n def diagnose(self,signals,candidates):\n  ranked=tuple(sorted([x for x in candidates if not x.externally_blocked],key=lambda x:x.score,reverse=True))\n  if not ranked: raise ValueError('no actionable self-development candidate')\n  d=D();d.selected=ranked[0];d.mode=DevelopmentMode.DEEP_DEVELOPMENT;d.reason='native';d.sovereignty_gate=Gate.AUTONOMOUS;d.cycle_id='x';d.ranked_candidates=ranked;d.portfolio=ranked[:8];return d\n`);
 return root;
}
function initRoot({includeRemote=true}={}){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'twc-cap-ws-'));for(const d of ['core','bridge','evidence'])fs.mkdirSync(path.join(root,d),{recursive:true});
 const files={'repo-graph.mjs':'x','changesets.mjs':'rollback','acceptance.mjs':'x','north-star-runner.mjs':'x','rcl-authority.mjs':'x','browser-observation.mjs':'x','tasks.mjs':'north_star_burst develop'};
 if(includeRemote){files['terminal.mjs']='conpty';files['git.mjs']='push pull request'}
 for(const [f,c] of Object.entries(files))write(path.join(root,'core',f),c);
 write(path.join(root,'bridge','dwac_bridge.py'),fs.readFileSync(bridge,'utf8'));
 write(path.join(root,'evidence','committed.json'),JSON.stringify({truth_boundaries:['UNRESOLVED: canonical closed-capability probe boundary']}));
 git(root,['init']);git(root,['config','user.email','t@example.invalid']);git(root,['config','user.name','T']);git(root,['add','.']);git(root,['commit','-m','canonical']);
 return root;
}
function run(root){const r=spawnSync(process.env.PYTHON||'python',[bridge,'--dwac-root',fakeDwac(),'--workspace',root,'--prompt','x'],{encoding:'utf8'});return {r,out:r.stdout?JSON.parse(r.stdout):null}}

test('dirty deletion cannot reopen a capability that canonical HEAD already contains',()=>{
 const root=initRoot();fs.unlinkSync(path.join(root,'core','terminal.mjs'));fs.unlinkSync(path.join(root,'core','git.mjs'));
 const {r,out}=run(root);assert.equal(r.status,0,r.stderr||r.stdout);assert.equal(out.workspace_observation.closed_capabilities['persistent-pty-runtime'],true);assert.equal(out.workspace_observation.closed_capabilities['github-remote-provider'],true);assert.match(out.selected_problem,/canonical closed-capability probe boundary/i);
});

test('dirty addition cannot fabricate closure absent from canonical HEAD',()=>{
 const root=initRoot({includeRemote:false});write(path.join(root,'core','terminal.mjs'),'conpty');write(path.join(root,'core','git.mjs'),'push pull request');
 const {r,out}=run(root);assert.equal(r.status,0,r.stderr||r.stdout);assert.equal(out.workspace_observation.closed_capabilities['persistent-pty-runtime'],false);assert.equal(out.workspace_observation.closed_capabilities['github-remote-provider'],false);assert.equal(out.selected_bottleneck,'github-remote-provider');
});
