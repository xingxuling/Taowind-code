import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {BrowserObservationOrgan} from '../core/browser-observation.mjs';

function fixture(){return fs.mkdtempSync(path.join(os.tmpdir(),'twc-browser-scalar-shape-'))}

test('browser observation rejects malformed scalar assertion fields before CDP transport',async()=>{
  const root=fixture();
  try{
    const observer=new BrowserObservationOrgan(root,{cdpUrl:'http://127.0.0.1:1'});
    const base={url:'https://example.invalid/'};
    for(const [field,value] of [['titleIncludes',false],['urlIncludes',{}],['forbidConsoleErrors','false'],['forbidPageExceptions',0],['forbidCriticalNetworkErrors',null],['screenshot','no']]){
      await assert.rejects(()=>observer.observe({...base,[field]:value}),error=>error?.code==='INVALID_BROWSER_CHECK_FIELD'&&error.field===field);
    }
  }finally{fs.rmSync(root,{recursive:true,force:true})}
});
