/** 在远程网页中执行的固定只读脚本。没有宿主桥、eval 参数或用户提供的代码。 */
export const PAGE_EXTRACTOR = `(() => {
  const limit=40000, selected=String(window.getSelection?.()||'').slice(0,limit);
  const forbidden='script,style,noscript,iframe,input,textarea,select,button,[contenteditable],[hidden],nav,header,footer';
  const chunks=[];let size=0;
  const root=document.querySelector('main,article,[role="main"]')||document.body;
  const meta=(name)=>document.querySelector('meta[name="'+name+'" i]')?.getAttribute('content')||'';
  const canonical=document.querySelector('link[rel~="canonical" i]')?.href||'';
  const robots=meta('robots').toLowerCase();
  const description=(meta('description')||document.querySelector('meta[property="og:description" i]')?.getAttribute('content')||'').slice(0,2000);
  const hasPasswordForm=!!document.querySelector('input[type="password"]');
  if(!root)return {title:document.title,text:'',selected:'',description,canonical,robots,hasPasswordForm,truncated:false};
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  while(walker.nextNode() && size<limit){
    const n=walker.currentNode,p=n.parentElement;
    if(!p||p.closest(forbidden))continue;
    const style=getComputedStyle(p);if(style.display==='none'||style.visibility==='hidden'||!p.getClientRects().length)continue;
    const t=n.textContent.replace(/\s+/g,' ').trim();if(!t)continue;
    chunks.push(t.slice(0,limit-size));size+=t.length+1;
  }
  return {title:document.title.slice(0,500),text:chunks.join('\n').slice(0,limit),selected,description,canonical,robots,hasPasswordForm,truncated:size>=limit};
})()`;
