import {RunStore} from './run-store.mjs';
import {ChangesetStore} from './changesets.mjs';
import {WorkspaceService} from './workspace.mjs';
import {compileWithDWAC} from './dwac-adapter.mjs';
import {requestChangesetCandidates,taoAIStatus} from './tao-ai-adapter.mjs';
import {buildSemanticRepoGraph,selectSemanticContext,graphSummary} from './semantic-repo-graph.mjs';
import {selectFederatedProposal} from './federated-generation.mjs';
import {repositorySummary} from './repo-context.mjs';
import {runAcceptance} from './acceptance.mjs';
import {captureValidationPostimage,compareValidationPostimage,enforceValidationPostimage} from './validation-integrity.mjs';
import {browserGoalLikely} from './browser-observation.mjs';
import {gitDeliveryPreview,gitLocalCommit} from './git.mjs';

function browserValidation(goal,proposal={},previous={}){
  const required=browserGoalLikely(goal)||previous.browserRequired===true;let checks=Array.isArray(proposal.browser_checks)?proposal.browser_checks.filter(Boolean).slice(0,8):Array.isArray(previous.browserChecks)?previous.browserChecks:[];
  if(required&&!checks.length&&process.env.TAOWIND_PREVIEW_URL)checks=[{url:process.env.TAOWIND_PREVIEW_URL,forbidConsoleErrors:true,forbidPageExceptions:true,forbidCriticalNetworkErrors:true,screenshot:true}];
  return {browserRequired:required,browserChecks:checks};
}
function cognitionStatus(){return taoAIStatus()}
function cognitionAvailable(){return cognitionStatus().connected===true}
function unresolvedCognitionBlocker(phase='变更合成'){
  const status=cognitionStatus();
  if(!status.nativeConnected&&!status.acceleratorConnected)return `DWAC Cognition 未绑定，${phase}无法继续`;
  if(status.nativeConnected&&!status.acceleratorConnected)return `DWAC 原生认知没有生成可执行 changeset。当前任务超出已验证的原生代码变更能力或上下文不足；可补充上下文，或连接可选 External AI Accelerator（外部 AI 加速器）扩大能力。`;
  return `DWAC 联邦候选没有生成可执行 changeset；需要补充上下文或更换可用能力 Provider。`;
}
export class NorthStarRunner{
 constructor({workspace,runtimeDir,taskStore,authorityGate=null,browserObserver=null}){this.workspace=workspace;this.runtimeDir=runtimeDir;this.tasks=taskStore;this.runs=new RunStore(runtimeDir);this.changesets=new ChangesetStore(runtimeDir,workspace);this.ws=new WorkspaceService(workspace);this.authorityGate=authorityGate;this.browserObserver=browserObserver}
 async _authorize(id,action,approvalMode,metadata={}){
   if(!this.authorityGate)throw Object.assign(new Error('RCL authority gate is required for effectful actions'),{code:'RCL_RUNTIME_UNBOUND'});
   try{const receipt=await this.authorityGate.assert(action,{approvalMode,workspace:this.workspace,requestId:`run:${id}:${action}:${Date.now()}`,metadata});this.runs.addEvidence(id,{kind:'rcl-authority',action,receipt});return receipt}
   catch(error){if(error.receipt)this.runs.addEvidence(id,{kind:'rcl-authority-denied',action,receipt:error.receipt});throw error}
 }
 create(goal){
   const dwac=compileWithDWAC(goal,this.workspace);const mode=dwac.mode||'WHOLE_ARTIFACT';let run=this.runs.create({goal,mode,dwac});const tasks=this.tasks.plan(goal,{mode,runId:run.id});
   const status=dwac.connected&&dwac.status==='COMPILED'?'PLANNED':'WAITING_PROVIDER';run=this.runs.update(run.id,{status,tasks,dwac,blocker:status==='WAITING_PROVIDER'?'DWAC runtime 未绑定或编译失败':null,message:dwac.decision_reason||null},'DWAC_COMPILED',{mode,cycleId:dwac.cycle_id||null});this.tasks.syncRun(run);return run;
 }
 list(){return this.runs.list()}
 get(id){return this.runs.get(id)}
 _semanticContext(goal){
   const manifest=this.ws.manifest();const seedPaths=manifest.filter(x=>x.size<=80_000).map(x=>x.path);const seed=this.ws.contextBundle(seedPaths,{maxFiles:180,maxBytes:650_000});
   const graph=buildSemanticRepoGraph(seed.files,{goal});const selection=selectSemanticContext(graph,{maxFiles:36,maxBytes:280_000});const bundle=this.ws.contextBundle(selection.paths,{maxFiles:36,maxBytes:280_000});
   return {manifest,graph,selection,bundle};
 }
 async _federatedProposal(goal,dwac,ctx){
   const candidates=await requestChangesetCandidates({goal,dwac,repository:{...repositorySummary(ctx.manifest),semanticGraph:graphSummary(ctx.graph)},files:ctx.bundle.files});
   const federation=selectFederatedProposal(candidates,{goal,manifest:ctx.manifest});return {candidates,federation,proposal:federation.winner};
 }
 async synthesize(id){
   let run=this.runs.get(id);if(!run.dwac?.connected||run.dwac?.status!=='COMPILED')throw new Error('DWAC_REQUIRED');if(!cognitionAvailable()){run=this.runs.update(id,{status:'WAITING_PROVIDER',blocker:unresolvedCognitionBlocker('变更合成')},'DWAC_COGNITION_BLOCKED');this.tasks.syncRun(run);return run}
   const ctx=this._semanticContext(run.goal);let {candidates,federation,proposal}=await this._federatedProposal(run.goal,run.dwac,ctx);
   const needs=[...new Set((federation.contextRequests||proposal?.needs_more_context||[]).filter(Boolean))].slice(0,32);if(needs.length){const extra=this.ws.contextBundle(needs,{maxFiles:32,maxBytes:320_000});if(extra.files.length){const merged=[...ctx.bundle.files,...extra.files.filter(x=>!ctx.bundle.files.some(y=>y.path===x.path))];const second=await requestChangesetCandidates({goal:run.goal,dwac:run.dwac,repository:{...repositorySummary(ctx.manifest),semanticGraph:graphSummary(ctx.graph)},files:merged});candidates=[...candidates,...second];federation=selectFederatedProposal(candidates,{goal:run.goal,manifest:ctx.manifest});proposal=federation.winner}}
   this.runs.addEvidence(id,{kind:'semantic-context',graph:graphSummary(ctx.graph),selectedPaths:ctx.selection.paths,totalBytes:ctx.bundle.totalBytes});
   this.runs.addEvidence(id,{kind:'federated-generation',protocol:federation.protocol,consensus:federation.consensus,ranked:federation.ranked.map(x=>({provider:x.provider,role:x.role,summary:x.summary,evaluation:x.evaluation,files:x.changes.map(c=>c.path)})),winner:proposal?{provider:proposal.provider,role:proposal.role,evaluation:proposal.evaluation}:null,cognition:cognitionStatus()});
   if(!proposal||!Array.isArray(proposal.changes)||!proposal.changes.length){run=this.runs.update(id,{status:'WAITING_PROVIDER',blocker:unresolvedCognitionBlocker('变更合成'),proposal,federation},'DWAC_COGNITION_UNRESOLVED');this.tasks.syncRun(run);return run}
   const cs=this.changesets.stage(id,proposal.changes,{source:`federation:${proposal.provider}:${proposal.role}`});const browser=browserValidation(run.goal,proposal);run=this.runs.update(id,{status:'CHANGESET_STAGED',changesets:[...run.changesets,cs.id],proposal,federation:{protocol:federation.protocol,consensus:federation.consensus,winner:{provider:proposal.provider,role:proposal.role,evaluation:proposal.evaluation}},semanticContext:{graph:graphSummary(ctx.graph),selection:ctx.selection},validation:{commands:proposal.validation_commands||[],...browser,status:'NOT_RUN'}},'CHANGESET_STAGED',{changesetId:cs.id,files:cs.changes.length,browserRequired:browser.browserRequired});this.runs.addEvidence(id,{kind:'changeset-staged',changesetId:cs.id,files:cs.changes.map(x=>({path:x.path,op:x.op,before:x.before.sha256,after:x.after.sha256})),browserRequired:browser.browserRequired,browserChecks:browser.browserChecks});run=this.runs.get(id);this.tasks.syncRun(run);return run;
 }
 stage(id,changes,validationCommands=[],browserChecks=[]){let run=this.runs.get(id);const cs=this.changesets.stage(id,changes,{source:'api'});const browser=browserValidation(run.goal,{browser_checks:browserChecks});run=this.runs.update(id,{status:'CHANGESET_STAGED',changesets:[...run.changesets,cs.id],validation:{commands:validationCommands,...browser,status:'NOT_RUN'}},'CHANGESET_STAGED',{changesetId:cs.id,files:cs.changes.length,browserRequired:browser.browserRequired});this.tasks.syncRun(run);return {run,changeset:cs}}
 async apply(id,{approvalMode='workspace'}={}){let run=this.runs.get(id);const csid=run.changesets.at(-1);if(!csid)throw new Error('CHANGESET_REQUIRED');await this._authorize(id,'changeset_apply',approvalMode,{changesetId:csid});const cs=this.changesets.apply(csid);run=this.runs.update(id,{status:'CHANGES_APPLIED',blocker:null},'CHANGESET_APPLIED',{changesetId:csid,receipt:cs.applyReceipt?.receiptSha256});this.runs.addEvidence(id,{kind:'changeset-applied',changesetId:csid,receipt:cs.applyReceipt});run=this.runs.get(id);this.tasks.syncRun(run);return {run,changeset:cs}}
 async validate(id,{approvalMode='workspace',commands=null,browserChecks=null}={}){let run=this.runs.get(id);if(!['CHANGES_APPLIED','REPAIR_REQUIRED','READY_FOR_DELIVERY'].includes(run.status))throw new Error('CHANGES_NOT_APPLIED');const selected=commands||run.validation?.commands||[];const checks=browserChecks||run.validation?.browserChecks||[];const browserRequired=run.validation?.browserRequired===true;const protectedPaths=[...new Set(run.changesets.flatMap(csid=>{try{return this.changesets.get(csid).changes.map(x=>x.path)}catch{return[]}}))];const postimageSnapshot=captureValidationPostimage(this.ws,protectedPaths);await this._authorize(id,'validation_execute',approvalMode,{commands:selected,browserChecks:checks,browserRequired});run=this.runs.update(id,{status:'VALIDATING'},'VALIDATION_STARTED');this.tasks.syncRun(run);let result=await runAcceptance(this.workspace,selected,{mode:approvalMode,browserObserver:this.browserObserver,browserChecks:checks,browserRequired});const postimageIntegrity=compareValidationPostimage(this.ws,postimageSnapshot);result=enforceValidationPostimage(result,postimageIntegrity);const status=result.passed?'READY_FOR_DELIVERY':'REPAIR_REQUIRED';run=this.runs.update(id,{status,validation:{...result,browserRequired,browserChecks:checks,at:new Date().toISOString()},blocker:result.passed?null:`验收失败：${result.hardGate}，需要 Repair`},'VALIDATION_FINISHED',{passed:result.passed,hardGate:result.hardGate,browserRequired,postimageIntegrity:postimageIntegrity.passed});this.runs.addEvidence(id,{kind:'validation',status:result.status,hardGate:result.hardGate,postimageIntegrity,results:result.results.map(x=>({command:x.command,code:x.code,timedOut:x.timedOut,durationMs:x.durationMs})),browser:(result.browser?.results||[]).map(x=>({id:x.id||null,url:x.url||x.check?.url||null,evidenceRoot:x.evidenceRoot||null,screenshot:x.screenshot||null,evaluation:x.evaluation||null,error:x.error||null}))});run=this.runs.get(id);this.tasks.syncRun(run);return run}
 async repair(id,{approvalMode='workspace'}={}){
   let run=this.runs.get(id);if(run.status!=='REPAIR_REQUIRED')throw new Error('REPAIR_NOT_REQUIRED');
   if(!cognitionAvailable()){run=this.runs.update(id,{status:'WAITING_PROVIDER',mode:'DEEP_DEVELOPMENT',blocker:unresolvedCognitionBlocker('修复合成')},'DWAC_COGNITION_REPAIR_BLOCKED');this.tasks.syncRun(run);return run}
   const ctx=this._semanticContext(`${run.goal} ${JSON.stringify(run.validation||{})}`);const failure={validation:run.validation,previousProposal:run.proposal||null,changesets:run.changesets};const repairGoal=`修复这次失败的 Taowind Code 运行，不扩大范围。原始目标：${run.goal}`;
   const {federation,proposal}=await this._federatedProposal(repairGoal,{...run.dwac,mode:'DEEP_DEVELOPMENT',failure},ctx);
   if(!proposal||!Array.isArray(proposal.changes)||!proposal.changes.length){run=this.runs.update(id,{status:'WAITING_PROVIDER',mode:'DEEP_DEVELOPMENT',blocker:unresolvedCognitionBlocker('修复合成'),proposal},'DWAC_COGNITION_REPAIR_UNRESOLVED');this.tasks.syncRun(run);return run}
   const cs=this.changesets.stage(id,proposal.changes,{source:`federation-repair:${proposal.provider}:${proposal.role}`});const browser=browserValidation(run.goal,proposal,run.validation||{});run=this.runs.update(id,{status:'CHANGESET_STAGED',mode:'DEEP_DEVELOPMENT',cycle:(run.cycle||1)+1,changesets:[...run.changesets,cs.id],proposal,federation:{protocol:federation.protocol,consensus:federation.consensus,winner:{provider:proposal.provider,role:proposal.role,evaluation:proposal.evaluation}},validation:{commands:proposal.validation_commands||run.validation?.commands||[],...browser,status:'NOT_RUN'},blocker:null},'REPAIR_CHANGESET_STAGED',{changesetId:cs.id,files:cs.changes.length,browserRequired:browser.browserRequired});
   this.runs.addEvidence(id,{kind:'repair-federated-generation',consensus:federation.consensus,winner:{provider:proposal.provider,role:proposal.role,evaluation:proposal.evaluation},browserRequired:browser.browserRequired,cognition:cognitionStatus()});this.tasks.syncRun(this.runs.get(id));await this.apply(id,{approvalMode});return await this.validate(id,{approvalMode});
 }
 async rollback(id,{approvalMode='workspace'}={}){let run=this.runs.get(id);const csid=run.changesets.at(-1);if(!csid)throw new Error('CHANGESET_REQUIRED');await this._authorize(id,'changeset_rollback',approvalMode,{changesetId:csid});const cs=this.changesets.rollback(csid);run=this.runs.update(id,{status:'ROLLED_BACK',blocker:null},'CHANGESET_ROLLED_BACK',{changesetId:csid,receipt:cs.rollbackReceipt?.receiptSha256});this.runs.addEvidence(id,{kind:'rollback',changesetId:csid,receipt:cs.rollbackReceipt});run=this.runs.get(id);this.tasks.syncRun(run);return run}
 async delivery(id,{commit=false,message='',approvalMode='workspace'}={}){let run=this.runs.get(id);if(run.status!=='READY_FOR_DELIVERY')throw new Error('VALIDATION_REQUIRED');const changedPaths=[...new Set(run.changesets.flatMap(csid=>{try{return this.changesets.get(csid).changes.map(x=>x.path)}catch{return[]}}))];let delivery={...gitDeliveryPreview(this.workspace),changedPaths};if(commit){await this._authorize(id,'git_commit',approvalMode,{changedPaths});delivery={...delivery,localCommit:gitLocalCommit(this.workspace,message||`Taowind Code: ${run.goal.slice(0,72)}`,changedPaths)}}run=this.runs.update(id,{status:commit&&delivery.localCommit?.ok?'DELIVERED_LOCAL':'READY_FOR_DELIVERY',delivery},'DELIVERY_PREVIEWED',{localCommitPerformed:!!delivery.localCommit?.ok,pushPerformed:false,prPerformed:false,changedPaths});this.runs.addEvidence(id,{kind:'git-delivery',branch:delivery.branch,head:delivery.head,stat:delivery.stat,changedPaths,localCommitPerformed:!!delivery.localCommit?.ok,pushPerformed:false,prPerformed:false});run=this.runs.get(id);this.tasks.syncRun(run);return run}
}
