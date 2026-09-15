import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  GameManufacturingGateway,
  assessGameBuildEvidence,
  buildGameRouteArgs,
  compileGameMissionGoal,
  createGameAwareGoalAssessor,
  detectLocalGameProject,
  parseGameManufacturingContract,
} from '../core/game-manufacturing.mjs';

function temp(){return fs.mkdtempSync(path.join(os.tmpdir(),'taowind-game-forge-'))}
function result(command,code=0){return {command,code,timedOut:false,durationMs:12}}
function gameRun(engine,commands,{genericPassed=true}={}){
  const goal=compileGameMissionGoal('目标',{primary_engine:engine,secondary_engines:[],hybrid:false});
  return {goal,validation:{passed:genericPassed,results:commands.map(c=>typeof c==='string'?result(c):c)}};
}

test('detects Godot, Unity and Unreal project markers',()=>{
  const g=temp();fs.writeFileSync(path.join(g,'project.godot'),'');assert.equal(detectLocalGameProject(g).engine,'godot');
  const u=temp();fs.mkdirSync(path.join(u,'Assets'));fs.mkdirSync(path.join(u,'ProjectSettings'));fs.writeFileSync(path.join(u,'ProjectSettings','ProjectVersion.txt'),'');assert.equal(detectLocalGameProject(u).engine,'unity');
  const ue=temp();fs.writeFileSync(path.join(ue,'Demo.uproject'),'{}');assert.equal(detectLocalGameProject(ue).engine,'unreal-engine');
});

test('ambiguous engine markers fail closed',()=>{
  const root=temp();fs.writeFileSync(path.join(root,'project.godot'),'');fs.writeFileSync(path.join(root,'Demo.uproject'),'{}');
  const info=detectLocalGameProject(root);assert.equal(info.ambiguous,true);assert.equal(info.reason,'MULTIPLE_ENGINE_MARKERS');
});

test('route argv preserves goal, target, project lock and requirements without shell composition',()=>{
  const args=buildGameRouteArgs({routerScript:'/dwac/route.py',goal:'做游戏',workspace:'/game',target:'android',requirements:['跨平台','XR'],projectInfo:{detected:true}});
  assert.deepEqual(args,['/dwac/route.py','做游戏','--project-root',path.resolve('/game'),'--target','android','--requirement','跨平台','--requirement','XR']);
});

test('gateway consumes DWAC routing decision and compiles autonomous mission goal',()=>{
  const dwac=temp();fs.mkdirSync(path.join(dwac,'scripts'));fs.writeFileSync(path.join(dwac,'scripts','dwac_game_engine_route.py'),'# fake');
  const workspace=temp();
  const decision={status:'READY',primary_engine:'unreal-engine',secondary_engines:['unity'],hybrid:true,scores:[],evidence_roots:{}};
  const calls=[];
  const gateway=new GameManufacturingGateway({dwacRoot:dwac,python:'python-test',spawnSyncImpl:(bin,args,opt)=>{calls.push({bin,args,opt});return {status:0,stdout:JSON.stringify(decision),stderr:''}}});
  const out=gateway.route('AAA 主游戏 + 手机跨平台验证',{workspace,target:'win64',requirements:['多引擎']});
  assert.equal(out.decision.primary_engine,'unreal-engine');
  assert.match(out.missionGoal,/DWAC 主引擎：unreal-engine/);
  assert.match(out.missionGoal,/RCL\/RNCS/);
  assert.match(out.missionGoal,/TAOWIND_GAME_BUILD_EVIDENCE_REQUIRED=1/);
  assert.equal(calls[0].opt.shell,false);
});

test('blocked decision is returned as evidence instead of false completion',()=>{
  const dwac=temp();fs.mkdirSync(path.join(dwac,'scripts'));fs.writeFileSync(path.join(dwac,'scripts','dwac_game_engine_route.py'),'# fake');
  const gateway=new GameManufacturingGateway({dwacRoot:dwac,spawnSyncImpl:()=>({status:3,stdout:JSON.stringify({status:'BLOCKED_NO_EXECUTABLE_ENGINE',primary_engine:null,secondary_engines:[],hybrid:false,scores:[]}),stderr:''})});
  const out=gateway.route('做一个游戏',{workspace:temp()});
  assert.equal(out.decision.status,'BLOCKED_NO_EXECUTABLE_ENGINE');
  assert.equal(out.missionGoal,null);
});

