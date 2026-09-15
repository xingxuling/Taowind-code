import {app,BrowserWindow} from 'electron'; import {spawn} from 'node:child_process'; import path from 'node:path'; import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'); let child;
app.whenReady().then(()=>{child=spawn(process.execPath,[path.join(root,'server/main.mjs')],{cwd:root,env:{...process.env,ELECTRON_RUN_AS_NODE:'1'},stdio:'inherit'});setTimeout(()=>{const w=new BrowserWindow({width:1580,height:980,minWidth:1120,minHeight:720,titleBarStyle:'hiddenInset',backgroundColor:'#07111d',webPreferences:{contextIsolation:true,sandbox:true}});w.loadURL('http://127.0.0.1:4877');},450)});
app.on('window-all-closed',()=>{child?.kill();if(process.platform!=='darwin')app.quit()});
