function baseEndpoint(raw){
  const value=String(raw||'').trim();if(!value)return null;
  if(/\/chat\/completions\/?$/.test(value))return value;
  return value.replace(/\/$/,'')+'/v1/chat/completions';
}
function providerConfigs(){
  const explicit=String(process.env.TAO_AI_ENDPOINTS||'').split(',').map(x=>x.trim()).filter(Boolean);
  const endpoints=explicit.length?explicit:[process.env.TAO_AI_ENDPOINT].filter(Boolean);
  return endpoints.map((endpoint,index)=>({name:`tao-${index+1}`,endpoint:baseEndpoint(endpoint),model:process.env.TAO_AI_MODEL||'tao-ai'})).filter(x=>x.endpoint);
}
function extractJson(text){
  const raw=String(text||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  try{return JSON.parse(raw)}catch{}
  const first=raw.indexOf('{'),last=raw.lastIndexOf('}');if(first>=0&&last>first)return JSON.parse(raw.slice(first,last+1));throw new Error('TAO_AI_INVALID_JSON');
}
export function taoAIStatus(){const providers=providerConfigs();return {connected:providers.length>0,protocol:process.env.TAO_AI_PROTOCOL||'openai-compatible',model:process.env.TAO_AI_MODEL||null,endpoint:process.env.TAO_AI_ENDPOINT||null,providerCount:providers.length,endpoints:providers.map(x=>x.endpoint)}}
async function chat(provider,messages,{temperature=0.1}={}){
  if(!provider?.endpoint)throw Object.assign(new Error('TAO_AI_UNBOUND'),{code:'TAO_AI_UNBOUND'});
  const headers={'content-type':'application/json'};if(process.env.TAO_AI_API_KEY)headers.authorization=`Bearer ${process.env.TAO_AI_API_KEY}`;
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),120_000);
  try{const r=await fetch(provider.endpoint,{method:'POST',headers,body:JSON.stringify({model:provider.model,messages,temperature,response_format:{type:'json_object'}}),signal:controller.signal});const body=await r.text();if(!r.ok)throw new Error(`TAO_AI_HTTP_${r.status}:${body.slice(0,500)}`);const data=JSON.parse(body);const content=data?.choices?.[0]?.message?.content??data?.content??data?.output_text;if(!content)throw new Error('TAO_AI_EMPTY_RESPONSE');return extractJson(content)}finally{clearTimeout(timer)}
}
const ROLE_PROMPTS={
 architecture:'Prioritize architecture coherence, dependency boundaries, backward compatibility and the smallest complete system change.',
 implementation:'Prioritize executable multi-file implementation, exact repository fit, tests and realistic validation commands.',
 verifier:'Act adversarially: prefer changes that are easy to validate, rollback and falsify; surface hidden regressions and missing tests.',
};
function systemPrompt(role){return `You are Tao AI inside Taowind Code, participating in a DWAC multi-civilization candidate competition. ${ROLE_PROMPTS[role]||ROLE_PROMPTS.implementation} Return JSON only. Produce a bounded candidate changeset for the user's repository. Never claim execution. Do not touch secrets, .git, node_modules, build outputs, lockfiles unless necessary, or files outside the workspace. Schema: {"summary":string,"changes":[{"op":"write"|"delete","path":string,"content"?:string,"expectedSha256"?:string}],"validation_commands":[string],"browser_checks"?: [{"url":string,"requiredSelectors"?:string[],"requiredText"?:string[],"titleIncludes"?:string,"urlIncludes"?:string,"forbidConsoleErrors"?:boolean,"forbidPageExceptions"?:boolean,"forbidCriticalNetworkErrors"?:boolean,"screenshot"?:boolean}],"risks":[string],"needs_more_context"?:string[]}. For UI/web/frontend/browser-facing goals, browser_checks are not optional evidence: point them at the actual preview URL if known, and require the important visible selectors/text plus no console/page/critical-network failures. Do not invent successful observations. Prefer coherent changes that close the goal rather than cosmetic edits. If context is insufficient, set changes=[] and list needs_more_context.`}
export async function requestChangesetCandidates({goal,dwac,repository,files}){
  const providers=providerConfigs();if(!providers.length)throw Object.assign(new Error('TAO_AI_UNBOUND'),{code:'TAO_AI_UNBOUND'});
  const roles=['architecture','implementation','verifier'];const requested=Math.max(1,Math.min(9,Number(process.env.TAO_AI_CANDIDATE_COUNT||3)||3));
  const jobs=Array.from({length:requested},(_,i)=>({provider:providers[i%providers.length],role:roles[i%roles.length],index:i}));
  const user=JSON.stringify({goal,dwac,repository,files,browserEvidence:{cdpConfigured:!!process.env.TAO_BROWSER_CDP_URL,defaultPreviewUrl:process.env.TAOWIND_PREVIEW_URL||null}});
  const settled=await Promise.allSettled(jobs.map(async job=>({provider:job.provider.name,role:job.role,proposal:await chat(job.provider,[{role:'system',content:systemPrompt(job.role)},{role:'user',content:user}],{temperature:job.role==='verifier'?0.05:0.15})})));
  const results=[];for(let i=0;i<settled.length;i++){const item=settled[i],job=jobs[i];if(item.status==='fulfilled')results.push(item.value);else results.push({provider:job.provider.name,role:job.role,error:String(item.reason?.message||item.reason),proposal:{summary:'provider failed',changes:[],validation_commands:[],browser_checks:[],risks:[String(item.reason?.message||item.reason)]}})}return results;
}
export async function requestChangeset(input){const out=await requestChangesetCandidates(input);const first=out.find(x=>Array.isArray(x.proposal?.changes)&&x.proposal.changes.length)||out[0];return first?.proposal||{summary:'no provider result',changes:[],validation_commands:[],browser_checks:[],risks:['NO_PROVIDER_RESULT']}}

