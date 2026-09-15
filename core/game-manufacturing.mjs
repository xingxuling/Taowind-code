import fs from 'node:fs';
import path from 'node:path';
import {spawnSync as nodeSpawnSync} from 'node:child_process';

export const GAME_MANUFACTURING_PROTOCOL='taowind-code.game-manufacturing.v0.3';

export function detectLocalGameProject(workspace,{fsImpl=fs}={}){
  const root=path.resolve(workspace);
  const matches=[];
  if(fsImpl.existsSync(path.join(root,'project.godot')))matches.push({engine:'godot',marker:'project.godot'});
  if(fsImpl.existsSync(path.join(root,'Assets'))&&fsImpl.existsSync(path.join(root,'ProjectSettings','ProjectVersion.txt')))matches.push({engine:'unity',marker:'ProjectSettings/ProjectVersion.txt'});
  let uprojs=[];
  try{uprojs=fsImpl.readdirSync(root).filter(x=>x.endsWith('.uproject')).sort()}catch{}
  if(uprojs.length===1)matches.push({engine:'unreal-engine',marker:uprojs[0]});
  if(uprojs.length>1)return {detected:false,ambiguous:true,reason:'MULTIPLE_UPROJECT_FILES',matches:uprojs.map(marker=>({engine:'unreal-engine',marker}))};
  if(matches.length>1)return {detected:false,ambiguous:true,reason:'MULTIPLE_ENGINE_MARKERS',matches};
  if(matches.length===1)return {detected:true,ambiguous:false,...matches[0],workspace:root};
  return {detected:false,ambiguous:false,matches:[],workspace:root};
}

export function buildGameRouteArgs({routerScript,goal,workspace,target,requirements=[],projectInfo}){
  const argv=[routerScript,String(goal||'').trim()];
  if(projectInfo?.detected)argv.push('--project-root',path.resolve(workspace));
  if(target)argv.push('--target',String(target));
  for(const requirement of requirements||[])if(String(requirement).trim())argv.push('--requirement',String(requirement).trim());
  return argv;
}

export function compileGameMissionGoal(goal,route){
  const primary=route?.primary_engine||'UNRESOLVED';
  const secondaries=route?.secondary_engines?.length?route.secondary_engines.join(','):'none';
  return [
    '[TAOWIND GAME MANUFACTURING CONTRACT / 道风游戏制造契约]',
    '[TAOWIND_GAME_MANUFACTURING=1]',
    `[TAOWIND_GAME_PRIMARY=${primary}]`,
    `[TAOWIND_GAME_SECONDARY=${secondaries}]`,
    '[TAOWIND_GAME_BUILD_EVIDENCE_REQUIRED=1]',
    `用户目标：${String(goal||'').trim()}`,
    `DWAC 主引擎：${primary}`,
    `DWAC 次级引擎：${secondaries}`,
    `多引擎策略：${route?.hybrid?'enabled':'disabled'}`,
    '引擎角色：primary 负责正式生产构建；secondary 默认只做独立原型、基准、资产验证或目标平台专用身体，除非存在经过验证的跨引擎桥。',
    '权威边界：RCL/RNCS 保留 canonical authority；Godot/Unity/Unreal 只作为外部 runtime/build provider。',
    '硬验收要求：validation 必须至少包含一次主引擎真实 CLI 构建/导出命令成功，以及一次对构建产物真实存在的文件系统检查成功；只有普通单元测试通过不能宣称游戏制造完成。',
    '优先执行入口：python <DWAC>/scripts/dwac_game_engine_provider.py execute <project> <build|package|archive|export> ...；该入口只有在真实引擎执行、返回码与输出工件门全部通过时才返回成功。',
    '执行要求：沿用 Taowind Code 自主北极星闭环，完成源码、资产、测试、真实构建验证、失败修复、证据账本与可回滚交付；没有真实引擎构建证据不得宣称完成。',
  ].join('\n');
}

