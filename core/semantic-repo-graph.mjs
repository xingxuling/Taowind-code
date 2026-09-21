import path from 'node:path';

const TOKEN_RE=/[A-Za-z_][A-Za-z0-9_]{2,}|[\p{Script=Han}]{2,}/gu;
const IMPORT_PATTERNS=[
  /(?:import\s+[^'"\n]*?from\s*|export\s+[^'"\n]*?from\s*|import\s*\(\s*|import\s*|require\s*\()\s*['"]([^'"]+)['"]/g,
  /(?:from|import)\s+([A-Za-z_][A-Za-z0-9_.]*)/g,
];
const SYMBOL_PATTERNS=[
  /\b(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g,
  /\b(?:export\s+)?class\s+([A-Za-z_$][\w$]*)/g,
  /\b(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/g,
  /^\s*def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/gm,
  /^\s*class\s+([A-Za-z_][A-Za-z0-9_]*)\s*[:(]/gm,
];

function tokens(text){return [...new Set((String(text||'').match(TOKEN_RE)||[]).map(x=>x.toLowerCase()))]}
function collect(re,text){const out=[];re.lastIndex=0;let m;while((m=re.exec(text)))out.push(m[1]);return out}
function normalizeImport(from,spec){
  if(!spec?.startsWith('.'))return null;
  const base=path.posix.normalize(path.posix.join(path.posix.dirname(from),spec));
  return base.replace(/^\.\//,'');
}
function resolveImportTarget(nodePaths,imp){
  const directExt=p=>{if(!p.startsWith(`${imp}.`))return false;const suffix=p.slice(imp.length+1);return !!suffix&&!suffix.includes('.')&&!suffix.includes('/')};
  const indexPrefix=`${imp}/index.`;
  const indexExt=p=>{if(!p.startsWith(indexPrefix))return false;const suffix=p.slice(indexPrefix.length);return !!suffix&&!suffix.includes('.')&&!suffix.includes('/')};
  const rank=p=>p===imp?0:directExt(p)?1:2;
  const candidates=nodePaths.filter(p=>p===imp||directExt(p)||indexExt(p));
  if(!candidates.length)return null;
  const bestRank=Math.min(...candidates.map(rank));
  const best=candidates.filter(p=>rank(p)===bestRank);
  return best.length===1?best[0]:null;
}
function isTestFile(p){return /(^|\/)(test|tests|__tests__)(\/|$)|\.(test|spec)\.[^.]+$/i.test(p)}
function isEntryLike(p){return /(^|\/)(index|main|app|server|cli)\.[^.]+$/i.test(p)||/^(package\.json|pyproject\.toml|Cargo\.toml|go\.mod)$/i.test(p)}
function relatedByStem(a,b){
  const stem=x=>path.posix.basename(x).replace(/\.[^.]+$/,'').replace(/\.(?:test|spec)$/i,'').replace(/[-_.]?test$/i,'');
  return stem(a)===stem(b);
}

export function buildSemanticRepoGraph(files,{goal=''}={}){
  const docs=(files||[]).filter(x=>x&&typeof x.path==='string'&&typeof x.content==='string');
  const byPath=new Map(docs.map(x=>[x.path.replaceAll('\\','/'),x]));
  const nodes=[];const edges=[];const edgeKeys=new Set();
  const addEdge=edge=>{const key=`${edge.type}\n${edge.from}\n${edge.to}`;if(edgeKeys.has(key))return false;edgeKeys.add(key);edges.push(edge);return true};
  for(const file of docs){
    const p=file.path.replaceAll('\\','/');
    const imports=[];for(const re of IMPORT_PATTERNS)for(const spec of collect(re,file.content)){const base=normalizeImport(p,spec);if(base)imports.push(base)}
    const symbols=[...new Set(SYMBOL_PATTERNS.flatMap(re=>collect(re,file.content)))].slice(0,120);
    nodes.push({path:p,size:Buffer.byteLength(file.content),ext:path.posix.extname(p).toLowerCase(),symbols,imports,isTest:isTestFile(p),isEntry:isEntryLike(p),tokens:tokens(`${p} ${symbols.join(' ')}`)});
  }
  const nodePaths=[...byPath.keys()];
  for(const n of nodes){
    for(const imp of n.imports){
      const hit=resolveImportTarget(nodePaths,imp);
      if(hit)addEdge({from:n.path,to:hit,type:'imports'});
    }
  }
  const tests=nodes.filter(n=>n.isTest),nonTests=nodes.filter(n=>!n.isTest);
  for(const t of tests){const matches=nonTests.filter(s=>relatedByStem(t.path,s.path));if(matches.length===1)addEdge({from:t.path,to:matches[0].path,type:'tests'});}
  const goalTokens=tokens(goal).filter(x=>x.length>2);
  const adjacency=new Map(nodes.map(n=>[n.path,new Set()]));
  for(const e of edges){adjacency.get(e.from)?.add(e.to);adjacency.get(e.to)?.add(e.from)}
  const ranked=nodes.map(n=>{
    const lexical=goalTokens.reduce((acc,t)=>acc+(n.tokens.some(x=>x.includes(t)||t.includes(x))?1:0),0);
    const centrality=adjacency.get(n.path)?.size||0;
    const score=lexical*8+Math.min(centrality,8)*1.5+(n.isEntry?3:0)+(n.isTest?1.5:0)+Math.min(n.symbols.length,12)*0.15;
    return {...n,score:Number(score.toFixed(3)),centrality,goalMatches:lexical};
  }).sort((a,b)=>b.score-a.score||a.size-b.size||a.path.localeCompare(b.path));
  return {version:'taowind.semantic-repo-graph.v0.1',goal,goalTokens,nodes:ranked,edges,stats:{files:nodes.length,edges:edges.length,symbols:nodes.reduce((a,n)=>a+n.symbols.length,0),tests:tests.length}};
}

export function selectSemanticContext(graph,{maxFiles=28,maxBytes=220000}={}){
  const selected=[];const seen=new Set();let bytes=0;
  const byPath=new Map(graph.nodes.map(n=>[n.path,n]));
  const rankByPath=new Map(graph.nodes.map((n,index)=>[n.path,index]));
  const add=n=>{if(!n||seen.has(n.path)||n.size>80000||bytes+n.size>maxBytes||selected.length>=maxFiles)return false;seen.add(n.path);selected.push(n.path);bytes+=n.size;return true};
  for(const n of graph.nodes){
    add(n);
    if(!seen.has(n.path))continue;
    const neighborPaths=new Set();
    for(const e of graph.edges){if(e.from===n.path)neighborPaths.add(e.to);else if(e.to===n.path)neighborPaths.add(e.from)}
    const neighbors=[...neighborPaths].sort((a,b)=>(rankByPath.get(a)??Number.MAX_SAFE_INTEGER)-(rankByPath.get(b)??Number.MAX_SAFE_INTEGER)||a.localeCompare(b));
    for(const neighborPath of neighbors)add(byPath.get(neighborPath));
  }
  return {paths:selected,totalBytes:bytes,reason:'goal lexical relevance + symbol/entry centrality + import/test neighborhood'};
}

export function graphSummary(graph){
  return {version:graph.version,stats:graph.stats,goalTokens:graph.goalTokens,top:graph.nodes.slice(0,12).map(n=>({path:n.path,score:n.score,centrality:n.centrality,symbols:n.symbols.slice(0,12),isTest:n.isTest,isEntry:n.isEntry}))};
}
