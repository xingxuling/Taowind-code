import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {requestGoalAssessment} from './tao-ai-adapter.mjs';

const MISSION_PROTOCOL='taowind-code.autonomous-mission.v0.1';
const TERMINAL=new Set(['GOAL_CLOSED','BUDGET_EXHAUSTED','BLOCKED','FAILED']);
const VALID=new Set(['ACTIVE','WAITING_PROVIDER','WAITING_APPROVAL','GOAL_CLOSED','BUDGET_EXHAUSTED','BLOCKED','FAILED']);
const MISSION_RUN_MODES=new Set(['NORTH_STAR','NORTH_STAR_BURST','WHOLE_ARTIFACT','DEEP_DEVELOPMENT']);
const CYCLE_RUN_STATUSES=new Set(['READY_FOR_DELIVERY','DELIVERED_LOCAL']);
function now(){return new Date().toISOString()}
function missionId(){return `mission-${Date.now().toString(36)}-${crypto.randomBytes(5).toString('hex')}`}
function atomicJson(file,value){fs.mkdirSync(path.dirname(file),{recursive:true});const tmp=`${file}.${process.pid}.tmp`;fs.writeFileSync(tmp,JSON.stringify(value,null,2));fs.renameSync(tmp,file)}
function boundedNumber(value,min,max,fallback){const n=Number(value);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback}
function validMissionConfig(config){return !!config&&typeof config==='object'&&!Array.isArray(config)&&Number.isFinite(config.maxCycles)&&config.maxCycles>=1&&config.maxCycles<=64&&Number.isFinite(config.maxRepairs)&&config.maxRepairs>=0&&config.maxRepairs<=8&&Number.isFinite(config.closureThreshold)&&config.closureThreshold>=.5&&config.closureThreshold<=1&&typeof config.autoCommit==='boolean'}
function validRunReference(value){return value===undefined||value===null||(typeof value==='string'&&/^run-[A-Za-z0-9-]+$/.test(value))}
function validMissionCycles(value){return Array.isArray(value)&&value.every((item,index)=>item&&typeof item==='object'&&!Array.isArray(item)&&Number.isInteger(item.index)&&item.index===index+1&&typeof item.runId==='string'&&/^run-[A-Za-z0-9-]+$/.test(item.runId)&&typeof item.goal==='string'&&!!item.goal.trim()&&MISSION_RUN_MODES.has(item.mode)&&CYCLE_RUN_STATUSES.has(item.status)&&typeof item.closedAt==='string'&&item.closedAt.length>0&&Object.prototype.hasOwnProperty.call(item,'assessment'))}
function validMissionClosure(value){return value===undefined||value===null||(typeof value==='object'&&!Array.isArray(value)&&validRunReference(value.runId))}
function validMissionEvidence(value){return Array.isArray(value)&&value.every(item=>item&&typeof item==='object'&&!Array.isArray(item)&&typeof item.id==='string'&&/^mev-[a-f0-9]{12}$/.test(item.id)&&typeof item.at==='string'&&item.at.length>0)}
function validMissionEvents(value){return Array.isArray(value)&&value.every((item,index)=>item&&typeof item==='object'&&!Array.isArray(item)&&Number.isInteger(item.seq)&&item.seq===index+1&&typeof item.at==='string'&&item.at.length>0&&typeof item.type==='string'&&item.type.length>0&&Object.prototype.hasOwnProperty.call(item,'data'))}
function validMissionShape(mission){
  if(typeof mission?.rootGoal!=='string'||!mission.rootGoal.trim())return false;
  if(!Number.isInteger(mission?.cycle)||mission.cycle<0)return false;
  if(!validMissionConfig(mission?.config))return false;
  if(!validMissionCycles(mission?.cycles)||!validMissionEvents(mission?.events)||!validMissionEvidence(mission?.evidence))return false;
  if(mission.cycle!==mission.cycles.length)return false;
  if(typeof mission?.createdAt!=='string'||!mission.createdAt||typeof mission?.updatedAt!=='string'||!mission.updatedAt)return false;
  if(mission.events.length&&mission.updatedAt!==mission.events.at(-1).at)return false;
  if(mission.nextGoal!==undefined&&(typeof mission.nextGoal!=='string'||!mission.nextGoal.trim()))return false;
  if(!validRunReference(mission.currentRunId))return false;
  if(!validMissionClosure(mission.closure))return false;
  if(mission.cycle>0&&(!mission.closure||mission.closure.runId!==mission.cycles.at(-1).runId))return false;
  if(mission.cycle>0&&(typeof mission.closure.at!=='string'||!mission.closure.at||!Object.prototype.hasOwnProperty.call(mission.closure,'assessment')))return false;
  if(mission.blocker!==undefined&&mission.blocker!==null&&typeof mission.blocker!=='string')return false;
  return true;
}

