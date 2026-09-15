import fs from 'node:fs';
import path from 'node:path';
import {spawnSync as nodeSpawnSync} from 'node:child_process';

export const GAME_MANUFACTURING_PROTOCOL='taowind-code.game-manufacturing.v0.1';

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
  const secondaries=route?.secondary_engines?.length?route.secondary_engines.join(', '):'none';
  return [
    '[TAOWIND GAME MANUFACTURING CONTRACT / 道风游戏制造契约]',
    `用户目标：${String(goal||'').trim()}`,
    `DWAC 主引擎：${route?.primary_engine||'UNRESOLVED'}`,
    `DWAC 次级引擎：${secondaries}`,
    `多引擎策略：${route?.hybrid?'enabled':'disabled'}`,
    '引擎角色：primary 负责正式生产构建；secondary 默认只做独立原型、基准、资产验证或目标平台专用身体，除非存在经过验证的跨引擎桥。',
    '权威边界：RCL/RNCS 保留 canonical authority；Godot/Unity/Unreal 只作为外部 runtime/build provider。',
    '执行要求：沿用 Taowind Code 自主北极星闭环，完成源码、资产、测试、真实构建验证、失败修复、证据账本与可回滚交付；没有真实引擎构建证据不得宣称完成。',
  ].join('\n');
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
