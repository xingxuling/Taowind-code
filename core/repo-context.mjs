import path from 'node:path';
const IMPORTANT=[/^README/i,/package\.json$/,/pyproject\.toml$/,/Cargo\.toml$/,/go\.mod$/,/build\.gradle/i,/settings\.gradle/i,/tsconfig/i,/vite\.config/i,/src\//,/app\//,/server\//,/core\//,/test/i];
const SECRET_PATH=/(^|\/)(?:\.env(?:\.[^\/]*)?|credentials?(?:\.[^\/]*)?|secrets?(?:\.[^\/]*)?|id_(?:rsa|ed25519)|[^\/]+\.(?:pem|key|p12|pfx))(?=\/|$)/i;
const priority=x=>IMPORTANT.some(r=>r.test(x.path))?1:0;
export function isCredentialLikePath(value){const normalized=String(value||'').replaceAll('\\','/').replace(/^\.\//,'');return !!normalized&&SECRET_PATH.test(normalized)}
export function selectContextPaths(manifest,{maxFiles=28}={}){
  return [...manifest].filter(x=>x.size<=80_000&&!isCredentialLikePath(x.path)).sort((a,b)=>priority(b)-priority(a)||a.size-b.size||a.path.localeCompare(b.path)).slice(0,maxFiles).map(x=>x.path);
}
export function repositoryPathIndex(manifest,{maxPaths=800,maxBytes=48_000}={}){
  const unique=new Map();
  for(const item of manifest||[]){
    if(!item||typeof item.path!=='string'||!item.path.trim())continue;
    const normalized=item.path.replaceAll('\\','/').replace(/^\.\//,'');
    if(!normalized||isCredentialLikePath(normalized))continue;
    unique.set(normalized,{...item,path:normalized});
  }
  const rows=[...unique.values()].sort((a,b)=>priority(b)-priority(a)||a.path.localeCompare(b.path));
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
  const visible=manifest.filter(x=>!isCredentialLikePath(x.path));
  const byExt={};for(const f of visible)byExt[f.ext||'<none>']=(byExt[f.ext||'<none>']||0)+1;
  const index=repositoryPathIndex(manifest);
  const extensionRows=Object.entries(byExt).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));
  const topLevels=[...new Set(visible.map(x=>x.path.split('/')[0]))].sort((a,b)=>a.localeCompare(b));
  return {
    fileCount:visible.length,
    manifestTruncated:manifest?.truncated===true,
    extensions:extensionRows.slice(0,16),
    extensionsTruncated:extensionRows.length>16,
    topLevel:topLevels.slice(0,80),
    topLevelTruncated:topLevels.length>80,
    contextRecovery:{
      protocol:'taowind.repo-context-recovery.v0.1',
      exactPathHints:index.paths,
      indexedPaths:index.totalPaths,
      totalManifestPaths:visible.length,
      manifestTruncated:manifest?.truncated===true,
      truncated:index.truncated||manifest?.truncated===true,
      approxJsonBytes:index.approxJsonBytes,
      rule:'If required file content is absent from files, request exact paths from exactPathHints via needs_more_context; do not guess unseen file content. Credential-like paths and their counts are intentionally absent.'
    }
  };
}
