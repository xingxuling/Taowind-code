import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import {fileURLToPath} from 'node:url';
import {WorkspaceService} from '../core/workspace.mjs'; import {gitStatus,gitDiff} from '../core/git.mjs'; import {runCommand} from '../core/terminal.mjs'; import {TaskStore} from '../core/tasks.mjs'; import {providerStatus} from '../core/providers.mjs'; import {compileWithDWAC} from '../core/dwac-adapter.mjs'; import {BrowserKnowledgeOrgan} from '../core/browser-organ.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)); const root=path.resolve(here,'..'); const workspace=path.resolve(process.env.TAOWIND_WORKSPACE||path.join(root,'examples/demo-workspace')); const service=new WorkspaceService(workspace); const runtimeDir=path.join(root,'runtime-data'); const tasks=new TaskStore(runtimeDir); const browserOrgan=new BrowserKnowledgeOrgan(runtimeDir); let approvalMode='workspace';
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.json':'application/json; charset=utf-8'};
function send(res,code,data,headers={}){res.writeHead(code,{'content-type':'application/json; charset=utf-8',...headers});res.end(JSON.stringify(data))}
async function body(req){let s='';for await(const c of req)s+=c;return s?JSON.parse(s):{}}
function staticFile(req,res){let p=new URL(req.url,'http://x').pathname;if(p==='/')p='/index.html';const f=path.join(root,'public',p);if(!f.startsWith(path.join(root,'public'))||!fs.existsSync(f)||fs.statSync(f).isDirectory())return false;res.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(res);return true}
const api=async(req,res,u)=>{
 if(req.method==='GET'&&u.pathname==='/api/health')return send(res,200,{ok:true,product:'Taowind Code',version:'0.1.0-alpha.1',workspace,approvalMode,providers:providerStatus()});
 if(req.method==='GET'&&u.pathname==='/api/tree')return send(res,200,{workspace,tree:service.tree('.')});
 if(req.method==='GET'&&u.pathname==='/api/file')return send(res,200,{path:u.searchParams.get('path'),content:service.read(u.searchParams.get('path'))});
 if(req.method==='PUT'&&u.pathname==='/api/file'){if(approvalMode==='read_only')return send(res,403,{error:'APPROVAL_REQUIRED'});const b=await body(req);return send(res,200,service.write(b.path,b.content));}
 if(req.method==='GET'&&u.pathname==='/api/git/status')return send(res,200,gitStatus(workspace));
 if(req.method==='GET'&&u.pathname==='/api/git/diff')return send(res,200,gitDiff(workspace));
 if(req.method==='GET'&&u.pathname==='/api/tasks')return send(res,200,{tasks:tasks.list()});
 if(req.method==='POST'&&u.pathname==='/api/agent/plan'){const b=await body(req);const t=tasks.plan(b.prompt);const dwac=compileWithDWAC(b.prompt,workspace);return send(res,200,{tasks:t,dwac});}
 if(req.method==='POST'&&u.pathname==='/api/tasks'){const b=await body(req);return send(res,200,{tasks:tasks.replace(b.tasks||[])});}
 if(req.method==='POST'&&u.pathname==='/api/terminal/run'){const b=await body(req);return send(res,200,await runCommand(workspace,b.command,{mode:approvalMode}));}
 if(req.method==='GET'&&u.pathname==='/api/providers')return send(res,200,{...providerStatus(),browserOrgan:browserOrgan.status()});
 if(req.method==='GET'&&u.pathname==='/api/research/search')return send(res,200,{query:u.searchParams.get('q')||'',results:browserOrgan.search(u.searchParams.get('q')||'',Number(u.searchParams.get('limit')||12))});
 if(req.method==='POST'&&u.pathname==='/api/research/index'){const b=await body(req);return send(res,200,browserOrgan.indexDocument(b));}
 if(req.method==='POST'&&u.pathname==='/api/research/frontier'){const b=await body(req);return send(res,200,browserOrgan.enqueue(b.url,{priority:b.priority,source:b.source}));}
 if(req.method==='GET'&&u.pathname==='/api/approval')return send(res,200,{mode:approvalMode});
 if(req.method==='POST'&&u.pathname==='/api/approval'){const b=await body(req);if(!['read_only','workspace','full_access'].includes(b.mode))return send(res,400,{error:'INVALID_MODE'});approvalMode=b.mode;return send(res,200,{mode:approvalMode});}
 return send(res,404,{error:'NOT_FOUND'});
};
const server=http.createServer(async(req,res)=>{try{const u=new URL(req.url,'http://localhost');if(u.pathname.startsWith('/api/'))return await api(req,res,u);if(staticFile(req,res))return;res.writeHead(404);res.end('Not found')}catch(e){send(res,500,{error:e.code||'INTERNAL_ERROR',message:e.message})}});
const port=Number(process.env.PORT||4877);server.listen(port,'127.0.0.1',()=>console.log(`Taowind Code ${'0.1.0-alpha.1'} running: http://127.0.0.1:${port}\nWorkspace: ${workspace}`));