export function parseGameManufacturingContract(goal){
  const text=String(goal||'');
  if(!text.includes('[TAOWIND_GAME_MANUFACTURING=1]'))return {enabled:false,buildEvidenceRequired:false,primaryEngine:null,secondaryEngines:[]};
  const primary=text.match(/\[TAOWIND_GAME_PRIMARY=([^\]]+)\]/)?.[1]?.trim()||null;
  const secondaryRaw=text.match(/\[TAOWIND_GAME_SECONDARY=([^\]]*)\]/)?.[1]?.trim()||'';
  const secondaryEngines=secondaryRaw&&secondaryRaw!=='none'?secondaryRaw.split(',').map(x=>x.trim()).filter(Boolean):[];
  return {enabled:true,buildEvidenceRequired:text.includes('[TAOWIND_GAME_BUILD_EVIDENCE_REQUIRED=1]'),primaryEngine:primary,secondaryEngines};
}

export function assessGameBuildEvidence(run,contract=parseGameManufacturingContract(run?.goal)){
  if(!contract?.enabled||!contract.buildEvidenceRequired)return {required:false,passed:true,primaryEngine:contract?.primaryEngine||null,buildCommand:null,artifactCheck:null,reason:'GAME_BUILD_EVIDENCE_NOT_REQUIRED'};
  const engine=contract.primaryEngine;
  const rows=Array.isArray(run?.validation?.results)?run.validation.results:[];
  const successful=rows.filter(x=>Number(x?.code)===0&&x?.timedOut!==true);
  const providerExecute=/dwac_game_engine_provider\.py(?:["']|\s|[^\r\n])*\bexecute\b(?:["']|\s|[^\r\n])*\b(build|package|archive|export)\b/i;
  const patterns={
    godot:/(^|[\\/\s"'])(godot4?|godot\.exe)([\s"']|$).*?(--export-release|--export-debug)|(--export-release|--export-debug).*?(godot4?|godot\.exe)/i,
    unity:/(^|[\\/\s"'])(Unity(?:\.exe)?|unity-editor)([\s"']|$).*?(-batchmode|-executeMethod|-buildTarget)/i,
    'unreal-engine':/(UnrealEditor-Cmd(?:\.exe)?|RunUAT(?:\.bat|\.sh)?|BuildCookRun)/i,
  };
  const matcher=patterns[engine]||/$a/;
  const buildCommand=successful.find(x=>{const command=String(x?.command||'');return providerExecute.test(command)||matcher.test(command)})||null;
  const artifactMatcher=/(test\s+-[ef]\s|Test-Path\s|Get-Item\s|if\s+exist\s|\bstat\s+|\bdir\s+|\bls\s+-l\s)/i;
  const artifactCheck=successful.find(x=>artifactMatcher.test(String(x?.command||'')))||null;
  const passed=run?.validation?.passed===true&&!!buildCommand&&!!artifactCheck;
  return {
    required:true,
    passed,
    primaryEngine:engine,
    buildCommand:buildCommand?{command:buildCommand.command,code:buildCommand.code,durationMs:buildCommand.durationMs}:null,
    artifactCheck:artifactCheck?{command:artifactCheck.command,code:artifactCheck.code,durationMs:artifactCheck.durationMs}:null,
    reason:passed?'GAME_ENGINE_BUILD_EVIDENCE_VERIFIED':!buildCommand?'PRIMARY_ENGINE_BUILD_COMMAND_MISSING':!artifactCheck?'BUILD_ARTIFACT_EXISTENCE_CHECK_MISSING':'GENERIC_VALIDATION_NOT_PASSED',
  };
}

export function createGameAwareGoalAssessor(baseAssess){
  if(typeof baseAssess!=='function')throw new TypeError('baseAssess must be a function');
  return async payload=>{
    const contract=parseGameManufacturingContract(payload?.rootGoal);
    if(contract.enabled&&contract.buildEvidenceRequired){
      const evidence=assessGameBuildEvidence(payload?.run||{},contract);
      if(!evidence.passed){
        return {
          closed:false,
          confidence:1,
          reason:`非补偿性游戏构建证据门未通过：${evidence.reason}`,
          gaps:[{kind:'game-engine-build-evidence',problem:evidence.reason,primary_engine:contract.primaryEngine}],
          next_goal:`补齐 ${contract.primaryEngine||'主引擎'} 的真实 CLI 构建/导出，并把成功构建命令与构建产物存在性检查同时加入 validation；不得用普通单元测试替代真实引擎构建。`,
          recommended_mode:'DEEP_DEVELOPMENT',
          game_build_evidence:evidence,
        };
      }
      const assessment=await baseAssess({...payload,gameBuildEvidence:evidence});
      return {...assessment,game_build_evidence:evidence};
    }
    return await baseAssess(payload);
  };
}

export class GameManufacturingGateway{
  constructor({dwacRoot=process.env.TAOWIND_DWAC_ROOT,python=process.env.PYTHON||'python',spawnSyncImpl=nodeSpawnSync,fsImpl=fs}={}){
    this.dwacRoot=dwacRoot?path.resolve(dwacRoot):null;
    this.python=python;
    this.spawnSync=spawnSyncImpl;
    this.fs=fsImpl;
  }
  routerScript(){return this.dwacRoot?path.join(this.dwacRoot,'scripts','dwac_game_engine_route.py'):null}
  status(workspace){
    const script=this.routerScript();
    const project=workspace?detectLocalGameProject(workspace,{fsImpl:this.fs}):null;
    return {protocol:GAME_MANUFACTURING_PROTOCOL,bound:!!script&&this.fs.existsSync(script),dwacRoot:this.dwacRoot,routerScript:script,project};
  }
  route(goal,{workspace,target,requirements=[]}={}){
    const normalized=String(goal||'').trim();
    if(!normalized)throw Object.assign(new Error('GAME_GOAL_REQUIRED'),{code:'GAME_GOAL_REQUIRED'});
    const script=this.routerScript();
    if(!script||!this.fs.existsSync(script))throw Object.assign(new Error('DWAC game-engine router is not bound; update/bind TAOWIND_DWAC_ROOT'),{code:'GAME_ROUTER_UNBOUND'});
    const projectInfo=workspace?detectLocalGameProject(workspace,{fsImpl:this.fs}):null;
    if(projectInfo?.ambiguous)throw Object.assign(new Error(projectInfo.reason||'AMBIGUOUS_GAME_PROJECT'),{code:'AMBIGUOUS_GAME_PROJECT',projectInfo});
    const args=buildGameRouteArgs({routerScript:script,goal:normalized,workspace,target,requirements,projectInfo});
    const out=this.spawnSync(this.python,args,{encoding:'utf8',timeout:30_000,maxBuffer:4*1024*1024,shell:false});
    const text=String(out.stdout||'').trim();
    let decision=null;
    try{decision=text?JSON.parse(text):null}catch{}
    if(out.error)throw Object.assign(new Error(`GAME_ROUTER_EXECUTION_ERROR: ${out.error.message}`),{code:'GAME_ROUTER_EXECUTION_ERROR'});
    if(!decision)throw Object.assign(new Error(String(out.stderr||'DWAC game-engine router returned invalid JSON').slice(-4000)),{code:'GAME_ROUTER_INVALID_RESPONSE'});
    if(![0,3].includes(out.status))throw Object.assign(new Error(String(out.stderr||decision?.message||'DWAC game-engine router failed').slice(-4000)),{code:'GAME_ROUTER_FAILED',decision});
    return {protocol:GAME_MANUFACTURING_PROTOCOL,decision,project:projectInfo,missionGoal:decision.status==='READY'?compileGameMissionGoal(normalized,decision):null};
  }
}
