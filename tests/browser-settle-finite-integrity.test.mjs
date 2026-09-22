import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {BrowserObservationOrgan} from '../core/browser-observation.mjs';

function fixture(){return fs.mkdtempSync(path.join(os.tmpdir(),'twc-browser-settle-finite-'))}

test('browser observation rejects non-finite settle timing before CDP transport',async()=>{
  const root=fixture();
  try{
    const observer=new BrowserObservationOrgan(root,{cdpUrl:'http://127.0.0.1:1'});
    await assert.rejects(()=>observer.observe({url:'https://example.invalid/',settleMs:'not-a-number'}),error=>error?.code==='INVALID_BROWSER_SETTLE_MS');
    await assert.rejects(()=>observer.observe({url:'https://example.invalid/',settleMs:{}}),error=>error?.code==='INVALID_BROWSER_SETTLE_MS');
  }finally{fs.rmSync(root,{recursive:true,force:true})}
});
