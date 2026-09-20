import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const bridge=process.env.DWAC_BRIDGE_PATH||path.resolve('bridge/dwac_cognition_bridge.py');

function runCase(workspace, payload){
  const script=`
import importlib.util,json,sys
from pathlib import Path
spec=importlib.util.spec_from_file_location("bridge",sys.argv[1])
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
raw=json.loads(sys.stdin.read())
print(json.dumps(m._normalize_native_proposal(Path(sys.argv[2]),raw),ensure_ascii=False))
`;
  const r=spawnSync(process.env.PYTHON||'python',['-c',script,bridge,workspace],{
    input:JSON.stringify(payload),encoding:'utf8'
  });
  assert.equal(r.status,0,r.stderr||r.stdout);
  return JSON.parse(r.stdout.trim().split(/\r?\n/).at(-1));
}

test('DWAC ChangeSetIR lowers write replace delete with preimage binding',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'twc-dwac-ir-'));
  fs.mkdirSync(path.join(root,'core'),{recursive:true});
  fs.writeFileSync(path.join(root,'core','a.mjs'),"const x = 'alpha';\n");
  fs.writeFileSync(path.join(root,'dead.txt'),'gone\n');
  const out=runCase(root,{
    changeset_id:'CS-test',hypothesis_id:'EVO-test',target_repo:'.',base_ref:'HEAD',status:'READY',
    files:[
      {operation:'replace',path:'core/a.mjs',old:'alpha',new:'beta'},
      {operation:'write',path:'new.py',content:"print('ok')\n"},
      {operation:'delete',path:'dead.txt'}
    ],
    tests:[{name:'syntax',argv:['node','--check','core/a.mjs'],timeout_seconds:30}],
    rollback:{}
  });
  assert.deepEqual(out.changes.map(x=>x.op),['write','write','delete']);
  assert.equal(out.changes[0].content,"const x = 'beta';\n");
  assert.match(out.changes[0].expectedSha256,/^[a-f0-9]{64}$/);
  assert.match(out.changes[2].expectedSha256,/^[a-f0-9]{64}$/);
  assert.deepEqual(out.validation_commands,['node --check core/a.mjs']);
  assert.equal(out.dwac_changeset_ir.changeset_id,'CS-test');
});

test('DWAC ChangeSetIR lowering fails closed on ambiguous replace and unsafe path',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'twc-dwac-ir-bad-'));
  fs.writeFileSync(path.join(root,'dupe.txt'),'same same');
  const base={changeset_id:'CS-bad',hypothesis_id:'EVO-bad',target_repo:'.',base_ref:'HEAD',status:'READY',tests:[],rollback:{}};
  const ambiguous=runCase(root,{...base,files:[{operation:'replace',path:'dupe.txt',old:'same',new:'x'}]});
  assert.equal(ambiguous.changes.length,0);
  assert.ok(ambiguous.risks.some(x=>x.includes('REPLACE_PREIMAGE_NOT_UNIQUE')));
  const escape=runCase(root,{...base,files:[{operation:'write',path:'../evil',content:'x'}]});
  assert.equal(escape.changes.length,0);
  assert.ok(escape.risks.some(x=>x.includes('UNSAFE_CHANGE_PATH')));
});

test('legacy native proposal shape remains compatible',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'twc-dwac-ir-legacy-'));
  const legacy={summary:'legacy',changes:[{op:'write',path:'x.txt',content:'y'}],validation_commands:['node --check x.js'],risks:[]};
  const out=runCase(root,legacy);
  assert.equal(out.summary,'legacy');
  assert.equal(out.changes[0].path,'x.txt');
  assert.deepEqual(out.validation_commands,['node --check x.js']);
});
