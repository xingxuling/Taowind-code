import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..');
const html=fs.readFileSync(path.join(root,'public','index.html'),'utf8');
const app=fs.readFileSync(path.join(root,'public','app.js'),'utf8');
const css=fs.readFileSync(path.join(root,'public','ux-v063.css'),'utf8');

for(const view of ['agent','code','preview','game','git','setup']){
  test(`navigation ${view} has matching panel`,()=>{
    assert.match(html,new RegExp(`data-view="${view}"`));
    assert.match(html,new RegExp(`data-view-panel="${view}"`));
  });
}

test('shared goal exists on agent and game surfaces',()=>{
  assert.match(html,/id="prompt"/); assert.match(html,/id="gameGoal"/);
  assert.match(app,/for\(const id of \['#prompt','#gameGoal'\]\)/);
});

test('one primary goal action dispatches mission single and game',()=>{
  assert.match(html,/id="primaryGoalAction"/);
  assert.match(app,/state\.actionMode==='single'/);
  assert.match(app,/state\.actionMode==='game'/);
  assert.match(app,/return startMission\(\)/);
});

test('delivery is a real run action, not navigation-only',()=>{
  assert.match(app,/runAction\('delivery',\{commit:false\}\)/);
});

test('setup separates core and optional accelerators',()=>{
  assert.match(html,/id="setupCore"/); assert.match(html,/id="setupOptional"/);
  assert.match(app,/Core \$\{coreReady\}\/2/);
});

test('keyboard closure paths exist',()=>{
  assert.match(app,/e\.key\.toLowerCase\(\)==='k'/);
  assert.match(app,/e\.key==='Enter'/);
  assert.match(app,/e\.key\.toLowerCase\(\)==='s'/);
});

test('responsive visual system has mobile breakpoint',()=>{
  assert.match(css,/@media\(max-width:760px\)/);
  assert.match(css,/\.sidebar-v063/);
  assert.match(css,/\.goal-composer-v063/);
});
