import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {WorkspaceService} from '../core/workspace.mjs';
import {gitStatus,gitDiff,gitDeliveryPreview} from '../core/git.mjs';
import {runCommand} from '../core/terminal.mjs';
import {TaskStore} from '../core/tasks.mjs';
import {providerStatus} from '../core/providers.mjs';
import {BrowserKnowledgeOrgan} from '../core/browser-organ.mjs';
import {NorthStarRunner} from '../core/north-star-runner.mjs';
import {RepositoryGraph} from '../core/repo-graph.mjs';

const VERSION='0.3.0-alpha.1';
const here=path.dirname(fileURLToPath(import.meta.url));const root=path.resolve(here,'..');
const workspace=path.resolve(process.env.TAOWIND_WORKSPACE||path.join(root,'examples/demo-workspace'));
const service=new WorkspaceService(workspace);const runtimeDir=path.join(root,'runtime-data');const tasks=new TaskStore(runtimeDir);const browserOrgan=new BrowserKnowledgeOrgan(runtimeDir);const repoGraph=new RepositoryGraph(workspace);const runner=new NorthStarRunner({workspace,runtimeDir,taskStore:tasks,repoGraph});let approvalMode='workspace';
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.json':'application/json; charset=utf-8'};
function send(res,code,data,headers={}){res.writeHead(code,{'content-type':'application/json; charset=utf-8',...headers});res.end(JSON.stringify(data))}
async function body(req){let s='';for await(const c of req){s+=c;if(s.length>12_000_000)throw new Error('REQUEST_TOO_LARGE')}return s?JSON.parse(s):{}}
function staticFile(req,res){let p=decodeURIComponent(new URL(req.url,'http://x').pathname);if(p==='/')p='/index.html';const publicRoot=path.join(root,'public');const f=path.resolve(publicRoot,'.'+p);if(f!==publicRoot&&!f.startsWith(publicRoot+path.sep))return false;if(!fs.existsSync(f)||fs.statSync(f).isDirectory())return false;res.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream','cache-control':'no-store'});fs.createReadStream(f).pipe(res);return true}
function runRoute(pathname){const m=pathname.match(/^\/api\/agent\/runs\/([^/]+)(?:\/(synthesize|changeset|apply|validate|repair|rollback|delivery))?$/);return m?{id:m[1],action:m[2]||null}:null}
async function autoAdvance(run,maxRepairs=2){
  if(run.status==='PLANNED'&&providerStatus().taoAI.connected)run=await runner.synthesize(run.id);
  if(run.status==='CHANGESET_STAGED'&&approvalMode!=='read_only'){runner.apply(run.id,{approvalMode});run=runner.get(run.id)}
  if(run.status==='CHANGES_APPLIED')run=await runner.validate(run.id,{approvalMode});
  let repairs=0;while(run.status==='REPAIR_REQUIRED'&&repairs<maxRepairs&&providerStatus().taoAI.connected&&approvalMode!=='read_only'){run=await runner.repair(run.id,{approvalMode});repairs++}
  if(run.status==='READY_FOR_DELIVERY')run=runner.delivery(run.id,{commit:false,approvalMode});
  return run;
}
const api=async(req,res,u)=>{
 if(req.method==='GET'&&u.pathname==='/api/health')return send(res,200,{ok:true,product:'Taowind Code',version:VERSION,workspace,approvalMode,providers:providerStatus(),northStar:'goal → whole-artifact → deep-development → changeset → validation → repair → evidence → delivery'});
 if(req.method==='GET'&&u.pathname==='/api/tree')return send(res,200,{workspace,tree:service.tree('.')});
 if(req.method==='GET'&&u.pathname==='/api/file')return send(res,200,{path:u.searchParams.get('path'),content:service.read(u.searchParams.get('path'))});
 if(req.method==='PUT'&&u.pathname==='/api/file'){if(approvalMode==='read_only')return send(res,403,{error:'APPROVAL_REQUIRED'});const b=await body(req);return send(res,200,service.write(b.path,b.content));}
 if(req.method==='GET'&&u.pathname==='/api/git/status')return send(res,200,gitStatus(workspace));
 if(req.method==='GET'&&u.pathname==='/api/git/diff')return send(res,200,gitDiff(workspace));
 if(req.method==='GET'&&u.pathname==='/api/git/delivery')return send(res,200,gitDeliveryPreview(workspace));
 if(req.method==='GET'&&u.pathname==='/api/repo/graph'){const g=repoGraph.build();return send(res,200,{fingerprint:g.fingerprint,generatedAt:g.generatedAt,summary:g.summary});}
 if(req.method==='GET'&&u.pathname==='/api/repo/search')return send(res,200,{query:u.searchParams.get('q')||'',results:repoGraph.search(u.searchParams.get('q')||'',{limit:Number(u.searchParams.get('limit')||30)})});
 if(req.method==='GET'&&u.pathname==='/api/repo/context'){const q=u.searchParams.get('q')||'';return send(res,200,{query:q,paths:repoGraph.contextPaths(q,{maxFiles:Number(u.searchParams.get('limit')||32)})});
 if(req.method==='POST'&&u.pathname==='/api/repo/impact'){const b=await body(req);return send(res,200,{paths:repoGraph.impact(b.paths||[],{depth:Math.max(0,Math.min(5,Number(b.depth??2))),limit:Math.max(1,Math.min(500,Number(b.limit??200)))})});
 if(req.method==='GET'&&u.pathname==='/api/tasks')return send(res,200,{tasks:tasks.list()});
 if(req.method==='POST'&&u.pathname==='/api/agent/plan'){const b=await body(req);const run=runner.create(b.prompt||b.goal);return send(res,200,{run,tasks:tasks.list(),dwac:run.dwac});}
 if(req.method==='POST'&&u.pathname==='/api/agent/run'){const b=await body(req);let run=runner.create(b.goal||b.prompt);if(b.auto!==false)run=await autoAdvance(run,Math.max(0,Math.min(3,Number(b.maxRepairs??2))));return send(res,200,{run,tasks:tasks.list()});}
 if(req.method==='GET'&&u.pathname==='/api/agent/runs')return send(res,200,{runs:runner.list()});
 const rr=runRoute(u.pathname);if(rr){
   if(req.method==='GET'&&!rr.action)return send(res,200,{run:runner.get(rr.id)});
   if(req.method==='POST'&&rr.action==='synthesize')return send(res,200,{run:await runner.synthesize(rr.id),tasks:tasks.list()});
   if(req.method==='POST'&&rr.action==='changeset'){const b=await body(req);const out=runner.stage(rr.id,b.changes,b.validation_commands||[]);return send(res,200,{...out,tasks:tasks.list()});
   if(req.method==='POST'&&rr.action==='apply')return send(res,200,{...runner.apply(rr.id,{approvalMode}),tasks:tasks.list()});
   if(req.method==='POST'&&rr.action==='validate'){const b=await body(req);return send(res,200,{run:await runner.validate(rr.id,{approvalMode,commands:b.commands||null}),tasks:tasks.list()});
   if(req.method==='POST'&&rr.action==='repair')return send(res,200,{run:await runner.repair(rr.id,{approvalMode}),tasks:tasks.list()});
   if(req.method==='POST'&&rr.action==='rollback')return send(res,200,{run:runner.rollback(rr.id),tasks:tasks.list()});
   if(req.method==='POST'&&rr.action==='delivery'){const b=await body(req);return send(res,200,{run:runner.delivery(rr.id,{commit:!!b.commit,message:b.message||'',approvalMode}),tasks:tasks.list()});
 }
 if(req.method==='POST'&&u.pathname==='/api/tasks'){const b=await body(req);return send(res,200,{tasks:tasks.replace(b.tasks||[])});}
 if(req.method==='POST'&&u.pathname==='/api/terminal/run'){const b=await body(req);return send(res,200,await runCommand(workspace,b.command,{mode:approvalMode}));
 if(req.method==='GET'&&u.pathname==='/api/providers')return send(res,200,{...providerStatus(),browserOrgan:browserOrgan.status()});
 if(req.method==='GET'&&u.pathname==='/api/research/search')return send(res,200,{query:u.searchParams.get('q')||'',results:browserOrgan.search(u.searchParams.get('q')||'',Number(u.searchParams.get('limit')||12))});
 if(req.method==='POST'&&u.pathname==='/api/research/index'){const b=await body(req);return send(res,200,browserOrgan.indexDocument(b));
 if(req.method==='POST'&&u.pathname==='/api/research/frontier'){const b=await body(req);return send(res,200,browserOrgan.enqueue(b.url,{priority:b.priority,source:b.source}));
 if(req.method==='GET'&&u.pathname==='/api/approval')return send(res,200,{mode:approvalMode});
 if(req.method==='POST'&&u.pathname==='/api/approval'){const b=await body(req);if(!['read_only','workspace','full_access'].includes(b.mode))return send(res,400,{error:'INVALID_MODE'});approvalMode=b.mode;return send(res,200,{mode:approvalMode});}
 return send(res,404,{error:'NOT_FOUND'});
};
const server=http.createServer(async(req,res)=>{try{const u=new URL(req.url,'http://localhost');if(u.pathname.startsWith('/api/'))return await api(req,res,u);if(staticFile(req,res))return;res.writeHead(404);res.end('Not found')}catch(e){send(res,e.code==='RUN_NOT_FOUND'?404:500,{error:e.code||e.message||'INTERNAL_ERROR',message:e.message})}});
const port=Number(process.env.PORT||4877);server.listen(port,'127.0.0.1',()=>console.log(`Taowind Code ${VERSION} running: http://127.0.0.1:${port}\nWorkspace: ${workspace}`));
