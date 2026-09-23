import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {WorkspaceService} from './workspace.mjs';
import {sha256Buffer,sha256Text} from './hash.mjs';
import {isCredentialLikePath} from './repo-context.mjs';
const MAX_FILES=128,MAX_FILE_BYTES=2_000_000,MAX_TOTAL_BYTES=8_000_000;
const CHANGESET_PROTOCOL='taowind-code.changeset.v0.3';
const HASH_RE=/^[a-f0-9]{64}$/;
const BLOCKED_CHANGE_SEGMENTS=new Set(['.git','node_modules','.next','dist','build','runtime-data','.venv']);
function now(){return new Date().toISOString()}
function atomicJson(file,value){fs.mkdirSync(path.dirname(file),{recursive:true});const tmp=`${file}.${process.pid}.tmp`;fs.writeFileSync(tmp,JSON.stringify(value,null,2));fs.renameSync(tmp,file)}
function changeId(runId,changes){return `cs-${sha256Text(`${runId}:${Date.now()}:${JSON.stringify(changes)}`).slice(0,20)}`}
function encode(bytes){return bytes?bytes.toString('base64'):null}
function decode(value){if(value===null)return null;const bytes=Buffer.from(value,'base64');return bytes.toString('base64')===value?bytes:null}
function blockedChangePath(value){const rel=path.posix.normalize(String(value||'').replaceAll('\\','/')).replace(/\/+$/,'');return rel.split('/').some(segment=>BLOCKED_CHANGE_SEGMENTS.has(segment.toLowerCase()))}
function validNullableHash(value){return value===null||(typeof value==='string'&&HASH_RE.test(value))}
function validNullableString(value){return value===null||typeof value==='string'}
function validNullableInteger(value){return value===null||Number.isInteger(value)}
function verifiedChangeShape(change){
 if(!change||typeof change!=='object'||Array.isArray(change)||!['write','delete'].includes(change.op)||typeof change.path!=='string')throw new Error('INVALID_CHANGESET_CHANGE_SHAPE');
 const before=change.before,after=change.after;
 if(!before||typeof before!=='object'||Array.isArray(before)||typeof before.exists!=='boolean'||!validNullableString(before.type)||!validNullableHash(before.sha256)||!Number.isInteger(before.size)||before.size<0||!validNullableString(before.identity)||!validNullableInteger(before.mode)||!validNullableString(before.contentBase64))throw new Error('INVALID_CHANGESET_CHANGE_SHAPE');
 if(!after||typeof after!=='object'||Array.isArray(after)||!validNullableHash(after.sha256)||!Number.isInteger(after.size)||after.size<0||!validNullableString(after.contentBase64))throw new Error('INVALID_CHANGESET_CHANGE_SHAPE');
 return change
}
function verifiedReceiptShape(receipt,kind){
 if(receipt===null)return null;
 if(!receipt||typeof receipt!=='object'||Array.isArray(receipt)||typeof receipt.at!=='string'||!Array.isArray(receipt.files)||receipt.files.length>MAX_FILES||typeof receipt.receiptSha256!=='string'||!HASH_RE.test(receipt.receiptSha256))throw new Error('INVALID_CHANGESET_RECEIPT_SHAPE');
 for(const file of receipt.files){
  const common=file&&typeof file==='object'&&!Array.isArray(file)&&typeof file.path==='string'&&typeof file.exists==='boolean'&&validNullableHash(file.sha256)&&validNullableString(file.identity)&&validNullableInteger(file.mode);
  if(!common||(kind==='APPLY'&&!['write','delete'].includes(file.op)))throw new Error('INVALID_CHANGESET_RECEIPT_SHAPE');
 }
 return receipt
}
function verifiedChangesetProtocol(doc){
 if(doc?.protocol!==CHANGESET_PROTOCOL)throw new Error('UNSUPPORTED_CHANGESET_PROTOCOL');
 if(!['STAGED','APPLIED','ROLLED_BACK'].includes(doc?.status))throw new Error('INVALID_CHANGESET_STATUS');
 if(typeof doc?.runId!=='string'||typeof doc?.source!=='string'||typeof doc?.createdAt!=='string'||typeof doc?.updatedAt!=='string'||!Array.isArray(doc?.changes)||doc.changes.length<1||doc.changes.length>MAX_FILES)throw new Error('INVALID_CHANGESET_ENVELOPE');
 if(!Object.hasOwn(doc,'applyReceipt')||!Object.hasOwn(doc,'rollbackReceipt')||(doc.applyReceipt!==null&&(typeof doc.applyReceipt!=='object'||Array.isArray(doc.applyReceipt)))||(doc.rollbackReceipt!==null&&(typeof doc.rollbackReceipt!=='object'||Array.isArray(doc.rollbackReceipt))))throw new Error('INVALID_CHANGESET_ENVELOPE');
 for(const change of doc.changes)verifiedChangeShape(change);
 verifiedReceiptShape(doc.applyReceipt,'APPLY');verifiedReceiptShape(doc.rollbackReceipt,'ROLLBACK');
 return doc
}
function stagedAfterBytes(change){
  if(change.op==='delete'){
    if(change.after?.sha256!==null||change.after?.contentBase64!==null||change.after?.size!==0)throw new Error(`CHANGESET_POSTIMAGE_CORRUPT:${change.path}`);
    return null;
  }
  const bytes=decode(change.after?.contentBase64??null);
  if(!Buffer.isBuffer(bytes)||bytes.length!==change.after?.size||sha256Buffer(bytes)!==change.after?.sha256)throw new Error(`CHANGESET_POSTIMAGE_CORRUPT:${change.path}`);
  return bytes;
}
function verifiedReceiptFiles(receipt,kind){
  const files=receipt?.files;
  if(!Array.isArray(files)||receipt?.receiptSha256!==sha256Text(JSON.stringify(files)))throw new Error(`CHANGESET_${kind}_RECEIPT_CORRUPT`);
  return files;
}
function verifiedApplyReceiptFiles(doc){
  const files=verifiedReceiptFiles(doc.applyReceipt,'APPLY');
  if(!Array.isArray(doc.changes)||files.length!==doc.changes.length)throw new Error('CHANGESET_APPLY_RECEIPT_CORRUPT');
  const byPath=new Map();
  for(const file of files){if(!file||typeof file.path!=='string'||byPath.has(file.path))throw new Error('CHANGESET_APPLY_RECEIPT_CORRUPT');byPath.set(file.path,file)}
  for(const change of doc.changes){const file=byPath.get(change.path);const expectedExists=change.op!=='delete';const expectedSha=expectedExists?change.after?.sha256:null;if(!file||file.op!==change.op||file.exists!==expectedExists||file.sha256!==expectedSha)throw new Error('CHANGESET_APPLY_RECEIPT_CORRUPT')}
  return files;
}
function stagedBeforeBytes(change){
  if(change.before?.exists!==true){
    if(change.before?.sha256!==null||change.before?.contentBase64!==null||change.before?.size!==0)throw new Error(`CHANGESET_PREIMAGE_CORRUPT:${change.path}`);
    return null;
  }
  if(change.before?.type!=='file')throw new Error(`CHANGESET_PREIMAGE_CORRUPT:${change.path}`);
  const bytes=decode(change.before?.contentBase64??null);
  if(!Buffer.isBuffer(bytes)||bytes.length!==change.before?.size||sha256Buffer(bytes)!==change.before?.sha256)throw new Error(`CHANGESET_PREIMAGE_CORRUPT:${change.path}`);
  return bytes;
}
function verifiedDurableChangeset(doc){
  verifiedChangesetProtocol(doc);
  let total=0;
  for(const change of doc.changes){
    const beforeBytes=stagedBeforeBytes(change);total+=beforeBytes?.length||0;
    const afterBytes=stagedAfterBytes(change);if(afterBytes&&afterBytes.length>MAX_FILE_BYTES)throw new Error('CHANGE_FILE_TOO_LARGE');total+=afterBytes?.length||0;
    if(total>MAX_TOTAL_BYTES)throw new Error('CHANGESET_TOO_LARGE');
  }
  return doc;
}
export class ChangesetStore{
 constructor(runtimeDir,workspace){this.dir=path.join(runtimeDir,'changesets');fs.mkdirSync(this.dir,{recursive:true});this.workspace=new WorkspaceService(workspace)}
 file(id){if(!/^cs-[a-f0-9]+$/.test(id))throw new Error('INVALID_CHANGESET_ID');return path.join(this.dir,`${id}.json`)}
 get(id){const f=this.file(id);if(!fs.existsSync(f))throw new Error('CHANGESET_NOT_FOUND');const doc=JSON.parse(fs.readFileSync(f,'utf8'));if(doc?.id!==id)throw new Error('CHANGESET_ID_MISMATCH');return verifiedDurableChangeset(doc)}
 stage(runId,changes,{source='agent'}={}){
   if(!Array.isArray(changes)||!changes.length)throw new Error('CHANGES_REQUIRED');if(changes.length>MAX_FILES)throw new Error('TOO_MANY_CHANGES');let total=0;const normalized=[],seenPaths=new Set();
   for(const raw of changes){const op=raw?.op||'write';if(!['write','delete'].includes(op))throw new Error('UNSUPPORTED_CHANGE_OPERATION');const rel=path.posix.normalize(String(raw.path||'').replaceAll('\\','/')).replace(/\/+$/,'');if(!rel||rel==='.'||rel==='..'||rel.startsWith('../')||rel.startsWith('/')||/^[A-Za-z]:/.test(rel))throw new Error('INVALID_CHANGE_PATH');if(blockedChangePath(rel))throw new Error(`BLOCKED_CHANGE_PATH:${rel}`);if(isCredentialLikePath(rel))throw new Error(`CREDENTIAL_CHANGE_PATH:${rel}`);if(seenPaths.has(rel))throw new Error(`DUPLICATE_CHANGE_PATH:${rel}`);const overlap=[...seenPaths].find(existing=>rel.startsWith(`${existing}/`)||existing.startsWith(`${rel}/`));if(overlap)throw new Error(`OVERLAPPING_CHANGE_PATH:${overlap}:${rel}`);seenPaths.add(rel);const ancestor=this.workspace.ancestorState(rel);if(!ancestor.ok)throw new Error(`UNSUPPORTED_CHANGE_ANCESTOR:${rel}:${ancestor.ancestor}`);const before=this.workspace.stat(rel);if(before.exists&&before.type!=='file')throw new Error(`UNSUPPORTED_CHANGE_TARGET:${rel}`);let beforeBytes=null;if(before.exists){beforeBytes=this.workspace.readBytes(rel,MAX_FILE_BYTES);total+=beforeBytes.length;if(total>MAX_TOTAL_BYTES)throw new Error('CHANGESET_TOO_LARGE')}let after=null;if(op==='write'){after=Buffer.from(String(raw.content??''),'utf8');if(after.length>MAX_FILE_BYTES)throw new Error('CHANGE_FILE_TOO_LARGE');total+=after.length;if(total>MAX_TOTAL_BYTES)throw new Error('CHANGESET_TOO_LARGE')}
     if(raw.expectedSha256!==undefined&&raw.expectedSha256!==before.sha256)throw new Error(`PREIMAGE_MISMATCH:${rel}`);
     normalized.push({op,path:rel,before:{exists:before.exists,type:before.type||null,sha256:before.sha256,size:before.size,identity:before.identity||null,mode:before.mode??null,contentBase64:encode(beforeBytes)},after:{sha256:after?sha256Buffer(after):null,size:after?.length||0,contentBase64:encode(after)}})
   }
   const id=changeId(runId,normalized.map(x=>({op:x.op,path:x.path,before:x.before.sha256,after:x.after.sha256})));
   const doc={id,protocol:CHANGESET_PROTOCOL,runId,source,status:'STAGED',createdAt:now(),updatedAt:now(),changes:normalized,applyReceipt:null,rollbackReceipt:null};atomicJson(this.file(id),doc);return doc;
 }
 apply(id){const doc=verifiedChangesetProtocol(this.get(id));if(doc.status!=='STAGED')throw new Error('CHANGESET_NOT_STAGED');if(!Array.isArray(doc.changes)||!doc.changes.length)throw new Error('CHANGES_REQUIRED');if(doc.changes.length>MAX_FILES)throw new Error('TOO_MANY_CHANGES');let total=0;const preflight=[],seenPaths=new Set();
   for(const c of doc.changes){const rel=path.posix.normalize(String(c.path||'').replaceAll('\\','/')).replace(/\/+$/,'');if(!rel||rel==='.'||rel==='..'||rel.startsWith('../')||rel.startsWith('/')||/^[A-Za-z]:/.test(rel)||rel!==c.path)throw new Error('INVALID_CHANGE_PATH');if(seenPaths.has(c.path))throw new Error(`DUPLICATE_CHANGE_PATH:${c.path}`);const overlap=[...seenPaths].find(existing=>c.path.startsWith(`${existing}/`)||existing.startsWith(`${c.path}/`));if(overlap)throw new Error(`OVERLAPPING_CHANGE_PATH:${overlap}:${c.path}`);seenPaths.add(c.path);if(!['write','delete'].includes(c.op))throw new Error('UNSUPPORTED_CHANGE_OPERATION');if(blockedChangePath(c.path))throw new Error(`BLOCKED_CHANGE_PATH:${c.path}`);if(isCredentialLikePath(c.path))throw new Error(`CREDENTIAL_CHANGE_PATH:${c.path}`);const beforeBytes=stagedBeforeBytes(c);total+=beforeBytes?.length||0;const afterBytes=stagedAfterBytes(c);if(afterBytes&&afterBytes.length>MAX_FILE_BYTES)throw new Error('CHANGE_FILE_TOO_LARGE');total+=afterBytes?.length||0;if(total>MAX_TOTAL_BYTES)throw new Error('CHANGESET_TOO_LARGE');const ancestor=this.workspace.ancestorState(c.path);if(!ancestor.ok)throw new Error(`APPLY_CONFLICT:${c.path}`);const current=this.workspace.stat(c.path);const identityChanged=c.before.exists&&c.before.identity&&current.identity!==c.before.identity;const modeChanged=c.before.exists&&c.before.mode!==null&&c.before.mode!==undefined&&current.mode!==c.before.mode;if(current.exists!==c.before.exists||current.sha256!==c.before.sha256||identityChanged||modeChanged)throw new Error(`APPLY_CONFLICT:${c.path}`);preflight.push({change:c,current,afterBytes})}
   const applied=[];for(const {change:c,afterBytes} of preflight){if(c.op==='delete')this.workspace.remove(c.path);else this.workspace.write(c.path,afterBytes);const post=this.workspace.stat(c.path);applied.push({path:c.path,op:c.op,sha256:post.sha256,exists:post.exists,identity:post.identity||null,mode:post.mode??null})}
   doc.status='APPLIED';doc.updatedAt=now();doc.applyReceipt={at:doc.updatedAt,files:applied,receiptSha256:sha256Text(JSON.stringify(applied))};atomicJson(this.file(id),doc);return doc;
 }
 rollback(id){const doc=verifiedChangesetProtocol(this.get(id));if(doc.status!=='APPLIED')throw new Error('CHANGESET_NOT_APPLIED');const appliedFiles=verifiedApplyReceiptFiles(doc);const preflight=[],appliedByPath=new Map(appliedFiles.map(x=>[x.path,x]));
   for(const c of [...doc.changes].reverse()){stagedAfterBytes(c);const beforeBytes=stagedBeforeBytes(c);const ancestor=this.workspace.ancestorState(c.path);if(!ancestor.ok)throw new Error(`ROLLBACK_CONFLICT:${c.path}`);const current=this.workspace.stat(c.path);const applied=appliedByPath.get(c.path);const expectedPost=c.op==='delete'?null:c.after.sha256;const expectedIdentity=applied?.identity||null;const expectedMode=applied?.mode;const modeChanged=expectedMode!==null&&expectedMode!==undefined&&current.mode!==expectedMode;if(current.sha256!==expectedPost||current.exists!==(c.op!=='delete')||(expectedIdentity&&current.identity!==expectedIdentity)||modeChanged)throw new Error(`ROLLBACK_CONFLICT:${c.path}`);preflight.push({change:c,beforeBytes})}
   const restored=[];for(const {change:c,beforeBytes} of preflight){if(!c.before.exists)this.workspace.remove(c.path);else this.workspace.write(c.path,beforeBytes,{mode:c.before.mode??null});const post=this.workspace.stat(c.path);restored.push({path:c.path,exists:post.exists,sha256:post.sha256,identity:post.identity||null,mode:post.mode??null})}
   doc.status='ROLLED_BACK';doc.updatedAt=now();doc.rollbackReceipt={at:doc.updatedAt,files:restored,receiptSha256:sha256Text(JSON.stringify(restored))};atomicJson(this.file(id),doc);return doc;
 }
}
