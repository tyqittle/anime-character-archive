'use strict';
(() => {
 const button=document.getElementById('sendToDesktop');
 if(!button)return;
 const idPattern=/^[a-zA-Z0-9_-]{1,120}$/;
 button.addEventListener('click',()=>{
  const picker=document.getElementById('characters');
  const id=picker?.value||'';
  if(!idPattern.test(id)){
   alert('请先选择一个动态立绘角色，再点击“放到桌面”。');
   return;
  }
  // Only the installed desktop client handles this URL; browsers may ask
  // for permission before launching the application.
  window.location.href='animecharacter://open?id='+encodeURIComponent(id);
 });
 if(new URLSearchParams(location.search).has('desktop'))button.hidden=true;
})();
