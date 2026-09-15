import fs from 'node:fs';
export function providerStatus(){
 const dwac=process.env.TAOWIND_DWAC_ROOT; const tao=process.env.TAO_AI_ENDPOINT; const browser=process.env.TAO_BROWSER_PATH;
 return {dwac:{name:'DWAC',connected:!!dwac,detail:dwac||'Set TAOWIND_DWAC_ROOT'},taoAI:{name:'Tao AI',connected:!!tao,detail:tao||'Set TAO_AI_ENDPOINT'},taoBrowser:{name:'Tao Browser',connected:!!browser&&fs.existsSync(browser),detail:browser||'Set TAO_BROWSER_PATH'},mode:'provider-contract'};
}
