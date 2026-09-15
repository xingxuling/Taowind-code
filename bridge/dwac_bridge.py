import argparse, json, os, re, sys
from pathlib import Path

p=argparse.ArgumentParser();p.add_argument('--dwac-root',required=True);p.add_argument('--workspace',required=True);p.add_argument('--prompt',required=True);a=p.parse_args()
sg=os.path.join(a.dwac_root,'structural_generation');sys.path.insert(0,sg)
try:
 from dwac_structural.software_production_pipeline import SoftwareProductionPipelineCompiler
 from dwac_structural.aaa_game_factory import AAAGameFactoryCompiler
 from dwac_structural.north_star_self_development import NorthStarSpec,NorthStarSelfDevelopmentController,Observation,BottleneckCandidate
 workspace=Path(a.workspace)
 is_game='[TAOWIND_GAME_MANUFACTURING=1]' in a.prompt
 primary_match=re.search(r'\[TAOWIND_GAME_PRIMARY=([^\]]+)\]',a.prompt)
 primary_engine=primary_match.group(1).strip() if primary_match else None
 if is_game:
  game_plan=AAAGameFactoryCompiler().compile(a.prompt)
  plan_id=game_plan.plan_id
  stage_count=len(game_plan.stages)
  topological_order=[stage.stage_id for stage in game_plan.stages]
  artifact_family='game'
  plan_meta={'game_factory_status':game_plan.status,'claim_ceiling':game_plan.claim_ceiling,'blocking_gaps':list(game_plan.blocking_gaps),'unmet_acceptance':list(game_plan.unmet_acceptance),'primary_engine':primary_engine}
 else:
  plan=SoftwareProductionPipelineCompiler().compile(a.prompt,profile='application')
  plan_id=plan.plan_id
  stage_count=len(plan.stages)
  topological_order=list(plan.topological_order())
  artifact_family='application'
  plan_meta={}
 signals=[]
 signals.append(Observation('repo-context','planning','repository context must be compiled into an execution graph',.82,.90,.80,('workspace',)))
 signals.append(Observation('real-edits','editing','goal closure requires revision-bound multi-file edits rather than plan-only output',.96,.98,.92,('changeset-contract',)))
 signals.append(Observation('validation','validation','candidate changes require executable non-compensatory acceptance evidence',.95,.98,.91,('acceptance-contract',)))
 if is_game:
  signals.append(Observation('game-build-evidence','validation','game closure requires measured primary-engine CLI build/export evidence plus a real output artifact existence check',.99,.99,.98,('game-engine-provider','artifact-existence')))
 if (workspace/'.git').exists(): signals.append(Observation('delivery','delivery','git delivery is available but must remain evidence-bound and distinguish local commit from push/PR',.80,.82,.72,('git',)))
 candidates=[
  BottleneckCandidate('goal-to-artifact-graph','planning','compile the goal and repository into a coherent whole-artifact execution graph',.94,.96,.91,.90,.45,.17),
  BottleneckCandidate('transactional-changeset','editing','produce rollbackable preimage-bound multi-file changes',.98,.96,.94,.98,.44,.16),
  BottleneckCandidate('validation-repair','validation','execute acceptance gates and repair from observed failures',.97,.94,.95,.99,.48,.18),
  BottleneckCandidate('git-delivery-evidence','delivery','prepare revision-bound local delivery evidence without false external completion',.78,.76,.65,.94,.32,.14),
 ]
 if is_game:
  candidates.append(BottleneckCandidate('measured-game-build-closure','validation','close the selected engine path with a real provider execution receipt and observed build artifact',.99,.97,.98,.995,.52,.18))
 goal='Taowind Code closes user coding goals into verified, rollbackable repository changes with minimal human intervention and no false completion.' if not is_game else 'Taowind Code closes game-manufacturing goals into playable, engine-built, measured artifacts while DWAC/RCL/RNCS retain orchestration, authority and evidence truth.'
 decision=NorthStarSelfDevelopmentController(NorthStarSpec(goal)).diagnose(signals,candidates)
 result={'connected':True,'status':'COMPILED','plan_id':plan_id,'stage_count':stage_count,'topological_order':topological_order,'workspace':a.workspace,'artifact_family':artifact_family,'mode':decision.mode.value,'cycle_id':decision.cycle_id,'selected_bottleneck':decision.selected.candidate_id,'decision_reason':decision.reason,'sovereignty_gate':decision.sovereignty_gate.value,'north_star':goal,'candidate_scores':[{'id':x.candidate_id,'score':x.score} for x in decision.ranked_candidates]}
 result.update(plan_meta)
 print(json.dumps(result,ensure_ascii=False))
except Exception as e:
 print(json.dumps({'connected':True,'status':'ERROR','message':f'{type(e).__name__}: {e}'},ensure_ascii=False));sys.exit(2)
