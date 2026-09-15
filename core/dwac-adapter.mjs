import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
export function compileWithDWAC(prompt,root){
 const dwac=process.env.TAOWIND_DWAC_ROOT;if(!dwac)return {connected:false,status:'UNBOUND_PROVIDER',message:'DWAC North Star runtime is ready; set TAOWIND_DWAC_ROOT to bind the local runtime.',mode:null};
 const bridge=path.resolve(here,'../bridge/dwac_bridge.py');const r=spawnSync(process.env.PYTHON||'python',[bridge,'--dwac-root',dwac,'--workspace',root,'--prompt',String(prompt)],{encoding:'utf8',timeout:45_000,maxBuffer:4*1024*1024});
 if(r.status!==0)return {connected:true,status:'ERROR',message:(r.stderr||r.stdout||'DWAC bridge failed').slice(-4000)};try{return JSON.parse(r.stdout)}catch{return {connected:true,status:'ERROR',message:'Invalid DWAC bridge response'}}
}
