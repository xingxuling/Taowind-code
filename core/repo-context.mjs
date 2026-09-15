import path from 'node:path';
const IMPORTANT=[/^README/i,/package\.json$/,/pyproject\.toml$/,/Cargo\.toml$/,/go\.mod$/,/build\.gradle/i,/settings\.gradle/i,/tsconfig/i,/vite\.config/i,/src\//,/app\//,/server\//,/core\//,/test/i];
export function selectContextPaths(manifest,{maxFiles=28}={}){
  return [...manifest].filter(x=>x.size<=80_000).sort((a,b)=>{const sa=IMPORTANT.some(r=>r.test(a.path))?1:0,sb=IMPORTANT.some(r=>r.test(b.path))?1:0;return sb-sa||a.size-b.size||a.path.localeCompare(b.path)}).slice(0,maxFiles).map(x=>x.path);
}
export function repositorySummary(manifest){
  const byExt={};for(const f of manifest)byExt[f.ext||'<none>']=(byExt[f.ext||'<none>']||0)+1;return {fileCount:manifest.length,extensions:Object.entries(byExt).sort((a,b)=>b[1]-a[1]).slice(0,16),topLevel:[...new Set(manifest.map(x=>x.path.split('/')[0]))].slice(0,80)};
}
