import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {validateWebUrl} from './security.mjs';

export const FRONTIER_FORMAT='taowind.search.frontier.v0.1';
const now=()=>new Date().toISOString();
const ts=v=>Number.isFinite(Date.parse(v||''))?Date.parse(v):0;
const root=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
function loopback(host){return ['localhost','127.0.0.1','::1','[::1]'].includes(String(host).toLowerCase());}
export function normalizeFrontierUrl(value){const u=new URL(validateWebUrl(value));if(u.protocol==='http:'&&!loopback(u.hostname))throw new Error('Tao Search 远程抓取只允许 HTTPS；HTTP 仅允许本机回环');if(u.username||u.password)throw new Error('抓取地址不能携带凭据');u.hash='';for(const key of [...u.searchParams.keys()])if(/^utm_|^(?:fbclid|gclid|mc_cid|mc_eid)$/i.test(key))u.searchParams.delete(key);u.searchParams.sort();return u.href;}
function makeEntry(url,{priority=50,depth=0,source='link',parent='',origin=''}={}){const normalized=normalizeFrontierUrl(url),u=new URL(normalized);return {url:normalized,origin:origin||u.origin,host:u.hostname.toLowerCase(),priority:Number(priority)||0,depth:Math.max(0,Number(depth)||0),source:String(source||'link'),parent:String(parent||''),status:'pending',attempts:0,discoveredAt:now(),lastFetchedAt:'',nextFetchAt:'',etag:'',lastModified:'',contentRoot:'',lastError:'',httpStatus:0};}
export class TaoSearchFrontier{
  constructor(file){this.file=file;this.entries=new Map();this.hosts=new Map();this.meta={createdAt:now(),updatedAt:now(),runs:0};this.load();}
  load(){try{const p=JSON.parse(fs.readFileSync(this.file,'utf8'));if(p?.format!==FRONTIER_FORMAT||!Array.isArray(p.entries))return;this.meta={...this.meta,...p.meta};for(const e of p.entries){try{const n=normalizeFrontierUrl(e.url);this.entries.set(n,{...makeEntry(n,e),...e,url:n});}catch{}}if(Array.isArray(p.hosts))for(const h of p.hosts)this.hosts.set(h.host,h);}catch{}}
  save(){fs.mkdirSync(path.dirname(this.file),{recursive:true});this.meta.updatedAt=now();const body={format:FRONTIER_FORMAT,meta:this.meta,entries:[...this.entries.values()],hosts:[...this.hosts.values()]};const tmp=this.file+'.tmp';fs.writeFileSync(tmp,JSON.stringify(body,null,2),{mode:0o600});fs.renameSync(tmp,this.file);return root(body);}
  enqueue(url,opts={}){const normalized=normalizeFrontierUrl(url);const old=this.entries.get(normalized);if(old){if(old.status==='pending')old.priority=Math.max(old.priority,Number(opts.priority)||0);if(opts.source==='seed'||opts.source==='sitemap'){old.source=opts.source;old.priority=Math.max(old.priority,opts.source==='seed'?100:85);}return old;}const e=makeEntry(normalized,opts);this.entries.set(normalized,e);return e;}
  scheduleSeeds(urls){let n=0;for(const u of urls){try{this.enqueue(u,{priority:100,depth:0,source:'seed'});n++;}catch{}}this.save();return n;}
  due({maxDepth=4,maxHosts=50,nowMs=Date.now()}={}){const allowedHosts=new Set([...this.entries.values()].sort((a,b)=>b.priority-a.priority).map(e=>e.host).slice(0,maxHosts));return [...this.entries.values()].filter(e=>e.status==='pending'&&e.depth<=maxDepth&&allowedHosts.has(e.host)&&(ts(e.nextFetchAt)<=nowMs)).sort((a,b)=>b.priority-a.priority||a.depth-b.depth||ts(a.discoveredAt)-ts(b.discoveredAt))[0]||null;}
  hostState(host){if(!this.hosts.has(host))this.hosts.set(host,{host,nextAllowedAt:'',robotsFetchedAt:'',crawlDelayMs:250,robotsRoot:'',sitemaps:[]});return this.hosts.get(host);}
  markHostDelay(host,delayMs){const h=this.hostState(host);h.crawlDelayMs=Math.max(100,Math.min(30000,Number(delayMs)||250));h.nextAllowedAt=new Date(Date.now()+h.crawlDelayMs).toISOString();}
  hostReady(host){return ts(this.hostState(host).nextAllowedAt)<=Date.now();}
  markFetched(url,{httpStatus=200,etag='',lastModified='',contentRoot='',recrawlAfterMs=6*60*60*1000}={}){const e=this.entries.get(normalizeFrontierUrl(url));if(!e)return;e.status='fetched';e.attempts++;e.httpStatus=httpStatus;e.lastFetchedAt=now();e.nextFetchAt=new Date(Date.now()+Math.max(60000,recrawlAfterMs)).toISOString();e.etag=String(etag||'').slice(0,500);e.lastModified=String(lastModified||'').slice(0,500);e.contentRoot=String(contentRoot||'');e.lastError='';}
  markNotModified(url,{etag='',lastModified='',recrawlAfterMs=6*60*60*1000}={}){this.markFetched(url,{httpStatus:304,etag,lastModified,contentRoot:this.entries.get(normalizeFrontierUrl(url))?.contentRoot||'',recrawlAfterMs});}
  markFailure(url,error,{httpStatus=0,retryable=true}={}){const e=this.entries.get(normalizeFrontierUrl(url));if(!e)return;e.attempts++;e.httpStatus=httpStatus;e.lastError=String(error||'UNKNOWN').slice(0,500);if(retryable&&e.attempts<4){e.status='pending';const backoff=Math.min(60*60*1000,1000*(2**(e.attempts-1)));e.nextFetchAt=new Date(Date.now()+backoff).toISOString();e.priority=Math.max(1,e.priority-5);}else e.status='failed';}
  reopenDue({nowMs=Date.now()}={}){let n=0;for(const e of this.entries.values())if(e.status==='fetched'&&ts(e.nextFetchAt)<=nowMs){e.status='pending';e.priority=Math.max(e.priority,35);n++;}if(n)this.save();return n;}
  stats(){const all=[...this.entries.values()];const count=s=>all.filter(e=>e.status===s).length;return {entries:all.length,pending:count('pending'),fetched:count('fetched'),failed:count('failed'),hosts:new Set(all.map(e=>e.host)).size,runs:Number(this.meta.runs||0),updatedAt:this.meta.updatedAt};}
  beginRun(){this.meta.runs=Number(this.meta.runs||0)+1;this.save();}
  clear(){this.entries.clear();this.hosts.clear();this.meta={createdAt:now(),updatedAt:now(),runs:0};try{fs.rmSync(this.file,{force:true});}catch{}return this.stats();}
}
