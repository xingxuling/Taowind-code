import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const RUN_PROTOCOL='taowind-code.north-star-run.v0.2';
const TERMINAL=new Set(['DELIVERED_LOCAL','ROLLED_BACK','FAILED']);
const MODES=new Set(['NORTH_STAR','NORTH_STAR_BURST','WHOLE_ARTIFACT','DEEP_DEVELOPMENT']);
const VALID=new Set(['OBSERVING','PLANNED','WAITING_PROVIDER','CHANGESET_STAGED','CHANGES_APPLIED','VALIDATING','REPAIR_REQUIRED','READY_FOR_DELIVERY','DELIVERED_LOCAL','ROLLED_BACK','FAILED']);
function now(){return new Date().toISOString()}
function id(){return `run-${Date.now().toString(36)}-${crypto.randomBytes(5).toString('hex')}`}
function atomicJson(file,value){fs.mkdirSync(path.dirname(file),{recursive:true});const tmp=`${file}.${process.pid}.tmp`;fs.writeFileSync(tmp,JSON.stringify(value,null,2));fs.renameSync(tmp,file)}
function validChangesetLedger(value){return Array.isArray(value)&&value.every(item=>typeof item==='string')}

export class RunStore{
  constructor(dir){this.dir=path.join(dir,'runs');fs.mkdirSync(this.dir,{recursive:true})}
  file(runId){if(!/^run-[a-z0-9-]+$/i.test(runId))throw new Error('INVALID_RUN_ID');return path.join(this.dir,`${runId}.json`)}
  create({goal,mode='WHOLE_ARTIFACT',dwac=null,tasks=[]}={}){
    const run={id:id(),protocol:RUN_PROTOCOL,goal:String(goal||'').trim(),status:'OBSERVING',mode,cycle:1,createdAt:now(),updatedAt:now(),dwac,tasks,evidence:[],events:[],changesets:[],validation:null,delivery:null,blocker:null,message:null};
    if(!run.goal)throw new Error('GOAL_REQUIRED');if(!MODES.has(run.mode))throw new Error('INVALID_RUN_MODE');this.eventObject(run,'RUN_CREATED',{mode});atomicJson(this.file(run.id),run);return run;
  }
  get(runId){const file=this.file(runId);if(!fs.existsSync(file))throw Object.assign(new Error('RUN_NOT_FOUND'),{code:'RUN_NOT_FOUND'});const run=JSON.parse(fs.readFileSync(file,'utf8'));if(run?.id!==runId)throw new Error('RUN_ID_MISMATCH');if(run?.protocol!==RUN_PROTOCOL)throw new Error('UNSUPPORTED_RUN_PROTOCOL');if(!MODES.has(run?.mode))throw new Error('INVALID_RUN_MODE');if(!VALID.has(run?.status))throw new Error('INVALID_RUN_STATUS');if(typeof run?.goal!=='string'||!run.goal.trim())throw new Error('INVALID_RUN_GOAL');if(!Number.isInteger(run?.cycle)||run.cycle<1)throw new Error('INVALID_RUN_CYCLE');if(!Array.isArray(run?.events)||!Array.isArray(run?.evidence)||!validChangesetLedger(run?.changesets))throw new Error('INVALID_RUN_LEDGER');return run}
  list(limit=30){return fs.readdirSync(this.dir).filter(x=>x.endsWith('.json')).map(x=>this.get(x.slice(0,-5))).sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt))).slice(0,limit)}
  eventObject(run,type,data={}){const event={seq:run.events.length+1,at:now(),type,data};run.events.push(event);run.updatedAt=event.at;return event}
  update(runId,patch={},eventType='RUN_UPDATED',eventData={}){const run=this.get(runId);if(Object.prototype.hasOwnProperty.call(patch,'id')&&patch.id!==run.id)throw new Error('RUN_ID_IMMUTABLE');if(Object.prototype.hasOwnProperty.call(patch,'protocol')&&patch.protocol!==RUN_PROTOCOL)throw new Error('RUN_PROTOCOL_IMMUTABLE');if(TERMINAL.has(run.status)&&Object.prototype.hasOwnProperty.call(patch,'status')&&patch.status!==run.status)throw new Error('RUN_TERMINAL');if(Object.prototype.hasOwnProperty.call(patch,'status')&&!VALID.has(patch.status))throw new Error('INVALID_RUN_STATUS');if(Object.prototype.hasOwnProperty.call(patch,'mode')&&!MODES.has(patch.mode))throw new Error('INVALID_RUN_MODE');if(Object.prototype.hasOwnProperty.call(patch,'goal')&&(typeof patch.goal!=='string'||!patch.goal.trim()))throw new Error('INVALID_RUN_GOAL');if(Object.prototype.hasOwnProperty.call(patch,'cycle')&&(!Number.isInteger(patch.cycle)||patch.cycle<1))throw new Error('INVALID_RUN_CYCLE');for(const field of ['events','evidence'])if(Object.prototype.hasOwnProperty.call(patch,field)&&!Array.isArray(patch[field]))throw new Error('INVALID_RUN_LEDGER');if(Object.prototype.hasOwnProperty.call(patch,'changesets')&&!validChangesetLedger(patch.changesets))throw new Error('INVALID_RUN_LEDGER');Object.assign(run,patch);this.eventObject(run,eventType,eventData);atomicJson(this.file(runId),run);return run}
  addEvidence(runId,evidence){const run=this.get(runId);const item={...evidence,id:`ev-${crypto.randomBytes(6).toString('hex')}`,at:now()};run.evidence.push(item);this.eventObject(run,'EVIDENCE_ADDED',{evidenceId:item.id,kind:item.kind||'generic'});atomicJson(this.file(runId),run);return run}
}