export class AutonomousMissionStore{
  constructor(runtimeDir){this.dir=path.join(runtimeDir,'missions');fs.mkdirSync(this.dir,{recursive:true})}
  file(id){if(!/^mission-[A-Za-z0-9-]+$/.test(id))throw new Error('INVALID_MISSION_ID');return path.join(this.dir,`${id}.json`)}
  create(goal,options={}){
    const rootGoal=String(goal||'').trim();if(!rootGoal)throw new Error('GOAL_REQUIRED');
    const config={maxCycles:boundedNumber(options.maxCycles||8,1,64,8),maxRepairs:boundedNumber(options.maxRepairs??2,0,8,2),closureThreshold:boundedNumber(options.closureThreshold||.8,.5,1,.8),autoCommit:options.autoCommit===true};
    const mission={id:missionId(),protocol:MISSION_PROTOCOL,rootGoal,nextGoal:rootGoal,status:'ACTIVE',cycle:0,currentRunId:null,config,createdAt:now(),updatedAt:now(),cycles:[],events:[],evidence:[],closure:null,blocker:null};
    this.eventObject(mission,'MISSION_CREATED',{config});atomicJson(this.file(mission.id),mission);return mission;
  }
  get(id){const f=this.file(id);if(!fs.existsSync(f))throw Object.assign(new Error('MISSION_NOT_FOUND'),{code:'MISSION_NOT_FOUND'});const mission=JSON.parse(fs.readFileSync(f,'utf8'));if(mission?.id!==id)throw new Error('MISSION_ID_MISMATCH');if(mission?.protocol!==MISSION_PROTOCOL)throw new Error('UNSUPPORTED_MISSION_PROTOCOL');if(!VALID.has(mission?.status))throw new Error('INVALID_MISSION_STATUS');if(!validMissionShape(mission))throw new Error('INVALID_MISSION_SHAPE');return mission}
  list(limit=30){return fs.readdirSync(this.dir).filter(x=>x.endsWith('.json')).map(x=>this.get(x.slice(0,-5))).sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt))).slice(0,limit)}
  eventObject(mission,type,data={}){const event={seq:mission.events.length+1,at:now(),type,data};mission.events.push(event);mission.updatedAt=event.at;return event}
  update(id,patch={},type='MISSION_UPDATED',data={}){const mission=this.get(id);if(Object.prototype.hasOwnProperty.call(patch,'id')&&patch.id!==mission.id)throw new Error('MISSION_ID_IMMUTABLE');if(Object.prototype.hasOwnProperty.call(patch,'protocol')&&patch.protocol!==MISSION_PROTOCOL)throw new Error('MISSION_PROTOCOL_IMMUTABLE');if(Object.prototype.hasOwnProperty.call(patch,'rootGoal')&&patch.rootGoal!==mission.rootGoal)throw new Error('MISSION_ROOT_GOAL_IMMUTABLE');if(Object.prototype.hasOwnProperty.call(patch,'createdAt')&&patch.createdAt!==mission.createdAt)throw new Error('MISSION_CREATED_AT_IMMUTABLE');if(Object.prototype.hasOwnProperty.call(patch,'events'))throw new Error('MISSION_EVENTS_STORE_OWNED');if(Object.prototype.hasOwnProperty.call(patch,'evidence'))throw new Error('MISSION_EVIDENCE_STORE_OWNED');if(Object.prototype.hasOwnProperty.call(patch,'cycles')){if(!Array.isArray(patch.cycles)||patch.cycles.length!==mission.cycles.length+1)throw new Error('MISSION_CYCLES_APPEND_ONLY');for(let i=0;i<mission.cycles.length;i++)if(JSON.stringify(patch.cycles[i])!==JSON.stringify(mission.cycles[i]))throw new Error('MISSION_CYCLES_APPEND_ONLY');if(!Object.prototype.hasOwnProperty.call(patch,'cycle')||patch.cycle!==mission.cycle+1)throw new Error('MISSION_CYCLE_ADVANCE_INVALID')}const hasStatus=Object.prototype.hasOwnProperty.call(patch,'status');if(TERMINAL.has(mission.status)&&hasStatus&&patch.status!==mission.status)throw new Error('MISSION_TERMINAL');if(hasStatus&&!VALID.has(patch.status))throw new Error('INVALID_MISSION_STATUS');const candidate={...mission,...patch};if(!validMissionShape(candidate))throw new Error('INVALID_MISSION_SHAPE');Object.assign(mission,patch);this.eventObject(mission,type,data);atomicJson(this.file(id),mission);return mission}
  addEvidence(id,evidence){const mission=this.get(id);const item={...evidence,id:`mev-${crypto.randomBytes(6).toString('hex')}`,at:now()};mission.evidence.push(item);this.eventObject(mission,'MISSION_EVIDENCE',{evidenceId:item.id,kind:item.kind||'generic'});atomicJson(this.file(id),mission);return mission}
}

