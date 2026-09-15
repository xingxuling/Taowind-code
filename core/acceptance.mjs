import fs from 'node:fs';
import path from 'node:path';
import {runCommand} from './terminal.mjs';

export function inferValidationCommands(workspace){
  const out=[];const pkgPath=path.join(workspace,'package.json');
  if(fs.existsSync(pkgPath)){try{const pkg=JSON.parse(fs.readFileSync(pkgPath,'utf8'));const scripts=pkg.scripts||{};if(scripts.check)out.push('npm run check');else for(const name of ['test','lint','typecheck','build'])if(scripts[name]&&!out.includes(`npm run ${name}`))out.push(`npm run ${name}`)}catch{}}
  const pyproject=path.join(workspace,'pyproject.toml');if(fs.existsSync(pyproject)&&!out.length)out.push('python -m pytest -q');
  return out.slice(0,4);
}

export async function runAcceptance(workspace,commands,{mode='workspace'}={}){
  const chosen=(Array.isArray(commands)&&commands.length?commands:inferValidationCommands(workspace)).map(String).filter(Boolean).slice(0,8);
  if(!chosen.length)return {status:'NO_VALIDATION_COMMANDS',passed:false,commands:[],results:[],hardGate:'VALIDATION_EVIDENCE_REQUIRED'};
  const results=[];for(const command of chosen){const r=await runCommand(workspace,command,{mode,timeoutMs:120_000});results.push(r);if(r.code!==0)break}
  const passed=results.length===chosen.length&&results.every(x=>x.code===0&&!x.timedOut);return {status:passed?'PASSED':'FAILED',passed,commands:chosen,results,hardGate:passed?'PASS':'COMMAND_FAILED'};
}
