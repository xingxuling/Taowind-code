import fs from 'node:fs';
import path from 'node:path';

const MODE_TITLES={
 NORTH_STAR:'北极星模式',
 NORTH_STAR_BURST:'北极星爆发模式',
 WHOLE_ARTIFACT:'全工件模式',
 DEEP_DEVELOPMENT:'深度开发模式'
};
const BASE_PHASES=[
 ['observe','观察仓库与约束'],['develop','DWAC 自主路由开发'],['apply','应用候选变更'],['validate','运行验收与失败路径'],['repair','Repair / 再验证'],['review','Diff / 风险 / Evidence'],['delivery','准备 Git 交付']
];
const TASK_STATUS=new Set(['queued','running','blocked','done','failed']);
function developmentTitle(mode){const label=MODE_TITLES[mode]||String(mode||'DWAC 自主模式');return `${label} · 自主开发`}
function validTask(task){if(!task||typeof task!=='object'||Array.isArray(task))return false;if(typeof task.id!=='string'||typeof task.title!=='string'||!TASK_STATUS.has(task.status))return false;if(Object.prototype.hasOwnProperty.call(task,'progress')&&(typeof task.progress!=='number'||!Number.isFinite(task.progress)||task.progress<0||task.progress>1))return false;if(Object.prototype.hasOwnProperty.call(task,'evidence')&&(!Array.isArray(task.evidence)||task.evidence.some(item=>typeof item!=='string')))return false;return true}
export class TaskStore {
  constructor(dir){this.file=path.join(dir,'tasks.json');fs.mkdirSync(dir,{recursive:true});if(!fs.existsSync(this.file))this.save([])}
  load(){let value;try{value=JSON.parse(fs.readFileSync(this.file,'utf8'))}catch{throw new Error('TASK_STORE_CORRUPT')}if(!Array.isArray(value)||value.some(task=>!validTask(task)))throw new Error('TASK_STORE_CORRUPT');return value}
  save(v){if(!Array.isArray(v))throw new Error('TASKS_REQUIRED_ARRAY');if(v.some(task=>!validTask(task)))throw new Error('INVALID_TASK');const tmp=`${this.file}.${process.pid}.tmp`;fs.writeFileSync(tmp,JSON.stringify(v,null,2));fs.renameSync(tmp,this.file)}
  list(){return this.load()}
  replace(tasks){this.save(tasks);return tasks}
  plan(prompt,{mode='WHOLE_ARTIFACT',runId=null}={}){
    const text=String(prompt||'').trim();const now=Date.now();
    const tasks=BASE_PHASES.map(([phase,baseTitle],i)=>({id:`task-${now}-${i+1}`,runId,phase,title:phase==='develop'?developmentTitle(mode):baseTitle,status:i===0?'running':'queued',progress:i===0?.12:0,detail:i===0?`正在分析：${text.slice(0,120)}`:'',mode}));
    this.save(tasks);return tasks;
  }
  syncRun(run){
    const map={OBSERVING:'observe',PLANNED:'develop',WAITING_PROVIDER:'develop',CHANGESET_STAGED:'apply',CHANGES_APPLIED:'validate',VALIDATING:'validate',REPAIR_REQUIRED:'repair',READY_FOR_DELIVERY:'review',DELIVERED_LOCAL:'delivery',ROLLED_BACK:'apply',FAILED:'repair'};
    const current=map[run.status]||'observe';let reached=true;const activeMode=run.mode||run.dwac?.mode||null;
    const tasks=this.load().map(t=>{if(t.runId!==run.id)return t;const mode=activeMode||t.mode;const title=t.phase==='develop'?developmentTitle(mode):t.title;if(t.phase===current){reached=false;return {...t,title,mode,status:'running',progress:.55,detail:run.blocker||run.message||''}}if(reached)return {...t,title,mode,status:'done',progress:1};return {...t,title,mode,status:'queued',progress:0}});
    if(run.status==='READY_FOR_DELIVERY')for(const t of tasks)if(t.runId===run.id&&['observe','develop','apply','validate','repair'].includes(t.phase)){t.status='done';t.progress=1}
    this.save(tasks);return tasks;
  }
}
