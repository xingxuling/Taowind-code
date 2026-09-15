import {spawnSync} from 'node:child_process'; import path from 'node:path';
export function compileWithDWAC(prompt,root){
 const dwac=process.env.TAOWIND_DWAC_ROOT; if(!dwac)return {connected:false,status:'UNBOUND_PROVIDER',message:'DWAC provider contract is ready; set TAOWIND_DWAC_ROOT to bind the runtime.'};
 const bridge=path.resolve('bridge/dwac_bridge.py'); const r=spawnSync('python',[bridge,'--dwac-root',dwac,'--workspace',root,'--prompt',String(prompt)],{encoding:'utf8',timeout:30000});
 if(r.status!==0)return {connected:true,status:'ERROR',message:r.stderr||'DWAC bridge failed'}; try{return JSON.parse(r.stdout)}catch{return {connected:true,status:'ERROR',message:'Invalid DWAC bridge response'}}
}
