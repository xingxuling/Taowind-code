import path from 'node:path';

const BLOCKED_SEGMENTS=new Set(['.git','node_modules','.next','dist','build','runtime-data','.venv']);
function safeRel(p){
  if(typeof p!=='string'||!p.trim())return false;
  const norm=path.posix.normalize(p.replaceAll('\\','/'));
  if(norm.startsWith('../')||norm==='..'||norm.startsWith('/')||/^[A-Za-z]:/.test(norm))return false;
  return !norm.split('/').some(x=>BLOCKED_SEGMENTS.has(x));
}
function normalizeChange(c){
  if(!c||!['write','delete'].includes(c.op)||!safeRel(c.path))return null;
  if(c.op==='write'&&typeof c.content!=='string')return null;
  return {op:c.op,path:c.path.replaceAll('\\','/'),...(c.op==='write'?{content:c.content}:{}),...(c.expectedSha256?{expectedSha256:String(c.expectedSha256)}:{})};
}
export function normalizeProposal(raw,{provider='unknown',role='implementation'}={}){
  const changes=[...new Map((Array.isArray(raw?.changes)?raw.changes:[]).map(normalizeChange).filter(Boolean).map(x=>[`${x.op}:${x.path}`,x])).values()];
  const validation=[...new Set((Array.isArray(raw?.validation_commands)?raw.validation_commands:[]).map(String).map(x=>x.trim()).filter(Boolean))].slice(0,16);
  return {provider,role,summary:String(raw?.summary||''),changes,validation_commands:validation,risks:(Array.isArray(raw?.risks)?raw.risks:[]).map(String).slice(0,20),needs_more_context:(Array.isArray(raw?.needs_more_context)?raw.needs_more_context:[]).map(String).filter(safeRel).slice(0,32)};
}
function goalTokens(goal){return [...new Set(String(goal||'').toLowerCase().match(/[A-Za-z_][A-Za-z0-9_]{2,}|[\p{Script=Han}]{2,}/gu)||[])]}
function proposalText(p){return `${p.summary} ${p.changes.map(c=>`${c.path} ${c.op==='write'?c.content.slice(0,800):''}`).join(' ')}`.toLowerCase()}
function changeFingerprint(change){return JSON.stringify([change.op,change.path,change.op==='write'?change.content:''])}
function consensusSignals(proposals){
  const executable=(proposals||[]).filter(p=>p.changes.length&&p.validation_commands.length);
  const exactSupport=new Map(),pathVariants=new Map();
  for(const proposal of executable){
    const seenExact=new Set(),seenPaths=new Set();
    for(const change of proposal.changes){
      const fingerprint=changeFingerprint(change);
      if(!seenExact.has(fingerprint)){seenExact.add(fingerprint);exactSupport.set(fingerprint,(exactSupport.get(fingerprint)||0)+1)}
      if(!seenPaths.has(change.path)){
        seenPaths.add(change.path);
        const variants=pathVariants.get(change.path)||new Set();variants.add(fingerprint);pathVariants.set(change.path,variants);
      }
    }
  }
  return {executableCount:executable.length,exactSupport,pathVariants};
}
function proposalConsensus(p,signals){
  let exactAgreement=0,agreedChanges=0,conflictPaths=0;
  for(const change of p.changes){
    const support=signals?.exactSupport?.get(changeFingerprint(change))||0;
    if(support>1){exactAgreement+=support-1;agreedChanges+=1}
    if((signals?.pathVariants?.get(change.path)?.size||0)>1)conflictPaths+=1;
  }
  return {exactAgreement,agreedChanges,conflictPaths};
}
export function scoreProposal(p,{goal='',manifest=[],consensus=null}={}){
  const known=new Set((manifest||[]).map(x=>typeof x==='string'?x:x.path));
  const text=proposalText(p);const gt=goalTokens(goal);const coverage=gt.length?gt.filter(t=>text.includes(t)).length/gt.length:0;
  const files=p.changes.length;const writes=p.changes.filter(x=>x.op==='write').length;
  const existingEdits=p.changes.filter(x=>known.has(x.path)).length;
  const risky=p.changes.filter(x=>/(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|\.env|secrets?\b)/i.test(x.path)).length;
  const duplicatePaths=files-new Set(p.changes.map(x=>x.path)).size;
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
  score-=p.risks.length*0.4+risky*18+duplicatePaths*5;
  if(!files)score-=60;if(!p.validation_commands.length)score-=22;if(!writes&&files)score-=4;
  return {score:Number(score.toFixed(3)),coverage:Number(coverage.toFixed(3)),files,existingEdits,risky,hasValidation:!!p.validation_commands.length,...agreement};
}
export function selectFederatedProposal(candidates,{goal='',manifest=[]}={}){
  const normalized=(candidates||[]).map((x,i)=>normalizeProposal(x.proposal??x,{provider:x.provider||`candidate-${i+1}`,role:x.role||'implementation'}));
  const signals=consensusSignals(normalized);
  const ranked=normalized.map(p=>({...p,evaluation:scoreProposal(p,{goal,manifest,consensus:signals})})).sort((a,b)=>b.evaluation.score-a.evaluation.score||a.provider.localeCompare(b.provider)||a.role.localeCompare(b.role));
  const winner=ranked.find(x=>x.changes.length&&x.validation_commands.length)||ranked[0]||null;
  const conflictedPaths=[...signals.pathVariants.entries()].filter(([,variants])=>variants.size>1).map(([path])=>path).sort();
  const exactAgreementCount=[...signals.exactSupport.values()].filter(count=>count>1).length;
  return {protocol:'taowind.federated-changeset-selection.v0.2',winner,ranked,consensus:{candidateCount:ranked.length,validCount:ranked.filter(x=>x.changes.length&&x.validation_commands.length).length,providers:[...new Set(ranked.map(x=>x.provider))],executableCount:signals.executableCount,exactAgreementCount,conflictedPathCount:conflictedPaths.length,conflictedPaths:conflictedPaths.slice(0,16)}};
}
