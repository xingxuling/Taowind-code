import fs from 'node:fs'; import path from 'node:path'; import {safePath} from './path-boundary.mjs';
const HIDDEN=new Set(['.git','node_modules','.next','dist','build','.venv']);
export class WorkspaceService {
 constructor(root){this.root=path.resolve(root)}
 tree(rel='.',depth=0){ const abs=safePath(this.root,rel); const stat=fs.statSync(abs); if(!stat.isDirectory()) return null;
   return fs.readdirSync(abs,{withFileTypes:true}).filter(x=>!HIDDEN.has(x.name)).sort((a,b)=>Number(b.isDirectory())-Number(a.isDirectory())||a.name.localeCompare(b.name)).slice(0,250).map(x=>{
    const child=path.posix.join(rel==='.'?'':rel.replaceAll('\\','/'),x.name); return {name:x.name,path:child,type:x.isDirectory()?'dir':'file',children:x.isDirectory()&&depth<4?this.tree(child,depth+1):undefined};
   }); }
 read(rel){const abs=safePath(this.root,rel); const st=fs.statSync(abs); if(!st.isFile()||st.size>2_000_000) throw new Error('FILE_NOT_READABLE'); return fs.readFileSync(abs,'utf8')}
 write(rel,content){const abs=safePath(this.root,rel); fs.mkdirSync(path.dirname(abs),{recursive:true}); fs.writeFileSync(abs,String(content),'utf8'); return {path:rel,bytes:Buffer.byteLength(String(content))}}
}
