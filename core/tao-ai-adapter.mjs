import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {normalizeProposal} from './federated-generation.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));

function baseEndpoint(raw){
  const value=String(raw||'').trim();if(!value)return null;
  if(/\/chat\/completions\/?$/.test(value))return value;
  return value.replace(/\/$/,'')+'/v1/chat/completions';
}
function providerConfigs(){
  const explicit=String(process.env.TAO_AI_ENDPOINTS||process.env.DWAC_LANGUAGE_ENDPOINTS||'').split(',').map(x=>x.trim()).filter(Boolean);
  const single=process.env.DWAC_LANGUAGE_ENDPOINT||process.env.TAO_AI_ENDPOINT;
  const endpoints=explicit.length?explicit:[single].filter(Boolean);
  const model=process.env.DWAC_LANGUAGE_MODEL||process.env.TAO_AI_MODEL||'dwac-external-accelerator';
  return endpoints.map((endpoint,index)=>({name:`external-${index+1}`,endpoint:baseEndpoint(endpoint),model})).filter(x=>x.endpoint);
}
function dwacNativeStatus(){
  const root=process.env.TAOWIND_DWAC_ROOT?path.resolve(process.env.TAOWIND_DWAC_ROOT):null;
  const bridge=path.resolve(here,'../bridge/dwac_cognition_bridge.py');
  const natural=root?path.join(root,'natural_conversation_runtime.py'):null;
  const connected=!!root&&fs.existsSync(natural)&&fs.existsSync(bridge);
  return {connected,root,bridge,natural};
}
function extractJson(text){
  const raw=String(text||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  try{return JSON.parse(raw)}catch{}
  const first=raw.indexOf('{'),last=raw.lastIndexOf('}');if(first>=0&&last>first)return JSON.parse(raw.slice(first,last+1));throw new Error('EXTERNAL_AI_INVALID_JSON');
}
export function taoAIStatus(){
  const external=providerConfigs();const native=dwacNativeStatus();
  return {
    connected:native.connected||external.length>0,
    required:false,
    nativeConnected:native.connected,
    acceleratorConnected:external.length>0,
    protocol:native.connected?'dwac-native-cognition':'external-openai-compatible',
    model:process.env.DWAC_LANGUAGE_MODEL||process.env.TAO_AI_MODEL||null,
    endpoint:process.env.DWAC_LANGUAGE_ENDPOINT||process.env.TAO_AI_ENDPOINT||null,
    providerCount:external.length,
    endpoints:external.map(x=>x.endpoint),
    detail:native.connected?(external.length?'DWAC native cognition + external accelerator':'DWAC native cognition; external accelerator optional'):(external.length?'external accelerator only':'DWAC cognition unbound'),
  };
}
function runDwacBridge(mode,payload,{role='implementation'}={}){
  const native=dwacNativeStatus();
  if(!native.connected)throw Object.assign(new Error('DWAC_COGNITION_UNBOUND'),{code:'DWAC_COGNITION_UNBOUND'});
  const args=[native.bridge,'--dwac-root',native.root,'--workspace',String(process.env.TAOWIND_WORKSPACE||process.cwd()),'--mode',mode,'--role',role];
  const r=spawnSync(process.env.PYTHON||'python',args,{encoding:'utf8',input:JSON.stringify(payload),timeout:90_000,maxBuffer:12*1024*1024,shell:false,env:{...process.env}});
  if(r.error)throw Object.assign(new Error(`DWAC_COGNITION_EXECUTION_ERROR:${r.error.message}`),{code:'DWAC_COGNITION_EXECUTION_ERROR'});
  let out=null;try{out=JSON.parse(String(r.stdout||'').trim())}catch{}
  if(!out)throw Object.assign(new Error(String(r.stderr||'DWAC cognition bridge returned invalid JSON').slice(-4000)),{code:'DWAC_COGNITION_INVALID_RESPONSE'});
  if(r.status!==0||out.status==='ERROR'||out.status==='UNBOUND')throw Object.assign(new Error(out.error||`DWAC cognition bridge failed (${r.status})`),{code:out.error||'DWAC_COGNITION_FAILED',detail:out});
  return out;
}
async function chat(provider,messages,{temperature=0.1}={}){
  if(!provider?.endpoint)throw Object.assign(new Error('EXTERNAL_AI_UNBOUND'),{code:'EXTERNAL_AI_UNBOUND'});
  const headers={'content-type':'application/json'};const key=process.env.DWAC_LANGUAGE_API_KEY||process.env.TAO_AI_API_KEY;if(key)headers.authorization=`Bearer ${key}`;
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),120_000);
  try{const r=await fetch(provider.endpoint,{method:'POST',headers,body:JSON.stringify({model:provider.model,messages,temperature,response_format:{type:'json_object'}}),signal:controller.signal});const body=await r.text();if(!r.ok)throw new Error(`EXTERNAL_AI_HTTP_${r.status}:${body.slice(0,500)}`);const data=JSON.parse(body);const content=data?.choices?.[0]?.message?.content??data?.content??data?.output_text;if(!content)throw new Error('EXTERNAL_AI_EMPTY_RESPONSE');return extractJson(content)}finally{clearTimeout(timer)}
}
const ROLE_PROMPTS={
 architecture:'Prioritize architecture coherence, dependency boundaries, backward compatibility and the smallest complete system change.',
 implementation:'Prioritize executable multi-file implementation, exact repository fit, tests and realistic validation commands.',
 verifier:'Act adversarially: prefer changes that are easy to validate, rollback and falsify; surface hidden regressions and missing tests.',
};
function systemPrompt(role){return `You are an optional language/code accelerator inside DWAC, not Taowind Code's primary brain. ${ROLE_PROMPTS[role]||ROLE_PROMPTS.implementation} Return JSON only. Produce a bounded candidate changeset for the user's repository. Never claim execution. Do not touch secrets, .git, node_modules, build outputs, lockfiles unless necessary, or files outside the workspace. Schema: {"summary":string,"changes":[{"op":"write"|"delete","path":string,"content"?:string,"expectedSha256"?:string}],"validation_commands":[string],"browser_checks"?: [{"url":string,"requiredSelectors"?:string[],"requiredText"?:string[],"titleIncludes"?:string,"urlIncludes"?:string,"forbidConsoleErrors"?:boolean,"forbidPageExceptions"?:boolean,"forbidCriticalNetworkErrors"?:boolean,"screenshot"?:boolean}],"risks":[string],"needs_more_context"?:string[]}. For UI/web/frontend/browser-facing goals, browser_checks are hard evidence. Do not invent successful observations. If context is insufficient, set changes=[] and list needs_more_context.`}

