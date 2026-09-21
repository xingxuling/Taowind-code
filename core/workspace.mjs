import fs from 'node:fs';
import path from 'node:path';
import {safePath} from './path-boundary.mjs';
import {sha256Buffer} from './hash.mjs';
import {isCredentialLikePath} from './repo-context.mjs';

const HIDDEN=new Set(['.git','node_modules','.next','dist','build','.venv','runtime-data']);
const TEXT_EXT=new Set(['.js','.mjs','.cjs','.ts','.tsx','.jsx','.json','.md','.txt','.css','.html','.yml','.yaml','.toml','.py','.rcl','.sh','.cmd','.ps1','.java','.kt','.kts','.go','.rs','.c','.h','.cpp','.hpp','.cs','.swift','.rb','.php','.vue','.svelte']);

function fileMode(st){return st&&st.isFile()?st.mode&0o7777:null}
function atomicWrite(file,content,{mode=null}={}){
  fs.mkdirSync(path.dirname(file),{recursive:true});
  const tmp=`${file}.taowind-${process.pid}-${Date.now()}.tmp`;
  let desiredMode=Number.isInteger(mode)?mode:null;
  if(desiredMode===null&&fs.existsSync(file)){const st=fs.lstatSync(file);if(st.isFile())desiredMode=fileMode(st)}
  fs.writeFileSync(tmp,content);
  if(desiredMode!==null)fs.chmodSync(tmp,desiredMode);
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
    if(!fs.existsSync(abs)) return {path:rel,exists:false,sha256:null,size:0,identity:null,mode:null};
    const st=fs.lstatSync(abs),identity=objectIdentity(st);
    if(st.isSymbolicLink()) return {path:rel,exists:true,type:'symlink',sha256:null,size:st.size,identity,mode:null};
    if(!st.isFile()) return {path:rel,exists:true,type:'dir',sha256:null,size:st.size,identity,mode:null};
    const bytes=fs.readFileSync(abs); return {path:rel,exists:true,type:'file',sha256:sha256Buffer(bytes),size:bytes.length,identity,mode:fileMode(st)};
  }
  write(rel,content,{mode=null}={}){
    const abs=safePath(this.root,rel); const bytes=Buffer.isBuffer(content)?Buffer.from(content):content instanceof Uint8Array?Buffer.from(content):Buffer.from(String(content),'utf8'); atomicWrite(abs,bytes,{mode}); return {path:rel,bytes:bytes.length,sha256:sha256Buffer(bytes)};
  }
  remove(rel){
    const abs=safePath(this.root,rel); if(!fs.existsSync(abs)) return {path:rel,removed:false}; const st=fs.lstatSync(abs); if(!st.isFile()&&!st.isSymbolicLink()) throw new Error('DELETE_FILE_ONLY'); fs.unlinkSync(abs); return {path:rel,removed:true};
  }
  manifest({maxFiles=2000}={}){
    const out=[]; const walk=(dir,rel='')=>{if(out.length>=maxFiles)return;for(const e of fs.readdirSync(dir,{withFileTypes:true})){if(out.length>=maxFiles)return;if(HIDDEN.has(e.name))continue;const childRel=rel?`${rel}/${e.name}`:e.name;const child=path.join(dir,e.name);if(e.isDirectory()){walk(child,childRel);continue;}if(!e.isFile())continue;const st=fs.statSync(child);out.push({path:childRel,size:st.size,ext:path.extname(e.name).toLowerCase()});if(out.length>=maxFiles)return;}}; walk(this.root); return out;
  }
  contextBundle(paths,{maxBytes=220_000,maxFiles=32}={}){
    const selected=[]; let total=0;
    for(const raw of [...new Set(paths||[])]){
      if(selected.length>=maxFiles)break;
      const rel=String(raw||'').replaceAll('\\','/').replace(/^\.\//,'');
      if(!rel||isCredentialLikePath(rel))continue;
      const ext=path.extname(rel).toLowerCase(); if(ext&&!TEXT_EXT.has(ext))continue;
      try{const ancestor=this.ancestorState(rel);if(!ancestor.ok)continue;const abs=safePath(this.root,rel);const st=fs.lstatSync(abs);if(st.isSymbolicLink()||!st.isFile()||st.size>80_000)continue;const content=fs.readFileSync(abs,'utf8');const contentBytes=Buffer.byteLength(content);if(total+contentBytes>maxBytes)continue;selected.push({path:rel,content});total+=contentBytes;}catch{}
    }
    return {files:selected,totalBytes:total};
  }
}
