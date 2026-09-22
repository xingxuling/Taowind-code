import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {BrowserObservationOrgan} from '../core/browser-observation.mjs';

function fixture(){return fs.mkdtempSync(path.join(os.tmpdir(),'twc-browser-inner-budget-'))}

test('browser observation fails closed before CDP when selector or required-text plans exceed established limits',async()=>{
  const root=fixture();
  try{
    const observer=new BrowserObservationOrgan(root,{cdpUrl:'http://127.0.0.1:1'});
    const selectors=Array.from({length:49},(_,i)=>`.required-${i}`);
    await assert.rejects(()=>observer.observe({url:'https://example.invalid/',requiredSelectors:selectors}),error=>error?.code==='BROWSER_SELECTOR_BUDGET_EXCEEDED'&&error.limit===48&&error.observed===49);
    const requiredText=Array.from({length:33},(_,i)=>`required text ${i}`);
    await assert.rejects(()=>observer.observe({url:'https://example.invalid/',requiredText}),error=>error?.code==='BROWSER_TEXT_BUDGET_EXCEEDED'&&error.limit===32&&error.observed===33);
  }finally{fs.rmSync(root,{recursive:true,force:true})}
});
