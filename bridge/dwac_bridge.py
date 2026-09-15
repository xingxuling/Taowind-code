import argparse, json, os, sys
from pathlib import Path

p=argparse.ArgumentParser();p.add_argument('--dwac-root',required=True);p.add_argument('--workspace',required=True);p.add_argument('--prompt',required=True);a=p.parse_args()
sg=os.path.join(a.dwac_root,'structural_generation');sys.path.insert(0,sg)
try:
 from dwac_structural.software_production_pipeline import SoftwareProductionPipelineCompiler
 from dwac_structural.north_star_self_development import NorthStarSpec,NorthStarSelfDevelopmentController,Observation,BottleneckCandidate
 workspace=Path(a.workspace)
 plan=SoftwareProductionPipelineCompiler().compile(a.prompt,profile='application')
 signals=[]
 signals.append(Observation('repo-context','planning','repository context must be compiled into an execution graph',.82,.90,.80,('workspace',)))
 signals.append(Observation('real-edits','editing','goal closure requires revision-bound multi-file edits rather than plan-only output',.96,.98,.92,('changeset-contract',)))
 signals.append(Observation('validation','validation','candidate changes require executable non-compensatory acceptance evidence',.95,.98,.91,('acceptance-contract',)))
 if (workspace/'.git').exists(): signals.append(Observation('delivery','delivery','git delivery is available but must remain evidence-bound and distinguish local commit from push/PR',.80,.82,.72,('git',)))
 candidates=[
  BottleneckCandidate('goal-to-artifact-graph','planning','compile the goal and repository into a coherent whole-artifact execution graph',.94,.96,.91,.90,.45,.17),
  BottleneckCandidate('transactional-changeset','editing','produce rollbackable preimage-bound multi-file changes',.98,.96,.94,.98,.44,.16),
  BottleneckCandidate('validation-repair','validation','execute acceptance gates and repair from observed failures',.97,.94,.95,.99,.48,.18),
  BottleneckCandidate('git-delivery-evidence','delivery','prepare revision-bound local delivery evidence without false external completion',.78,.76,.65,.94,.32,.14),
 ]
 goal='Taowind Code closes user coding goals into verified, rollbackable repository changes with minimal human intervention and no false completion.'
 decision=NorthStarSelfDevelopmentController(NorthStarSpec(goal)).diagnose(signals,candidates)
 print(json.dumps({'connected':True,'status':'COMPILED','plan_id':plan.plan_id,'stage_count':len(plan.stages),'topological_order':list(plan.topological_order()),'workspace':a.workspace,'mode':decision.mode.value,'cycle_id':decision.cycle_id,'selected_bottleneck':decision.selected.candidate_id,'decision_reason':decision.reason,'sovereignty_gate':decision.sovereignty_gate.value,'north_star':goal,'candidate_scores':[{'id':x.candidate_id,'score':x.score} for x in decision.ranked_candidates]},ensure_ascii=False))
except Exception as e:
 print(json.dumps({'connected':True,'status':'ERROR','message':f'{type(e).__name__}: {e}'},ensure_ascii=False));sys.exit(2)
