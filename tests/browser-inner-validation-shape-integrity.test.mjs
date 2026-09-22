import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {BrowserObservationOrgan} from '../core/browser-observation.mjs';

function fixture(){return fs.mkdtempSync(path.join(os.tmpdir(),'twc-browser-inner-shape-'))}

test('browser observation rejects malformed selector and required-text plans before CDP transport',async()=>{
  const root=fixture();
  try{
    const observer=new BrowserObservationOrgan(root,{cdpUrl:'http://127.0.0.1:1'});
    const base={url:'https://example.invalid/'};
    await assert.rejects(()=>observer.observe({...base,requiredSelectors:false}),error=>error?.code==='INVALID_BROWSER_SELECTOR_LIST');
    await assert.rejects(()=>observer.observe({...base,requiredSelectors:[42]}),error=>error?.code==='INVALID_BROWSER_SELECTOR');
    await assert.rejects(()=>observer.observe({...base,requiredSelectors:['']}),error=>error?.code==='INVALID_BROWSER_SELECTOR');
    await assert.rejects(()=>observer.observe({...base,requiredText:null}),error=>error?.code==='INVALID_BROWSER_REQUIRED_TEXT_LIST');
    await assert.rejects(()=>observer.observe({...base,requiredText:[{}]}),error=>error?.code==='INVALID_BROWSER_REQUIRED_TEXT');
    await assert.rejects(()=>observer.observe({...base,requiredText:['']}),error=>error?.code==='INVALID_BROWSER_REQUIRED_TEXT');
  }finally{fs.rmSync(root,{recursive:true,force:true})}
});