const CLOSURE_ROLES={
  evidence:'Judge only from hard validation, delivery evidence and repository observations. Missing evidence means not closed.',
  regression:'Search for regressions, untested paths, hidden blockers and false-completion risk. Prefer not closed when uncertain.',
  product:'Judge whether the user-visible result goal is actually achieved rather than whether code merely changed.',
};
function closureSystemPrompt(role){return `You are a conservative North Star goal-closure auditor inside Taowind Code. ${CLOSURE_ROLES[role]} Return JSON only. Never treat plans, generated text, diffs, or model confidence as execution evidence. Schema: {"closed":boolean,"confidence":number,"reason":string,"gaps":[{"id":string,"problem":string,"severity":number,"evidence"?:string[]}],"next_goal":string,"recommended_mode":"WHOLE_ARTIFACT"|"DEEP_DEVELOPMENT"}. closed=true requires the supplied hard gates to pass and no material gap to remain. For UI/web goals, browser observation evidence is a hard gate and screenshots alone do not compensate for console/network/DOM failures.`}
function normalizeAssessment(value,provider,role){
  const gaps=Array.isArray(value?.gaps)?value.gaps.slice(0,24).map((g,i)=>({id:String(g?.id||`gap-${i+1}`),problem:String(g?.problem||'unspecified gap'),severity:Math.max(0,Math.min(1,Number(g?.severity)||0)),evidence:Array.isArray(g?.evidence)?g.evidence.map(String).slice(0,12):[]})):[];
  return {provider,role,closed:value?.closed===true,confidence:Math.max(0,Math.min(1,Number(value?.confidence)||0)),reason:String(value?.reason||''),gaps,next_goal:String(value?.next_goal||''),recommended_mode:value?.recommended_mode==='DEEP_DEVELOPMENT'?'DEEP_DEVELOPMENT':'WHOLE_ARTIFACT'};
}
export async function requestGoalAssessment(input){
  const providers=providerConfigs();if(!providers.length)throw Object.assign(new Error('TAO_AI_UNBOUND'),{code:'TAO_AI_UNBOUND'});
  const roles=Object.keys(CLOSURE_ROLES);const jobs=roles.map((role,i)=>({provider:providers[i%providers.length],role}));const payload=JSON.stringify(input);
  const settled=await Promise.allSettled(jobs.map(async job=>normalizeAssessment(await chat(job.provider,[{role:'system',content:closureSystemPrompt(job.role)},{role:'user',content:payload}],{temperature:0.02}),job.provider.name,job.role)));
  const votes=settled.filter(x=>x.status==='fulfilled').map(x=>x.value);if(votes.length<2)throw Object.assign(new Error('GOAL_ASSESSMENT_QUORUM_UNAVAILABLE'),{code:'GOAL_ASSESSMENT_QUORUM_UNAVAILABLE'});
  const minConfidence=Math.min(...votes.map(x=>x.confidence));const closed=votes.every(x=>x.closed&&x.confidence>=0.75);const gapMap=new Map();
  for(const vote of votes)for(const gap of vote.gaps){const current=gapMap.get(gap.id);if(!current||gap.severity>current.severity)gapMap.set(gap.id,gap)}
  const gaps=[...gapMap.values()].sort((a,b)=>b.severity-a.severity);const continuation=votes.filter(x=>!x.closed).sort((a,b)=>b.confidence-a.confidence)[0]||votes[0];
  return {protocol:'taowind-code.goal-closure-federation.v0.1',closed,confidence:minConfidence,reason:closed?'closure auditors unanimously accepted hard-gate evidence':continuation.reason||'closure quorum rejected completion',gaps,next_goal:continuation.next_goal||gaps[0]?.problem||String(input?.rootGoal||''),recommended_mode:continuation.recommended_mode,votes};
}
