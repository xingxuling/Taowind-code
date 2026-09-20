import path from 'node:path';
const IMPORTANT=[/^README/i,/package\.json$/,/pyproject\.toml$/,/Cargo\.toml$/,/go\.mod$/,/build\.gradle/i,/settings\.gradle/i,/tsconfig/i,/vite\.config/i,/src\//,/app\//,/server\//,/core\//,/test/i];
const priority=x=>IMPORTANT.some(r=>r.test(x.path))?1:0;
export function selectContextPaths(manifest,{maxFiles=28}={}){
  return [...manifest].filter(x=>x.size<=80_000).sort((a,b)=>priority(b)-priority(a)||a.size-b.size||a.path.localeCompare(b.path)).slice(0,maxFiles).map(x=>x.path);
}
export function repositoryPathIndex(manifest,{maxPaths=800,maxBytes=48_000}={}){
  const rows=[...new Map((manifest||[]).filter(x=>x&&typeof x.path==='string'&&x.path.trim()).map(x=>{
    const normalized=x.path.replaceAll('\\','/').replace(/^\.\//,'');
    return [normalized,{...x,path:normalized}];
  })).values()].sort((a,b)=>priority(b)-priority(a)||a.path.localeCompare(b.path));
  const paths=[];let bytes=2;
  for(const row of rows){
    if(paths.length>=maxPaths)break;
    const encoded=JSON.stringify(row.path);
    const cost=Buffer.byteLength(encoded)+(paths.length?1:0);
    if(bytes+cost>maxBytes)break;
    paths.push(row.path);bytes+=cost;
  }
  return {paths,totalPaths:rows.length,truncated:paths.length<rows.length,approxJsonBytes:bytes};
}
export function repositorySummary(manifest){
  const byExt={};for(const f of manifest)byExt[f.ext||'<none>']=(byExt[f.ext||'<none>']||0)+1;
  const index=repositoryPathIndex(manifest);
  return {
    fileCount:manifest.length,
    extensions:Object.entries(byExt).sort((a,b)=>b[1]-a[1]).slice(0,16),
    topLevel:[...new Set(manifest.map(x=>x.path.split('/')[0]))].slice(0,80),
    contextRecovery:{
      protocol:'taowind.repo-context-recovery.v0.1',
      exactPathHints:index.paths,
      totalPaths:index.totalPaths,
      truncated:index.truncated,
      approxJsonBytes:index.approxJsonBytes,
      rule:'If required file content is absent from files, request exact paths from exactPathHints via needs_more_context; do not guess unseen file content.'
    }
  };
}
