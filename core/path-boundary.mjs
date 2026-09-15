import fs from 'node:fs';
import path from 'node:path';

function boundaryError(code='WORKSPACE_BOUNDARY'){
  return Object.assign(new Error(code),{code});
}

function isWithin(base,target){
  return target===base || target.startsWith(base+path.sep);
}

function nearestExisting(target){
  let cursor=target;
  for(;;){
    if(fs.existsSync(cursor)) return cursor;
    const parent=path.dirname(cursor);
    if(parent===cursor) return null;
    cursor=parent;
  }
}

export function safePath(root, relative='.') {
  const base=path.resolve(root);
  const target=path.resolve(base, relative || '.');
  if(!isWithin(base,target)) throw boundaryError();

  const existingBase=nearestExisting(base);
  if(!existingBase) throw boundaryError('WORKSPACE_ROOT_MISSING');
  const realBase=fs.realpathSync.native ? fs.realpathSync.native(existingBase) : fs.realpathSync(existingBase);
  const ancestor=nearestExisting(target);
  if(!ancestor) throw boundaryError();
  const realAncestor=fs.realpathSync.native ? fs.realpathSync.native(ancestor) : fs.realpathSync(ancestor);
  if(!isWithin(realBase,realAncestor)) throw boundaryError('WORKSPACE_SYMLINK_ESCAPE');
  return target;
}

export function assertWorkspacePath(root, absolutePath){
  const base=path.resolve(root);
  const rel=path.relative(base,path.resolve(absolutePath));
  return safePath(base,rel||'.');
}
