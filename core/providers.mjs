import fs from 'node:fs';
import {taoAIStatus} from './tao-ai-adapter.mjs';
export function providerStatus(){
 const dwac=process.env.TAOWIND_DWAC_ROOT;const browser=process.env.TAO_BROWSER_PATH;const tao=taoAIStatus();
 return {dwac:{name:'DWAC',connected:!!dwac,detail:dwac||'Set TAOWIND_DWAC_ROOT'},taoAI:{name:'Tao AI',connected:tao.connected,detail:tao.connected?`${tao.protocol} · ${tao.model||'model unset'}`:'Set TAO_AI_ENDPOINT',protocol:tao.protocol,model:tao.model},taoBrowser:{name:'Tao Browser',connected:!!browser&&fs.existsSync(browser),detail:browser||'Set TAO_BROWSER_PATH'},mode:'north-star-provider-contract'};
}
