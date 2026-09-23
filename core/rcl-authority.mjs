import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';

const RECEIPT_PROTOCOL='taowind-code.rcl-authority-receipt.v0.1';
const ACTIONS=Object.freeze({
  workspace_write:'authorize_workspace_write',
  shell_execute:'authorize_shell_execute',
  changeset_apply:'authorize_changeset_apply',
  changeset_rollback:'authorize_changeset_rollback',
  validation_execute:'authorize_validation_execute',
  git_commit:'authorize_git_commit',
  mission_advance:'authorize_mission_advance',
  external_side_effect:'authorize_external_side_effect',
});
const MODES=Object.freeze({
  read_only:{workspace_write:false,shell_execute:false,changeset_apply:false,validation_execute:false,git_delivery:false,mission_advance:true},
  workspace:{workspace_write:true,shell_execute:true,changeset_apply:true,validation_execute:true,git_delivery:false,mission_advance:true},
  full_access:{workspace_write:true,shell_execute:true,changeset_apply:true,validation_execute:true,git_delivery:true,mission_advance:true},
});
const AUTHORITY_RECEIPT_ID_RE=/^auth-[a-z0-9]+-[a-f0-9]{10}$/;
const ISO_DATE_TIME_RE=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const SHA256_RE=/^[a-f0-9]{64}$/;
const AUTHORITY_CONTEXT_FIELDS=Object.freeze(['workspace_write','shell_execute','changeset_apply','validation_execute','git_delivery','mission_advance','workspace_boundary','explicit_approval']);
const RCL_RESULT_FIELDS=Object.freeze(['stateRoot','rule','actor','authority','witnesses','historyLength']);
function now(){return new Date().toISOString()}
function validDateTime(value){if(typeof value!=='string'||!ISO_DATE_TIME_RE.test(value))return false;try{return new Date(value).toISOString()===value}catch{return false}}
function validSha256OrNull(value){return value===null||(typeof value==='string'&&SHA256_RE.test(value))}
function validSha256OrAbsentOrNull(value){return value===undefined||validSha256OrNull(value)}
function sha256(value){return crypto.createHash('sha256').update(value).digest('hex')}
function atomicJson(file,value){fs.mkdirSync(path.dirname(file),{recursive:true});const tmp=`${file}.${process.pid}.tmp`;fs.writeFileSync(tmp,JSON.stringify(value,null,2));fs.renameSync(tmp,file)}
function escapeRe(value){return String(value).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}
function objectOrNull(value){return value===null||value===undefined||(typeof value==='object'&&!Array.isArray(value))}
function validAuthorityContext(value){if(value===null)return true;if(!value||typeof value!=='object'||Array.isArray(value))return false;return AUTHORITY_CONTEXT_FIELDS.every(field=>typeof value[field]==='boolean')}
function validAuthorityContextForMode(value,mode){if(!validAuthorityContext(value))return false;if(value===null)return true;const expected=MODES[mode];return !!expected&&Object.entries(expected).every(([field,enabled])=>value[field]===enabled)}
function validRclPayload(value){
  if(value===null)return false;if(!value||typeof value!=='object'||Array.isArray(value))return false;
  if(Object.prototype.hasOwnProperty.call(value,'error'))return typeof value.error==='string'&&value.error.length>0&&typeof value.message==='string';
  if(!RCL_RESULT_FIELDS.every(field=>Object.prototype.hasOwnProperty.call(value,field)))return false;
  return Array.isArray(value.witnesses)&&Number.isInteger(value.historyLength)&&value.historyLength>=0;
}
function validAuthorityReceipt(receipt){
  if(!receipt||typeof receipt!=='object'||Array.isArray(receipt))return false;
  if(typeof receipt.id!=='string'||!AUTHORITY_RECEIPT_ID_RE.test(receipt.id))return false;
  if(receipt.protocol!==RECEIPT_PROTOCOL||!validDateTime(receipt.at))return false;
  if(typeof receipt.requestId!=='string'||receipt.requestId.length===0||!Object.prototype.hasOwnProperty.call(ACTIONS,receipt.action)||!Object.prototype.hasOwnProperty.call(MODES,receipt.approvalMode))return false;
  for(const field of ['workspace','materializedDigest','context','rcl','metadata'])if(!Object.prototype.hasOwnProperty.call(receipt,field))return false;
  if(receipt.workspace!==null&&typeof receipt.workspace!=='string')return false;
  if(typeof receipt.allowed!=='boolean'||typeof receipt.reason!=='string'||receipt.reason.length===0)return false;
  if(receipt.allowed&&receipt.reason!=='RCL_AUTHORITY_GRANTED')return false;
  if(!validSha256OrNull(receipt.policyDigest))return false;
  if(!validSha256OrNull(receipt.materializedDigest))return false;
  if(!validAuthorityContextForMode(receipt.context,receipt.approvalMode)||!validRclPayload(receipt.rcl))return false;
  if(Object.prototype.hasOwnProperty.call(receipt.rcl,'error')&&receipt.reason!==receipt.rcl.error)return false;
  if(!Object.prototype.hasOwnProperty.call(receipt.rcl,'error')&&receipt.context===null)return false;
  if(!Object.prototype.hasOwnProperty.call(receipt.rcl,'error')&&receipt.policyDigest===null)return false;
  if(!Object.prototype.hasOwnProperty.call(receipt.rcl,'error')&&receipt.materializedDigest===null)return false;
  if(!Object.prototype.hasOwnProperty.call(receipt.rcl,'error')&&receipt.allowed===false&&receipt.reason!=='RCL_TRANSITION_NOT_REALIZED')return false;
  if(receipt.rcl&&Object.prototype.hasOwnProperty.call(receipt.rcl,'error')&&receipt.allowed!==false)return false;
  if(receipt.allowed&&(receipt.rcl===null||Object.prototype.hasOwnProperty.call(receipt.rcl,'error')))return false;
  if(receipt.allowed&&receipt.rcl.rule!==ACTIONS[receipt.action])return false;
  if(receipt.allowed&&(!receipt.rcl.authority||typeof receipt.rcl.authority!=='object'||Array.isArray(receipt.rcl.authority)||!Array.isArray(receipt.rcl.authority.needs)||receipt.rcl.authority.needs.length===0))return false;
  if(receipt.allowed&&receipt.rcl.historyLength<1)return false;
  if(receipt.metadata!==undefined&&(typeof receipt.metadata!=='object'||receipt.metadata===null||Array.isArray(receipt.metadata)))return false;
  return true;
}
export function authorityContextForMode(mode='workspace',{workspaceBoundary=true,explicitApproval=false}={}){
  const base=MODES[mode];if(!base)throw Object.assign(new Error('INVALID_APPROVAL_MODE'),{code:'INVALID_APPROVAL_MODE'});
  return {...base,workspace_boundary:workspaceBoundary===true,explicit_approval:explicitApproval===true};
}
export function materializeAuthorityPolicy(source,context,action){
  const rule=ACTIONS[action];if(!rule)throw Object.assign(new Error(`UNKNOWN_AUTHORITY_ACTION:${action}`),{code:'UNKNOWN_AUTHORITY_ACTION'});
  const values={
    'workspace.boundary':context.workspace_boundary,
    'authority.workspace_write':context.workspace_write,
    'authority.shell_execute':context.shell_execute,
    'authority.changeset_apply':context.changeset_apply,
    'authority.validation_execute':context.validation_execute,
    'authority.git_delivery':context.git_delivery,
    'authority.mission_advance':context.mission_advance,
    'action.explicit_approval':context.explicit_approval,
  };
  let out=String(source);
  for(const [facet,value] of Object.entries(values)){
    const re=new RegExp(`(facet\\s+${escapeRe(facet)}\\s*:\\s*Truth\\s*=\\s*)(true|false)`);
    if(!re.test(out))throw Object.assign(new Error(`RCL_POLICY_FACET_MISSING:${facet}`),{code:'RCL_POLICY_INVALID'});
    out=out.replace(re,`$1${value?'true':'false'}`);
  }
  const end=out.lastIndexOf('}');if(end<0)throw Object.assign(new Error('RCL_POLICY_ROOT_MISSING'),{code:'RCL_POLICY_INVALID'});
  return `${out.slice(0,end).trimEnd()}\n\n  realize ${rule}\n${out.slice(end)}`;
}

