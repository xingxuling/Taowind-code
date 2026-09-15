import path from 'node:path';
import {WorkspaceService} from './workspace.mjs';
import {sha256Text} from './hash.mjs';

const CODE_EXT=new Set(['.js','.mjs','.cjs','.ts','.tsx','.jsx','.py','.go','.rs','.java','.kt','.kts','.cs','.swift','.rb','.php','.vue','.svelte']);
const JS_EXT=['.js','.mjs','.cjs','.ts','.tsx','.jsx','.json'];
const TEST_RE=/(^|\/)(__tests__|tests?|spec)(\/|\.)|\.(test|spec)\.[^.]+$/i;
function posix(v){return String(v).replaceAll('\\','/')}
function tokens(v){return [...new Set(String(v||'').normalize('NFKC').toLowerCase().match(/[\p{L}\p{N}_-]{2,}/gu)||[])].slice(0,64)}
function scoreText(text,queryTokens){const t=String(text||'').toLowerCase();let s=0;for(const q of queryTokens){if(t===q)s+=8;else if(t.includes(q))s+=2;}return s}
function unique(arr){return [...new Set(arr)]}

function symbolRecords(rel,content){
  const out=[];const ext=path.extname(rel).toLowerCase();const lines=String(content).split(/\r?\n/);
  const add=(name,kind,line,exported=false)=>{if(name&&!out.some(x=>x.name===name&&x.line===line))out.push({name,kind,line,exported})};
  for(let i=0;i<lines.length;i++){
    const line=lines[i];let m;
    if(['.js','.mjs','.cjs','.ts','.tsx','.jsx','.vue','.svelte'].includes(ext)){
      if((m=line.match(/^\s*(export\s+)?(?:default\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/)))add(m[2],'function',i+1,!!m[1]);
      if((m=line.match(/^\s*(export\s+)?(?:default\s+)?class\s+([A-Za-z_$][\w$]*)/)))add(m[2],'class',i+1,!!m[1]);
      if((m=line.match(/^\s*(export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/)))add(m[2],'callable',i+1,!!m[1]);
      if((m=line.match(/^\s*export\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*)/)))add(m[1],'export',i+1,true);
    }else if(ext==='.py'){
      if((m=line.match(/^\s*(?:async\s+)?def\s+([A-Za-z_]\w*)/)))add(m[1],'function',i+1,false);
      if((m=line.match(/^\s*class\s+([A-Za-z_]\w*)/)))add(m[1],'class',i+1,false);
    }else if(ext==='.go'){
      if((m=line.match(/^\s*func\s+(?:\([^)]*\)\s*)?([A-Za-z_]\w*)/)))add(m[1],'function',i+1,/^[A-Z]/.test(m[1]));
      if((m=line.match(/^\s*type\s+([A-Za-z_]\w*)\s+/)))add(m[1],'type',i+1,/^[A-Z]/.test(m[1]));
    }else if(['.java','.kt','.kts','.cs','.swift','.rs'].includes(ext)){
      if((m=line.match(/^\s*(?:public\s+|private\s+|protected\s+|internal\s+|export\s+)*(?:class|interface|struct|enum|trait)\s+([A-Za-z_]\w*)/)))add(m[1],'type',i+1,false);
      if((m=line.match(/^\s*(?:pub\s+)?(?:async\s+)?(?:fn|fun)\s+([A-Za-z_]\w*)/)))add(m[1],'function',i+1,false);
    }
  }
  return out.slice(0,400);
}

