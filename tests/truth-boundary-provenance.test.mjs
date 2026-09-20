import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const bridge=path.resolve(here,'../bridge/dwac_bridge.py');
function write(file,content){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,content)}
function fakeDwac(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'twc-boundary-dwac-'));const pkg=path.join(root,'structural_generation','dwac_structural');
 write(path.join(pkg,'software_production_pipeline.py'),`class Stage:\n def __init__(self,i): self.stage_id=f's{i}'\nclass Plan:\n plan_id='plan-boundary'\n stages=[Stage(i) for i in range(3)]\n def topological_order(self): return [x.stage_id for x in self.stages]\nclass SoftwareProductionPipelineCompiler:\n def compile(self,prompt,profile='application'): return Plan()\n`);
 write(path.join(pkg,'aaa_game_factory.py'),`class AAAGameFactoryCompiler:\n def compile(self,prompt): raise RuntimeError('not used')\n`);
 write(path.join(pkg,'north_star_self_development.py'),`from dataclasses import dataclass,field\nfrom enum import Enum\nclass DevelopmentMode(str,Enum): WHOLE_ARTIFACT='WHOLE_ARTIFACT';DEEP_DEVELOPMENT='DEEP_DEVELOPMENT'\nclass Gate(str,Enum): AUTONOMOUS='AUTONOMOUS';EXPLICIT_APPROVAL='EXPLICIT_APPROVAL'\n@dataclass\nclass NorthStarSpec: goal:str\n@dataclass\nclass Observation:\n observation_id:str;domain:str;signal:str;severity:float;centrality:float;recurrence:float;evidence:tuple=();externally_blocked:bool=False;metadata:dict=field(default_factory=dict)\n @property\n def pressure(self): return round(self.severity*.45+self.centrality*.35+self.recurrence*.20,6)\n@dataclass\nclass BottleneckCandidate:\n candidate_id:str;domain:str;problem:str;expected_goal_gain:float;reuse_gain:float;autonomy_gain:float;evidence_gain:float;implementation_cost:float;regression_risk:float;externally_blocked:bool=False;evidence:tuple=();metadata:dict=field(default_factory=dict)\n @property\n def score(self): return float('-inf') if self.externally_blocked else round(self.expected_goal_gain*.32+self.reuse_gain*.14+self.autonomy_gain*.28+self.evidence_gain*.16-self.implementation_cost*.06-self.regression_risk*.04,6)\nclass D: pass\nclass NorthStarSelfDevelopmentController:\n def __init__(self,spec): self.spec=spec\n def diagnose(self,signals,candidates):\n  ranked=tuple(sorted([x for x in candidates if not x.externally_blocked],key=lambda x:(x.score,x.autonomy_gain,x.evidence_gain),reverse=True))\n  if not ranked: raise ValueError('no actionable self-development candidate')\n  floor=max(.45,ranked[0].score*.72);portfolio=tuple(x for x in ranked if x.score>=floor)[:8] or (ranked[0],);selected=portfolio[0];broad=len({x.domain for x in signals if x.pressure>=.45});dom=selected.score-(ranked[1].score if len(ranked)>1 else 0);d=D();d.selected=selected;d.mode=DevelopmentMode.WHOLE_ARTIFACT if broad>=3 and dom<.18 else DevelopmentMode.DEEP_DEVELOPMENT;d.reason='native';d.sovereignty_gate=Gate.AUTONOMOUS;d.cycle_id='NSC-boundary';d.ranked_candidates=ranked;d.portfolio=portfolio;return d\n`);
 write(path.join(pkg,'four_mode_router.py'),`from dataclasses import dataclass\nfrom enum import Enum\nclass FourDevelopmentMode(str,Enum): WHOLE_ARTIFACT='WHOLE_ARTIFACT';DEEP_DEVELOPMENT='DEEP_DEVELOPMENT';NORTH_STAR='NORTH_STAR';NORTH_STAR_BURST='NORTH_STAR_BURST'\n@dataclass(frozen=True)\nclass FourModeSignal: breadth:float=0.;bottleneck_centrality:float=0.;evidence_density:float=0.;adjacent_work_count:int=0;direction_stability:float=0.;urgency:float=0.;artifact_pressure:float=0.\n@dataclass(frozen=True)\nclass Decision: mode:FourDevelopmentMode;reason:str;scores:dict\nclass FourDevelopmentModeRouter:\n def route(self,s):\n  scores={'WHOLE_ARTIFACT':.45*s.breadth+.35*s.artifact_pressure+.2*(1-s.bottleneck_centrality),'DEEP_DEVELOPMENT':.55*s.bottleneck_centrality+.3*s.evidence_density+.15*(1-s.breadth),'NORTH_STAR':.55*s.direction_stability+.25*s.evidence_density+.2*(1-s.urgency),'NORTH_STAR_BURST':.35*s.direction_stability+.25*s.evidence_density+.2*s.urgency+.2*min(1,s.adjacent_work_count/8)}\n  if s.breadth>=.8 and s.artifact_pressure>=.7:m=FourDevelopmentMode.WHOLE_ARTIFACT\n  elif s.bottleneck_centrality>=.85 and s.evidence_density>=.7:m=FourDevelopmentMode.DEEP_DEVELOPMENT\n  elif s.direction_stability>=.8 and s.adjacent_work_count>=4 and s.urgency>=.5:m=FourDevelopmentMode.NORTH_STAR_BURST\n  else:\n   if s.adjacent_work_count<2:scores['NORTH_STAR_BURST']*=.35\n   m=FourDevelopmentMode(max(scores,key=scores.get))\n  return Decision(m,'routed',scores)\n`);
 return root;
}
function workspace(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'twc-boundary-ws-'));
 for(const dir of ['core','bridge','evidence'])fs.mkdirSync(path.join(root,dir),{recursive:true});
 write(path.join(root,'core','repo-graph.mjs'),'export const graph=1');
 write(path.join(root,'core','changesets.mjs'),'export function rollback(){}');
 write(path.join(root,'core','acceptance.mjs'),'export const acceptance=1');
 write(path.join(root,'core','north-star-runner.mjs'),'export const runner=1');
 write(path.join(root,'core','rcl-authority.mjs'),'export const rcl=1');
 write(path.join(root,'core','browser-observation.mjs'),'export const browser=1');
 write(path.join(root,'core','tasks.mjs'),`const modes=['NORTH_STAR_BURST']; const phase='develop';`);
 write(path.join(root,'core','terminal.mjs'),`const conpty=true;`);
 write(path.join(root,'core','git.mjs'),`export function push(){}; export function pullRequest(){}; // pull request`);
 write(path.join(root,'bridge','dwac_bridge.py'),fs.readFileSync(bridge,'utf8'));
 write(path.join(root,'evidence','zz-stale.json'),JSON.stringify({
  changes:['Unresolved persistent PTY remains an internal candidate but the capability is already closed.'],
  truth_boundaries:['The discovery layer recognizes actionability markers such as UNRESOLVED, BLOCKED, PENDING and NOT_RUN.']
 }));
 write(path.join(root,'evidence','yy-external.json'),JSON.stringify({truth_boundaries:[
  'The portable package is structurally verified, but real Windows click-through remains pending on the user machine.'
 ]}));
 write(path.join(root,'evidence','xx-current.json'),JSON.stringify({truth_boundaries:[
  'No claim that DWAC native cognition can reliably generate arbitrary complex repository code without an external provider.'
 ]}));
 return root;
}

test('candidate discovery ignores stale marker prose and fails external user-machine boundaries closed',()=>{
 const r=spawnSync(process.env.PYTHON||'python',[bridge,'--dwac-root',fakeDwac(),'--workspace',workspace(),'--prompt','build app'],{encoding:'utf8'});
 assert.equal(r.status,0,r.stderr||r.stdout);
 const out=JSON.parse(r.stdout);
 assert.match(out.selected_problem,/native cognition/);
 assert.equal(out.sovereignty_gate,'AUTONOMOUS');
 assert.equal(out.mode,'DEEP_DEVELOPMENT');
 assert.ok(!out.candidate_scores.some(x=>/persistent PTY/i.test(x.problem)));
 assert.ok(!out.candidate_scores.some(x=>/user machine/i.test(x.problem)));
 assert.ok(out.workspace_observation.truth_boundaries.some(x=>/user machine/i.test(x.text)));
});
