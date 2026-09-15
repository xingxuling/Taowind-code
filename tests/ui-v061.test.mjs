import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..');
const html=fs.readFileSync(path.join(root,'public','index.html'),'utf8');
const app=fs.readFileSync(path.join(root,'public','app.js'),'utf8');

const views=['agent','code','preview','game','git','setup'];
const ids=['prompt','planBtn','singleRunBtn','gameForgeBtn','codeEditor','saveBtn','terminalCommand','terminalRun','previewUrl','openPreview','gameRouteBtn','gitRefresh','refreshSetupBtn','providerBanner'];

test('primary navigation has a matching panel for every view',()=>{
  for(const view of views){
    assert.match(html,new RegExp(`data-view="${view}"`));
    assert.match(html,new RegExp(`data-view-panel="${view}"`));
  }
});

test('all primary interactive controls exist',()=>{
  for(const id of ids)assert.match(html,new RegExp(`id="${id}"`));
});

test('client binds navigation and degrades with explicit setup guidance',()=>{
  assert.match(app,/switchView\(name\)/);
  assert.match(app,/showActionError/);
  assert.match(app,/switchView\('setup'\)/);
  assert.match(app,/Promise\.allSettled/);
});
