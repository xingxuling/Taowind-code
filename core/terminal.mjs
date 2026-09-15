import {spawn} from 'node:child_process';
const BLOCKED=/\b(rm\s+-rf\s+\/|mkfs|format\s+[a-z]:|shutdown|reboot|poweroff|diskpart|bcdedit)\b/i;
export function isCommandAllowed(command,{mode='workspace'}={}){
  const raw=String(command||'').trim(); if(!raw)return {ok:false,reason:'COMMAND_REQUIRED'};
  if(mode==='read_only')return {ok:false,reason:'APPROVAL_REQUIRED'};
  if(BLOCKED.test(raw)&&mode!=='full_access')return {ok:false,reason:'DESTRUCTIVE_COMMAND_BLOCKED'};
  return {ok:true};
}
export async function runCommand(cwd,command,{mode='workspace',timeoutMs=60_000,env={}}={}){
 const raw=String(command||'').trim(); const allowed=isCommandAllowed(raw,{mode}); if(!allowed.ok)throw Object.assign(new Error(allowed.reason),{code:allowed.reason});
 const shell=process.platform==='win32'?'powershell.exe':'/bin/bash'; const args=process.platform==='win32'?['-NoProfile','-Command',raw]:['-lc',raw];
 return await new Promise(resolve=>{let out='',err='',timedOut=false;const started=Date.now();const child=spawn(shell,args,{cwd,env:{...process.env,...env}});const kill=setTimeout(()=>{timedOut=true;child.kill('SIGTERM');err+='\n[TIMEOUT]';},timeoutMs);
 child.stdout.on('data',d=>out+=d);child.stderr.on('data',d=>err+=d);child.on('close',code=>{clearTimeout(kill);resolve({command:raw,code:code??-1,stdout:out.slice(-240000),stderr:err.slice(-120000),timedOut,durationMs:Date.now()-started})})})
}
