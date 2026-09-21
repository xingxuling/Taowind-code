import {spawnSync} from 'node:child_process';
import * as baseGit from './git-base.mjs';

export * from './git-base.mjs';

function run(cwd,args,timeout=15_000){
  const r=spawnSync('git',args,{cwd,encoding:'utf8',timeout});
  return {ok:r.status===0,stdout:r.stdout||'',stderr:r.stderr||'',code:r.status??-1};
}
function clip(value,limit=12_000){return String(value||'').replace(/(https?:\/\/)([^@\s/]+)@/gi,'$1***@').replace(/(authorization:\s*bearer\s+)[^\s]+/gi,'$1***').slice(-limit)}
function githubToken(env=process.env){return String(env.GH_TOKEN||env.GITHUB_TOKEN||'').trim()||null}
async function apiJson(fetchImpl,url,init){
  if(typeof fetchImpl!=='function')return {ok:false,status:0,data:null,error:'FETCH_UNAVAILABLE'};
  try{
    const response=await fetchImpl(url,init);const text=await response.text();let data=null;
    try{data=text?JSON.parse(text):null}catch{data={message:text.slice(0,2000)}}
    return {ok:response.ok,status:response.status,data,error:response.ok?null:String(data?.message||`HTTP_${response.status}`)};
  }catch(error){return {ok:false,status:0,data:null,error:String(error?.message||error)}}
}
function resolveExpectedBase(cwd,base,value,remote='origin'){
  const raw=String(value||'').trim();
  if(raw){
    return /^[0-9a-f]{40,64}$/i.test(raw)?{ok:true,sha:raw,error:null}:{ok:false,sha:null,error:'EXPECTED_BASE_SHA_INVALID'};
  }
  const selected=String(base||'main').trim()||'main';
  for(const ref of [selected,`refs/remotes/${remote}/${selected}`]){
    const resolved=run(cwd,['rev-parse','--verify',`${ref}^{commit}`]);
    if(resolved.ok&&/^[0-9a-f]{40,64}$/i.test(resolved.stdout.trim()))return {ok:true,sha:resolved.stdout.trim(),error:null};
  }
  return {ok:false,sha:null,error:'EXPECTED_BASE_SHA_REQUIRED'};
}
function context(cwd,{remote='origin',token=null,env=process.env}={}){
  const info=baseGit.gitRemoteInfo(cwd,{remote,env});
  return {...info,token:String(token||githubToken(env)||'').trim()||null};
}
function headers(token){return {accept:'application/vnd.github+json',authorization:`Bearer ${token}`,'content-type':'application/json','x-github-api-version':'2022-11-28'}}
async function preflightBaseRef(cwd,{remote='origin',base='main',expectedBaseSha=null,token=null,env=process.env,fetchImpl=globalThis.fetch}={}){
  const ctx=context(cwd,{remote,token,env});const expected=resolveExpectedBase(cwd,base,expectedBaseSha,remote);
  if(!expected.ok)return {ok:false,error:expected.error,expectedBaseSha:null,baseSha:null,externalSideEffectPerformed:false};
  if(!ctx.repository)return {ok:false,error:'GITHUB_REPOSITORY_REQUIRED',expectedBaseSha:expected.sha,baseSha:null,externalSideEffectPerformed:false};
  if(!ctx.token)return {ok:false,error:'GITHUB_TOKEN_REQUIRED',repository:ctx.repository,expectedBaseSha:expected.sha,baseSha:null,externalSideEffectPerformed:false};
  const result=await apiJson(fetchImpl,`https://api.github.com/repos/${ctx.repository}/git/ref/heads/${encodeURIComponent(String(base||'main'))}`,{method:'GET',headers:headers(ctx.token)});
  const baseSha=String(result.data?.object?.sha||'').trim();
  if(!result.ok)return {ok:false,error:'PR_MERGE_BASE_PREFLIGHT_FAILED',detail:result.error,repository:ctx.repository,expectedBaseSha:expected.sha,baseSha:null,status:result.status,externalSideEffectPerformed:false};
  if(!/^[0-9a-f]{40,64}$/i.test(baseSha))return {ok:false,error:'PR_MERGE_BASE_PREFLIGHT_RECEIPT_INVALID',repository:ctx.repository,expectedBaseSha:expected.sha,baseSha:baseSha||null,status:result.status,externalSideEffectPerformed:false};
  if(baseSha.toLowerCase()!==expected.sha.toLowerCase())return {ok:false,error:'PR_MERGE_BASE_DRIFT',repository:ctx.repository,expectedBaseSha:expected.sha,baseSha,status:result.status,externalSideEffectPerformed:false};
  return {ok:true,error:null,repository:ctx.repository,expectedBaseSha:expected.sha,baseSha,status:result.status,externalSideEffectPerformed:false};
}
async function preflightPullRequestBase(cwd,{number,remote='origin',expectedBaseSha=null,token=null,env=process.env,fetchImpl=globalThis.fetch}={}){
  const ctx=context(cwd,{remote,token,env});const prNumber=Number(number);const expected=String(expectedBaseSha||'').trim();
  if(!ctx.repository)return {ok:false,error:'GITHUB_REPOSITORY_REQUIRED',externalSideEffectPerformed:false};
  if(!ctx.token)return {ok:false,error:'GITHUB_TOKEN_REQUIRED',repository:ctx.repository,externalSideEffectPerformed:false};
  if(!Number.isInteger(prNumber)||prNumber<1)return {ok:false,error:'PR_NUMBER_REQUIRED',repository:ctx.repository,externalSideEffectPerformed:false};
  if(!expected)return {ok:false,error:'EXPECTED_BASE_SHA_REQUIRED',repository:ctx.repository,number:prNumber,externalSideEffectPerformed:false};
  if(!/^[0-9a-f]{40,64}$/i.test(expected))return {ok:false,error:'EXPECTED_BASE_SHA_INVALID',repository:ctx.repository,number:prNumber,expectedBaseSha:expected,externalSideEffectPerformed:false};
  const result=await apiJson(fetchImpl,`https://api.github.com/repos/${ctx.repository}/pulls/${prNumber}`,{method:'GET',headers:headers(ctx.token)});
  const baseSha=String(result.data?.base?.sha||'').trim();
  if(!result.ok)return {ok:false,error:'PR_MERGE_BASE_PREFLIGHT_FAILED',detail:result.error,repository:ctx.repository,number:prNumber,expectedBaseSha:expected,baseSha:null,status:result.status,externalSideEffectPerformed:false};
  if(!/^[0-9a-f]{40,64}$/i.test(baseSha))return {ok:false,error:'PR_MERGE_BASE_PREFLIGHT_RECEIPT_INVALID',repository:ctx.repository,number:prNumber,expectedBaseSha:expected,baseSha:baseSha||null,status:result.status,externalSideEffectPerformed:false};
  if(baseSha.toLowerCase()!==expected.toLowerCase())return {ok:false,error:'PR_MERGE_BASE_DRIFT',repository:ctx.repository,number:prNumber,expectedBaseSha:expected,baseSha,status:result.status,externalSideEffectPerformed:false};
  return {ok:true,error:null,repository:ctx.repository,number:prNumber,expectedBaseSha:expected,baseSha,status:result.status,externalSideEffectPerformed:false};
}

