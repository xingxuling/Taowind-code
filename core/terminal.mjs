import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';

const BLOCKED=/(?:rm\s+-rf\s+\/(?:\s|$)|\bmkfs\b|\bformat\s+[a-z]:|\bshutdown\b|\breboot\b|\bpoweroff\b|\bdiskpart\b|\bbcdedit\b)/i;
const MODE_RANK={read_only:0,workspace:1,full_access:2};

function errorWithCode(code,message=code){return Object.assign(new Error(message),{code});}
function clampInt(value,fallback,min,max){const n=Number(value);return Number.isFinite(n)?Math.max(min,Math.min(max,Math.trunc(n))):fallback;}
function normalizedEnv(env={}){return Object.fromEntries(Object.entries({...process.env,...env}).filter(([,v])=>v!==undefined&&v!==null).map(([k,v])=>[k,String(v)]));}
function effectiveMode(sessionMode,currentMode){const a=MODE_RANK[sessionMode]??MODE_RANK.workspace;const b=MODE_RANK[currentMode]??MODE_RANK.workspace;const rank=Math.min(a,b);return Object.keys(MODE_RANK).find(k=>MODE_RANK[k]===rank)||'workspace';}
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

export async function runCommand(cwd,command,{mode='workspace',timeoutMs=60_000,env={}}={}){
 const raw=String(command||'').trim(); const allowed=isCommandAllowed(raw,{mode}); if(!allowed.ok)throw errorWithCode(allowed.reason);
 const shell=process.platform==='win32'?'powershell.exe':'/bin/bash'; const args=process.platform==='win32'?['-NoProfile','-Command',raw]:['-lc',raw];
 return await new Promise(resolve=>{let out='',err='',timedOut=false;const started=Date.now();const child=spawn(shell,args,{cwd,env:normalizedEnv(env),windowsHide:true});const kill=setTimeout(()=>{timedOut=true;child.kill('SIGTERM');err+='\n[TIMEOUT]';},timeoutMs);
 child.stdout.on('data',d=>out+=d);child.stderr.on('data',d=>err+=d);child.on('close',code=>{clearTimeout(kill);resolve({command:raw,code:code??-1,stdout:out.slice(-240000),stderr:err.slice(-120000),timedOut,durationMs:Date.now()-started})})})
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