export class AutonomousGoalSupervisor{
  constructor({runner,runtimeDir,assessGoal=requestGoalAssessment,contextProvider=null,authorityGate=null}){this.runner=runner;this.store=new AutonomousMissionStore(runtimeDir);this.assessGoal=assessGoal;this.contextProvider=contextProvider;this.authorityGate=authorityGate;this.busy=new Set();this.timer=null}
  start(goal,options={}){return this.store.create(goal,options)}
  get(id){return this.store.get(id)}
  list(limit=30){return this.store.list(limit)}
  resume(id){const mission=this.store.get(id);if(TERMINAL.has(mission.status))throw new Error('MISSION_TERMINAL');return this.store.update(id,{status:'ACTIVE',blocker:null},'MISSION_RESUMED',{from:mission.status})}
  async _authorizeMission(id,approvalMode){
    if(!this.authorityGate)throw Object.assign(new Error('RCL authority gate is required for autonomous mission advance'),{code:'RCL_RUNTIME_UNBOUND'});
    try{const receipt=await this.authorityGate.assert('mission_advance',{approvalMode,requestId:`mission:${id}:advance:${Date.now()}`,metadata:{missionId:id}});this.store.addEvidence(id,{kind:'rcl-authority',action:'mission_advance',receipt});return receipt}
    catch(error){if(error.receipt)this.store.addEvidence(id,{kind:'rcl-authority-denied',action:'mission_advance',receipt:error.receipt});throw error}
  }
  async _advance(run,mission,approvalMode){
    if(['PLANNED','WAITING_PROVIDER'].includes(run.status)&&run.dwac?.connected&&run.dwac?.status==='COMPILED')run=await this.runner.synthesize(run.id);
    if(run.status==='CHANGESET_STAGED'){
      if(approvalMode==='read_only')return run;
      await this.runner.apply(run.id,{approvalMode});run=this.runner.get(run.id);
    }
    if(run.status==='CHANGES_APPLIED')run=await this.runner.validate(run.id,{approvalMode});
    let repairs=0;while(run.status==='REPAIR_REQUIRED'&&repairs<mission.config.maxRepairs&&approvalMode!=='read_only'){run=await this.runner.repair(run.id,{approvalMode});repairs++}
    if(run.status==='READY_FOR_DELIVERY'&&!run.delivery)run=await this.runner.delivery(run.id,{commit:mission.config.autoCommit&&approvalMode==='full_access',approvalMode,message:`Taowind Code autonomous cycle ${mission.cycle+1}: ${mission.rootGoal.slice(0,60)}`});
    return run;
  }
  _repoObservation(mission,run){
    try{if(this.contextProvider)return this.contextProvider(mission,run);if(typeof this.runner._semanticContext==='function'){const ctx=this.runner._semanticContext(mission.rootGoal);return {selection:ctx.selection,graph:{version:ctx.graph?.version,stats:ctx.graph?.stats,goalTokens:ctx.graph?.goalTokens,top:ctx.graph?.nodes?.slice(0,16).map(n=>({path:n.path,score:n.score,centrality:n.centrality,symbols:n.symbols?.slice(0,8)}))}}}}catch(error){return {error:String(error?.message||error)}}return null
  }
  async tick(id,{approvalMode='workspace'}={}){
    if(this.busy.has(id))throw Object.assign(new Error('MISSION_BUSY'),{code:'MISSION_BUSY'});this.busy.add(id);
    try{
      let mission=this.store.get(id);if(TERMINAL.has(mission.status))return mission;
      try{await this._authorizeMission(id,approvalMode)}catch(error){const unbound=error.code==='RCL_RUNTIME_UNBOUND';return this.store.update(id,{status:unbound?'WAITING_PROVIDER':'WAITING_APPROVAL',blocker:unbound?'RCL Authority 未绑定，自治循环按失败关闭原则暂停':`RCL Authority 拒绝推进：${error.receipt?.reason||error.message}`},unbound?'MISSION_RCL_PROVIDER_BLOCKED':'MISSION_RCL_AUTHORITY_DENIED',{receiptId:error.receipt?.id||null})}
      mission=this.store.update(id,{status:'ACTIVE',blocker:null},'MISSION_TICK_STARTED',{cycle:mission.cycle+1});
      let run=mission.currentRunId?this.runner.get(mission.currentRunId):null;
      if(!run||['ROLLED_BACK','FAILED','DELIVERED_LOCAL'].includes(run.status)){run=this.runner.create(mission.nextGoal||mission.rootGoal);mission=this.store.update(id,{currentRunId:run.id},'MISSION_RUN_BOUND',{runId:run.id,cycle:mission.cycle+1})}
      run=await this._advance(run,mission,approvalMode);
      if(run.status==='WAITING_PROVIDER'){return this.store.update(id,{status:'WAITING_PROVIDER',blocker:run.blocker||'Provider 未绑定或没有可执行候选'},'MISSION_WAITING_PROVIDER',{runId:run.id})}
      if(run.status==='CHANGESET_STAGED'&&approvalMode==='read_only'){return this.store.update(id,{status:'WAITING_APPROVAL',blocker:'Read only 模式禁止应用 changeset'},'MISSION_WAITING_APPROVAL',{runId:run.id})}
      if(run.status==='REPAIR_REQUIRED'){return this.store.update(id,{status:'BLOCKED',blocker:'Repair 预算内仍未通过硬验收'},'MISSION_BLOCKED',{runId:run.id,reason:'REPAIR_BUDGET_EXHAUSTED'})}
      if(['FAILED','ROLLED_BACK'].includes(run.status)){return this.store.update(id,{status:'BLOCKED',blocker:`子运行终止：${run.status}`},'MISSION_BLOCKED',{runId:run.id,reason:run.status})}
      if(run.status!=='READY_FOR_DELIVERY'&&run.status!=='DELIVERED_LOCAL')return this.store.update(id,{status:'ACTIVE',blocker:null},'MISSION_RUN_PROGRESS',{runId:run.id,status:run.status});
      const hardGatePassed=run.validation?.passed===true;if(!hardGatePassed)return this.store.update(id,{status:'BLOCKED',blocker:'缺少通过的真实验收证据'},'MISSION_BLOCKED',{runId:run.id,reason:'VALIDATION_EVIDENCE_REQUIRED'});
      const repository=this._repoObservation(mission,run);let assessment;
      try{assessment=await this.assessGoal({rootGoal:mission.rootGoal,cycleGoal:mission.nextGoal,cycle:mission.cycle+1,run:{id:run.id,status:run.status,mode:run.mode,validation:run.validation,delivery:run.delivery,evidence:run.evidence?.slice(-24),dwac:run.dwac?{mode:run.dwac.mode,selected_bottleneck:run.dwac.selected_bottleneck,decision_reason:run.dwac.decision_reason}:null},repository})}catch(error){return this.store.update(id,{status:'WAITING_PROVIDER',blocker:`目标闭合审计不可用：${error?.message||error}`},'MISSION_CLOSURE_AUDIT_BLOCKED',{runId:run.id})}
      this.store.addEvidence(id,{kind:'goal-closure-assessment',runId:run.id,assessment});mission=this.store.get(id);
      const cycleRecord={index:mission.cycle+1,runId:run.id,goal:mission.nextGoal,mode:run.mode,status:run.status,closedAt:now(),assessment};const cycles=[...mission.cycles,cycleRecord];const cycle=mission.cycle+1;
      if(assessment.closed===true&&assessment.confidence>=mission.config.closureThreshold){return this.store.update(id,{status:'GOAL_CLOSED',cycle,cycles,currentRunId:run.id,closure:{at:now(),assessment,runId:run.id},blocker:null},'MISSION_GOAL_CLOSED',{runId:run.id,confidence:assessment.confidence})}
      if(cycle>=mission.config.maxCycles){return this.store.update(id,{status:'BUDGET_EXHAUSTED',cycle,cycles,currentRunId:run.id,closure:{at:now(),assessment,runId:run.id},blocker:'达到自主循环预算，仍未获得闭合共识'},'MISSION_BUDGET_EXHAUSTED',{runId:run.id,cycles:cycle})}
      const nextGoal=String(assessment.next_goal||assessment.gaps?.[0]?.problem||mission.rootGoal).trim()||mission.rootGoal;
      return this.store.update(id,{status:'ACTIVE',cycle,cycles,currentRunId:null,nextGoal,closure:{at:now(),assessment,runId:run.id},blocker:null},'MISSION_RECOMPILED',{fromRunId:run.id,nextGoal,recommendedMode:assessment.recommended_mode});
    }catch(error){try{return this.store.update(id,{status:'FAILED',blocker:String(error?.message||error)},'MISSION_FAILED',{error:String(error?.stack||error)})}catch{throw error}}finally{this.busy.delete(id)}
  }
  async run(id,{approvalMode='workspace',maxTicks=8}={}){let mission=this.store.get(id);for(let i=0;i<Math.max(1,Math.min(64,Number(maxTicks)||1));i++){if(TERMINAL.has(mission.status)||['WAITING_PROVIDER','WAITING_APPROVAL','BLOCKED'].includes(mission.status))break;mission=await this.tick(id,{approvalMode})}return mission}
  startScheduler({getApprovalMode=()=> 'workspace',intervalMs=2500}={}){if(this.timer)return this.timer;const delay=Math.max(750,Math.min(60_000,Number(intervalMs)||2500));this.timer=setInterval(()=>{for(const mission of this.list(64)){if(mission.status!=='ACTIVE'||this.busy.has(mission.id))continue;this.tick(mission.id,{approvalMode:getApprovalMode()}).catch(()=>{})}},delay);this.timer.unref?.();return this.timer}
  stopScheduler(){if(this.timer)clearInterval(this.timer);this.timer=null}
}
