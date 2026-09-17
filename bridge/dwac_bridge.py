import argparse, json, os, re, subprocess, sys
from pathlib import Path

p=argparse.ArgumentParser();p.add_argument('--dwac-root',required=True);p.add_argument('--workspace',required=True);p.add_argument('--prompt',required=True);a=p.parse_args()
sg=os.path.join(a.dwac_root,'structural_generation');sys.path.insert(0,sg)


def _read(path):
 try:return Path(path).read_text(encoding='utf-8',errors='ignore')
 except Exception:return ''


def _git_head(workspace):
 try:
  r=subprocess.run(['git','-C',str(workspace),'rev-parse','HEAD'],capture_output=True,text=True,timeout=5)
  return r.stdout.strip() if r.returncode==0 else None
 except Exception:return None


def _source_has(workspace, rel, needles):
 text=_read(workspace/rel).lower()
 return bool(text) and all(str(x).lower() in text for x in needles)


def _truth_boundaries(workspace, limit=12):
 evidence=workspace/'evidence';rows=[]
 if not evidence.exists():return rows
 for file in sorted(evidence.glob('*.json'),reverse=True):
  try:data=json.loads(file.read_text(encoding='utf-8'))
  except Exception:continue
  stack=[data]
  while stack:
   value=stack.pop()
   if isinstance(value,dict):
    for key,item in value.items():
     if key in {'truth_boundaries','claim_limit','limitations'}:stack.append(item)
     elif isinstance(item,(dict,list)):stack.append(item)
     elif isinstance(item,str) and any(tok in item.upper() for tok in ('PENDING','NOT_RUN','UNRESOLVED','BLOCKED')):
      rows.append({'source':str(file.relative_to(workspace)),'text':item[:400]})
   elif isinstance(value,list):
    for item in value:
     if isinstance(item,str):rows.append({'source':str(file.relative_to(workspace)),'text':item[:400]})
     elif isinstance(item,(dict,list)):stack.append(item)
   elif isinstance(value,str):rows.append({'source':str(file.relative_to(workspace)),'text':value[:400]})
   if len(rows)>=limit:return rows
 return rows[:limit]


def _probe_workspace(workspace, four_mode_available):
 head=_git_head(workspace)
 closed={
  'semantic-repo-graph': (workspace/'core'/'repo-graph.mjs').exists(),
  'transactional-changeset': (workspace/'core'/'changesets.mjs').exists() and _source_has(workspace,'core/changesets.mjs',['rollback']),
  'validation-repair': (workspace/'core'/'acceptance.mjs').exists() and (workspace/'core'/'north-star-runner.mjs').exists(),
  'rcl-authority': (workspace/'core'/'rcl-authority.mjs').exists(),
  'browser-observation': (workspace/'core'/'browser-observation.mjs').exists(),
  'four-mode-routing': bool(four_mode_available) and _source_has(workspace,'core/tasks.mjs',['north_star_burst','develop']),
  'fresh-main-observer': _source_has(workspace,'bridge/dwac_bridge.py',['workspace_observation','closed_capabilities','truth_boundaries']),
  'persistent-pty-runtime': _source_has(workspace,'core/terminal.mjs',['node-pty']) or _source_has(workspace,'core/terminal.mjs',['conpty']),
  'github-remote-provider': _source_has(workspace,'core/git.mjs',['push']) and _source_has(workspace,'core/git.mjs',['pull request']),
 }
 return {'head':head,'closed_capabilities':closed,'truth_boundaries':_truth_boundaries(workspace)}


