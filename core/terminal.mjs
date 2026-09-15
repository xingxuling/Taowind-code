import {spawn} from 'node:child_process';
const BLOCKED=/\b(rm\s+-rf\s+\/|mkfs|format\s+[a-z]:|shutdown|reboot|poweroff)\b/i;
export async function runCommand(cwd,command,{mode='workspace'}={}){
 const raw=String(command||'').trim(); if(!raw) throw new Error('COMMAND_REQUIRED');
 if(mode==='read_only') throw new Error('APPROVAL_REQUIRED');
 if(BLOCKED.test(raw) && mode!=='full_access') throw new Error('DESTRUCTIVE_COMMAND_BLOCKED');
 const shell=process.platform==='win32'?'powershell.exe':'/bin/bash'; const args=process.platform==='win32'?['-NoProfile','-Command',raw]:['-lc',raw];
 return await new Promise(resolve=>{let out='',err=''; const child=spawn(shell,args,{cwd,env:process.env}); const kill=setTimeout(()=>{child.kill('SIGTERM');err+='\n[TIMEOUT]';},60000);
 child.stdout.on('data',d=>out+=d);child.stderr.on('data',d=>err+=d);child.on('close',code=>{clearTimeout(kill);resolve({command:raw,code,stdout:out.slice(-200000),stderr:err.slice(-100000)})})})
}