export class RclAuthorityGate{
  constructor({policyPath,runtimeDir,rclRoot=process.env.TAOWIND_RCL_ROOT,runtimeLoader=null}={}){
    this.policyPath=path.resolve(policyPath||'contracts/approval-policy.rcl');this.rclRoot=rclRoot?path.resolve(rclRoot):null;this.dir=path.join(path.resolve(runtimeDir||'runtime-data'),'authority-receipts');fs.mkdirSync(this.dir,{recursive:true});this.runtimeLoader=runtimeLoader;this.runtimePromise=null;
  }
  _policy(){if(!fs.existsSync(this.policyPath))throw Object.assign(new Error('RCL_POLICY_NOT_FOUND'),{code:'RCL_POLICY_NOT_FOUND'});return fs.readFileSync(this.policyPath,'utf8')}
  _runtimeEntry(){return this.rclRoot?path.join(this.rclRoot,'src','index.mjs'):null}
  status(){
    let policyDigest=null,policyValid=false;try{policyDigest=sha256(this._policy());policyValid=true}catch{}
    const entry=this._runtimeEntry();return {name:'RCL Authority',connected:!!entry&&fs.existsSync(entry)&&policyValid,rclRoot:this.rclRoot,policyPath:this.policyPath,policyDigest,policyValid,mode:'executable-authority-gate'};
  }
  async _runtime(){
    if(this.runtimeLoader)return await this.runtimeLoader();if(this.runtimePromise)return this.runtimePromise;
    const entry=this._runtimeEntry();if(!entry||!fs.existsSync(entry))throw Object.assign(new Error('RCL_RUNTIME_UNBOUND'),{code:'RCL_RUNTIME_UNBOUND'});
    this.runtimePromise=import(pathToFileURL(entry).href).then(mod=>{if(typeof mod.runReality!=='function')throw Object.assign(new Error('RCL_RUN_REALITY_MISSING'),{code:'RCL_RUNTIME_INVALID'});return mod});return this.runtimePromise;
  }
  _receiptFile(id){return path.join(this.dir,`${id}.json`)}
  _record(receipt){if(!validAuthorityReceipt(receipt))throw Object.assign(new Error('INVALID_AUTHORITY_RECEIPT'),{code:'INVALID_AUTHORITY_RECEIPT'});atomicJson(this._receiptFile(receipt.id),receipt);return receipt}
  async decide(action,{approvalMode='workspace',workspaceBoundary=true,explicitApproval=false,requestId=null,workspace=null,metadata={}}={}){
    const id=`auth-${Date.now().toString(36)}-${crypto.randomBytes(5).toString('hex')}`;const at=now();let policy='';let policyDigest=null,context=null,materialized=null;
    const base={id,protocol:RECEIPT_PROTOCOL,at,requestId:requestId||id,action,approvalMode,workspace,metadata,allowed:false,reason:null,policyDigest:null,materializedDigest:null,rcl:null};
    try{
      policy=this._policy();policyDigest=sha256(policy);context=authorityContextForMode(approvalMode,{workspaceBoundary,explicitApproval});materialized=materializeAuthorityPolicy(policy,context,action);const runtime=await this._runtime();const result=await runtime.runReality(materialized);const transition=result.history?.at(-1);const expected=ACTIONS[action];
      const allowed=transition?.status==='realized'&&transition?.rule===expected&&transition?.authority?.needs?.length>0;
      return this._record({...base,allowed,reason:allowed?'RCL_AUTHORITY_GRANTED':'RCL_TRANSITION_NOT_REALIZED',policyDigest,materializedDigest:sha256(materialized),context,rcl:{stateRoot:result.stateRoot||null,rule:transition?.rule||null,actor:transition?.actor||null,authority:transition?.authority||null,witnesses:transition?.witnesses||[],historyLength:result.history?.length||0}});
    }catch(error){
      const code=error?.code||String(error?.message||'RCL_AUTHORITY_ERROR').split(':')[0];return this._record({...base,allowed:false,reason:code,policyDigest,materializedDigest:materialized?sha256(materialized):null,context,rcl:{error:code,message:String(error?.message||error)}});
    }
  }
  async assert(action,context={}){
    const receipt=await this.decide(action,context);if(receipt.allowed)return receipt;const error=Object.assign(new Error(`RCL authority denied ${action}: ${receipt.reason}`),{code:receipt.reason==='RCL_RUNTIME_UNBOUND'?'RCL_RUNTIME_UNBOUND':'RCL_AUTHORITY_DENIED',receipt});throw error;
  }
}

export {ACTIONS as RCL_AUTHORITY_ACTIONS};
