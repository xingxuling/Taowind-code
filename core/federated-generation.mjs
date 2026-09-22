import path from 'node:path';
import {isCredentialLikePath} from './repo-context.mjs';

const BLOCKED_SEGMENTS=new Set(['.git','node_modules','.next','dist','build','runtime-data','.venv']);
const MAX_EXECUTABLE_VALIDATION_COMMANDS=8;
const MAX_EXECUTABLE_CHANGES=128;
const MAX_EXECUTABLE_FILE_BYTES=2_000_000;
const SHA256_RE=/^[a-f0-9]{64}$/;
const compareText=(a,b)=>a<b?-1:a>b?1:0;
function normalizeRel(p){
  if(typeof p!=='string'||!p.trim())return null;
  const norm=path.posix.normalize(p.replaceAll('\\','/')).replace(/\/+$/,'');
  if(!norm||norm==='.'||norm.startsWith('../')||norm==='..'||norm.startsWith('/')||/^[A-Za-z]:/.test(norm))return null;
  if(norm.split('/').some(x=>BLOCKED_SEGMENTS.has(x.toLowerCase())))return null;
  return norm;
}
function safeRel(p){return normalizeRel(p)!==null}
function normalizeContextRel(p){const rel=normalizeRel(p);return rel&&!isCredentialLikePath(rel)?rel:null}
function normalizeChange(c){
  const rel=normalizeRel(c?.path);
  if(!c||!['write','delete'].includes(c.op)||!rel)return null;
  if(c.op==='write'&&typeof c.content!=='string')return null;
  const hasExpected=Object.hasOwn(c,'expectedSha256');
  if(hasExpected&&(typeof c.expectedSha256!=='string'||!SHA256_RE.test(c.expectedSha256)))return null;
  return {op:c.op,path:rel,...(c.op==='write'?{content:c.content}:{}),...(hasExpected?{expectedSha256:c.expectedSha256}:{})};
}
function changeFingerprint(change){return JSON.stringify([change.op,change.path,change.op==='write'?change.content:'',change.expectedSha256||''])}
function overlappingChangePaths(paths){
  const rows=[...paths],out=new Set();
  for(let i=0;i<rows.length;i++)for(let j=i+1;j<rows.length;j++){
    const a=rows[i],b=rows[j];
    if(a.startsWith(`${b}/`)||b.startsWith(`${a}/`)){out.add(a);out.add(b)}
  }
  return [...out].sort(compareText);
}
function normalizeChanges(rawChanges){
  const rows=Array.isArray(rawChanges)?rawChanges:[];
  if(rows.length>MAX_EXECUTABLE_CHANGES)return {changes:[],ambiguousPaths:[],overlappingPaths:[],invalidChangeCount:0,changeOverflow:true,observedChangeCount:rows.length,fileByteOverflow:false,oversizedFileCount:0};
  const normalizedRows=rows.map(normalizeChange);
  const invalidChangeCount=normalizedRows.filter(change=>!change).length;
  if(invalidChangeCount)return {changes:[],ambiguousPaths:[],overlappingPaths:[],invalidChangeCount,changeOverflow:false,observedChangeCount:rows.length,fileByteOverflow:false,oversizedFileCount:0};
  const oversizedFileCount=normalizedRows.filter(change=>change.op==='write'&&Buffer.byteLength(change.content,'utf8')>MAX_EXECUTABLE_FILE_BYTES).length;
  if(oversizedFileCount)return {changes:[],ambiguousPaths:[],overlappingPaths:[],invalidChangeCount:0,changeOverflow:false,observedChangeCount:rows.length,fileByteOverflow:true,oversizedFileCount};
  const byPath=new Map();
  for(const change of normalizedRows){
    const variants=byPath.get(change.path)||new Map();
    variants.set(changeFingerprint(change),change);byPath.set(change.path,variants);
  }
  const ambiguousPaths=[...byPath.entries()].filter(([,variants])=>variants.size>1).map(([path])=>path).sort(compareText);
  const overlappingPaths=overlappingChangePaths(byPath.keys());
  if(ambiguousPaths.length||overlappingPaths.length)return {changes:[],ambiguousPaths,overlappingPaths,invalidChangeCount:0,changeOverflow:false,observedChangeCount:rows.length,fileByteOverflow:false,oversizedFileCount:0};
  return {changes:[...byPath.values()].map(variants=>variants.values().next().value),ambiguousPaths:[],overlappingPaths:[],invalidChangeCount:0,changeOverflow:false,observedChangeCount:rows.length,fileByteOverflow:false,oversizedFileCount:0};
}
function normalizeValidationCommands(rawCommands){
  const rows=Array.isArray(rawCommands)?rawCommands:[];const invalidValidationCount=rows.filter(command=>typeof command!=='string').length;
  if(invalidValidationCount)return {commands:[],invalidValidationCount};
  return {commands:[...new Set(rows.map(x=>x.trim()).filter(Boolean))].slice(0,16),invalidValidationCount:0};
}
export function normalizeProposal(raw,{provider='unknown',role='implementation'}={}){
  const normalized=normalizeChanges(raw?.changes);const normalizedValidation=normalizeValidationCommands(raw?.validation_commands);const validation=normalizedValidation.commands;
  const context=[...new Set((Array.isArray(raw?.needs_more_context)?raw.needs_more_context:[]).map(normalizeContextRel).filter(Boolean))].slice(0,32);
  const risks=(Array.isArray(raw?.risks)?raw.risks:[]).map(String).slice(0,20);
  if(normalized.changeOverflow&&risks.length<20)risks.push(`CHANGESET_FILE_BUDGET_EXCEEDED:${normalized.observedChangeCount}>${MAX_EXECUTABLE_CHANGES}`);
  if(normalized.fileByteOverflow&&risks.length<20)risks.push(`CHANGE_FILE_BUDGET_EXCEEDED:${normalized.oversizedFileCount}:${MAX_EXECUTABLE_FILE_BYTES}`);
  if(normalized.invalidChangeCount&&risks.length<20)risks.push(`INVALID_CHANGE_ENTRY:${normalized.invalidChangeCount}`);
  if(normalizedValidation.invalidValidationCount&&risks.length<20)risks.push(`INVALID_VALIDATION_COMMAND_ENTRY:${normalizedValidation.invalidValidationCount}`);
  for(const rel of normalized.ambiguousPaths){if(risks.length<20)risks.push(`AMBIGUOUS_CHANGE_PATH:${rel}`)}
  for(const rel of normalized.overlappingPaths){if(risks.length<20)risks.push(`OVERLAPPING_CHANGE_PATH:${rel}`)}
  const validationOverflow=validation.length>MAX_EXECUTABLE_VALIDATION_COMMANDS;if(validationOverflow&&risks.length<20)risks.push(`VALIDATION_COMMAND_BUDGET_EXCEEDED:${validation.length}>${MAX_EXECUTABLE_VALIDATION_COMMANDS}`);
  return {provider,role,summary:String(raw?.summary||''),changes:normalized.changes,validation_commands:validation,risks,needs_more_context:context,ambiguous_paths:normalized.ambiguousPaths,overlapping_paths:normalized.overlappingPaths,invalid_change_count:normalized.invalidChangeCount,change_overflow:normalized.changeOverflow,observed_change_count:normalized.observedChangeCount,file_byte_overflow:normalized.fileByteOverflow,oversized_file_count:normalized.oversizedFileCount,invalid_validation_command_count:normalizedValidation.invalidValidationCount,validation_overflow:validationOverflow};
}
function goalTokens(goal){return [...new Set(String(goal||'').toLowerCase().match(/[A-Za-z_][A-Za-z0-9_]{2,}|[\p{Script=Han}]{2,}/gu)||[])]}
function proposalText(p){return `${p.summary} ${p.changes.map(c=>`${c.path} ${c.op==='write'?c.content.slice(0,800):''}`).join(' ')}`.toLowerCase()}
function proposalOrigin(proposal){return `${proposal.provider||'unknown'}:${proposal.role||'implementation'}`}
function executableProposal(p){return !!(p?.changes?.length&&p.validation_commands?.length&&!p.change_overflow&&!p.file_byte_overflow&&!p.validation_overflow&&!p.invalid_change_count&&!p.invalid_validation_command_count&&!p.ambiguous_paths?.length&&!p.overlapping_paths?.length)}
function consensusSignals(proposals){
  const executable=(proposals||[]).filter(executableProposal);
  const exactSupport=new Map(),pathVariants=new Map();
  for(const proposal of executable){
    const origin=proposalOrigin(proposal);const seenExact=new Set(),seenPaths=new Set();
    for(const change of proposal.changes){
      const fingerprint=changeFingerprint(change);
      if(!seenExact.has(fingerprint)){
        seenExact.add(fingerprint);
        const supporters=exactSupport.get(fingerprint)||new Set();supporters.add(origin);exactSupport.set(fingerprint,supporters);
      }
      if(!seenPaths.has(change.path)){
        seenPaths.add(change.path);
        const variants=pathVariants.get(change.path)||new Set();variants.add(fingerprint);pathVariants.set(change.path,variants);
      }
    }
  }
  return {executableCount:executable.length,exactSupport,pathVariants,independentOrigins:new Set(executable.map(proposalOrigin)).size};
}
function proposalConsensus(p,signals){
  let exactAgreement=0,agreedChanges=0,conflictPaths=0;
  for(const change of p.changes){
    const support=signals?.exactSupport?.get(changeFingerprint(change))?.size||0;
    if(support>1){exactAgreement+=support-1;agreedChanges+=1}
    if((signals?.pathVariants?.get(change.path)?.size||0)>1)conflictPaths+=1;
  }
  return {exactAgreement,agreedChanges,conflictPaths};
}
export function scoreProposal(p,{goal='',manifest=[],consensus=null}={}){
  const known=new Set((manifest||[]).map(x=>typeof x==='string'?normalizeRel(x):normalizeRel(x.path)).filter(Boolean));
  const text=proposalText(p);const gt=goalTokens(goal);const coverage=gt.length?gt.filter(t=>text.includes(t)).length/gt.length:0;
  const files=p.changes.length;const writes=p.changes.filter(x=>x.op==='write').length;
  const existingEdits=p.changes.filter(x=>known.has(x.path)).length;
  const risky=p.changes.filter(x=>/(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|\.env|secrets?\b)/i.test(x.path)).length;
  const duplicatePaths=files-new Set(p.changes.map(x=>x.path)).size;const ambiguousPaths=p.ambiguous_paths?.length||0;const overlappingPaths=p.overlapping_paths?.length||0;
  const agreement=proposalConsensus(p,consensus);
  let score=0;
  score+=coverage*32;
  score+=Math.min(p.validation_commands.length,3)*8;
  score+=Math.min(files,8)*3;
  score+=Math.min(existingEdits,5)*2;
  score+=p.changes.some(x=>x.expectedSha256)?4:0;
  score+=Math.min(agreement.exactAgreement,4)*3;
  score+=Math.min(agreement.agreedChanges,4)*1.5;
  score-=agreement.conflictPaths*3;
  score-=Math.max(0,files-16)*2;
  score-=p.risks.length*0.4+risky*18+duplicatePaths*5+ambiguousPaths*60+overlappingPaths*60;
  if(!files)score-=60;if(!p.validation_commands.length)score-=22;if(!writes&&files)score-=4;
  return {score:Number(score.toFixed(3)),coverage:Number(coverage.toFixed(3)),files,existingEdits,risky,ambiguousPaths,overlappingPaths,hasValidation:!!p.validation_commands.length,...agreement};
}
export function selectFederatedProposal(candidates,{goal='',manifest=[]}={}){
  const normalized=(candidates||[]).map((x,i)=>normalizeProposal(x.proposal??x,{provider:x.provider||`candidate-${i+1}`,role:x.role||'implementation'}));
  const signals=consensusSignals(normalized);
  const ranked=normalized.map(p=>({...p,evaluation:scoreProposal(p,{goal,manifest,consensus:signals})})).sort((a,b)=>b.evaluation.score-a.evaluation.score||compareText(a.provider,b.provider)||compareText(a.role,b.role));
  const contextRequests=[...new Set(ranked.flatMap(p=>p.needs_more_context||[]))].slice(0,32);
  const winner=ranked.find(executableProposal)||null;
  const conflictedPaths=[...signals.pathVariants.entries()].filter(([,variants])=>variants.size>1).map(([path])=>path).sort();
  const exactAgreementCount=[...signals.exactSupport.values()].filter(origins=>origins.size>1).length;
  return {protocol:'taowind.federated-changeset-selection.v0.8',winner,ranked,contextRequests,consensus:{candidateCount:ranked.length,validCount:ranked.filter(executableProposal).length,providers:[...new Set(ranked.map(x=>x.provider))],executableCount:signals.executableCount,independentOriginCount:signals.independentOrigins,exactAgreementCount,conflictedPathCount:conflictedPaths.length,conflictedPaths:conflictedPaths.slice(0,16)}};
}