export async function githubMergePullRequest(cwd,options={}){
  const expectedHead=String(options.expectedHeadSha||'').trim();
  if(!expectedHead||!/^[0-9a-f]{40,64}$/i.test(expectedHead))return baseGit.githubMergePullRequest(cwd,options);
  const expectedBase=String(options.expectedBaseSha||'').trim();
  if(!expectedBase)return {ok:false,mergePerformed:false,externalSideEffectPerformed:false,error:'EXPECTED_BASE_SHA_REQUIRED',number:Number(options.number)||null,expectedHeadSha:expectedHead,expectedBaseSha:null};
  const preflight=await preflightPullRequestBase(cwd,{...options,expectedBaseSha:expectedBase});
  if(!preflight.ok)return {...preflight,mergePerformed:false};
  const merged=await baseGit.githubMergePullRequest(cwd,options);
  return {...merged,expectedBaseSha:preflight.expectedBaseSha,baseSha:preflight.baseSha,basePreflight:preflight};
}

export async function gitRemoteDelivery(cwd,options={}){
  if(options.explicitApproval!==true)return baseGit.gitRemoteDelivery(cwd,options);
  if(options.merge!==true)return baseGit.gitRemoteDelivery(cwd,options);
  const expectedHeadSha=String(options.expectedHeadSha||'').trim();
  if(!expectedHeadSha)return {ok:false,explicitApproval:true,externalSideEffectPerformed:false,pushPerformed:false,prPerformed:false,mergePerformed:false,error:'EXPECTED_HEAD_SHA_REQUIRED'};
  const expectedBase=resolveExpectedBase(cwd,options.base||'main',options.expectedBaseSha,options.remote||'origin');
  if(!expectedBase.ok)return {ok:false,explicitApproval:true,externalSideEffectPerformed:false,pushPerformed:false,prPerformed:false,mergePerformed:false,error:expectedBase.error};
  const baseRef=await preflightBaseRef(cwd,{...options,expectedBaseSha:expectedBase.sha});
  if(!baseRef.ok)return {ok:false,explicitApproval:true,externalSideEffectPerformed:false,pushPerformed:false,prPerformed:false,mergePerformed:false,error:baseRef.error,basePreflight:baseRef};

  const first=await baseGit.gitRemoteDelivery(cwd,{...options,merge:false});
  if(!first.ok)return {...first,basePreflight:baseRef,expectedBaseSha:expectedBase.sha};
  const number=options.prNumber||first.pullRequest?.number;
  const merged=await githubMergePullRequest(cwd,{number,remote:options.remote,mergeMethod:options.mergeMethod,expectedHeadSha,expectedBaseSha:expectedBase.sha,token:options.token,env:options.env,fetchImpl:options.fetchImpl});
  const out={
    ...first,
    merge:merged,
    mergePerformed:merged.mergePerformed===true,
    externalSideEffectPerformed:first.externalSideEffectPerformed===true||merged.externalSideEffectPerformed===true,
    expectedBaseSha:expectedBase.sha,
    basePreflight:baseRef,
  };
  return merged.ok?{...out,ok:true,error:null}:{...out,ok:false,error:merged.error||'PR_MERGE_FAILED'};
}
