import {spawnSync} from 'node:child_process';
function run(cwd,args){const r=spawnSync('git',args,{cwd,encoding:'utf8',timeout:10000}); return {ok:r.status===0,stdout:r.stdout||'',stderr:r.stderr||'',code:r.status}}
export function gitStatus(cwd){const branch=run(cwd,['branch','--show-current']); const status=run(cwd,['status','--short']); return {available:branch.ok||status.ok,branch:branch.stdout.trim()||null,status:status.stdout.trim().split(/\r?\n/).filter(Boolean)}}
export function gitDiff(cwd){const r=run(cwd,['diff','--no-ext-diff','--unified=3']); return {available:r.ok,diff:r.stdout.slice(0,300000),error:r.stderr.trim()||null}}
