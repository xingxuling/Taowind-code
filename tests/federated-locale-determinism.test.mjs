import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

function observe(lang){
  const moduleHref=new URL('../core/federated-generation.mjs',import.meta.url).href;
  const proposal={summary:'same',changes:[{op:'write',path:'src/a.js',content:'export const a=1'}],validation_commands:['node --check src/a.js']};
  const script=`import {selectFederatedProposal} from ${JSON.stringify(moduleHref)}; const proposal=${JSON.stringify(proposal)}; const result=selectFederatedProposal([{provider:'ä',role:'implementation',proposal},{provider:'z',role:'implementation',proposal}],{goal:'',manifest:['src/a.js']}); console.log(JSON.stringify({winner:result.winner?.provider,ranked:result.ranked.map(x=>x.provider)}));`;
  const child=spawnSync(process.execPath,['--input-type=module','-e',script],{encoding:'utf8',env:{...process.env,LANG:lang,LC_ALL:lang}});
  assert.equal(child.status,0,child.stderr);
  return JSON.parse(child.stdout.trim());
}

test('federated proposal winner is independent of host locale collation',()=>{
  assert.deepEqual(observe('sv_SE.UTF-8'),observe('en_US.UTF-8'));
});
