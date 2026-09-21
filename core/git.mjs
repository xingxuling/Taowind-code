import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
// GitHub remote delivery provider: non-force push plus pull request create/merge, always behind explicit approval.

function run(cwd,args,timeout=15_000){
  const r=spawnSync('git',args,{cwd,encoding:'utf8',timeout});
  return {ok:r.status===0,stdout:r.stdout||'',stderr:r.stderr||'',code:r.status??-1};
}
function runBytes(cwd,args,timeout=15_000){
  const r=spawnSync('git',args,{cwd,encoding:null,timeout});
  return {ok:r.status===0,stdout:Buffer.isBuffer(r.stdout)?r.stdout:Buffer.from(r.stdout||''),stderr:Buffer.isBuffer(r.stderr)?r.stderr.toString('utf8'):String(r.stderr||''),code:r.status??-1};
}
function redactSecrets(value){return String(value||'').replace(/(https?:\/\/)([^@\s/]+)@/gi,'$1***@').replace(/(authorization:\s*bearer\s+)[^\s]+/gi,'$1***')}
function clip(value,limit=12_000){return redactSecrets(value).slice(-limit)}
function currentBranch(cwd){const r=run(cwd,['branch','--show-current']);return r.ok?r.stdout.trim()||null:null}
function githubToken(env=process.env){return String(env.GH_TOKEN||env.GITHUB_TOKEN||'').trim()||null}
function sanitizedRemoteUrl(value){
  const raw=String(value||'').trim();
  if(!raw)return null;
  if(/^git@github\.com:/i.test(raw))return raw;
  try{const u=new URL(raw);u.username='';u.password='';return u.toString().replace(/\/$/,'')}catch{return raw.replace(/:\/\/[^/@]+@/,'://***@')}
}
function sha256(bytes){return createHash('sha256').update(bytes).digest('hex')}
function expectedGitMode(mode){return Number.isInteger(mode)?((mode&0o111)!==0?'100755':'100644'):null}
function gitIndexEntry(cwd,path){
  const listed=run(cwd,['ls-files','-s','--',path]);
  if(!listed.ok)return {path,error:'GIT_INDEX_READ_FAILED',detail:clip(listed.stderr)};
  const line=listed.stdout.trim().split(/\r?\n/).find(Boolean);
  if(!line)return {path,exists:false,sha256:null,mode:null,oid:null};
  const match=line.match(/^(\d{6})\s+([0-9a-f]+)\s+\d+\t/);
  if(!match)return {path,error:'GIT_INDEX_PARSE_FAILED',detail:clip(line)};
  const bytes=runBytes(cwd,['cat-file','blob',match[2]]);
  if(!bytes.ok)return {path,error:'GIT_INDEX_BLOB_READ_FAILED',detail:clip(bytes.stderr)};
  return {path,exists:true,sha256:sha256(bytes.stdout),mode:match[1],oid:match[2]};
}
export function checkGitIndexPostimage(cwd,paths=[],validatedPostimage=null){
  if(!Array.isArray(validatedPostimage))return {passed:false,checked:0,drift:[],hardGate:'GIT_INDEX_POSTIMAGE_RECEIPT_REQUIRED'};
  const expectedByPath=new Map(validatedPostimage.map(item=>[String(item?.path||''),item]));
  const drift=[];let checked=0;
  for(const path of [...new Set((paths||[]).map(String).filter(Boolean))]){
    checked+=1;const expected=expectedByPath.get(path);const current=gitIndexEntry(cwd,path);
    if(!expected){drift.push({path,changed:['receipt'],expected:null,current});continue}
    if(current.error){drift.push({path,changed:['index'],expected,current});continue}
    const changed=[];const expectedExists=expected.exists===true;
    if(expectedExists!==current.exists)changed.push('exists');
    if(expectedExists&&expected.sha256!==current.sha256)changed.push('sha256');
    if(expectedExists){const mode=expectedGitMode(expected.mode);if(mode&&mode!==current.mode)changed.push('mode')}
    if(changed.length)drift.push({path,changed,expected:{exists:expectedExists,sha256:expected.sha256??null,mode:expectedGitMode(expected.mode)},current});
  }
  return {passed:drift.length===0,checked,drift,hardGate:drift.length?'GIT_INDEX_POSTIMAGE_DRIFT':'PASS'};
}
export function parseGitHubRepository(remoteUrl){
  const raw=String(remoteUrl||'').trim();
  let match=raw.match(/^git@github\.com:([^/]+)\/(.+?)(?:\.git)?$/i);
  if(!match)match=raw.match(/^ssh:\/\/git@github\.com\/([^/]+)\/(.+?)(?:\.git)?\/?$/i);
  if(!match){
    try{const u=new URL(raw);if(u.hostname.toLowerCase()!=='github.com')return null;const parts=u.pathname.replace(/^\/+|\/+$/g,'').split('/');if(parts.length<2)return null;match=[raw,parts[0],parts[1].replace(/\.git$/i,'')]}catch{return null}
  }
  return `${match[1]}/${match[2].replace(/\.git$/i,'')}`;
}
export function gitStatus(cwd){const branch=run(cwd,['branch','--show-current']);const status=run(cwd,['status','--short']);const head=run(cwd,['rev-parse','HEAD']);return {available:branch.ok||status.ok,branch:branch.stdout.trim()||null,head:head.ok?head.stdout.trim():null,status:status.stdout.trim().split(/\r?\n/).filter(Boolean)}}
export function gitDiff(cwd){const r=run(cwd,['diff','--no-ext-diff','--unified=3']);return {available:r.ok,diff:r.stdout.slice(0,400000),error:r.stderr.trim()||null}}
export function gitDiffStat(cwd){const r=run(cwd,['diff','--stat','--no-ext-diff']);return {available:r.ok,stat:r.stdout.trim(),error:r.stderr.trim()||null}}
export function gitRemoteInfo(cwd,{remote='origin',env=process.env}={}){
  const url=run(cwd,['remote','get-url',remote]);const branch=currentBranch(cwd);const repository=url.ok?parseGitHubRepository(url.stdout.trim()):null;
  return {available:url.ok,remote,branch,repository,remoteUrl:url.ok?sanitizedRemoteUrl(url.stdout.trim()):null,githubApiReady:!!repository&&!!githubToken(env)};
}
export function gitDeliveryPreview(cwd){return {...gitStatus(cwd),...gitDiffStat(cwd),remote:gitRemoteInfo(cwd),externalSideEffectPerformed:false,pushPerformed:false,prPerformed:false,mergePerformed:false}}
export function gitLocalCommit(cwd,message,paths=[],validatedPostimage=null){
 const msg=String(message||'').trim(); if(!msg)throw new Error('COMMIT_MESSAGE_REQUIRED');
 const selected=[...new Set((paths||[]).map(String).filter(Boolean))]; if(!selected.length)throw new Error('COMMIT_PATHS_REQUIRED');
 const add=run(cwd,['add','-A','--',...selected]); if(!add.ok)return {ok:false,stage:add,paths:selected};
 let indexIntegrity=null;
 if(validatedPostimage!==null){
   indexIntegrity=checkGitIndexPostimage(cwd,selected,validatedPostimage);
   if(!indexIntegrity.passed){const unstage=run(cwd,['reset','-q','--',...selected]);return {ok:false,error:indexIntegrity.hardGate,stage:add,unstage,indexIntegrity,paths:selected}}
 }
 const commit=run(cwd,['commit','-m',msg],30_000); const head=run(cwd,['rev-parse','HEAD']);
 return {ok:commit.ok,stage:add,indexIntegrity,commit,head:head.ok?head.stdout.trim():null,paths:selected,externalSideEffectPerformed:false,pushPerformed:false};
}
export function gitPushBranch(cwd,{remote='origin',branch=null,setUpstream=true}={}){
  const selected=String(branch||currentBranch(cwd)||'').trim();if(!selected)return {ok:false,pushPerformed:false,externalSideEffectPerformed:false,error:'BRANCH_REQUIRED'};
  const args=['push'];if(setUpstream)args.push('--set-upstream');args.push(remote,selected);const pushed=run(cwd,args,60_000);
  return {ok:pushed.ok,remote,branch:selected,pushPerformed:pushed.ok,externalSideEffectPerformed:pushed.ok,stdout:clip(pushed.stdout),stderr:clip(pushed.stderr),code:pushed.code};
}
async function apiJson(fetchImpl,url,init){
  if(typeof fetchImpl!=='function')return {ok:false,status:0,data:null,error:'FETCH_UNAVAILABLE'};
  try{const response=await fetchImpl(url,init);const text=await response.text();let data=null;try{data=text?JSON.parse(text):null}catch{data={message:text.slice(0,2000)}};return {ok:response.ok,status:response.status,data,error:response.ok?null:String(data?.message||`HTTP_${response.status}`)}}catch(error){return {ok:false,status:0,data:null,error:String(error?.message||error)}}
}
function apiContext(cwd,{remote='origin',token=null,env=process.env}={}){
  const info=gitRemoteInfo(cwd,{remote,env});return {...info,token:String(token||githubToken(env)||'').trim()||null};
}
export async function githubCreatePullRequest(cwd,{remote='origin',base='main',head=null,title='',body='',draft=false,token=null,env=process.env,fetchImpl=globalThis.fetch}={}){
  const ctx=apiContext(cwd,{remote,token,env});const selectedHead=String(head||ctx.branch||'').trim();const selectedTitle=String(title||'').trim();
  if(!ctx.repository)return {ok:false,prPerformed:false,externalSideEffectPerformed:false,error:'GITHUB_REPOSITORY_REQUIRED'};
  if(!ctx.token)return {ok:false,prPerformed:false,externalSideEffectPerformed:false,error:'GITHUB_TOKEN_REQUIRED',repository:ctx.repository};
  if(!selectedHead||!selectedTitle)return {ok:false,prPerformed:false,externalSideEffectPerformed:false,error:!selectedHead?'PR_HEAD_REQUIRED':'PR_TITLE_REQUIRED',repository:ctx.repository};
  const result=await apiJson(fetchImpl,`https://api.github.com/repos/${ctx.repository}/pulls`,{method:'POST',headers:{accept:'application/vnd.github+json',authorization:`Bearer ${ctx.token}`,'content-type':'application/json','x-github-api-version':'2022-11-28'},body:JSON.stringify({title:selectedTitle,head:selectedHead,base:String(base||'main'),body:String(body||''),draft:draft===true})});
  return {ok:result.ok,prPerformed:result.ok,externalSideEffectPerformed:result.ok,repository:ctx.repository,number:result.data?.number||null,url:result.data?.html_url||null,state:result.data?.state||null,status:result.status,error:result.error};
}
export async function githubMergePullRequest(cwd,{number,remote='origin',mergeMethod='squash',expectedHeadSha=null,token=null,env=process.env,fetchImpl=globalThis.fetch}={}){
  const ctx=apiContext(cwd,{remote,token,env});const prNumber=Number(number);
  if(!ctx.repository)return {ok:false,mergePerformed:false,externalSideEffectPerformed:false,error:'GITHUB_REPOSITORY_REQUIRED'};
  if(!ctx.token)return {ok:false,mergePerformed:false,externalSideEffectPerformed:false,error:'GITHUB_TOKEN_REQUIRED',repository:ctx.repository};
  if(!Number.isInteger(prNumber)||prNumber<1)return {ok:false,mergePerformed:false,externalSideEffectPerformed:false,error:'PR_NUMBER_REQUIRED',repository:ctx.repository};
  const body={merge_method:['merge','squash','rebase'].includes(mergeMethod)?mergeMethod:'squash'};if(expectedHeadSha)body.sha=String(expectedHeadSha);
  const result=await apiJson(fetchImpl,`https://api.github.com/repos/${ctx.repository}/pulls/${prNumber}/merge`,{method:'PUT',headers:{accept:'application/vnd.github+json',authorization:`Bearer ${ctx.token}`,'content-type':'application/json','x-github-api-version':'2022-11-28'},body:JSON.stringify(body)});
  return {ok:result.ok&&result.data?.merged!==false,mergePerformed:result.ok&&result.data?.merged!==false,externalSideEffectPerformed:result.ok&&result.data?.merged!==false,repository:ctx.repository,number:prNumber,sha:result.data?.sha||null,message:result.data?.message||null,status:result.status,error:result.ok?null:result.error};
}
export async function gitRemoteDelivery(cwd,{explicitApproval=false,push=true,createPullRequest=false,merge=false,remote='origin',branch=null,base='main',title='',body='',draft=false,prNumber=null,mergeMethod='squash',expectedHeadSha=null,token=null,env=process.env,fetchImpl=globalThis.fetch}={}){
  const result={ok:false,explicitApproval:explicitApproval===true,externalSideEffectPerformed:false,pushPerformed:false,prPerformed:false,mergePerformed:false};
  if(explicitApproval!==true)return {...result,error:'EXPLICIT_APPROVAL_REQUIRED'};
  let pushResult=null;if(push){pushResult=gitPushBranch(cwd,{remote,branch});Object.assign(result,{push:pushResult,pushPerformed:pushResult.pushPerformed===true,externalSideEffectPerformed:pushResult.externalSideEffectPerformed===true});if(!pushResult.ok)return {...result,error:'PUSH_FAILED'}}
  let pr=null;if(createPullRequest){pr=await githubCreatePullRequest(cwd,{remote,base,head:branch,title,body,draft,token,env,fetchImpl});Object.assign(result,{pullRequest:pr,prPerformed:pr.prPerformed===true,externalSideEffectPerformed:result.externalSideEffectPerformed||pr.externalSideEffectPerformed===true});if(!pr.ok)return {...result,error:'PR_CREATE_FAILED'}}
  let mergeResult=null;if(merge){const number=prNumber||pr?.number;mergeResult=await githubMergePullRequest(cwd,{number,remote,mergeMethod,expectedHeadSha,token,env,fetchImpl});Object.assign(result,{merge:mergeResult,mergePerformed:mergeResult.mergePerformed===true,externalSideEffectPerformed:result.externalSideEffectPerformed||mergeResult.externalSideEffectPerformed===true});if(!mergeResult.ok)return {...result,error:'PR_MERGE_FAILED'}}
  return {...result,ok:true,error:null};
}
