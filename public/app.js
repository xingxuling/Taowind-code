const $=s=>document.querySelector(s);
const toast=m=>{const t=$('#toast');t.textContent=m;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),1800)};
let activeFile='README.md';
async function api(url,opt){const r=await fetch(url,{headers:{'content-type':'application/json'},...opt});const d=await r.json();if(!r.ok)throw new Error(d.message||d.error);return d}
function renderTree(nodes,depth=0){return (nodes||[]).map(n=>`<div class="tree-row ${n.type}" data-path="${n.path}" style="padding-left:${6+depth*12}px">${n.type==='dir'?'▾':'·'} <span>${n.name}</span></div>${n.children?renderTree(n.children,depth+1):''}`).join('')}
async function loadTree(){const d=await api('/api/tree');$('#workspaceName').textContent=d.workspace.split(/[\\/]/).pop();$('#statusWorkspace').textContent=`Workspace · ${d.workspace}`;$('#fileTree').innerHTML=renderTree(d.tree);document.querySelectorAll('.tree-row.file').forEach(el=>el.onclick=()=>openFile(el.dataset.path));}
async function openFile(path){try{const d=await api('/api/file?path='+encodeURIComponent(path));activeFile=path;$('#activeTab').textContent=path.split('/').pop();$('#codeEditor').value=d.content;syncLines();document.querySelectorAll('.tree-row').forEach(x=>x.classList.toggle('active',x.dataset.path===path));}catch(e){toast(e.message)}}
function syncLines(){const n=$('#codeEditor').value.split('\n').length;$('#lineNumbers').textContent=Array.from({length:n},(_,i)=>i+1).join('\n')}
async function save(){try{await api('/api/file',{method:'PUT',body:JSON.stringify({path:activeFile,content:$('#codeEditor').value})});toast('已保存 '+activeFile);loadGit()}catch(e){toast(e.message)}}
function renderTasks(tasks){$('#taskList').innerHTML=(tasks||[]).map(t=>`<div class="task ${t.status}"><i class="state"></i><div><span>${t.title}</span><small>${t.detail||''}</small></div><small>${Math.round((t.progress||0)*100)}%</small></div>`).join('')||'<div class="preview-placeholder"><b>还没有任务</b><span>给 DWAC × Tao AI 一个目标。</span></div>';$('#taskSummary').textContent=tasks?.length?`${tasks.length} 个任务`:'等待目标'}
async function plan(){const p=$('#prompt').value.trim();if(!p)return;const convo=$('#conversation');convo.insertAdjacentHTML('beforeend',`<div class="message user"><div class="bubble">${p.replace(/[<>&]/g,'')}</div></div><div class="message agent"><div class="agent-badge">DWAC</div><div class="bubble"><b>正在编译目标与任务图…</b><p>会保持 Evidence-first，并区分已实现与未绑定 Provider。</p></div></div>`);$('#prompt').value='';convo.scrollTop=convo.scrollHeight;try{const d=await api('/api/agent/plan',{method:'POST',body:JSON.stringify({prompt:p})});renderTasks(d.tasks);const last=convo.lastElementChild.querySelector('.bubble');last.innerHTML=`<b>${d.dwac.connected?'DWAC 已连接':'任务图已建立，DWAC Provider 尚未绑定'}</b><p>${d.dwac.message||`计划 ${d.dwac.stage_count||d.tasks.length} 个执行单元。`}</p>`}catch(e){toast(e.message)}}
async function runTerminal(){const i=$('#terminalCommand'),cmd=i.value.trim();if(!cmd)return;i.value='';$('#terminalOutput').textContent+=`\n$ ${cmd}\n`;try{const d=await api('/api/terminal/run',{method:'POST',body:JSON.stringify({command:cmd})});$('#terminalOutput').textContent+=(d.stdout||'')+(d.stderr?`\n${d.stderr}`:'')+`\n[exit ${d.code}]`;$('#terminalOutput').scrollTop=999999;loadGit()}catch(e){$('#terminalOutput').textContent+=`[blocked] ${e.message}\n`}}
async function loadGit(){try{const s=await api('/api/git/status');$('#gitBranch').textContent=s.branch?`⑂ ${s.branch}`:'⑂ no branch';$('#gitState').textContent=s.available?(s.status.length?`${s.status.length} changes`:'clean'):'Git unavailable';const d=await api('/api/git/diff');$('#gitDiff').textContent=d.diff||'No unstaged diff';}catch(e){$('#gitState').textContent=e.message}}
async function loadProviders(){const h=await api('/api/health');const p=h.providers;const connected=Object.values(p).filter(x=>x&&typeof x==='object'&&x.connected).length;$('#providerMini').textContent=`${connected}/3 connected`;$('#statusProviders').textContent=`Providers · ${connected}/3`;$('#providerDot').style.background=connected?'#45d98a':'#ffbf5a';$('#approvalMode').value=h.approvalMode}
$('#codeEditor').addEventListener('input',syncLines);
$('#codeEditor').addEventListener('scroll',()=>$('#lineNumbers').scrollTop=$('#codeEditor').scrollTop);
$('#saveBtn').onclick=save;
$('#refreshBtn').onclick=()=>{loadTree();openFile(activeFile)};
$('#planBtn').onclick=plan;
$('#newTaskBtn').onclick=()=>$('#prompt').focus();
$('#terminalRun').onclick=runTerminal;
$('#terminalCommand').addEventListener('keydown',e=>{if(e.key==='Enter')runTerminal()});
$('#gitRefresh').onclick=loadGit;
$('#approvalMode').onchange=async e=>{await api('/api/approval',{method:'POST',body:JSON.stringify({mode:e.target.value})});toast('Approval mode: '+e.target.value)};
$('#openPreview').onclick=()=>{const u=$('#previewUrl').value.trim();if(!u)return;$('#previewIframe').src=u;$('#previewIframe').style.display='block';$('#previewPlaceholder').style.display='none'};
$('#globalSearch').addEventListener('keydown',e=>{if(e.key==='Enter'){const v=e.target.value.trim();if(v){$('#prompt').value=v;plan();e.target.value=''}}});
Promise.all([loadTree(),loadProviders(),loadGit(),api('/api/tasks').then(d=>renderTasks(d.tasks))]).then(()=>openFile('README.md')).catch(e=>toast(e.message));
