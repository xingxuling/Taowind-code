import argparse, hashlib, json, os, re, subprocess, sys
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


def _is_boundary_key(key):
 key=str(key or '').strip().lower()
 return key in {'claim_limit','limitations'} or 'boundary' in key or 'boundaries' in key


def _append_boundary_rows(value, source, path, rows, limit):
 if len(rows)>=limit:return
 if isinstance(value,str):
  text=' '.join(value.split())
  if text:rows.append({'source':source,'path':path,'text':text[:400]})
  return
 if isinstance(value,list):
  for index,item in enumerate(value):
   _append_boundary_rows(item,source,f'{path}[{index}]',rows,limit)
   if len(rows)>=limit:return
  return
 if isinstance(value,dict):
  for key,item in value.items():
   _append_boundary_rows(item,source,f'{path}.{key}' if path else str(key),rows,limit)
   if len(rows)>=limit:return


def _evidence_files_by_revision(workspace, evidence):
 files=list(evidence.glob('*.json'))
 if not files:return []
 by_source={str(file.relative_to(workspace)).replace('\\','/'):file for file in files}
 try:
  r=subprocess.run(['git','-C',str(workspace),'log','--format=','--name-only','--diff-filter=ACMR','--','evidence'],capture_output=True,text=True,timeout=5)
 except Exception:
  r=None
 if r is None or r.returncode!=0:return sorted(files,reverse=True)
 ordered=[];seen=set()
 for line in r.stdout.splitlines():
  source=line.strip().replace('\\','/')
  file=by_source.get(source)
  if file is None or source in seen:continue
  ordered.append(file);seen.add(source)
 remaining=[file for source,file in by_source.items() if source not in seen]
 remaining.sort(key=lambda file:(file.stat().st_mtime_ns,str(file)),reverse=True)
 return remaining+ordered


def _truth_boundaries(workspace, limit=96):
 evidence=workspace/'evidence';rows=[]
 if not evidence.exists():return rows
 for file in _evidence_files_by_revision(workspace,evidence):
  try:data=json.loads(file.read_text(encoding='utf-8'))
  except Exception:continue
  source=str(file.relative_to(workspace))
  stack=[('',data)]
  while stack and len(rows)<limit:
   path,value=stack.pop()
   if isinstance(value,dict):
    for key,item in value.items():
     child=f'{path}.{key}' if path else str(key)
     if _is_boundary_key(key):
      _append_boundary_rows(item,source,child,rows,limit)
     elif isinstance(item,(dict,list)):
      stack.append((child,item))
   elif isinstance(value,list):
    for index,item in enumerate(value):
     if isinstance(item,(dict,list)):stack.append((f'{path}[{index}]',item))
  if len(rows)>=limit:return rows
 return rows[:limit]


def _boundary_external(text):
 upper=' '.join(str(text or '').upper().split())
 normalized=re.sub(r'[^A-Z0-9]+','_',upper).strip('_')
 exact_markers=(
  'PENDING_USER_MACHINE','BLOCKED_EXTERNAL','EXTERNAL_BLOCKER','REQUIRES_CREDENTIAL','PAID_ACTION',
  'CURRENT_SANDBOX','CURRENT_CONTAINER','EXECUTION_CONTAINER','VALIDATION_CONTAINER',
  'CURRENT_EXECUTION_ENVIRONMENT','THIS_EXECUTION_ENVIRONMENT','MATERIALIZED_CURRENT_CHECKOUT',
  'CANNOT_CLONE','HAS_NO_GITHUB_CHECKOUT','NO_GITHUB_CHECKOUT',
  'WINDOWS_PORTABLE_REGRESSION','ENGINE_BINARY_ABSENT',
 )
 if any(marker in normalized for marker in exact_markers):return True
 if 'PENDING' in normalized and 'USER' in normalized and 'MACHINE' in normalized:return True
 phrase_patterns=(
  r'\bUSER(?:_[A-Z0-9]+){0,3}_MACHINE\b',
  r'\bMATERIALIZED_(?:CURRENT_)?CHECKOUT\b',
  r'\bWINDOWS_(?:HOST|MACHINE|RUNTIME)\b',
 )
 return any(re.search(pattern,normalized) for pattern in phrase_patterns)


def _boundary_meta(text):
 upper=' '.join(str(text or '').upper().split())
 truth_disclaimer=(
  bool(re.search(r'\bDO(?:ES)? NOT FABRICATE\b',upper))
  and any(marker in upper for marker in ('UNRESOLVED','BLOCKED','PENDING','NOT_RUN','MISSING','CANNOT','NO CLAIM'))
 )
 return (
  ('MARKER' in upper and ('SUCH AS' in upper or 'ACTIONABILITY' in upper or 'VOCABULARY' in upper))
  or ('DISCOVERY MECHANISM' in upper and 'PROOF' in upper)
  or truth_disclaimer
 )


