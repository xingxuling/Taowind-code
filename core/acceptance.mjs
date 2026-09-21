import fs from 'node:fs';
import path from 'node:path';
import {runCommand} from './terminal.mjs';

const VALIDATION_ENV_KEYS=new Set(['PATH','PATHEXT','SYSTEMROOT','COMSPEC','WINDIR','HOME','USERPROFILE','TMPDIR','TMP','TEMP','LANG','LC_ALL','TERM','COLORTERM','CI']);

export function buildValidationEnvironment(source=process.env){
  const out={};for(const [key,value] of Object.entries(source||{})){const upper=String(key).toUpperCase();if((VALIDATION_ENV_KEYS.has(upper)||upper.startsWith('LC_'))&&value!==undefined&&value!==null)out[key]=String(value)}return out;
}

export function inferValidationCommands(workspace){
  const out=[];const pkgPath=path.join(workspace,'package.json');
  if(fs.existsSync(pkgPath)){try{const pkg=JSON.parse(fs.readFileSync(pkgPath,'utf8'));const scripts=pkg.scripts||{};if(scripts.check)out.push('npm run check');for(const name of ['test','lint','typecheck','build'])if(scripts[name]&&!out.includes(`npm run ${name}`))out.push(`npm run ${name}`)}catch{}}
  const pyproject=path.join(workspace,'pyproject.toml');if(fs.existsSync(pyproject)&&!out.length)out.push('python -m pytest -q');
  return out.slice(0,4);
}
function normalizeBrowserChecks(checks){return (Array.isArray(checks)?checks:[]).filter(x=>x&&typeof x==='object').slice(0,8)}

export async function runAcceptance(workspace,commands,{mode='workspace',browserObserver=null,browserChecks=[],browserRequired=false}={}){
  const chosen=(Array.isArray(commands)&&commands.length?commands:inferValidationCommands(workspace)).map(String).filter(Boolean).slice(0,8);const checks=normalizeBrowserChecks(browserChecks);
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
