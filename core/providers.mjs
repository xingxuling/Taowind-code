import fs from 'node:fs';
import path from 'node:path';
import {taoAIStatus} from './tao-ai-adapter.mjs';
export function providerStatus(){
 const dwac=process.env.TAOWIND_DWAC_ROOT;const browser=process.env.TAO_BROWSER_PATH;const rcl=process.env.TAOWIND_RCL_ROOT;const tao=taoAIStatus();const rclEntry=rcl?path.join(rcl,'src','index.mjs'):null;
 return {dwac:{name:'DWAC',connected:!!dwac,detail:dwac||'Set TAOWIND_DWAC_ROOT'},taoAI:{name:'Tao AI',connected:tao.connected,detail:tao.connected?`${tao.protocol} · ${tao.model||'model unset'}`:'Set TAO_AI_ENDPOINT',protocol:tao.protocol,model:tao.model},taoBrowser:{name:'Tao Browser',connected:!!browser&&fs.existsSync(browser),detail:browser||'Set TAO_BROWSER_PATH'},rcl:{name:'RCL Authority',connected:!!rclEntry&&fs.existsSync(rclEntry),detail:rcl||'Set TAOWIND_RCL_ROOT'},mode:'north-star-provider-contract'};
}
