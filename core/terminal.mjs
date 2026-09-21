import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';

const BLOCKED=/(?:rm\s+-rf\s+\/(?:\s|$)|\bmkfs\b|\bformat\s+[a-z]:|\bshutdown\b|\breboot\b|\bpoweroff\b|\bdiskpart\b|\bbcdedit\b)/i;
const MODE_RANK={read_only:0,workspace:1,full_access:2};

function errorWithCode(code,message=code){return Object.assign(new Error(message),{code});}
function clampInt(value,fallback,min,max){const n=Number(value);return Number.isFinite(n)?Math.max(min,Math.min(max,Math.trunc(n))):fallback;}
function normalizedEnv(env={},inheritProcessEnv=true){const base=inheritProcessEnv?process.env:{};return Object.fromEntries(Object.entries({...base,...env}).filter(([,v])=>v!==undefined&&v!==null).map(([k,v])=>[k,String(v)]));}
function effectiveMode(sessionMode,currentMode){const a=MODE_RANK[sessionMode]??MODE_RANK.workspace;const b=MODE_RANK[currentMode]??MODE_RANK.workspace;const rank=Math.min(a,b);return Object.keys(MODE_RANK).find(k=>MODE_RANK[k]===rank)||'workspace';}
function appendTail(current,chunk,maxChars){const text=String(chunk??'');if(!text)return {value:current,dropped:0,observed:0};const next=current+text;if(next.length<=maxChars)return {value:next,dropped:0,observed:text.length};const cut=next.length-maxChars;return {value:next.slice(cut),dropped:cut,observed:text.length};}
function defaultShell(platform=process.platform){if(platform==='win32')return process.env.TAOWIND_PTY_SHELL||'powershell.exe';return process.env.TAOWIND_PTY_SHELL||process.env.SHELL||'/bin/bash';}

export function isCommandAllowed(command,{mode='workspace'}={}){
  const raw=String(command||'').trim(); if(!raw)return {ok:false,reason:'COMMAND_REQUIRED'};
  if(mode==='read_only')return {ok:false,reason:'APPROVAL_REQUIRED'};
  if(BLOCKED.test(raw)&&mode!=='full_access')return {ok:false,reason:'DESTRUCTIVE_COMMAND_BLOCKED'};
  return {ok:true};
}

export function isTerminalInputAllowed(input,{mode='workspace'}={}){
  const raw=String(input??''); if(!raw)return {ok:false,reason:'TERMINAL_INPUT_REQUIRED'};
  if(mode==='read_only')return {ok:false,reason:'APPROVAL_REQUIRED'};
  if(BLOCKED.test(raw)&&mode!=='full_access')return {ok:false,reason:'DESTRUCTIVE_COMMAND_BLOCKED'};
  return {ok:true};
}

export function shellInvocation(command,{platform=process.platform,isolatedShell=false}={}){const raw=String(command||'');if(platform==='win32')return {shell:'powershell.exe',args:['-NoProfile','-Command',raw]};return {shell:'/bin/bash',args:isolatedShell?['--noprofile','--norc','-c',raw]:['-lc',raw]};}

function signalCommandTree(child,signal,{containProcessTree=false,platform=process.platform}={}){
 if(!child?.pid)return false;
 if(containProcessTree&&platform!=='win32'){try{process.kill(-child.pid,signal);return true}catch{}}
 try{return child.kill(signal)}catch{return false}
}
function commandTreeAlive(child,{containProcessTree=false,platform=process.platform}={}){
 if(!child?.pid)return false;if(!(containProcessTree&&platform!=='win32'))return false;try{process.kill(-child.pid,0);return true}catch(error){return error?.code!=='ESRCH'}
}

