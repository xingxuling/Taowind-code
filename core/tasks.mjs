import fs from 'node:fs';
import path from 'node:path';

export class TaskStore {
  constructor(dir){
    this.file=path.join(dir,'tasks.json');
    fs.mkdirSync(dir,{recursive:true});
    if(!fs.existsSync(this.file)) this.save([]);
  }
  load(){try{return JSON.parse(fs.readFileSync(this.file,'utf8'))}catch{return []}}
  save(v){fs.writeFileSync(this.file,JSON.stringify(v,null,2))}
  list(){return this.load()}
  replace(tasks){this.save(tasks);return tasks}
  plan(prompt){
    const text=String(prompt||'').trim();
    const verbs=[['理解仓库与约束','running'],['建立任务/工件图','queued'],['实现核心修改','queued'],['运行验证并修复','queued'],['审查 Diff 与风险','queued'],['准备 Git 交付','queued']];
    const tasks=verbs.map((x,i)=>({id:`task-${Date.now()}-${i+1}`,title:x[0],status:x[1],progress:i===0?.18:0,detail:i===0?`正在分析：${text.slice(0,100)}`:''}));
    this.save(tasks);return tasks;
  }
}