try:
 from dwac_structural.software_production_pipeline import SoftwareProductionPipelineCompiler
 from dwac_structural.aaa_game_factory import AAAGameFactoryCompiler
 from dwac_structural.north_star_self_development import NorthStarSpec,NorthStarSelfDevelopmentController,Observation,BottleneckCandidate
 try:
  from dwac_structural.four_mode_router import FourDevelopmentModeRouter,FourModeSignal
 except Exception:
  FourDevelopmentModeRouter=None;FourModeSignal=None
 workspace=Path(a.workspace)
 is_game='[TAOWIND_GAME_MANUFACTURING=1]' in a.prompt
 primary_match=re.search(r'\[TAOWIND_GAME_PRIMARY=([^\]]+)\]',a.prompt)
 primary_engine=primary_match.group(1).strip() if primary_match else None
 if is_game:
  game_plan=AAAGameFactoryCompiler().compile(a.prompt)
  plan_id=game_plan.plan_id;stage_count=len(game_plan.stages);topological_order=[stage.stage_id for stage in game_plan.stages];artifact_family='game'
  plan_meta={'game_factory_status':game_plan.status,'claim_ceiling':game_plan.claim_ceiling,'blocking_gaps':list(game_plan.blocking_gaps),'unmet_acceptance':list(game_plan.unmet_acceptance),'primary_engine':primary_engine}
 else:
  plan=SoftwareProductionPipelineCompiler().compile(a.prompt,profile='application')
  plan_id=plan.plan_id;stage_count=len(plan.stages);topological_order=list(plan.topological_order());artifact_family='application';plan_meta={}

 reality=_probe_workspace(workspace,FourDevelopmentModeRouter is not None and FourModeSignal is not None)
 closed=reality['closed_capabilities']
 signals=[];candidates=[]

 # Current-main freshness is itself a non-compensatory autonomy requirement. If the
 # bridge can see that previously ranked capabilities are already materialized, stale
 # static diagnosis would keep selecting solved work instead of observing the repo.
 stale_closed=sum(1 for x in ('semantic-repo-graph','transactional-changeset','validation-repair','rcl-authority','browser-observation','four-mode-routing') if closed.get(x))
 if not closed.get('fresh-main-observer'):
  signals.append(Observation('fresh-main','autonomy',f'latest workspace head must change diagnosis; observed {stale_closed} already-materialized capabilities',.98,.99,.96,tuple(x for x,v in closed.items() if v)))
  candidates.append(BottleneckCandidate('fresh-main-reality-observer','autonomy','replace stale solved-capability diagnosis with workspace-state-aware North Star observation',.99,.94,.99,.99,.36,.14,False,tuple(x for x,v in closed.items() if v)))

 if not closed.get('persistent-pty-runtime'):
  signals.append(Observation('terminal-session','terminal','terminal is bounded one-shot command execution rather than a persistent PTY/VT session',.68,.63,.72,('core/terminal.mjs',)))
  candidates.append(BottleneckCandidate('persistent-pty-runtime','terminal','persistent interactive terminal reality is still absent',.62,.67,.66,.74,.74,.30))
 if not closed.get('github-remote-provider'):
  signals.append(Observation('remote-delivery','delivery','runtime does not own remote push/PR/merge delivery',.72,.68,.65,('core/git.mjs',),metadata={'external_side_effect':True}))
  candidates.append(BottleneckCandidate('github-remote-provider','delivery','remote GitHub delivery remains an external side-effect capability',.78,.75,.78,.86,.55,.25,False,('core/git.mjs',),{'external_side_effect':True,'impact':'external'}))
 if is_game:
  signals.append(Observation('game-build-evidence','validation','game closure requires measured primary-engine CLI build/export evidence plus a real output artifact existence check',.99,.99,.98,('game-engine-provider','artifact-existence')))
  candidates.append(BottleneckCandidate('measured-game-build-closure','validation','close the selected engine path with a real provider execution receipt and observed build artifact',.99,.97,.98,.995,.52,.18))
 if not signals:signals.append(Observation('saturated','autonomy','no unresolved internal candidate observed',.10,.10,.10,('workspace',)))
 if not candidates:raise RuntimeError('NO_ACTIONABLE_CANDIDATE')

 goal='Taowind Code closes user coding goals into verified, rollbackable repository changes with minimal human intervention and no false completion.' if not is_game else 'Taowind Code closes game-manufacturing goals into playable, engine-built, measured artifacts while DWAC/RCL/RNCS retain orchestration, authority and evidence truth.'
 decision=NorthStarSelfDevelopmentController(NorthStarSpec(goal)).diagnose(signals,candidates)
 native_mode=decision.mode.value;mode=native_mode;route_reason=decision.reason;route_scores={native_mode:1.0};route_signal=None;routing_source='NORTH_STAR_NATIVE_FALLBACK'
 if FourDevelopmentModeRouter is not None and FourModeSignal is not None:
  ranked=list(decision.ranked_candidates);portfolio=list(decision.portfolio or (decision.selected,));domain_universe={item.domain for item in candidates} or {'unknown'};pressure_domains={item.domain for item in signals if item.pressure>=.45}
  top_score=float(ranked[0].score) if ranked else 0.0;second_score=float(ranked[1].score) if len(ranked)>1 else 0.0;dominance=max(0.0,top_score-second_score);clamp=lambda value:max(0.0,min(1.0,float(value)))
  route_signal=FourModeSignal(breadth=clamp(len(pressure_domains)/max(1,len(domain_universe))),bottleneck_centrality=clamp(dominance/0.18),evidence_density=clamp(decision.selected.evidence_gain),adjacent_work_count=len(portfolio),direction_stability=clamp(top_score),urgency=clamp(max((item.pressure for item in signals),default=0.0)),artifact_pressure=clamp(len(portfolio)/8.0))
  routed=FourDevelopmentModeRouter().route(route_signal);mode=routed.mode.value;route_reason=routed.reason;route_scores=dict(routed.scores);routing_source='DWAC_FOUR_MODE_ROUTER'
 result={'connected':True,'status':'COMPILED','plan_id':plan_id,'stage_count':stage_count,'topological_order':topological_order,'workspace':a.workspace,'workspace_observation':reality,'artifact_family':artifact_family,'mode':mode,'native_mode':native_mode,'routing_source':routing_source,'route_reason':route_reason,'route_scores':route_scores,'route_signal':({'breadth':route_signal.breadth,'bottleneck_centrality':route_signal.bottleneck_centrality,'evidence_density':route_signal.evidence_density,'adjacent_work_count':route_signal.adjacent_work_count,'direction_stability':route_signal.direction_stability,'urgency':route_signal.urgency,'artifact_pressure':route_signal.artifact_pressure} if route_signal is not None else None),'cycle_id':decision.cycle_id,'selected_bottleneck':decision.selected.candidate_id,'decision_reason':decision.reason,'sovereignty_gate':decision.sovereignty_gate.value,'north_star':goal,'candidate_scores':[{'id':x.candidate_id,'score':x.score} for x in decision.ranked_candidates]}
 result.update(plan_meta);print(json.dumps(result,ensure_ascii=False))
except Exception as e:
 print(json.dumps({'connected':True,'status':'ERROR','message':f'{type(e).__name__}: {e}'},ensure_ascii=False));sys.exit(2)
