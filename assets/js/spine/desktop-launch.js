'use strict';
(()=>{
 const button=document.getElementById('sendToDesktop');
 if(!button)return;
 // The website owns catalog loading and source validation. The desktop receives
 // only the exact selected catalog identity, never a model URL or a local path.
 function currentSelection(){
  const selected=typeof chosen==='function'?chosen():null;
  if(!selected||typeof allCharacters==='undefined')return null;
  const matches=allCharacters.filter(model=>model.id===selected.id&&model.gameId===selected.gameId);
  if(matches.length!==1)return null;
  return matches[0];
 }
 const identity=value=>typeof value==='string'&&value.trim().length>0&&value.length<=256&&!/[\u0000-\u001f\u007f-\u009f]/.test(value);
 button.title='需先安装支持通用播放的新版 Windows 桌面客户端；支持本站 Spine 与 Cubism 动态立绘';
 button.addEventListener('click',()=>{
  const selected=currentSelection();
  if(!selected){
   alert('请先从当前游戏的角色列表选择一个动态立绘，再点击“放到桌面”。');
   return;
  }
  const {id,gameId:game}=selected;
  if(!identity(id)||!identity(game)){
   alert('角色目录身份无效，请刷新网站后重试。');return;
  }
  window.location.href='animecharacter://open?host=webview2&game='+encodeURIComponent(game)+'&id='+encodeURIComponent(id);
 });
 if(new URLSearchParams(location.search).has('desktop'))button.hidden=true;
})();