function importSpecifiers(rel,content){
  const ext=path.extname(rel).toLowerCase(),out=[];const text=String(content);
  if(['.js','.mjs','.cjs','.ts','.tsx','.jsx','.vue','.svelte'].includes(ext)){
    const re=/(?:import\s+(?:[^'"()]*?\s+from\s+)?|export\s+[^'"()]*?\s+from\s+|require\s*\(|import\s*\()\s*['"]([^'"]+)['"]/g;let m;while((m=re.exec(text)))out.push(m[1]);
  }else if(ext==='.py'){
    for(const line of text.split(/\r?\n/)){let m;if((m=line.match(/^\s*from\s+([.\w]+)\s+import\s+/)))out.push(m[1]);else if((m=line.match(/^\s*import\s+([\w.]+)/)))out.push(m[1]);}
  }
  return unique(out).slice(0,300);
}

function resolveJs(from,spec,fileSet){
  if(!spec.startsWith('.'))return null;const base=posix(path.posix.normalize(path.posix.join(path.posix.dirname(from),spec)));const candidates=[base,...JS_EXT.map(e=>base+e),...JS_EXT.map(e=>`${base}/index${e}`)];return candidates.find(x=>fileSet.has(x))||null;
}
function resolvePy(from,spec,fileSet){
  let base;if(spec.startsWith('.')){let dots=(spec.match(/^\.+/)||[''])[0].length;let dir=path.posix.dirname(from);for(let i=1;i<dots;i++)dir=path.posix.dirname(dir);base=path.posix.join(dir,spec.slice(dots).replaceAll('.','/'));}else base=spec.replaceAll('.','/');
  const candidates=[`${base}.py`,`${base}/__init__.py`];return candidates.find(x=>fileSet.has(x))||null;
}

export class RepositoryGraph{
  constructor(root){this.workspace=new WorkspaceService(root);this.cache=null;}
  build(){
    const manifest=this.workspace.manifest({maxFiles:6000});const fileSet=new Set(manifest.map(x=>posix(x.path)));const files=[],edges=[];const hashes=[];
    for(const f of manifest){
      const ext=path.extname(f.path).toLowerCase();if(!CODE_EXT.has(ext)&&!['.md','.json','.toml','.yaml','.yml'].includes(ext))continue;
      let content='';try{content=this.workspace.read(f.path)}catch{continue}const stat=this.workspace.stat(f.path);hashes.push(`${f.path}:${stat.sha256}`);
      const symbols=CODE_EXT.has(ext)?symbolRecords(f.path,content):[];const specs=CODE_EXT.has(ext)?importSpecifiers(f.path,content):[];
      const resolved=[];for(const spec of specs){const target=ext==='.py'?resolvePy(f.path,spec,fileSet):resolveJs(f.path,spec,fileSet);if(target){resolved.push(target);edges.push({from:f.path,to:target,type:'imports',specifier:spec});}}
      files.push({path:f.path,ext,size:f.size,test:TEST_RE.test(f.path),symbols,imports:specs,resolvedImports:unique(resolved)});
    }
    const reverse={};for(const e of edges)(reverse[e.to]??=[]).push(e.from);
    const symbolCount=files.reduce((n,f)=>n+f.symbols.length,0);const testFiles=files.filter(f=>f.test).map(f=>f.path);
    this.cache={protocol:'taowind-code.repository-graph.v0.3',fingerprint:sha256Text(hashes.sort().join('\n')),generatedAt:new Date().toISOString(),files,edges,reverse,summary:{manifestFiles:manifest.length,indexedFiles:files.length,codeFiles:files.filter(f=>CODE_EXT.has(f.ext)).length,symbols:symbolCount,importEdges:edges.length,testFiles:testFiles.length}};return this.cache;
  }
  graph(){return this.build()}
  search(query,{limit=30}={}){
    const g=this.build(),qs=tokens(query);if(!qs.length)return[];const rows=[];
    for(const f of g.files){let score=scoreText(f.path,qs)*1.7;const matched=[];for(const s of f.symbols){const ss=scoreText(s.name,qs);if(ss){score+=ss*2.4;matched.push(s)}}if(f.test&&qs.some(q=>q.includes('test')||q.includes('测试')))score+=4;if(score>0)rows.push({path:f.path,score:Number(score.toFixed(3)),test:f.test,symbols:matched.slice(0,12),imports:f.resolvedImports.length,dependents:(g.reverse[f.path]||[]).length});}
    return rows.sort((a,b)=>b.score-a.score||a.path.localeCompare(b.path)).slice(0,Math.max(1,Math.min(100,limit)));
  }
  contextPaths(query,{maxFiles=32}={}){
    const g=this.build(),seeds=this.search(query,{limit:12}).map(x=>x.path),selected=[],push=p=>{if(p&&!selected.includes(p)&&selected.length<maxFiles)selected.push(p)};
    for(const p of seeds)push(p);
    for(const p of [...selected]){const f=g.files.find(x=>x.path===p);for(const d of f?.resolvedImports||[])push(d);for(const r of g.reverse[p]||[])push(r);}
    const relatedTests=g.files.filter(f=>f.test&&(f.resolvedImports.some(x=>selected.includes(x))||selected.some(x=>path.posix.basename(x).split('.')[0]&&f.path.toLowerCase().includes(path.posix.basename(x).split('.')[0].toLowerCase()))));for(const t of relatedTests)push(t.path);
    for(const anchor of ['README.md','package.json','pyproject.toml','Cargo.toml','go.mod'])if(g.files.some(f=>f.path===anchor))push(anchor);
    if(!selected.length)for(const f of g.files.filter(x=>CODE_EXT.has(x.ext)).slice(0,Math.min(12,maxFiles)))push(f.path);
    return selected.slice(0,maxFiles);
  }
  impact(paths,{depth=2,limit=200}={}){
    const g=this.build(),queue=(paths||[]).map(p=>({path:posix(p),d:0})),seen=new Set(),out=[];
    while(queue.length&&out.length<limit){const cur=queue.shift();if(seen.has(cur.path))continue;seen.add(cur.path);out.push(cur.path);if(cur.d>=depth)continue;const f=g.files.find(x=>x.path===cur.path);for(const n of [...(f?.resolvedImports||[]),...(g.reverse[cur.path]||[])])if(!seen.has(n))queue.push({path:n,d:cur.d+1});}
    return out;
  }
}
