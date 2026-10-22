'use strict';
(()=>{
 const button=document.getElementById('sendToDesktop');
 if(!button)return;
 // Unlike the web player, pinned native My_SpinePet currently supports only
 // verified Spine 4.1 NIKKE skeletons; earlier versions must not be relabeled.
 const idPattern=/^c[0-9]{3,6}(?:_[0-9]{2})?$/;
 let catalogPromise;
 function getCatalog(){
  if(!catalogPromise){
   catalogPromise=fetch('./data/spine-characters.json',{cache:'no-cache'})
    .then(response=>{if(!response.ok)throw Error('目录网络错误');return response.json()})
    .catch(error=>{catalogPromise=null;throw error});
  }
  return catalogPromise;
 }
 button.title='原生桌面版目前支持已验证的《胜利女神：妮姬》Spine 4.1；支持普通角色和服装角色';
 button.addEventListener('click',async()=>{
  const id=document.getElementById('characters')?.value||'';
  if(!idPattern.test(id)){
   alert('请先选择一个受支持的妮姬动态立绘角色。');return;
  }
  button.disabled=true;
  try{
   const manifest=await getCatalog();
   const entry=manifest.characters?.find(item=>item.id===id);
   if(!entry){alert('角色不在网站目录中，暂不能发送到桌面。');return}
   if(entry.gameId!=='nikke'||entry.spineVersion!=='4.1'||entry.versionUnverified){
    alert('当前原生桌面版仅支持已验证的《胜利女神：妮姬》Spine 4.1 模型。\n'
      +entry.name+'：'+(entry.gameId!=='nikke'?'该游戏尚未适配':entry.versionUnverified?'模型版本尚未验证':'Spine '+entry.spineVersion+' 需要对应版本的原生运行时')
      +'。\n这不是立绘缺失，网页内仍可播放；后续将按版本扩展原生适配器。');
    return;
   }
   window.location.href='animecharacter://open?id='+encodeURIComponent(id);
  }catch(error){
   alert('暂时无法验证角色资源目录：'+(error?.message||'未知网络错误')+'。请联网刷新页面后重试。');
  }finally{button.disabled=false}
 });
 if(new URLSearchParams(location.search).has('desktop'))button.hidden=true;
})();