test('mission contract does not pretend secondary engines share one runtime',()=>{
  const text=compileGameMissionGoal('目标',{primary_engine:'godot',secondary_engines:['unity','unreal-engine'],hybrid:true});
  assert.match(text,/secondary 默认只做独立原型、基准、资产验证或目标平台专用身体/);
  assert.match(text,/没有真实引擎构建证据不得宣称完成/);
});

test('machine-readable game manufacturing contract preserves engine route',()=>{
  const text=compileGameMissionGoal('目标',{primary_engine:'unity',secondary_engines:['godot'],hybrid:true});
  assert.deepEqual(parseGameManufacturingContract(text),{enabled:true,buildEvidenceRequired:true,primaryEngine:'unity',secondaryEngines:['godot']});
  assert.equal(parseGameManufacturingContract('ordinary coding goal').enabled,false);
});

test('generic tests cannot compensate for a missing primary engine build',()=>{
  const run=gameRun('godot',['node --test tests/*.test.mjs','test -f build/game.x86_64']);
  const evidence=assessGameBuildEvidence(run);
  assert.equal(evidence.passed,false);
  assert.equal(evidence.reason,'PRIMARY_ENGINE_BUILD_COMMAND_MISSING');
});

test('real engine build still requires an explicit artifact existence check',()=>{
  const run=gameRun('unity',['Unity -batchmode -projectPath . -executeMethod BuildScript.Build -quit']);
  const evidence=assessGameBuildEvidence(run);
  assert.equal(evidence.passed,false);
  assert.equal(evidence.reason,'BUILD_ARTIFACT_EXISTENCE_CHECK_MISSING');
});

for(const [engine,build,artifact] of [
  ['godot','godot --headless --path . --export-release Linux build/game.x86_64','test -f build/game.x86_64'],
  ['unity','Unity -batchmode -projectPath . -executeMethod BuildScript.Build -quit','test -e Builds/Game.exe'],
  ['unreal-engine','RunUAT.sh BuildCookRun -project=Demo.uproject -build -cook -stage -package -archive','test -e Saved/DWACBuild'],
]){
  test(`${engine} real build plus artifact check passes non-compensatory gate`,()=>{
    const evidence=assessGameBuildEvidence(gameRun(engine,[build,artifact]));
    assert.equal(evidence.passed,true);
    assert.equal(evidence.reason,'GAME_ENGINE_BUILD_EVIDENCE_VERIFIED');
  });
}

test('DWAC provider execute command counts as measured engine build only when artifact check also passes',()=>{
  const run=gameRun('godot',['python /dwac/scripts/dwac_game_engine_provider.py execute . build --preset Linux --output build/game.x86_64','stat build/game.x86_64']);
  const evidence=assessGameBuildEvidence(run);
  assert.equal(evidence.passed,true);
  assert.match(evidence.buildCommand.command,/dwac_game_engine_provider\.py execute/);
});

test('game-aware closure assessor refuses AI closure before build evidence exists',async()=>{
  let delegated=0;
  const assessor=createGameAwareGoalAssessor(async()=>{delegated++;return {closed:true,confidence:1,reason:'model says done'}});
  const run=gameRun('unreal-engine',['node --test tests/*.test.mjs']);
  const out=await assessor({rootGoal:run.goal,run});
  assert.equal(out.closed,false);
  assert.equal(out.confidence,1);
  assert.equal(out.game_build_evidence.reason,'PRIMARY_ENGINE_BUILD_COMMAND_MISSING');
  assert.equal(delegated,0);
});

test('game-aware closure assessor delegates only after hard build evidence passes',async()=>{
  let delegated=0;
  const assessor=createGameAwareGoalAssessor(async payload=>{delegated++;assert.equal(payload.gameBuildEvidence.passed,true);return {closed:true,confidence:.93,reason:'verified'}});
  const run=gameRun('godot',['godot --headless --path . --export-release Linux build/game.x86_64','test -f build/game.x86_64']);
  const out=await assessor({rootGoal:run.goal,run});
  assert.equal(out.closed,true);
  assert.equal(out.game_build_evidence.passed,true);
  assert.equal(delegated,1);
});
