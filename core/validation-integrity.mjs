const STATE_FIELDS=['exists','type','sha256','identity','mode'];
function stateOf(workspace,path){
  try{const st=workspace.stat(path);return {path,...Object.fromEntries(STATE_FIELDS.map(key=>[key,st?.[key]??null]))}}
  catch(error){return {path,error:String(error?.code||error?.message||error)}}
}
export function captureValidationPostimage(workspace,paths){
  return [...new Set((paths||[]).map(String).filter(Boolean))].sort().map(path=>stateOf(workspace,path));
}
export function compareValidationPostimage(workspace,snapshot){
  const drift=[];
  for(const expected of Array.isArray(snapshot)?snapshot:[]){
    const current=stateOf(workspace,expected.path);
    if(expected.error||current.error){if(expected.error!==current.error)drift.push({path:expected.path,changed:['error'],expected,current});continue}
    const changed=STATE_FIELDS.filter(key=>expected[key]!==current[key]);
    if(changed.length)drift.push({path:expected.path,changed,expected,current});
  }
  return {passed:drift.length===0,checked:Array.isArray(snapshot)?snapshot.length:0,drift};
}
export function enforceValidationPostimage(result,postimageIntegrity,validatedPostimage=null){
  const guarded={...(result||{}),postimageIntegrity,validatedPostimage:Array.isArray(validatedPostimage)?validatedPostimage:null};
  if(result?.passed===true&&postimageIntegrity?.passed===false)return {...guarded,status:'FAILED',passed:false,hardGate:'VALIDATION_POSTIMAGE_DRIFT',validatedPostimage:null};
  return guarded;
}
export function checkDeliveryPostimage(workspace,validatedPostimage){
  if(!Array.isArray(validatedPostimage))return {passed:false,checked:0,drift:[],hardGate:'DELIVERY_POSTIMAGE_RECEIPT_REQUIRED'};
  const integrity=compareValidationPostimage(workspace,validatedPostimage);
  return {...integrity,hardGate:integrity.passed?'PASS':'DELIVERY_POSTVALIDATION_DRIFT'};
}
