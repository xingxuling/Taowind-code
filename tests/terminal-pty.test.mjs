import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {PersistentTerminalRuntime,isCommandAllowed,runCommand} from '../core/terminal.mjs';

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function waitFor(runtime,id,needle,{timeoutMs=4000,cursor=0}={}){const end=Date.now()+timeoutMs;let text='';let next=cursor;while(Date.now()<end){const r=runtime.read(id,{cursor:next});text+=r.data;next=r.nextCursor;if(text.includes(needle))return {text,cursor:next};await sleep(40)}throw new Error(`timeout waiting for ${needle}; got ${JSON.stringify(text.slice(-1000))}`)}

const hasScript=process.platform!=='win32'&&spawnSync('script',['--version'],{stdio:'ignore'}).status===0;

test('one-shot command guard preserves destructive-command sovereignty',()=>{assert.equal(isCommandAllowed('echo ok',{mode:'workspace'}).ok,true);assert.deepEqual(isCommandAllowed('rm -rf /',{mode:'workspace'}),{ok:false,reason:'DESTRUCTIVE_COMMAND_BLOCKED'});assert.deepEqual(isCommandAllowed('echo ok',{mode:'read_only'}),{ok:false,reason:'APPROVAL_REQUIRED'})});

test('persistent PTY keeps shell state across writes on a real POSIX pseudo-terminal',{skip:!hasScript},async t=>{const cwd=fs.mkdtempSync(path.join(os.tmpdir(),'taowind-pty-'));const runtime=new PersistentTerminalRuntime({nativePty:null,platform:process.platform});t.after(()=>runtime.dispose());const s=await runtime.create(cwd,{mode:'workspace',shell:'/bin/sh',cols:100,rows:24});assert.equal(s.backend,'posix-script-pty');runtime.write(s.id,'printf "__TAO_READY__\\n"\n');let r=await waitFor(runtime,s.id,'__TAO_READY__');runtime.write(s.id,'cd /tmp\nprintf "__TAO_CWD__:%s\\n" "$PWD"\n');r=await waitFor(runtime,s.id,'__TAO_CWD__:/tmp',{cursor:r.cursor});assert.match(r.text,/__TAO_CWD__:\/tmp/);const blocked=()=>runtime.write(s.id,'rm -rf /\n',{mode:'workspace'});assert.throws(blocked,e=>e.code==='DESTRUCTIVE_COMMAND_BLOCKED');runtime.write(s.id,'exit\n');await sleep(100)});

test('cursor reads expose append-only session evidence without replaying consumed output',{skip:!hasScript},async t=>{const cwd=fs.mkdtempSync(path.join(os.tmpdir(),'taowind-pty-'));const runtime=new PersistentTerminalRuntime({nativePty:null,platform:process.platform,maxBufferChars:8192});t.after(()=>runtime.dispose());const s=await runtime.create(cwd,{shell:'/bin/sh'});runtime.write(s.id,'printf "__ONE__\\n"\n');const first=await waitFor(runtime,s.id,'__ONE__');runtime.write(s.id,'printf "__TWO__\\n"\n');const second=await waitFor(runtime,s.id,'__TWO__',{cursor:first.cursor});assert.doesNotMatch(second.text,/__ONE__/);assert.match(second.text,/__TWO__/)});

test('Windows path uses an injected ConPTY-compatible node-pty provider without shelling out',async()=>{let writes='';let resize=null;let killed=false;const fakeProc={pid:42,onData(fn){this.data=fn},onExit(fn){this.exit=fn},write(s){writes+=s},resize(c,r){resize=[c,r]},kill(){killed=true}};const fake={spawn(file,args,opt){assert.equal(file,'powershell.exe');assert.equal(opt.useConpty,true);return fakeProc}};const runtime=new PersistentTerminalRuntime({platform:'win32',nativePty:fake});const s=await runtime.create(process.cwd(),{mode:'workspace',shell:'powershell.exe'});assert.match(s.backend,/conpty/);runtime.write(s.id,'Write-Output ok\r');assert.match(writes,/Write-Output ok/);assert.equal(runtime.resize(s.id,132,40).resized,true);assert.deepEqual(resize,[132,40]);runtime.close(s.id);assert.equal(killed,true)});

test('one-shot timeout terminates the POSIX validation process group',{skip:process.platform==='win32'},async()=>{const cwd=fs.mkdtempSync(path.join(os.tmpdir(),'taowind-timeout-'));const sentinel=path.join(cwd,'late.txt');const script=`setTimeout(()=>require('fs').writeFileSync(${JSON.stringify(sentinel)},'late'),500)`;const started=Date.now();const result=await runCommand(cwd,`node -e ${JSON.stringify(script)} & sleep 5`,{mode:'workspace',timeoutMs:100,isolatedShell:true,containProcessTree:true});assert.equal(result.timedOut,true);assert.ok(Date.now()-started<2000,`timeout took ${Date.now()-started}ms`);await sleep(650);assert.equal(fs.existsSync(sentinel),false)});
