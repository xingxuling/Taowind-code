import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {WorkspaceService} from './workspace.mjs';
import {sha256Buffer,sha256Text} from './hash.mjs';

const MAX_FILES=128,MAX_FILE_BYTES=2_000_000,MAX_TOTAL_BYTES=8_000_000;
function now(){return new Date().toISOString()}
function atomicJson(file,value){fs.mkdirSync(path.dirname(file),{recursive:true});const tmp=`${file}.${process.pid}.tmp`;fs.writeFileSync(tmp,JSON.stringify(value,null,2));fs.renameSync(tmp,file)}
function changeId(runId,changes){return `cs-${sha256Text(`${runId}:${Date.now()}:${JSON.stringify(changes)}`).slice(0,20)}`}
function encode(bytes){return bytes?bytes.toString('base64'):null}
function decode(value){return value===null?null:Buffer.from(value,'base64')}

export class ChangesetStore{
 constructor(runtimeDir,workspace){this.dir=path.join(runtimeDir,'changesets');fs.mkdirSync(this.dir,{recursive:true});this.workspace=new WorkspaceService(workspace)}
 file(id){if(!/^cs-[a-f0-9]+$/i.test(id))throw new Error('INVALID_CHANGESET_ID');return path.join(this.dir,`${id}.json`)}
 get(id){const f=this.file(id);if(!fs.existsSync(f))throw new Error('CHANGESET_NOT_FOUND');return JSON.parse(fs.readFileSync(f,'utf8'))}
 stage(runId,changes,{source='agent'}={}){
   if(!Array.isArray(changes)||!changes.length)throw new Error('CHANGES_REQUIRED');if(changes.length>MAX_FILES)throw new Error('TOO_MANY_CHANGES');let total=0;const normalized=[];
   for(const raw of changes){const op=raw?.op||'write';if(!['write','delete'].includes(op))throw new Error('UNSUPPORTED_CHANGE_OPERATION');const rel=String(raw.path||'').replaceAll('\\','/').replace(/^\.\//,'');if(!rel||rel.startsWith('/'))throw new Error('INVALID_CHANGE_PATH');const before=this.workspace.stat(rel);let beforeBytes=null;if(before.exists&&before.type==='file')beforeBytes=this.workspace.readBytes(rel,MAX_FILE_BYTES);let after=null;if(op==='write'){after=Buffer.from(String(raw.content??''),'utf8');if(after.length>MAX_FILE_BYTES)throw new Error('CHANGE_FILE_TOO_LARGE');total+=after.length;if(total>MAX_TOTAL_BYTES)throw new Error('CHANGESET_TOO_LARGE')}
     if(raw.expectedSha256!==undefined&&raw.expectedSha256!==before.sha256)throw new Error(`PREIMAGE_MISMATCH:${rel}`);
     normalized.push({op,path:rel,before:{exists:before.exists,type:before.type||null,sha256:before.sha256,size:before.size,contentBase64:encode(beforeBytes)},after:{sha256:after?sha256Buffer(after):null,size:after?.length||0,contentBase64:encode(after)}})
   }
   const id=changeId(runId,normalized.map(x=>({op:x.op,path:x.path,before:x.before.sha256,after:x.after.sha256})));
   const doc={id,protocol:'taowind-code.changeset.v0.2',runId,source,status:'STAGED',createdAt:now(),updatedAt:now(),changes:normalized,applyReceipt:null,rollbackReceipt:null};atomicJson(this.file(id),doc);return doc;
 }
 apply(id){const doc=this.get(id);if(doc.status!=='STAGED')throw new Error('CHANGESET_NOT_STAGED');const applied=[];
   for(const c of doc.changes){const current=this.workspace.stat(c.path);if(current.exists!==c.before.exists||current.sha256!==c.before.sha256)throw new Error(`APPLY_CONFLICT:${c.path}`);if(c.op==='delete')this.workspace.remove(c.path);else this.workspace.write(c.path,decode(c.after.contentBase64).toString('utf8'));const post=this.workspace.stat(c.path);applied.push({path:c.path,op:c.op,sha256:post.sha256,exists:post.exists})}
   doc.status='APPLIED';doc.updatedAt=now();doc.applyReceipt={at:doc.updatedAt,files:applied,receiptSha256:sha256Text(JSON.stringify(applied))};atomicJson(this.file(id),doc);return doc;
 }
 rollback(id){const doc=this.get(id);if(doc.status!=='APPLIED')throw new Error('CHANGESET_NOT_APPLIED');const restored=[];
   for(const c of [...doc.changes].reverse()){const current=this.workspace.stat(c.path);const expectedPost=c.op==='delete'?null:c.after.sha256;if(current.sha256!==expectedPost||current.exists!==(c.op!=='delete'))throw new Error(`ROLLBACK_CONFLICT:${c.path}`);if(!c.before.exists)this.workspace.remove(c.path);else{if(c.before.type!=='file')throw new Error(`ROLLBACK_UNSUPPORTED_TYPE:${c.path}`);this.workspace.write(c.path,decode(c.before.contentBase64).toString('utf8'))}const post=this.workspace.stat(c.path);restored.push({path:c.path,exists:post.exists,sha256:post.sha256})}
   doc.status='ROLLED_BACK';doc.updatedAt=now();doc.rollbackReceipt={at:doc.updatedAt,files:restored,receiptSha256:sha256Text(JSON.stringify(restored))};atomicJson(this.file(id),doc);return doc;
 }
}
