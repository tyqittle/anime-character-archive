'use strict';
(()=>{
 const button=document.getElementById('sendToDesktop');
 if(!button)return;
 const nikkeId=/^c[0-9]{3,6}(?:_[0-9]{2})?$/;
 const bd2Id=/^bd2-char[0-9]{6}(?:_c)?$/;
 const trustedNikke='https://raw.githubusercontent.com/Nikke-db/Nikke-db.github.io/main/l2d/';
 const trustedBd2='https://raw.githubusercontent.com/Zormolo/Brown-Dust-2-Assets/94a3ac97b8fab7ee054e0826de7d912de0a233ef/assets/spine/character/';
 let pending=false,catalogPromise=null;
 async function getCatalog(game){
  if(game==='browndust2'){
   const response=await fetch('./data/spine-bd2-characters.json',{cache:'no-cache'});
   if(!response.ok)throw Error('无法读取棕色尘埃2资源目录');
   return response.json();
  }
  if(!catalogPromise)catalogPromise=fetch('./data/spine-characters.json',{cache:'no-cache'})
   .then(response=>{if(!response.ok)throw Error('无法读取妮姬资源目录');return response.json()})
   .catch(error=>{catalogPromise=null;throw error});
  return catalogPromise;
 }
 // Spine's binary format stores its version string immediately after the
 // 8-byte skeleton hash, prefixed with a length+1 varint. Catalog metadata
 // is advisory: several models, including c113_01, were wrongly tagged 4.0.
 function decodeBinaryVersion(bytes){
  if(bytes.length<12)throw Error('骨骼数据过短');
  let size=0,shift=0,offset=8;
  for(let i=0;i<5;i++){
   if(offset>=bytes.length)throw Error('骨骼版本字段不完整');
   const b=bytes[offset++];
   size|=(b&127)<<shift;
   if(!(b&128))break;
   shift+=7;
   if(i===4)throw Error('骨骼版本字段无效');
  }
  size-=1;
  if(size<3||size>32||offset+size>bytes.length)throw Error('骨骼版本长度无效');
  const str=new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(offset,offset+size));
  if(!/^\d+\.\d+(?:\.\d+)?$/.test(str))throw Error('骨骼版本字段不符合 Spine 格式');
  return str;
 }
 async function getActualVersion(entry){
  const base=entry.base||'';
  if(entry.gameId==='nikke'){
   if(!base.startsWith(trustedNikke+entry.id+'/')||
      !new RegExp('/'+entry.id+'_[0-9]{2}$').test(base))
    throw Error('妮姬模型来源校验失败');
  }else if(entry.gameId==='browndust2'){
   const stem=entry.id.slice(4),relative=base.slice(trustedBd2.length);
   if(!bd2Id.test(entry.id)||!base.startsWith(trustedBd2)||
      !/^[A-Za-z0-9_'-]+\/[A-Za-z0-9_'-]+\/char[0-9]{6}(?:_c)?$/.test(relative)||
      !base.endsWith('/'+stem))throw Error('棕色尘埃2模型来源校验失败');
  }else throw Error('暂不支持该游戏的桌面运行时');
  const response=await fetch(base+'.skel',{
   mode:'cors',credentials:'omit',cache:'default',
   headers:{Range:'bytes=0-63'}
  });
  if(!response.ok)throw Error('骨骼文件下载失败（HTTP '+response.status+'）');
  const size=Number(response.headers.get('content-length')||0);
  if(size>30_000_000)throw Error('骨骼文件过大');
  const bytes=new Uint8Array(await response.arrayBuffer());
  return decodeBinaryVersion(bytes);
 }
 button.title='妮姬／棕色尘埃2：检查真实 Spine 4.1 骨骼并一键放到原生桌面';
 button.addEventListener('click',async()=>{
  if(pending)return;
  const id=document.getElementById('characters')?.value||'';
  const game=nikkeId.test(id)?'nikke':bd2Id.test(id)?'browndust2':'';
  if(!game){alert('原生桌面一键导入目前支持妮姬和棕色尘埃2的 Spine 4.1 角色，其他游戏运行时仍在接入。');return}
  pending=true;button.disabled=true;
  const text=button.textContent;button.textContent='校验模型中…';
  try{
   const manifest=await getCatalog(game);
   const entry=manifest.characters?.find(item=>item.id===id && item.gameId===game);
   if(!entry){alert('角色不在网站目录中。');return}
   if(game==='browndust2'&&!entry.base){
    alert('该角色尚未提供完整 Spine 骨骼来源。');return;
   }
   // Do not reject models using "spineVersion" or "versionUnverified":
   // these catalog labels were demonstrated wrong for real 4.1 binaries.
   // Browser-side binary checking is advisory; corporate networks may
   // block raw.githubusercontent.com CORS or HTTP Range requests.
   // The native application ALWAYS validates the real skeleton itself.
   let actual=null;
   try{actual=await getActualVersion(entry)}
   catch(error){
    if(String(error?.message||'').includes('来源校验失败'))throw error;
    console.warn('Browser binary preflight unavailable; native parser will validate',error);
   }
   if(actual&&!/^4\.1(?:\.|$)/.test(actual)){
    alert('检测到 '+entry.name+' 的真实骨骼版本为 Spine '+actual+
      '。当前 My_SpinePet 原生运行时只支持 4.1。'+
      '\n该模型可在网页播放；其他 Spine 版本需要相应原生运行时。');
    return;
   }
   window.location.href=game==='browndust2'
    ? 'animecharacter://open?game=browndust2&id='+encodeURIComponent(id)
    : 'animecharacter://open?id='+encodeURIComponent(id);
  }catch(error){
   alert('暂时无法执行桌面导入：'+(error?.message||'网络错误')+
      '。请检查角色来源或网站连接后重试。');
  }finally{pending=false;button.disabled=false;button.textContent=text}
 });
 if(new URLSearchParams(location.search).has('desktop'))button.hidden=true;
})();
