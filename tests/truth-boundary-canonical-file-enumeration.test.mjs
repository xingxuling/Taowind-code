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
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'twc-enum-dwac-'));const pkg=path.join(root,'structural_generation','dwac_structural');
 write(path.join(pkg,'software_production_pipeline.py'),`class Stage:\n def __init__(self,i): self.stage_id=f's{i}'\nclass Plan:\n plan_id='p'\n stages=[Stage(0)]\n def topological_order(self): return [x.stage_id for x in self.stages]\nclass SoftwareProductionPipelineCompiler:\n def compile(self,prompt,profile='application'): return Plan()\n`);
 write(path.join(pkg,'aaa_game_factory.py'),`class AAAGameFactoryCompiler:\n def compile(self,prompt): raise RuntimeError('not used')\n`);
 write(path.join(pkg,'north_star_self_development.py'),`from dataclasses import dataclass,field\nfrom enum import Enum\nclass DevelopmentMode(str,Enum): WHOLE_ARTIFACT='WHOLE_ARTIFACT';DEEP_DEVELOPMENT='DEEP_DEVELOPMENT'\nclass Gate(str,Enum): AUTONOMOUS='AUTONOMOUS';EXPLICIT_APPROVAL='EXPLICIT_APPROVAL'\n@dataclass\nclass NorthStarSpec: goal:str\n@dataclass\nclass Observation:\n observation_id:str;domain:str;signal:str;severity:float;centrality:float;recurrence:float;evidence:tuple=();externally_blocked:bool=False;metadata:dict=field(default_factory=dict)\n @property\n def pressure(self): return 1\n@dataclass\nclass BottleneckCandidate:\n candidate_id:str;domain:str;problem:str;expected_goal_gain:float;reuse_gain:float;autonomy_gain:float;evidence_gain:float;implementation_cost:float;regression_risk:float;externally_blocked:bool=False;evidence:tuple=();metadata:dict=field(default_factory=dict)\n @property\n def score(self): return float('-inf') if self.externally_blocked else self.expected_goal_gain\nclass D: pass\nclass NorthStarSelfDevelopmentController:\n def __init__(self,spec): pass\n def diagnose(self,signals,candidates):\n  ranked=tuple(sorted([x for x in candidates if not x.externally_blocked],key=lambda x:x.score,reverse=True))\n  if not ranked: raise ValueError('no actionable self-development candidate')\n  d=D();d.selected=ranked[0];d.mode=DevelopmentMode.DEEP_DEVELOPMENT;d.reason='native';d.sovereignty_gate=Gate.AUTONOMOUS;d.cycle_id='x';d.ranked_candidates=ranked;d.portfolio=ranked[:8];return d\n`);return root;
}
function base(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'twc-enum-ws-'));for(const d of ['core','bridge','evidence'])fs.mkdirSync(path.join(root,d),{recursive:true});
 for(const [f,c] of Object.entries({'repo-graph.mjs':'x','changesets.mjs':'rollback','acceptance.mjs':'x','north-star-runner.mjs':'x','rcl-authority.mjs':'x','browser-observation.mjs':'x','terminal.mjs':'conpty','git.mjs':'push pull request'}))write(path.join(root,'core',f),c);
 write(path.join(root,'bridge','dwac_bridge.py'),fs.readFileSync(bridge,'utf8'));
 git(root,['init']);git(root,['config','user.email','t@example.invalid']);git(root,['config','user.name','T']);
 write(path.join(root,'evidence','committed.json'),JSON.stringify({truth_boundaries:['UNRESOLVED: canonical deleted-worktree boundary']}));git(root,['add','.']);git(root,['commit','-m','canonical evidence']);
 return root;
}
function run(root){const r=spawnSync(process.env.PYTHON||'python',[bridge,'--dwac-root',fakeDwac(),'--workspace',root,'--prompt','x'],{encoding:'utf8'});return r}

test('dirty deletion of a committed evidence file cannot erase canonical-main boundary discovery',()=>{
 const root=base();fs.unlinkSync(path.join(root,'evidence','committed.json'));
 const r=run(root);assert.equal(r.status,0,r.stderr||r.stdout);const out=JSON.parse(r.stdout);assert.match(out.selected_problem,/canonical deleted-worktree boundary/i);
});

test('dirty deletion of the evidence directory cannot erase canonical-main boundary discovery',()=>{
 const root=base();fs.rmSync(path.join(root,'evidence'),{recursive:true,force:true});
 const r=run(root);assert.equal(r.status,0,r.stderr||r.stdout);const out=JSON.parse(r.stdout);assert.match(out.selected_problem,/canonical deleted-worktree boundary/i);
});
