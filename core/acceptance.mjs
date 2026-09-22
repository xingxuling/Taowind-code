import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {runCommand} from './terminal.mjs';

const VALIDATION_ENV_KEYS=new Set(['PATH','PATHEXT','SYSTEMROOT','COMSPEC','WINDIR','HOME','USERPROFILE','TMPDIR','TMP','TEMP','LANG','LC_ALL','TERM','COLORTERM','CI']);
const MAX_VALIDATION_COMMANDS=8;
const PACKAGE_VALIDATION_SCRIPTS=['check','test','lint','typecheck','build'];

export function buildValidationEnvironment(source=process.env){
  const out={};for(const [key,value] of Object.entries(source||{})){const upper=String(key).toUpperCase();if((VALIDATION_ENV_KEYS.has(upper)||upper.startsWith('LC_'))&&value!==undefined&&value!==null)out[key]=String(value)}return out;
}
function hasNpmWorkspaces(pkg){const ws=pkg?.workspaces;return (Array.isArray(ws)&&ws.length>0)||(ws&&typeof ws==='object'&&Array.isArray(ws.packages)&&ws.packages.length>0)}
function npmWorkspaceValidationNames(workspace){
  const npm=process.platform==='win32'?'npm.cmd':'npm';
  const result=spawnSync(npm,['pkg','get','scripts','--workspaces','--json'],{cwd:workspace,encoding:'utf8',timeout:5_000,maxBuffer:1024*1024,windowsHide:true,env:buildValidationEnvironment()});
  if(result.status!==0||!result.stdout)return [];
  try{const packages=JSON.parse(result.stdout);const found=new Set();for(const scripts of Object.values(packages||{})){if(!scripts||typeof scripts!=='object')continue;for(const name of PACKAGE_VALIDATION_SCRIPTS)if(scripts[name])found.add(name)}return PACKAGE_VALIDATION_SCRIPTS.filter(name=>found.has(name))}catch{return []}
}
function packageValidationCommands(workspace,pkg){
  const scripts=pkg?.scripts||{};const names=PACKAGE_VALIDATION_SCRIPTS.filter(name=>scripts[name]);
  if(!hasNpmWorkspaces(pkg))return names.map(name=>`npm run ${name}`);
  if(names.length)return PACKAGE_VALIDATION_SCRIPTS.map(name=>`npm run ${name} --if-present && npm run ${name} --workspaces --if-present`);
  const workspaceNames=npmWorkspaceValidationNames(workspace);return workspaceNames.map(name=>`npm run ${name} --if-present && npm run ${name} --workspaces --if-present`);
}

export function inferValidationCommands(workspace){
  const out=[];const pkgPath=path.join(workspace,'package.json');
  if(fs.existsSync(pkgPath)){let pkg;try{pkg=JSON.parse(fs.readFileSync(pkgPath,'utf8'))}catch(error){throw Object.assign(new Error('INVALID_PACKAGE_JSON'),{code:'INVALID_PACKAGE_JSON',cause:error})}out.push(...packageValidationCommands(workspace,pkg))}
  const pyproject=path.join(workspace,'pyproject.toml');if(fs.existsSync(pyproject)&&!out.includes('python -m pytest -q'))out.push('python -m pytest -q');
  return out.slice(0,MAX_VALIDATION_COMMANDS);
}
function normalizeValidationCommands(commands){const out=[];for(const command of Array.isArray(commands)?commands:[]){const text=String(command);if(!text)continue;out.push(text);if(out.length>MAX_VALIDATION_COMMANDS)break}return out}
function normalizeBrowserChecks(checks){return (Array.isArray(checks)?checks:[]).filter(x=>x&&typeof x==='object').slice(0,8)}

export async function runAcceptance(workspace,commands,{mode='workspace',browserObserver=null,browserChecks=[],browserRequired=false}={}){
  let source;try{source=Array.isArray(commands)&&commands.length?commands:inferValidationCommands(workspace)}catch(error){const checks=normalizeBrowserChecks(browserChecks);return {status:'FAILED',passed:false,commands:[],results:[],browser:{required:browserRequired||checks.length>0,checks,results:[]},hardGate:'VALIDATION_DISCOVERY_FAILED',blocker:error?.code||error?.message||'VALIDATION_DISCOVERY_FAILED'}}const chosen=normalizeValidationCommands(source);const checks=normalizeBrowserChecks(browserChecks);
  if(chosen.length>MAX_VALIDATION_COMMANDS)return {status:'FAILED',passed:false,commands:chosen.slice(0,MAX_VALIDATION_COMMANDS),results:[],browser:{required:browserRequired||checks.length>0,checks,results:[]},hardGate:'VALIDATION_COMMAND_BUDGET_EXCEEDED',validationBudget:{limit:MAX_VALIDATION_COMMANDS,observedAtLeast:chosen.length}};
  if(!chosen.length&&!checks.length&&!browserRequired)return {status:'NO_VALIDATION_EVIDENCE',passed:false,commands:[],results:[],browser:{required:false,checks:[],results:[]},hardGate:'VALIDATION_EVIDENCE_REQUIRED'};
  const validationEnv=buildValidationEnvironment();const results=[];for(const command of chosen){const r=await runCommand(workspace,command,{mode,timeoutMs:120_000,env:validationEnv,inheritProcessEnv:false,isolatedShell:true,containProcessTree:true,maxOutputChars:360000});results.push(r);if(r.code!==0||r.outputLimitExceeded)break}
  const commandsPassed=!chosen.length||(results.length===chosen.length&&results.every(x=>x.code===0&&!x.timedOut&&!x.outputLimitExceeded));
  if(!commandsPassed)return {status:'FAILED',passed:false,commands:chosen,results,browser:{required:browserRequired,checks,results:[]},hardGate:'COMMAND_FAILED'};
  if(browserRequired&&!checks.length)return {status:'FAILED',passed:false,commands:chosen,results,browser:{required:true,checks:[],results:[],blocker:'BROWSER_TARGET_REQUIRED'},hardGate:'BROWSER_TARGET_REQUIRED'};
  if(checks.length&&!browserObserver)return {status:'FAILED',passed:false,commands:chosen,results,browser:{required:true,checks,results:[],blocker:'BROWSER_OBSERVER_REQUIRED'},hardGate:'BROWSER_OBSERVER_REQUIRED'};
  const browserResults=[];for(const check of checks){try{const receipt=await browserObserver.observe(check);browserResults.push(receipt);if(!receipt.evaluation?.passed)break}catch(error){browserResults.push({protocol:'taowind-code.browser-observation-error.v0.1',check,error:error.code||error.message,message:error.message,evaluation:{passed:false,failures:[{gate:'observer',reason:error.code||error.message}]}});break}}
  const browserPassed=!checks.length||(browserResults.length===checks.length&&browserResults.every(x=>x.evaluation?.passed===true));const passed=commandsPassed&&browserPassed;
  return {status:passed?'PASSED':'FAILED',passed,commands:chosen,results,browser:{required:browserRequired||checks.length>0,checks,results:browserResults},hardGate:passed?'PASS':'BROWSER_OBSERVATION_FAILED'};
}
