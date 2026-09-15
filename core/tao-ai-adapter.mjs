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
function systemPrompt(role){return `You are Tao AI inside Taowind Code, participating in a DWAC multi-civilization candidate competition. ${ROLE_PROMPTS[role]||ROLE_PROMPTS.implementation} Return JSON only. Produce a bounded candidate changeset for the user's repository. Never claim execution. Do not touch secrets, .git, node_modules, build outputs, lockfiles unless necessary, or files outside the workspace. Schema: {"summary":string,"changes":[{"op":"write"|"delete","path":string,"content"?:string,"expectedSha256"?:string}],"validation_commands":[string],"risks":[string],"needs_more_context"?:string[]}. Prefer coherent changes that close the goal rather than cosmetic edits. If context is insufficient, set changes=[] and list needs_more_context.`}
export async function requestChangesetCandidates({goal,dwac,repository,files}){
  const providers=providerConfigs();if(!providers.length)throw Object.assign(new Error('TAO_AI_UNBOUND'),{code:'TAO_AI_UNBOUND'});
  const roles=['architecture','implementation','verifier'];const requested=Math.max(1,Math.min(9,Number(process.env.TAO_AI_CANDIDATE_COUNT||3)||3));
  const jobs=Array.from({length:requested},(_,i)=>({provider:providers[i%providers.length],role:roles[i%roles.length],index:i}));
  const user=JSON.stringify({goal,dwac,repository,files});
  const settled=await Promise.allSettled(jobs.map(async job=>({provider:job.provider.name,role:job.role,proposal:await chat(job.provider,[{role:'system',content:systemPrompt(job.role)},{role:'user',content:user}],{temperature:job.role==='verifier'?0.05:0.15})})));
  const results=[];for(let i=0;i<settled.length;i++){const item=settled[i],job=jobs[i];if(item.status==='fulfilled')results.push(item.value);else results.push({provider:job.provider.name,role:job.role,error:String(item.reason?.message||item.reason),proposal:{summary:'provider failed',changes:[],validation_commands:[],risks:[String(item.reason?.message||item.reason)]}})}return results;
}
export async function requestChangeset(input){const out=await requestChangesetCandidates(input);const first=out.find(x=>Array.isArray(x.proposal?.changes)&&x.proposal.changes.length)||out[0];return first?.proposal||{summary:'no provider result',changes:[],validation_commands:[],risks:['NO_PROVIDER_RESULT']}}