export async function runCommand(cwd,command,{mode='workspace',timeoutMs=60_000,env={},inheritProcessEnv=true,isolatedShell=false,containProcessTree=false,maxStdoutChars=240000,maxStderrChars=120000,maxOutputChars=0}={}){
 const raw=String(command||'').trim(); const allowed=isCommandAllowed(raw,{mode}); if(!allowed.ok)throw errorWithCode(allowed.reason);
 const stdoutCap=clampInt(maxStdoutChars,240000,1024,2_000_000);const stderrCap=clampInt(maxStderrChars,120000,1024,1_000_000);const outputCap=clampInt(maxOutputChars,0,0,20_000_000);
 const {shell,args}=shellInvocation(raw,{isolatedShell});const detached=containProcessTree&&process.platform!=='win32';
 return await new Promise(resolve=>{let out='',err='',timedOut=false,outputLimitExceeded=false,hardKill=null,kill=null,stdoutDroppedChars=0,stderrDroppedChars=0,outputCharsObserved=0,closeSeen=false,closeCode=-1,resolved=false;const started=Date.now();const child=spawn(shell,args,{cwd,env:normalizedEnv(env,inheritProcessEnv),windowsHide:true,detached});
 const finalize=()=>{if(resolved)return;resolved=true;clearTimeout(kill);if(hardKill){clearTimeout(hardKill);hardKill=null}resolve({command:raw,code:closeCode,stdout:out,stderr:err,timedOut,outputLimitExceeded,stdoutTruncated:stdoutDroppedChars>0,stderrTruncated:stderrDroppedChars>0,stdoutDroppedChars,stderrDroppedChars,outputCharsObserved,durationMs:Date.now()-started})};
 const appendErr=chunk=>{const next=appendTail(err,chunk,stderrCap);err=next.value;stderrDroppedChars+=next.dropped;outputCharsObserved+=next.observed};
 const scheduleHardKill=()=>{if(detached&&!hardKill){hardKill=setTimeout(()=>{signalCommandTree(child,'SIGKILL',{containProcessTree:true});hardKill=null;if(closeSeen)finalize()},750)}};
 const stopTree=marker=>{if(marker)appendErr(marker);signalCommandTree(child,'SIGTERM',{containProcessTree});scheduleHardKill()};
 const account=(kind,chunk)=>{const next=appendTail(kind==='stdout'?out:err,chunk,kind==='stdout'?stdoutCap:stderrCap);if(kind==='stdout'){out=next.value;stdoutDroppedChars+=next.dropped}else{err=next.value;stderrDroppedChars+=next.dropped}outputCharsObserved+=next.observed;if(outputCap>0&&!outputLimitExceeded&&outputCharsObserved>outputCap){outputLimitExceeded=true;if(kill)clearTimeout(kill);stopTree('\n[OUTPUT_LIMIT]')}};
 kill=setTimeout(()=>{timedOut=true;stopTree('\n[TIMEOUT]')},timeoutMs);
 child.stdout.on('data',d=>account('stdout',d));child.stderr.on('data',d=>account('stderr',d));child.on('close',code=>{closeSeen=true;closeCode=code??-1;clearTimeout(kill);if(hardKill&&(timedOut||outputLimitExceeded)&&commandTreeAlive(child,{containProcessTree}))return;finalize()})})
}

let nativePtyPromise=null;
async function loadNativePty(){
 if(nativePtyPromise)return nativePtyPromise;
 nativePtyPromise=(async()=>{
  for(const specifier of ['@lydell/node-pty','node-pty']){
   try{const mod=await import(specifier);const api=mod.default||mod;if(typeof api.spawn==='function')return {api,specifier};}catch{}
  }
  return null;
 })();
 return nativePtyPromise;
}

function appendOutput(session,chunk,maxBufferChars){
 const text=String(chunk??'');if(!text)return;
 session.output+=text;session.lastActivityAt=new Date().toISOString();
 if(session.output.length>maxBufferChars){const cut=session.output.length-maxBufferChars;session.output=session.output.slice(cut);session.baseCursor+=cut;}
}

function publicSession(session){return {id:session.id,backend:session.backend,pid:session.pid??null,cwd:session.cwd,shell:session.shell,mode:session.mode,cols:session.cols,rows:session.rows,createdAt:session.createdAt,lastActivityAt:session.lastActivityAt,closed:session.closed,exitCode:session.exitCode,signal:session.signal,baseCursor:session.baseCursor,endCursor:session.baseCursor+session.output.length};}

