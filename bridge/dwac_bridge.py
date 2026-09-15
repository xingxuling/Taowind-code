import argparse,json,sys,os
p=argparse.ArgumentParser();p.add_argument('--dwac-root',required=True);p.add_argument('--workspace',required=True);p.add_argument('--prompt',required=True);a=p.parse_args()
sg=os.path.join(a.dwac_root,'structural_generation');sys.path.insert(0,sg)
try:
 from dwac_structural.software_production_pipeline import SoftwareProductionPipelineCompiler
 plan=SoftwareProductionPipelineCompiler().compile(a.prompt,profile='application')
 print(json.dumps({'connected':True,'status':'COMPILED','plan_id':plan.plan_id,'stage_count':len(plan.stages),'topological_order':list(plan.topological_order()),'workspace':a.workspace},ensure_ascii=False))
except Exception as e:
 print(json.dumps({'connected':True,'status':'ERROR','message':str(e)},ensure_ascii=False));sys.exit(2)
