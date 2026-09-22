import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {WorkspaceService} from './workspace.mjs';
import {sha256Buffer,sha256Text} from './hash.mjs';
const MAX_FILES=128,MAX_FILE_BYTES=2_000_000,MAX_TOTAL_BYTES=8_000_000;
const BLOCKED_CHANGE_SEGMENTS=new Set(['.git','node_modules','.next','dist','build','runtime-data','.venv']);
function now(){return new Date().toISOString()}
function atomicJson(file,value){fs.mkdirSync(path.dirname(file),{recursive:true});const tmp=`${file}.${process.pid}.tmp`;fs.writeFileSync(tmp,JSON.stringify(value,null,2));fs.renameSync(tmp,file)}
function changeId(runId,changes){return `cs-${sha256Text(`${runId}:${Date.now()}:${JSON.stringify(changes)}`).slice(0,20)}`}
function encode(bytes){return bytes?bytes.toString('base64'):null}
function decode(value){return value===null?null:Buffer.from(value,'base64')}
function blockedChangePath(value){const rel=path.posix.normalize(String(value||'').replaceAll('\\','/')).replace(/\/+$/,'');return rel.split('/').some(segment=>BLOCKED_CHANGE_SEGMENTS.has(segment.toLowerCase()))}
export class ChangesetStore{
 constructor(runtimeDir,workspace){this.dir=path.join(runtimeDir,'changesets');fs.mkdirSync(this.dir,{recursive:true});this.workspace=new WorkspaceService(workspace)}
 file(id){if(!/^cs-[a-f0-9]+$/i.test(id))throw new Error('INVALID_CHANGESET_ID');return path.join(this.dir,`${id}.json`)}
 get(id){const f=this.file(id);if(!fs.existsSync(f))throw new Error('CHANGESET_NOT_FOUND');return JSON.parse(fs.readFileSync(f,'utf8'))}
 stage(runId,changes,{source='agent'}={}){
   if(!Array.isArray(changes)||!changes.length)throw new Error('CHANGES_REQUIRED');if(changes.length>MAX_FILES)throw new Error('TOO_MANY_CHANGES');let total=0;const normalized=[],seenPaths=new Set();
   for(const raw of changes){const op=raw?.op||'write';if(!['write','delete'].includes(op))throw new Error('UNSUPPORTED_CHANGE_OPERATION');const rel=path.posix.normalize(String(raw.path||'').replaceAll('\\','/')).replace(/\/+$/,'');if(!rel||rel==='.'||rel==='..'||rel.startsWith('../')||rel.startsWith('/')||/^[A-Za-z]:/.test(rel))throw new Error('INVALID_CHANGE_PATH');if(blockedChangePath(rel))throw new Error(`BLOCKED_CHANGE_PATH:${rel}`);if(seenPaths.has(rel))throw new Error(`DUPLICATE_CHANGE_PATH:${rel}`);const overlap=[...seenPaths].find(existing=>rel.startsWith(`${existing}/`)||existing.startsWith(`${rel}/`));if(overlap)throw new Error(`OVERLAPPING_CHANGE_PATH:${overlap}:${rel}`);seenPaths.add(rel);const ancestor=this.workspace.ancestorState(rel);if(!ancestor.ok)throw new Error(`UNSUPPORTED_CHANGE_ANCESTOR:${rel}:${ancestor.ancestor}`);const before=this.workspace.stat(rel);if(before.exists&&before.type!=='file')throw new Error(`UNSUPPORTED_CHANGE_TARGET:${rel}`);let beforeBytes=null;if(before.exists){beforeBytes=this.workspace.readBytes(rel,MAX_FILE_BYTES);total+=beforeBytes.length;if(total>MAX_TOTAL_BYTES)throw new Error('CHANGESET_TOO_LARGE')}let after=null;if(op==='write'){after=Buffer.from(String(raw.content??''),'utf8');if(after.length>MAX_FILE_BYTES)throw new Error('CHANGE_FILE_TOO_LARGE');total+=after.length;if(total>MAX_TOTAL_BYTES)throw new Error('CHANGESET_TOO_LARGE')}
     if(raw.expectedSha256!==undefined&&raw.expectedSha256!==before.sha256)throw new Error(`PREIMAGE_MISMATCH:${rel}`);
     normalized.push({op,path:rel,before:{exists:before.exists,type:before.type||null,sha256:before.sha256,size:before.size,identity:before.identity||null,mode:before.mode??null,contentBase64:encode(beforeBytes)},after:{sha256:after?sha256Buffer(after):null,size:after?.length||0,contentBase64:encode(after)}})
   }
   const id=changeId(runId,normalized.map(x=>({op:x.op,path:x.path,before:x.before.sha256,after:x.after.sha256})));
   const doc={id,protocol:'taowind-code.changeset.v0.3',runId,source,status:'STAGED',createdAt:now(),updatedAt:now(),changes:normalized,applyReceipt:null,rollbackReceipt:null};atomicJson(this.file(id),doc);return doc;
 }
 apply(id){const doc=this.get(id);if(doc.status!=='STAGED')throw new Error('CHANGESET_NOT_STAGED');const preflight=[];
   for(const c of doc.changes){if(blockedChangePath(c.path))throw new Error(`BLOCKED_CHANGE_PATH:${c.path}`);const ancestor=this.workspace.ancestorState(c.path);if(!ancestor.ok)throw new Error(`APPLY_CONFLICT:${c.path}`);const current=this.workspace.stat(c.path);const identityChanged=c.before.exists&&c.before.identity&&current.identity!==c.before.identity;const modeChanged=c.before.exists&&c.before.mode!==null&&c.before.mode!==undefined&&current.mode!==c.before.mode;if(current.exists!==c.before.exists||current.sha256!==c.before.sha256||identityChanged||modeChanged)throw new Error(`APPLY_CONFLICT:${c.path}`);preflight.push({change:c,current})}
   const applied=[];for(const {change:c} of preflight){if(c.op==='delete')this.workspace.remove(c.path);else this.workspace.write(c.path,decode(c.after.contentBase64));const post=this.workspace.stat(c.path);applied.push({path:c.path,op:c.op,sha256:post.sha256,exists:post.exists,identity:post.identity||null,mode:post.mode??null})}
   doc.status='APPLIED';doc.updatedAt=now();doc.applyReceipt={at:doc.updatedAt,files:applied,receiptSha256:sha256Text(JSON.stringify(applied))};atomicJson(this.file(id),doc);return doc;
 }
 rollback(id){const doc=this.get(id);if(doc.status!=='APPLIED')throw new Error('CHANGESET_NOT_APPLIED');const preflight=[],appliedByPath=new Map((doc.applyReceipt?.files||[]).map(x=>[x.path,x]));
   for(const c of [...doc.changes].reverse()){const ancestor=this.workspace.ancestorState(c.path);if(!ancestor.ok)throw new Error(`ROLLBACK_CONFLICT:${c.path}`);const current=this.workspace.stat(c.path);const applied=appliedByPath.get(c.path);const expectedPost=c.op==='delete'?null:c.after.sha256;const expectedIdentity=applied?.identity||null;const expectedMode=applied?.mode;const modeChanged=expectedMode!==null&&expectedMode!==undefined&&current.mode!==expectedMode;if(current.sha256!==expectedPost||current.exists!==(c.op!=='delete')||(expectedIdentity&&current.identity!==expectedIdentity)||modeChanged)throw new Error(`ROLLBACK_CONFLICT:${c.path}`);preflight.push(c)}
   const restored=[];for(const c of preflight){if(!c.before.exists)this.workspace.remove(c.path);else{if(c.before.type!=='file')throw new Error(`ROLLBACK_UNSUPPORTED_TYPE:${c.path}`);this.workspace.write(c.path,decode(c.before.contentBase64),{mode:c.before.mode??null})}const post=this.workspace.stat(c.path);restored.push({path:c.path,exists:post.exists,sha256:post.sha256,identity:post.identity||null,mode:post.mode??null})}
   doc.status='ROLLED_BACK';doc.updatedAt=now();doc.rollbackReceipt={at:doc.updatedAt,files:restored,receiptSha256:sha256Text(JSON.stringify(restored))};atomicJson(this.file(id),doc);return doc;
 }
}
