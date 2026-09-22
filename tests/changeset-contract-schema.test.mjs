import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const schema=JSON.parse(fs.readFileSync(path.join(root,'contracts','changeset.schema.json'),'utf8'));
const runtimeSource=fs.readFileSync(path.join(root,'core','changesets.mjs'),'utf8');
const protocol=runtimeSource.match(/protocol:'([^']+)'/)?.[1];

function requiredSet(node){return new Set(node?.required||[])}

test('changeset contract matches the durable v0.3 runtime document shape',()=>{
  assert.equal(protocol,'taowind-code.changeset.v0.3');
  assert.equal(schema.properties?.protocol?.const,protocol);
  assert.match(schema.$id,/changeset-v0\.3\.json$/);
  assert.match(schema.title,/v0\.3$/);
  const top=requiredSet(schema);
  for(const key of ['id','protocol','runId','source','status','createdAt','updatedAt','changes','applyReceipt','rollbackReceipt'])assert.ok(top.has(key),`missing required ${key}`);
  assert.equal(schema.properties?.changes?.minItems,1);
  assert.equal(schema.properties?.changes?.maxItems,128);
  const item=schema.properties?.changes?.items;
  const itemRequired=requiredSet(item);
  for(const key of ['op','path','before','after'])assert.ok(itemRequired.has(key),`missing change field ${key}`);
  assert.equal(item?.properties?.before?.$ref,'#/$defs/beforeImage');
  assert.equal(item?.properties?.after?.$ref,'#/$defs/afterImage');
  for(const key of ['exists','type','sha256','size','identity','mode','contentBase64'])assert.ok(requiredSet(schema.$defs?.beforeImage).has(key),`missing before field ${key}`);
  for(const key of ['sha256','size','contentBase64'])assert.ok(requiredSet(schema.$defs?.afterImage).has(key),`missing after field ${key}`);
  assert.ok(schema.$defs?.applyReceipt);
  assert.ok(schema.$defs?.rollbackReceipt);
});