def _truth_boundary_candidates(rows, limit=16):
 """Turn explicit unresolved evidence boundaries into neutral DWAC candidates.

 Only fields whose schema names them as boundaries/limitations are considered. This
 avoids treating historical implementation notes or PASS receipts containing words
 like UNRESOLVED as current work. External blockers are retained for observation but
 placed behind actionable internal candidates so they cannot starve autonomous work.
 """
 actionable=[];blocked=[];seen=set()
 marker_weights=(('UNRESOLVED',.98),('BLOCKED',.95),('PENDING',.90),('NOT_RUN',.86),('MISSING',.84),('CANNOT',.82),('NO CLAIM',.80))
 for row in rows or ():
  source=str(row.get('source') or 'evidence/unknown')
  path=str(row.get('path') or '')
  text=' '.join(str(row.get('text') or '').split())
  if not text or _boundary_meta(text):continue
  upper=text.upper()
  severity=next((weight for marker,weight in marker_weights if marker in upper),None)
  if severity is None:continue
  key=f'{source}\n{path}\n{text}'
  if key in seen:continue
  seen.add(key)
  external=_boundary_external(text)
  stem=re.sub(r'[^a-z0-9]+','-',Path(source).stem.lower()).strip('-')[:28] or 'evidence'
  digest=hashlib.sha256(key.encode('utf-8')).hexdigest()[:10]
  entry={
   'candidate_id':f'truth-boundary-{stem}-{digest}',
   'domain':'truth_boundary',
   'problem':text,
   'severity':severity,
   'externally_blocked':external,
   'evidence':(source,),
   'metadata':{'truth_boundary_source':source,'truth_boundary_path':path},
  }
  (blocked if external else actionable).append(entry)
 return (actionable+blocked)[:limit]


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
  'open-ended-candidate-discovery': _source_has(workspace,'bridge/dwac_bridge.py',['_truth_boundary_candidates','truth-boundary']),
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

 # Once bootstrap candidates are genuinely closed, do not declare saturation merely
 # because the old finite catalog is exhausted. Promote explicit unresolved evidence
 # boundaries into neutral candidates and let DWAC rank them. No feature list or mode
 # mapping lives here.
 if not candidates and closed.get('open-ended-candidate-discovery'):
  for row in _truth_boundary_candidates(reality.get('truth_boundaries')):
   metadata=dict(row.get('metadata') or {})
   signals.append(Observation(
    f"truth-boundary-observation-{row['candidate_id'][-10:]}",
    row['domain'],
    row['problem'],
    row['severity'],
    .88,
    .84,
    row['evidence'],
    row['externally_blocked'],
    metadata,
   ))
   candidates.append(BottleneckCandidate(
    row['candidate_id'],
    row['domain'],
    row['problem'],
    min(.97,row['severity']),
    .76,
    .94 if not row['externally_blocked'] else .30,
    .98,
    .52,
    .24,
    row['externally_blocked'],
    row['evidence'],
    metadata,
   ))

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
 result={'connected':True,'status':'COMPILED','plan_id':plan_id,'stage_count':stage_count,'topological_order':topological_order,'workspace':a.workspace,'workspace_observation':reality,'artifact_family':artifact_family,'mode':mode,'native_mode':native_mode,'routing_source':routing_source,'route_reason':route_reason,'route_scores':route_scores,'route_signal':({'breadth':route_signal.breadth,'bottleneck_centrality':route_signal.bottleneck_centrality,'evidence_density':route_signal.evidence_density,'adjacent_work_count':route_signal.adjacent_work_count,'direction_stability':route_signal.direction_stability,'urgency':route_signal.urgency,'artifact_pressure':route_signal.artifact_pressure} if route_signal is not None else None),'cycle_id':decision.cycle_id,'selected_bottleneck':decision.selected.candidate_id,'selected_problem':decision.selected.problem,'decision_reason':decision.reason,'sovereignty_gate':decision.sovereignty_gate.value,'north_star':goal,'candidate_scores':[{'id':x.candidate_id,'problem':x.problem,'score':x.score} for x in decision.ranked_candidates]}
 result.update(plan_meta);print(json.dumps(result,ensure_ascii=False))
except Exception as e:
 print(json.dumps({'connected':True,'status':'ERROR','message':f'{type(e).__name__}: {e}'},ensure_ascii=False));sys.exit(2)