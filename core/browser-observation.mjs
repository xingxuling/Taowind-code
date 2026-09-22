import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {PAGE_EXTRACTOR} from '../vendor/taobrowser/core/page-extractor.mjs';
import {validateWebUrl} from '../vendor/taobrowser/core/security.mjs';

function now(){return new Date().toISOString()}
function hash(value){return crypto.createHash('sha256').update(value).digest('hex')}
function atomicJson(file,value){fs.mkdirSync(path.dirname(file),{recursive:true});const tmp=`${file}.${process.pid}.tmp`;fs.writeFileSync(tmp,JSON.stringify(value,null,2));fs.renameSync(tmp,file)}
function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
function timeout(promise,ms,label='TIMEOUT'){let id;return Promise.race([promise,new Promise((_,reject)=>{id=setTimeout(()=>reject(Object.assign(new Error(label),{code:label})),ms)})]).finally(()=>clearTimeout(id))}
function normalizeCdpBase(raw){const value=String(raw||'').trim();if(!value)return null;if(/^wss?:\/\//i.test(value))return {webSocketDebuggerUrl:value,base:null};const u=new URL(value);if(!['http:','https:'].includes(u.protocol))throw new Error('TAO_BROWSER_CDP_URL must be http(s) or ws(s)');u.pathname=u.pathname.replace(/\/$/,'');u.search='';u.hash='';return {base:u.href.replace(/\/$/,''),webSocketDebuggerUrl:null}}

class CdpClient{
  constructor(url){this.url=url;this.ws=null;this.seq=0;this.pending=new Map();this.listeners=new Map()}
  async connect(){if(typeof globalThis.WebSocket!=='function')throw Object.assign(new Error('NODE_WEBSOCKET_UNAVAILABLE'),{code:'NODE_WEBSOCKET_UNAVAILABLE'});this.ws=new WebSocket(this.url);await timeout(new Promise((resolve,reject)=>{this.ws.addEventListener('open',resolve,{once:true});this.ws.addEventListener('error',()=>reject(new Error('CDP_WEBSOCKET_CONNECT_FAILED')),{once:true})}),8000,'CDP_CONNECT_TIMEOUT');this.ws.addEventListener('message',event=>{let msg;try{msg=JSON.parse(typeof event.data==='string'?event.data:String(event.data))}catch{return}if(msg.id){const p=this.pending.get(msg.id);if(!p)return;this.pending.delete(msg.id);if(msg.error)p.reject(Object.assign(new Error(msg.error.message||'CDP_ERROR'),{code:'CDP_ERROR',data:msg.error}));else p.resolve(msg.result||{});return}if(msg.method){for(const fn of this.listeners.get(msg.method)||[])try{fn(msg.params||{})}catch{}}});this.ws.addEventListener('close',()=>{for(const p of this.pending.values())p.reject(new Error('CDP_CLOSED'));this.pending.clear()});return this}
  on(method,fn){const list=this.listeners.get(method)||[];list.push(fn);this.listeners.set(method,list);return()=>this.listeners.set(method,(this.listeners.get(method)||[]).filter(x=>x!==fn))}
  send(method,params={}){if(!this.ws||this.ws.readyState!==1)throw new Error('CDP_NOT_CONNECTED');const id=++this.seq;const p=new Promise((resolve,reject)=>this.pending.set(id,{resolve,reject}));this.ws.send(JSON.stringify({id,method,params}));return timeout(p,15000,`CDP_${method}_TIMEOUT`)}
  wait(method,ms=15000){return timeout(new Promise(resolve=>{const off=this.on(method,p=>{off();resolve(p)})}),ms,`CDP_EVENT_${method}_TIMEOUT`)}
  close(){try{this.ws?.close()}catch{}}
}

async function resolveDebuggerUrl(config,targetUrl){
  if(config.webSocketDebuggerUrl)return config.webSocketDebuggerUrl;
  const list=await timeout(fetch(config.base+'/json/list').then(r=>{if(!r.ok)throw new Error(`CDP_DISCOVERY_HTTP_${r.status}`);return r.json()}),8000,'CDP_DISCOVERY_TIMEOUT');
  let page=Array.isArray(list)?list.find(x=>x.type==='page'&&x.webSocketDebuggerUrl):null;
  if(!page){const created=await timeout(fetch(config.base+'/json/new?'+encodeURIComponent(targetUrl),{method:'PUT'}).then(r=>{if(!r.ok)throw new Error(`CDP_CREATE_TARGET_HTTP_${r.status}`);return r.json()}),8000,'CDP_CREATE_TARGET_TIMEOUT');page=created}
  if(!page?.webSocketDebuggerUrl)throw new Error('CDP_PAGE_TARGET_UNAVAILABLE');return page.webSocketDebuggerUrl;
}

function domChecksScript(selectors=[]){const safe=JSON.stringify(selectors.slice(0,48));return `(() => { const out={}; for(const s of ${safe}){ try{ const el=document.querySelector(s); out[s]=el?{exists:true,text:String(el.innerText||el.textContent||'').trim().slice(0,1000),tag:el.tagName,visible:!!(el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden'&&getComputedStyle(el).display!=='none')}:{exists:false}; }catch(e){ out[s]={exists:false,error:String(e.message||e)} } } return out; })()`}
function resultValue(result){return result?.result?.value}
const MAX_REQUIRED_SELECTORS=48;
const MAX_REQUIRED_TEXT=32;
function boundedUniqueStrings(values,limit,{containerCode,itemCode,budgetCode}){if(!Array.isArray(values))throw Object.assign(new Error(containerCode),{code:containerCode});const normalized=[];const seen=new Set();for(const value of values){if(typeof value!=='string'||value.length===0)throw Object.assign(new Error(itemCode),{code:itemCode});if(!seen.has(value)){seen.add(value);normalized.push(value)}}if(normalized.length>limit)throw Object.assign(new Error(budgetCode),{code:budgetCode,limit,observed:normalized.length});return normalized}
function normalizeCheck(raw={}){const selectorSource=raw.requiredSelectors!==undefined?raw.requiredSelectors:raw.selectors!==undefined?raw.selectors:[];const textSource=raw.requiredText!==undefined?raw.requiredText:[];return {url:validateWebUrl(String(raw.url||'')),requiredSelectors:boundedUniqueStrings(selectorSource,MAX_REQUIRED_SELECTORS,{containerCode:'INVALID_BROWSER_SELECTOR_LIST',itemCode:'INVALID_BROWSER_SELECTOR',budgetCode:'BROWSER_SELECTOR_BUDGET_EXCEEDED'}),requiredText:boundedUniqueStrings(textSource,MAX_REQUIRED_TEXT,{containerCode:'INVALID_BROWSER_REQUIRED_TEXT_LIST',itemCode:'INVALID_BROWSER_REQUIRED_TEXT',budgetCode:'BROWSER_TEXT_BUDGET_EXCEEDED'}),titleIncludes:String(raw.titleIncludes||''),urlIncludes:String(raw.urlIncludes||''),forbidConsoleErrors:raw.forbidConsoleErrors!==false,forbidPageExceptions:raw.forbidPageExceptions!==false,forbidCriticalNetworkErrors:raw.forbidCriticalNetworkErrors!==false,screenshot:raw.screenshot!==false,settleMs:Math.max(100,Math.min(5000,Number(raw.settleMs||700)))}}

export function evaluateBrowserChecks(observation,check){
  const failures=[];const page=observation.page||{},dom=observation.selectors||{};
  for(const selector of check.requiredSelectors||[]){const hit=dom[selector];if(!hit?.exists)failures.push({gate:'selector',selector,reason:'missing'});else if(hit.visible===false)failures.push({gate:'selector',selector,reason:'not-visible'})}
  for(const text of check.requiredText||[])if(!String(page.text||'').includes(text))failures.push({gate:'text',text,reason:'missing'});
  if(check.titleIncludes&&!String(page.title||'').includes(check.titleIncludes))failures.push({gate:'title',expected:check.titleIncludes,actual:page.title||''});
  if(check.urlIncludes&&!String(observation.url||'').includes(check.urlIncludes))failures.push({gate:'url',expected:check.urlIncludes,actual:observation.url||''});
  if(check.forbidConsoleErrors&&observation.consoleErrors?.length)failures.push({gate:'console',count:observation.consoleErrors.length});
  if(check.forbidPageExceptions&&observation.pageExceptions?.length)failures.push({gate:'page-exception',count:observation.pageExceptions.length});
  if(check.forbidCriticalNetworkErrors&&observation.criticalNetworkErrors?.length)failures.push({gate:'network',count:observation.criticalNetworkErrors.length});
  return {passed:failures.length===0,failures};
}

export class BrowserObservationOrgan{
  constructor(runtimeDir,{cdpUrl=process.env.TAO_BROWSER_CDP_URL}={}){this.dir=path.join(runtimeDir,'browser-evidence');fs.mkdirSync(this.dir,{recursive:true});this.raw=cdpUrl||null;try{this.config=normalizeCdpBase(cdpUrl)}catch(error){this.config=null;this.configError=error.message}}
  status(){return {organ:'Tao Browser Observation Organ',connected:!!this.config&&typeof globalThis.WebSocket==='function',cdpUrl:this.raw||null,webSocketAvailable:typeof globalThis.WebSocket==='function',configError:this.configError||null,capabilities:['dom','console','page-exception','network','screenshot','tao-page-extractor'],mode:'cdp-read-observe'}}
  async observe(rawCheck={}){
    if(!this.config)throw Object.assign(new Error(this.configError||'TAO_BROWSER_CDP_UNBOUND'),{code:'TAO_BROWSER_CDP_UNBOUND'});const check=normalizeCheck(rawCheck);const debuggerUrl=await resolveDebuggerUrl(this.config,check.url);const cdp=await new CdpClient(debuggerUrl).connect();const consoleErrors=[],pageExceptions=[],networkFailures=[],httpErrors=[];let finalUrl=check.url;
    const criticalTypes=new Set(['Document','Script','Stylesheet','XHR','Fetch','WebSocket']);
    try{
      cdp.on('Runtime.consoleAPICalled',p=>{if(p.type==='error')consoleErrors.push({type:p.type,args:(p.args||[]).map(x=>x.value??x.description??'').slice(0,8),timestamp:p.timestamp})});
      cdp.on('Runtime.exceptionThrown',p=>pageExceptions.push({text:p.exceptionDetails?.text||p.exceptionDetails?.exception?.description||'exception',url:p.exceptionDetails?.url||'',line:p.exceptionDetails?.lineNumber??null,column:p.exceptionDetails?.columnNumber??null}));
      cdp.on('Log.entryAdded',p=>{const e=p.entry||{};if(e.level==='error')consoleErrors.push({type:'log',text:e.text||'',source:e.source||'',url:e.url||''})});
      cdp.on('Network.loadingFailed',p=>networkFailures.push({requestId:p.requestId,errorText:p.errorText||'',type:p.type||'',canceled:!!p.canceled}));
      cdp.on('Network.responseReceived',p=>{const r=p.response||{};if(Number(r.status)>=400)httpErrors.push({url:r.url||'',status:r.status,statusText:r.statusText||'',type:p.type||''})});
      await Promise.all([cdp.send('Page.enable'),cdp.send('Runtime.enable'),cdp.send('Network.enable'),cdp.send('Log.enable').catch(()=>({}))]);
      const loaded=cdp.wait('Page.loadEventFired',20000).catch(()=>null);await cdp.send('Page.navigate',{url:check.url});await loaded;await sleep(check.settleMs);
      const location=await cdp.send('Runtime.evaluate',{expression:'location.href',returnByValue:true});finalUrl=resultValue(location)||check.url;
      const extracted=await cdp.send('Runtime.evaluate',{expression:PAGE_EXTRACTOR,returnByValue:true,awaitPromise:true});const page=resultValue(extracted)||{};
      const selected=await cdp.send('Runtime.evaluate',{expression:domChecksScript(check.requiredSelectors),returnByValue:true});const selectors=resultValue(selected)||{};
      const criticalNetworkErrors=[...networkFailures.filter(x=>criticalTypes.has(x.type)&&!x.canceled),...httpErrors.filter(x=>criticalTypes.has(x.type))].slice(0,100);
      let screenshot=null;if(check.screenshot){const shot=await cdp.send('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:false});if(shot.data){const bytes=Buffer.from(shot.data,'base64');const sha256=hash(bytes);const file=path.join(this.dir,`${Date.now()}-${sha256.slice(0,16)}.png`);fs.writeFileSync(file,bytes);screenshot={sha256,bytes:bytes.length,file:path.basename(file)}}}
      const observation={protocol:'taowind-code.browser-observation.v0.1',at:now(),requestedUrl:check.url,url:finalUrl,page:{title:String(page.title||''),text:String(page.text||'').slice(0,40000),description:String(page.description||''),canonical:String(page.canonical||''),robots:String(page.robots||''),hasPasswordForm:!!page.hasPasswordForm,truncated:!!page.truncated},selectors,consoleErrors:consoleErrors.slice(0,100),pageExceptions:pageExceptions.slice(0,100),networkFailures:networkFailures.slice(0,100),httpErrors:httpErrors.slice(0,100),criticalNetworkErrors,screenshot};
      const evaluation=evaluateBrowserChecks(observation,check);const receiptBody={...observation,check,evaluation};const receipt={id:`browser-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`,...receiptBody,evidenceRoot:hash(JSON.stringify(receiptBody))};atomicJson(path.join(this.dir,`${receipt.id}.json`),receipt);return receipt;
    }finally{cdp.close()}
  }
}

export function browserGoalLikely(goal=''){return /\b(ui|ux|web|frontend|browser|page|button|form|css|html|react|vue|svelte)\b|界面|前端|网页|浏览器|按钮|表单|样式|页面|视觉|交互/i.test(String(goal))}