const NATIVE_CANDIDATE_ROLES=Object.freeze(['implementation','architecture','verifier']);
export function nativeProposalExecutable(proposal){
  const normalized=normalizeProposal(proposal,{provider:'dwac-native',role:'implementation'});
  return !!(normalized.changes.length&&normalized.validation_commands.length&&!normalized.validation_overflow&&!normalized.invalid_browser_check_count&&!normalized.browser_check_overflow&&!normalized.ambiguous_paths.length);
}
export function nativeFallbackRoles(firstProposal,{configuredCount=null}={}){
  const raw=String(configuredCount??'').trim();
  if(raw){
    const count=Math.max(1,Math.min(NATIVE_CANDIDATE_ROLES.length,Number(raw)||1));
    return NATIVE_CANDIDATE_ROLES.slice(1,count);
  }
  return nativeProposalExecutable(firstProposal)?[]:NATIVE_CANDIDATE_ROLES.slice(1);
}
function nativeCandidateResult(role,payload){
  try{
    const out=runDwacBridge('changeset',payload,{role});
    return {provider:'dwac-native',role,proposal:out.proposal,native:{status:out.status,route:out.route,interaction_class:out.interaction_class,accelerator:out.accelerator}};
  }catch(error){
    return {provider:'dwac-native',role,error:String(error?.message||error),proposal:{summary:'DWAC native synthesis failed',changes:[],validation_commands:[],browser_checks:[],risks:[String(error?.message||error)],needs_more_context:[]}};
  }
}
export async function requestChangesetCandidates({goal,dwac,repository,files}){
  const results=[];const native=dwacNativeStatus();const external=providerConfigs();
  const payload={goal,dwac,repository,files,browserEvidence:{cdpConfigured:!!process.env.TAO_BROWSER_CDP_URL,defaultPreviewUrl:process.env.TAOWIND_PREVIEW_URL||null}};
  if(native.connected){
    const first=nativeCandidateResult('implementation',payload);results.push(first);
    const fallback=nativeFallbackRoles(first.proposal,{configuredCount:process.env.DWAC_NATIVE_CANDIDATE_COUNT});
    for(const role of fallback)results.push(nativeCandidateResult(role,payload));
  }
  if(external.length){
    const roles=['architecture','implementation','verifier'];const requested=Math.max(1,Math.min(9,Number(process.env.TAO_AI_CANDIDATE_COUNT||3)||3));
    const jobs=Array.from({length:requested},(_,i)=>({provider:external[i%external.length],role:roles[i%roles.length],index:i}));
    const user=JSON.stringify(payload);
    const settled=await Promise.allSettled(jobs.map(async job=>({provider:job.provider.name,role:job.role,proposal:await chat(job.provider,[{role:'system',content:systemPrompt(job.role)},{role:'user',content:user}],{temperature:job.role==='verifier'?0.05:0.15})})));
    for(let i=0;i<settled.length;i++){const item=settled[i],job=jobs[i];if(item.status==='fulfilled')results.push(item.value);else results.push({provider:job.provider.name,role:job.role,error:String(item.reason?.message||item.reason),proposal:{summary:'external accelerator failed',changes:[],validation_commands:[],browser_checks:[],risks:[String(item.reason?.message||item.reason)],needs_more_context:[]}})}
  }
  if(!results.length)throw Object.assign(new Error('DWAC_COGNITION_UNBOUND'),{code:'DWAC_COGNITION_UNBOUND'});
  return results;
}
export async function requestChangeset(input){const out=await requestChangesetCandidates(input);const first=out.find(x=>Array.isArray(x.proposal?.changes)&&x.proposal.changes.length)||out[0];return first?.proposal||{summary:'no cognition result',changes:[],validation_commands:[],browser_checks:[],risks:['NO_COGNITION_RESULT']}}

