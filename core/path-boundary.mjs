import path from 'node:path';
export function safePath(root, relative='.') {
  const base=path.resolve(root); const target=path.resolve(base, relative || '.');
  if(target!==base && !target.startsWith(base+path.sep)) throw Object.assign(new Error('WORKSPACE_BOUNDARY'),{code:'WORKSPACE_BOUNDARY'});
  return target;
}