export class PersistentTerminalRuntime{
 constructor({maxSessions=8,maxBufferChars=240000,platform=process.platform,nativePty=undefined,scriptCommand='script'}={}){
  this.maxSessions=clampInt(maxSessions,8,1,64);this.maxBufferChars=clampInt(maxBufferChars,240000,4096,2_000_000);this.platform=platform;this.nativePty=nativePty;this.scriptCommand=scriptCommand;this.sessions=new Map();
 }
 list(){return [...this.sessions.values()].map(publicSession);}
 get(id){const s=this.sessions.get(String(id));if(!s)throw errorWithCode('TERMINAL_SESSION_NOT_FOUND');return s;}
 async create(cwd,{mode='workspace',env={},cols=120,rows=30,shell=defaultShell(this.platform)}={}){
  if(mode==='read_only')throw errorWithCode('APPROVAL_REQUIRED');
  const target=path.resolve(String(cwd||'.'));if(!fs.existsSync(target)||!fs.statSync(target).isDirectory())throw errorWithCode('TERMINAL_CWD_NOT_FOUND');
  const active=[...this.sessions.values()].filter(x=>!x.closed).length;if(active>=this.maxSessions)throw errorWithCode('TERMINAL_SESSION_LIMIT');
  cols=clampInt(cols,120,20,500);rows=clampInt(rows,30,5,200);const id=`pty-${randomUUID()}`;const now=new Date().toISOString();
  const session={id,backend:null,pid:null,cwd:target,shell:String(shell),mode,cols,rows,createdAt:now,lastActivityAt:now,closed:false,exitCode:null,signal:null,output:'',baseCursor:0,proc:null};
  let native=this.nativePty===null?null:(this.nativePty?{api:this.nativePty,specifier:'injected-node-pty'}:await loadNativePty());
  if(native){
   try{
    const proc=native.api.spawn(session.shell,[],{name:'xterm-256color',cols,rows,cwd:target,env:normalizedEnv({...env,TERM:env.TERM||'xterm-256color'}),useConpty:this.platform==='win32'});
    session.backend=this.platform==='win32'?`conpty:${native.specifier}`:`node-pty:${native.specifier}`;session.pid=proc.pid;session.proc=proc;
    proc.onData(data=>appendOutput(session,data,this.maxBufferChars));
    proc.onExit(({exitCode,signal})=>{session.closed=true;session.exitCode=exitCode??0;session.signal=signal??null;session.lastActivityAt=new Date().toISOString();});
   }catch(e){if(this.platform==='win32')throw errorWithCode('PTY_PROVIDER_START_FAILED',e.message);native=null;}
  }
  if(!native){
   if(this.platform==='win32')throw errorWithCode('PTY_PROVIDER_UNAVAILABLE','Windows persistent PTY requires @lydell/node-pty or node-pty (ConPTY).');
   const args=this.platform==='darwin'?['-q','/dev/null',session.shell]:['-qefc',session.shell,'/dev/null'];
   const proc=spawn(this.scriptCommand,args,{cwd:target,env:normalizedEnv({...env,TERM:env.TERM||'xterm-256color',COLUMNS:cols,LINES:rows}),stdio:['pipe','pipe','pipe'],windowsHide:true});
   session.backend='posix-script-pty';session.pid=proc.pid;session.proc=proc;
   proc.stdout.on('data',d=>appendOutput(session,d.toString('utf8'),this.maxBufferChars));
   proc.stderr.on('data',d=>appendOutput(session,d.toString('utf8'),this.maxBufferChars));
   proc.on('error',e=>{appendOutput(session,`\r\n[PTY_ERROR] ${e.message}\r\n`,this.maxBufferChars);session.closed=true;session.exitCode=-1;session.lastActivityAt=new Date().toISOString();});
   proc.on('close',(code,signal)=>{session.closed=true;session.exitCode=code??-1;session.signal=signal??null;session.lastActivityAt=new Date().toISOString();});
  }
  this.sessions.set(id,session);return publicSession(session);
 }
 write(id,input,{mode='workspace'}={}){
  const s=this.get(id);if(s.closed)throw errorWithCode('TERMINAL_SESSION_CLOSED');const currentMode=effectiveMode(s.mode,mode);const allowed=isTerminalInputAllowed(input,{mode:currentMode});if(!allowed.ok)throw errorWithCode(allowed.reason);
  const data=String(input);if(s.backend.startsWith('node-pty')||s.backend.startsWith('conpty'))s.proc.write(data);else s.proc.stdin.write(data);s.lastActivityAt=new Date().toISOString();return {id:s.id,accepted:true,bytes:Buffer.byteLength(data),mode:currentMode};
 }
 resize(id,cols,rows){
  const s=this.get(id);if(s.closed)return {...publicSession(s),resized:false};cols=clampInt(cols,s.cols,20,500);rows=clampInt(rows,s.rows,5,200);s.cols=cols;s.rows=rows;let resized=false;
  try{if((s.backend.startsWith('node-pty')||s.backend.startsWith('conpty'))&&typeof s.proc.resize==='function'){s.proc.resize(cols,rows);resized=true;}else if(s.backend==='posix-script-pty'){s.proc.stdin.write(`stty cols ${cols} rows ${rows}\n`);resized=true;}}catch{}
  s.lastActivityAt=new Date().toISOString();return {...publicSession(s),resized};
 }
 read(id,{cursor=0,limit=120000}={}){
  const s=this.get(id);const requested=Math.max(0,Number(cursor)||0);const start=Math.max(s.baseCursor,Math.min(requested,s.baseCursor+s.output.length));const offset=start-s.baseCursor;const cap=clampInt(limit,120000,1,240000);const data=s.output.slice(offset,offset+cap);return {...publicSession(s),cursor:start,nextCursor:start+data.length,truncated:requested<s.baseCursor,data};
 }
 close(id,{signal='SIGTERM'}={}){
  const s=this.get(id);if(!s.closed){try{if(s.backend.startsWith('node-pty')||s.backend.startsWith('conpty'))s.proc.kill();else{s.proc.stdin.end();s.proc.kill(signal);}}catch{}s.closed=true;s.signal=signal;s.lastActivityAt=new Date().toISOString();}
  return publicSession(s);
 }
 dispose(){for(const s of this.sessions.values()){if(!s.closed){try{this.close(s.id);}catch{}}}}
}