const CLOSURE_ROLES={
  evidence:'Judge only from hard validation, delivery evidence and repository observations. Missing evidence means not closed.',
  regression:'Search for regressions, untested paths, hidden blockers and false-completion risk. Prefer not closed when uncertain.',
  product:'Judge whether the user-visible result goal is actually achieved rather than whether code merely changed.',
};
function closureSystemPrompt(role){return `You are an optional closure auditor inside DWAC. ${CLOSURE_ROLES[role]} Return JSON only. Never treat plans, generated text, diffs, or model confidence as execution evidence. Schema: {"closed":boolean,"confidence":number,"reason":string,"gaps":[{"id":string,"problem":string,"severity":number,"evidence"?:string[]}],"next_goal":string,"recommended_mode":"WHOLE_ARTIFACT"|"DEEP_DEVELOPMENT"}.`}
function normalizeAssessment(value,provider,role){
  const gaps=Array.isArray(value?.gaps)?value.gaps.slice(0,24).map((g,i)=>({id:String(g?.id||`gap-${i+1}`),problem:String(g?.problem||'unspecified gap'),severity:Math.max(0,Math.min(1,Number(g?.severity)||0)),evidence:Array.isArray(g?.evidence)?g.evidence.map(String).slice(0,12):[]})):[];
  return {provider,role,closed:value?.closed===true,confidence:Math.max(0,Math.min(1,Number(value?.confidence)||0)),reason:String(value?.reason||''),gaps,next_goal:String(value?.next_goal||''),recommended_mode:value?.recommended_mode==='DEEP_DEVELOPMENT'?'DEEP_DEVELOPMENT':'WHOLE_ARTIFACT'};
}
async function externalGoalAssessment(input,providers){
  const roles=Object.keys(CLOSURE_ROLES);const jobs=roles.map((role,i)=>({provider:providers[i%providers.length],role}));const payload=JSON.stringify(input);
  const settled=await Promise.allSettled(jobs.map(async job=>normalizeAssessment(await chat(job.provider,[{role:'system',content:closureSystemPrompt(job.role)},{role:'user',content:payload}],{temperature:0.02}),job.provider.name,job.role)));
  const votes=settled.filter(x=>x.status==='fulfilled').map(x=>x.value);if(votes.length<2)throw Object.assign(new Error('GOAL_ASSESSMENT_QUORUM_UNAVAILABLE'),{code:'GOAL_ASSESSMENT_QUORUM_UNAVAILABLE'});
  const minConfidence=Math.min(...votes.map(x=>x.confidence));const closed=votes.every(x=>x.closed&&x.confidence>=0.75);const gapMap=new Map();for(const vote of votes)for(const gap of vote.gaps){const current=gapMap.get(gap.id);if(!current||gap.severity>current.severity)gapMap.set(gap.id,gap)}
  const gaps=[...gapMap.values()].sort((a,b)=>b.severity-a.severity);const continuation=votes.filter(x=>!x.closed).sort((a,b)=>b.confidence-a.confidence)[0]||votes[0];
  return {protocol:'taowind-code.external-closure-federation.v0.1',closed,confidence:minConfidence,reason:closed?'external auditors unanimously accepted hard-gate evidence':continuation.reason||'closure quorum rejected completion',gaps,next_goal:continuation.next_goal||gaps[0]?.problem||String(input?.rootGoal||''),recommended_mode:continuation.recommended_mode,votes};
}
export async function requestGoalAssessment(input){
  const native=dwacNativeStatus();
  if(native.connected){
    const out=runDwacBridge('closure',input,{role:'hard-evidence'});
    return {...out,provider:'dwac-native',externalAcceleratorOptional:providerConfigs().length>0};
  }
  const providers=providerConfigs();if(providers.length)return await externalGoalAssessment(input,providers);
  throw Object.assign(new Error('DWAC_COGNITION_UNBOUND'),{code:'DWAC_COGNITION_UNBOUND'});
}
