import fs from 'node:fs';
import path from 'node:path';

const BASE_PHASES=[
 ['observe','观察仓库与约束'],['whole_artifact','全工件重编译'],['deep_development','深度开发瓶颈'],['apply','应用候选变更'],['validate','运行验收与失败路径'],['repair','Repair / 再验证'],['review','Diff / 风险 / Evidence'],['delivery','准备 Git 交付']
];
export class TaskStore {
  constructor(dir){this.file=path.join(dir,'tasks.json');fs.mkdirSync(dir,{recursive:true});if(!fs.existsSync(this.file))this.save([])}
  load(){try{return JSON.parse(fs.readFileSync(this.file,'utf8'))}catch{return []}}
  save(v){const tmp=`${this.file}.${process.pid}.tmp`;fs.writeFileSync(tmp,JSON.stringify(v,null,2));fs.renameSync(tmp,this.file)}
  list(){return this.load()}
  replace(tasks){this.save(tasks);return tasks}
  plan(prompt,{mode='WHOLE_ARTIFACT',runId=null}={}){
    const text=String(prompt||'').trim();const now=Date.now();
    const tasks=BASE_PHASES.map(([phase,title],i)=>({id:`task-${now}-${i+1}`,runId,phase,title,status:i===0?'running':'queued',progress:i===0?.12:0,detail:i===0?`正在分析：${text.slice(0,120)}`:'',mode}));
    this.save(tasks);return tasks;
  }
  syncRun(run){
    const map={OBSERVING:'observe',PLANNED:'whole_artifact',WAITING_PROVIDER:'deep_development',CHANGESET_STAGED:'apply',CHANGES_APPLIED:'validate',VALIDATING:'validate',REPAIR_REQUIRED:'repair',READY_FOR_DELIVERY:'review',DELIVERED_LOCAL:'delivery',ROLLED_BACK:'apply',FAILED:'repair'};
    const current=map[run.status]||'observe';let reached=true;
    const tasks=this.load().map(t=>{if(t.runId!==run.id)return t;if(t.phase===current){reached=false;return {...t,status:'running',progress:.55,detail:run.blocker||run.message||''}}if(reached)return {...t,status:'done',progress:1};return {...t,status:'queued',progress:0}});
    if(run.status==='READY_FOR_DELIVERY')for(const t of tasks)if(t.runId===run.id&&['observe','whole_artifact','deep_development','apply','validate','repair'].includes(t.phase)){t.status='done';t.progress=1}
    this.save(tasks);return tasks;
  }
}
