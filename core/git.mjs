import {spawnSync} from 'node:child_process';
function run(cwd,args,timeout=15_000){const r=spawnSync('git',args,{cwd,encoding:'utf8',timeout});return {ok:r.status===0,stdout:r.stdout||'',stderr:r.stderr||'',code:r.status??-1}}
export function gitStatus(cwd){const branch=run(cwd,['branch','--show-current']);const status=run(cwd,['status','--short']);const head=run(cwd,['rev-parse','HEAD']);return {available:branch.ok||status.ok,branch:branch.stdout.trim()||null,head:head.ok?head.stdout.trim():null,status:status.stdout.trim().split(/\r?\n/).filter(Boolean)}}
export function gitDiff(cwd){const r=run(cwd,['diff','--no-ext-diff','--unified=3']);return {available:r.ok,diff:r.stdout.slice(0,400000),error:r.stderr.trim()||null}}
export function gitDiffStat(cwd){const r=run(cwd,['diff','--stat','--no-ext-diff']);return {available:r.ok,stat:r.stdout.trim(),error:r.stderr.trim()||null}}
export function gitDeliveryPreview(cwd){return {...gitStatus(cwd),...gitDiffStat(cwd),externalSideEffectPerformed:false,pushPerformed:false,prPerformed:false}}
export function gitLocalCommit(cwd,message,paths=[]){
 const msg=String(message||'').trim(); if(!msg)throw new Error('COMMIT_MESSAGE_REQUIRED');
 const selected=[...new Set((paths||[]).map(String).filter(Boolean))]; if(!selected.length)throw new Error('COMMIT_PATHS_REQUIRED');
 const add=run(cwd,['add','-A','--',...selected]); if(!add.ok)return {ok:false,stage:add,paths:selected};
 const commit=run(cwd,['commit','-m',msg],30_000); const head=run(cwd,['rev-parse','HEAD']);
 return {ok:commit.ok,stage:add,commit,head:head.ok?head.stdout.trim():null,paths:selected,externalSideEffectPerformed:false,pushPerformed:false};
}
