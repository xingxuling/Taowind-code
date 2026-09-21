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
function gitCommitEntry(cwd,commit,path){
  const listed=run(cwd,['ls-tree',commit,'--',path]);
  if(!listed.ok)return {path,error:'GIT_COMMIT_TREE_READ_FAILED',detail:clip(listed.stderr)};
  const line=listed.stdout.trim().split(/\r?\n/).find(Boolean);
  if(!line)return {path,exists:false,sha256:null,mode:null,oid:null};
  const match=line.match(/^(\d{6})\s+blob\s+([0-9a-f]+)\t/);
  if(!match)return {path,error:'GIT_COMMIT_TREE_PARSE_FAILED',detail:clip(line)};
  const bytes=runBytes(cwd,['cat-file','blob',match[2]]);
  if(!bytes.ok)return {path,error:'GIT_COMMIT_BLOB_READ_FAILED',detail:clip(bytes.stderr)};
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
function preexistingStagedPaths(cwd){
  const staged=run(cwd,['diff','--cached','--name-only','-z']);
  if(!staged.ok)return {ok:false,paths:[],error:'GIT_INDEX_OWNERSHIP_READ_FAILED',detail:clip(staged.stderr)};
  return {ok:true,paths:staged.stdout.split('\0').filter(Boolean),error:null,detail:null};
}
export function checkGitIndexOwnership(cwd){
  const staged=preexistingStagedPaths(cwd);
  if(!staged.ok)return {passed:false,checked:0,stagedPaths:[],hardGate:staged.error,detail:staged.detail};
  return {passed:staged.paths.length===0,checked:staged.paths.length,stagedPaths:staged.paths,hardGate:staged.paths.length?'GIT_INDEX_PREEXISTING_STAGED_CHANGES':'PASS'};
}
export function checkGitCommitPostimage(cwd,commit,parent,paths=[],validatedPostimage=null){
  if(!Array.isArray(validatedPostimage))return {passed:false,checked:0,changedPaths:[],drift:[],hardGate:'GIT_COMMIT_POSTIMAGE_RECEIPT_REQUIRED'};
  const selected=[...new Set((paths||[]).map(String).filter(Boolean))];const selectedSet=new Set(selected);
  const changed=run(cwd,['diff-tree','--no-commit-id','--name-only','-r','-z',parent,commit]);
  if(!changed.ok)return {passed:false,checked:0,changedPaths:[],drift:[{path:null,changed:['commit-diff'],detail:clip(changed.stderr)}],hardGate:'GIT_COMMIT_TREE_READ_FAILED'};
  const changedPaths=changed.stdout.split('\0').filter(Boolean);const expectedByPath=new Map(validatedPostimage.map(item=>[String(item?.path||''),item]));
  const drift=changedPaths.filter(path=>!selectedSet.has(path)).map(path=>({path,changed:['ownership']}));let checked=0;
  for(const path of selected){
    checked+=1;const expected=expectedByPath.get(path);const current=gitCommitEntry(cwd,commit,path);
    if(!expected){drift.push({path,changed:['receipt'],expected:null,current});continue}
    if(current.error){drift.push({path,changed:['commit'],expected,current});continue}
    const changedFields=[];const expectedExists=expected.exists===true;
    if(expectedExists!==current.exists)changedFields.push('exists');
    if(expectedExists&&expected.sha256!==current.sha256)changedFields.push('sha256');
    if(expectedExists){const mode=expectedGitMode(expected.mode);if(mode&&mode!==current.mode)changedFields.push('mode')}
    if(changedFields.length)drift.push({path,changed:changedFields,expected:{exists:expectedExists,sha256:expected.sha256??null,mode:expectedGitMode(expected.mode)},current});
  }
  return {passed:drift.length===0,checked,changedPaths,drift,hardGate:drift.length?'GIT_COMMIT_POSTIMAGE_DRIFT':'PASS'};
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
 const indexOwnership=checkGitIndexOwnership(cwd);
 if(!indexOwnership.passed)return {ok:false,error:indexOwnership.hardGate,indexOwnership,indexIntegrity:indexOwnership,paths:selected};
 const parent=run(cwd,['rev-parse','HEAD']); if(!parent.ok)return {ok:false,error:'GIT_HEAD_REQUIRED',indexOwnership,paths:selected};
 const add=run(cwd,['add','-A','--',...selected]); if(!add.ok)return {ok:false,stage:add,indexOwnership,paths:selected};
 let indexIntegrity=null;
 if(validatedPostimage!==null){
   indexIntegrity=checkGitIndexPostimage(cwd,selected,validatedPostimage);
   if(!indexIntegrity.passed){const unstage=run(cwd,['reset','-q','--',...selected]);return {ok:false,error:indexIntegrity.hardGate,stage:add,unstage,indexOwnership,indexIntegrity,paths:selected}}
 }
 const commit=run(cwd,['commit','-m',msg],30_000); const head=run(cwd,['rev-parse','HEAD']);let commitIntegrity=null;
 if(commit.ok&&head.ok&&validatedPostimage!==null){
   commitIntegrity=checkGitCommitPostimage(cwd,head.stdout.trim(),parent.stdout.trim(),selected,validatedPostimage);
   if(!commitIntegrity.passed){
     const rollback=run(cwd,['reset','--mixed',parent.stdout.trim()]);const restoredHead=run(cwd,['rev-parse','HEAD']);
     return {ok:false,error:commitIntegrity.hardGate,stage:add,indexOwnership,indexIntegrity,commit,commitIntegrity,rollback,createdHead:head.stdout.trim(),head:restoredHead.ok?restoredHead.stdout.trim():null,paths:selected,externalSideEffectPerformed:false,pushPerformed:false};
   }
 }
 return {ok:commit.ok,stage:add,indexOwnership,indexIntegrity,commitIntegrity,commit,head:head.ok?head.stdout.trim():null,paths:selected,externalSideEffectPerformed:false,pushPerformed:false};
}
function resolveExpectedCommit(cwd,value){
  const raw=String(value||'').trim();
  if(!/^[0-9a-f]{7,64}$/i.test(raw))return {ok:false,sha:null,error:raw?'EXPECTED_HEAD_SHA_INVALID':'EXPECTED_HEAD_SHA_REQUIRED'};
  const resolved=run(cwd,['rev-parse','--verify',`${raw}^{commit}`]);
  return resolved.ok?{ok:true,sha:resolved.stdout.trim(),error:null}:{ok:false,sha:null,error:'EXPECTED_HEAD_SHA_NOT_FOUND',detail:clip(resolved.stderr)};
}
export function gitPushBranch(cwd,{remote='origin',branch=null,setUpstream=true,expectedHeadSha=null}={}){
  const selected=String(branch||currentBranch(cwd)||'').trim();if(!selected)return {ok:false,pushPerformed:false,externalSideEffectPerformed:false,error:'BRANCH_REQUIRED'};
  const expected=resolveExpectedCommit(cwd,expectedHeadSha);if(!expected.ok)return {ok:false,remote,branch:selected,expectedHeadSha:String(expectedHeadSha||'').trim()||null,pushPerformed:false,externalSideEffectPerformed:false,error:expected.error,detail:expected.detail||null};
  const refspec=`${expected.sha}:refs/heads/${selected}`;const pushed=run(cwd,['push',remote,refspec],60_000);
  let upstream=null;if(pushed.ok&&setUpstream){const configured=run(cwd,['branch','--set-upstream-to',`${remote}/${selected}`,selected]);upstream={ok:configured.ok,stdout:clip(configured.stdout),stderr:clip(configured.stderr),code:configured.code}}
  return {ok:pushed.ok,remote,branch:selected,expectedHeadSha:expected.sha,pushedHead:expected.sha,refspec,upstream,pushPerformed:pushed.ok,externalSideEffectPerformed:pushed.ok,stdout:clip(pushed.stdout),stderr:clip(pushed.stderr),code:pushed.code,error:pushed.ok?null:'PUSH_FAILED'};
}
async function apiJson(fetchImpl,url,init){
  if(typeof fetchImpl!=='function')return {ok:false,status:0,data:null,error:'FETCH_UNAVAILABLE'};
  try{const response=await fetchImpl(url,init);const text=await response.text();let data=null;try{data=text?JSON.parse(text):null}catch{data={message:text.slice(0,2000)}};return {ok:response.ok,status:response.status,data,error:response.ok?null:String(data?.message||`HTTP_${response.status}`)}}catch(error){return {ok:false,status:0,data:null,error:String(error?.message||error)}}
}
function apiContext(cwd,{remote='origin',token=null,env=process.env}={}){
  const info=gitRemoteInfo(cwd,{remote,env});return {...info,token:String(token||githubToken(env)||'').trim()||null};
}
export async function githubCreatePullRequest(cwd,{remote='origin',base='main',head=null,title='',body='',draft=false,expectedHeadSha=null,token=null,env=process.env,fetchImpl=globalThis.fetch}={}){
  const ctx=apiContext(cwd,{remote,token,env});const selectedHead=String(head||ctx.branch||'').trim();const selectedTitle=String(title||'').trim();
  if(!ctx.repository)return {ok:false,prPerformed:false,externalSideEffectPerformed:false,error:'GITHUB_REPOSITORY_REQUIRED'};
  if(!ctx.token)return {ok:false,prPerformed:false,externalSideEffectPerformed:false,error:'GITHUB_TOKEN_REQUIRED',repository:ctx.repository};
  if(!selectedHead||!selectedTitle)return {ok:false,prPerformed:false,externalSideEffectPerformed:false,error:!selectedHead?'PR_HEAD_REQUIRED':'PR_TITLE_REQUIRED',repository:ctx.repository};
  const expected=expectedHeadSha!==null?resolveExpectedCommit(cwd,expectedHeadSha):null;if(expected&&!expected.ok)return {ok:false,prPerformed:false,externalSideEffectPerformed:false,error:expected.error,repository:ctx.repository,expectedHeadSha:String(expectedHeadSha||'').trim()||null};
  const result=await apiJson(fetchImpl,`https://api.github.com/repos/${ctx.repository}/pulls`,{method:'POST',headers:{accept:'application/vnd.github+json',authorization:`Bearer ${ctx.token}`,'content-type':'application/json','x-github-api-version':'2022-11-28'},body:JSON.stringify({title:selectedTitle,head:selectedHead,base:String(base||'main'),body:String(body||''),draft:draft===true})});
  const prNumber=Number(result.data?.number);const returnedHeadSha=String(result.data?.head?.sha||'').trim();const headMatches=!expected||(returnedHeadSha&&returnedHeadSha.toLowerCase()===expected.sha.toLowerCase());const receiptValid=result.ok&&Number.isInteger(prNumber)&&prNumber>0&&headMatches;const error=!result.ok?result.error:!Number.isInteger(prNumber)||prNumber<1?'PR_CREATE_RECEIPT_INVALID':!headMatches?'PR_CREATE_HEAD_MISMATCH':null;
  return {ok:receiptValid,prPerformed:result.ok,externalSideEffectPerformed:result.ok,repository:ctx.repository,number:Number.isInteger(prNumber)&&prNumber>0?prNumber:null,expectedHeadSha:expected?.sha||null,headSha:returnedHeadSha||null,url:result.data?.html_url||null,state:result.data?.state||null,status:result.status,error};
}
export async function githubMergePullRequest(cwd,{number,remote='origin',mergeMethod='squash',expectedHeadSha=null,token=null,env=process.env,fetchImpl=globalThis.fetch}={}){
  const ctx=apiContext(cwd,{remote,token,env});const prNumber=Number(number);const expected=String(expectedHeadSha||'').trim();
  if(!ctx.repository)return {ok:false,mergePerformed:false,externalSideEffectPerformed:false,error:'GITHUB_REPOSITORY_REQUIRED'};
  if(!ctx.token)return {ok:false,mergePerformed:false,externalSideEffectPerformed:false,error:'GITHUB_TOKEN_REQUIRED',repository:ctx.repository};
  if(!Number.isInteger(prNumber)||prNumber<1)return {ok:false,mergePerformed:false,externalSideEffectPerformed:false,error:'PR_NUMBER_REQUIRED',repository:ctx.repository};
  if(!expected)return {ok:false,mergePerformed:false,externalSideEffectPerformed:false,error:'EXPECTED_HEAD_SHA_REQUIRED',repository:ctx.repository,number:prNumber};
  if(!/^[0-9a-f]{40,64}$/i.test(expected))return {ok:false,mergePerformed:false,externalSideEffectPerformed:false,error:'EXPECTED_HEAD_SHA_INVALID',repository:ctx.repository,number:prNumber};
  const body={merge_method:['merge','squash','rebase'].includes(mergeMethod)?mergeMethod:'squash',sha:expected};
  const result=await apiJson(fetchImpl,`https://api.github.com/repos/${ctx.repository}/pulls/${prNumber}/merge`,{method:'PUT',headers:{accept:'application/vnd.github+json',authorization:`Bearer ${ctx.token}`,'content-type':'application/json','x-github-api-version':'2022-11-28'},body:JSON.stringify(body)});
  const mergeConfirmed=result.ok&&result.data?.merged===true;const mergeSha=String(result.data?.sha||'').trim();const receiptValid=mergeConfirmed&&/^[0-9a-f]{40,64}$/i.test(mergeSha);const error=!result.ok?result.error:!mergeConfirmed?(String(result.data?.message||'').trim()||'PR_MERGE_NOT_CONFIRMED'):!receiptValid?'PR_MERGE_SHA_INVALID':null;
  return {ok:receiptValid,mergePerformed:mergeConfirmed,externalSideEffectPerformed:mergeConfirmed,repository:ctx.repository,number:prNumber,expectedHeadSha:expected,sha:mergeSha||null,message:result.data?.message||null,status:result.status,error};
}
export async function gitRemoteDelivery(cwd,{explicitApproval=false,push=true,createPullRequest=false,merge=false,remote='origin',branch=null,base='main',title='',body='',draft=false,prNumber=null,mergeMethod='squash',expectedHeadSha=null,token=null,env=process.env,fetchImpl=globalThis.fetch}={}){
  const result={ok:false,explicitApproval:explicitApproval===true,externalSideEffectPerformed:false,pushPerformed:false,prPerformed:false,mergePerformed:false};
  if(explicitApproval!==true)return {...result,error:'EXPLICIT_APPROVAL_REQUIRED'};
  let pushResult=null;if(push){pushResult=gitPushBranch(cwd,{remote,branch,expectedHeadSha});Object.assign(result,{push:pushResult,pushPerformed:pushResult.pushPerformed===true,externalSideEffectPerformed:pushResult.externalSideEffectPerformed===true});if(!pushResult.ok)return {...result,error:pushResult.error||'PUSH_FAILED'}}
  let pr=null;if(createPullRequest){pr=await githubCreatePullRequest(cwd,{remote,base,head:branch,title,body,draft,expectedHeadSha,token,env,fetchImpl});Object.assign(result,{pullRequest:pr,prPerformed:pr.prPerformed===true,externalSideEffectPerformed:result.externalSideEffectPerformed||pr.externalSideEffectPerformed===true});if(!pr.ok)return {...result,error:'PR_CREATE_FAILED'}}
  let mergeResult=null;if(merge){const number=prNumber||pr?.number;mergeResult=await githubMergePullRequest(cwd,{number,remote,mergeMethod,expectedHeadSha,token,env,fetchImpl});Object.assign(result,{merge:mergeResult,mergePerformed:mergeResult.mergePerformed===true,externalSideEffectPerformed:result.externalSideEffectPerformed||mergeResult.externalSideEffectPerformed===true});if(!mergeResult.ok)return {...result,error:mergeResult.error||'PR_MERGE_FAILED'}}
  return {...result,ok:true,error:null};
}
