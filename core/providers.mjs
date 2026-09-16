import fs from 'node:fs';
import path from 'node:path';
import {taoAIStatus} from './tao-ai-adapter.mjs';

export function providerStatus(){
  const dwacRoot=process.env.TAOWIND_DWAC_ROOT?path.resolve(process.env.TAOWIND_DWAC_ROOT):null;
  const rclRoot=process.env.TAOWIND_RCL_ROOT?path.resolve(process.env.TAOWIND_RCL_ROOT):null;
  const browser=process.env.TAO_BROWSER_PATH;
  const cognition=taoAIStatus();
  const dwacStructural=dwacRoot?path.join(dwacRoot,'structural_generation'):null;
  const dwacNatural=dwacRoot?path.join(dwacRoot,'natural_conversation_runtime.py'):null;
  const rclEntry=rclRoot?path.join(rclRoot,'src','index.mjs'):null;
  const dwacConnected=!!dwacStructural&&fs.existsSync(dwacStructural);
  const rclConnected=!!rclEntry&&fs.existsSync(rclEntry);
  return {
    core:{
      name:'Taowind Core',
      connected:dwacConnected&&rclConnected,
      readyCount:[dwacConnected,rclConnected].filter(Boolean).length,
      totalCount:2,
      required:['dwac','rcl'],
    },
    dwac:{name:'DWAC Core',connected:dwacConnected,detail:dwacRoot||'Set TAOWIND_DWAC_ROOT'},
    cognition:{name:'DWAC Cognition',connected:cognition.nativeConnected===true,detail:cognition.nativeConnected?'Native cognition is bound to DWAC Core':'DWAC natural_conversation_runtime.py is unavailable',protocol:cognition.protocol},
    rcl:{name:'RCL Authority',connected:rclConnected,detail:rclRoot||'Set TAOWIND_RCL_ROOT'},
    externalAI:{name:'External AI Accelerator',connected:cognition.acceleratorConnected===true,required:false,detail:cognition.acceleratorConnected?`${cognition.model||'model unset'} · ${cognition.endpoint||'endpoint bound'}`:'Optional. DWAC native cognition remains the primary path.',protocol:'openai-compatible-optional'},
    taoAI:{name:'External AI Accelerator',connected:cognition.acceleratorConnected===true,required:false,detail:cognition.acceleratorConnected?`${cognition.model||'model unset'} · ${cognition.endpoint||'endpoint bound'}`:'Optional. Not required for core readiness.',protocol:'compatibility-alias',model:cognition.model},
    taoBrowser:{name:'Tao Browser',connected:!!browser&&fs.existsSync(browser),required:false,detail:browser||'Optional browser observation provider'},
    mode:'dwac-core-cognition-contract',
  };
}
