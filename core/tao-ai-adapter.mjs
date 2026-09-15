function endpoint(){
  const raw=process.env.TAO_AI_ENDPOINT?.trim();if(!raw)return null;
  if(/\/chat\/completions\/?$/.test(raw))return raw;
  return raw.replace(/\/$/,'')+'/v1/chat/completions';
}
function extractJson(text){
  const raw=String(text||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  try{return JSON.parse(raw)}catch{}
  const first=raw.indexOf('{'),last=raw.lastIndexOf('}');if(first>=0&&last>first)return JSON.parse(raw.slice(first,last+1));throw new Error('TAO_AI_INVALID_JSON');
}
export function taoAIStatus(){return {connected:!!endpoint(),protocol:process.env.TAO_AI_PROTOCOL||'openai-compatible',model:process.env.TAO_AI_MODEL||null,endpoint:process.env.TAO_AI_ENDPOINT||null}}
async function chat(messages,{temperature=0.1}={}){
  const url=endpoint();if(!url)throw Object.assign(new Error('TAO_AI_UNBOUND'),{code:'TAO_AI_UNBOUND'});
  const model=process.env.TAO_AI_MODEL||'tao-ai';const headers={'content-type':'application/json'};if(process.env.TAO_AI_API_KEY)headers.authorization=`Bearer ${process.env.TAO_AI_API_KEY}`;
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),120_000);
  try{const r=await fetch(url,{method:'POST',headers,body:JSON.stringify({model,messages,temperature,response_format:{type:'json_object'}}),signal:controller.signal});const body=await r.text();if(!r.ok)throw new Error(`TAO_AI_HTTP_${r.status}:${body.slice(0,500)}`);const data=JSON.parse(body);const content=data?.choices?.[0]?.message?.content??data?.content??data?.output_text;if(!content)throw new Error('TAO_AI_EMPTY_RESPONSE');return extractJson(content)}finally{clearTimeout(timer)}
}
export async function requestChangeset({goal,dwac,repository,files}){
  const system=`You are Tao AI inside Taowind Code. Return JSON only. Produce a bounded candidate changeset for the user's repository. Never claim execution. Do not touch secrets, .git, node_modules, build outputs, lockfiles unless necessary, or files outside the workspace. Schema: {"summary":string,"changes":[{"op":"write"|"delete","path":string,"content"?:string,"expectedSha256"?:string}],"validation_commands":[string],"risks":[string],"needs_more_context"?:string[]}. Prefer minimal coherent multi-file edits. If context is insufficient, set changes=[] and list needs_more_context.`;
  return chat([{role:'system',content:system},{role:'user',content:JSON.stringify({goal,dwac,repository,files})}]);
}
