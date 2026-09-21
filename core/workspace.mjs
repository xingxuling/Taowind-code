import fs from 'node:fs';
import path from 'node:path';
import {safePath} from './path-boundary.mjs';
import {sha256Buffer} from './hash.mjs';
import {isCredentialLikePath} from './repo-context.mjs';

const HIDDEN=new Set(['.git','node_modules','.next','dist','build','.venv','runtime-data']);
const TEXT_EXT=new Set(['.js','.mjs','.cjs','.ts','.tsx','.jsx','.json','.md','.txt','.css','.html','.yml','.yaml','.toml','.py','.rcl','.sh','.cmd','.ps1','.java','.kt','.kts','.go','.rs','.c','.h','.cpp','.hpp','.cs','.swift','.rb','.php','.vue','.svelte']);

function atomicWrite(file,content){
  fs.mkdirSync(path.dirname(file),{recursive:true});
  const tmp=`${file}.taowind-${process.pid}-${Date.now()}.tmp`;
  fs.writeFileSync(tmp,content);
  fs.renameSync(tmp,file);
}
function objectIdentity(st){return st&&st.ino?`${st.dev}:${st.ino}`:null}

export class WorkspaceService {
  constructor(root){
    this.root=path.resolve(root);
    fs.mkdirSync(this.root,{recursive:true});
  }
  tree(rel='.',depth=0){
    const abs=safePath(this.root,rel); const stat=fs.statSync(abs); if(!stat.isDirectory()) return null;
    return fs.readdirSync(abs,{withFileTypes:true})
      .filter(x=>!HIDDEN.has(x.name))
      .sort((a,b)=>Number(b.isDirectory())-Number(a.isDirectory())||a.name.localeCompare(b.name))
      .slice(0,300)
      .map(x=>{const child=path.posix.join(rel==='.'?'':rel.replaceAll('\\','/'),x.name);return {name:x.name,path:child,type:x.isDirectory()?'dir':'file',children:x.isDirectory()&&depth<5?this.tree(child,depth+1):undefined};});
  }
  read(rel){
    const abs=safePath(this.root,rel); const st=fs.statSync(abs); if(!st.isFile()||st.size>2_000_000) throw new Error('FILE_NOT_READABLE'); return fs.readFileSync(abs,'utf8');
  }
  readBytes(rel,maxBytes=2_000_000){
    const abs=safePath(this.root,rel); const st=fs.statSync(abs); if(!st.isFile()||st.size>maxBytes) throw new Error('FILE_NOT_READABLE'); return fs.readFileSync(abs);
  }
  ancestorState(rel){
    const abs=safePath(this.root,rel),parent=path.dirname(abs);
    const relParent=path.relative(this.root,parent);
    if(!relParent||relParent==='.') return {path:rel,ok:true};
    let cursor=this.root;
    for(const part of relParent.split(path.sep).filter(Boolean)){
      cursor=path.join(cursor,part);
      let st;try{st=fs.lstatSync(cursor)}catch(error){if(error?.code==='ENOENT'||error?.code==='ENOTDIR')break;throw error}
      const ancestor=path.relative(this.root,cursor).split(path.sep).join('/');
      if(st.isSymbolicLink()) return {path:rel,ok:false,ancestor,type:'symlink'};
      if(!st.isDirectory()) return {path:rel,ok:false,ancestor,type:'non-directory'};
    }
    return {path:rel,ok:true};
  }
  stat(rel){
    const abs=safePath(this.root,rel);
    if(!fs.existsSync(abs)) return {path:rel,exists:false,sha256:null,size:0,identity:null};
    const st=fs.lstatSync(abs),identity=objectIdentity(st);
    if(st.isSymbolicLink()) return {path:rel,exists:true,type:'symlink',sha256:null,size:st.size,identity};
    if(!st.isFile()) return {path:rel,exists:true,type:'dir',sha256:null,size:st.size,identity};
    const bytes=fs.readFileSync(abs); return {path:rel,exists:true,type:'file',sha256:sha256Buffer(bytes),size:bytes.length,identity};
  }
  write(rel,content){
    const abs=safePath(this.root,rel); const text=String(content); atomicWrite(abs,Buffer.from(text,'utf8')); return {path:rel,bytes:Buffer.byteLength(text),sha256:sha256Buffer(Buffer.from(text,'utf8'))};
  }
  remove(rel){
    const abs=safePath(this.root,rel); if(!fs.existsSync(abs)) return {path:rel,removed:false}; const st=fs.lstatSync(abs); if(!st.isFile()&&!st.isSymbolicLink()) throw new Error('DELETE_FILE_ONLY'); fs.unlinkSync(abs); return {path:rel,removed:true};
  }
  manifest({maxFiles=2000}={}){
    const out=[]; const walk=(dir,rel='')=>{if(out.length>=maxFiles)return;for(const e of fs.readdirSync(dir,{withFileTypes:true})){if(HIDDEN.has(e.name))continue;const childRel=rel?`${rel}/${e.name}`:e.name;const child=path.join(dir,e.name);if(e.isDirectory()){walk(child,childRel);continue;}if(!e.isFile())continue;const st=fs.statSync(child);out.push({path:childRel,size:st.size,ext:path.extname(e.name).toLowerCase()});if(out.length>=maxFiles)return;}}; walk(this.root); return out;
  }
  contextBundle(paths,{maxBytes=220_000,maxFiles=32}={}){
    const selected=[]; let total=0;
    for(const raw of [...new Set(paths||[])].slice(0,maxFiles)){
      const rel=String(raw||'').replaceAll('\\','/').replace(/^\.\//,'');
      if(!rel||isCredentialLikePath(rel))continue;
      const ext=path.extname(rel).toLowerCase(); if(ext&&!TEXT_EXT.has(ext))continue;
      try{const ancestor=this.ancestorState(rel);if(!ancestor.ok)continue;const abs=safePath(this.root,rel);const st=fs.lstatSync(abs);if(st.isSymbolicLink()||!st.isFile()||st.size>80_000||total+st.size>maxBytes)continue;const content=fs.readFileSync(abs,'utf8');selected.push({path:rel,content});total+=Buffer.byteLength(content);}catch{}
    }
    return {files:selected,totalBytes:total};
  }
}
