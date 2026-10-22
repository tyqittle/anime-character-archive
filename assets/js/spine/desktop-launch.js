'use strict';
(()=>{
 const button=document.getElementById('sendToDesktop');
 if(!button)return;
 const idPattern=/^c[0-9]{3,6}(?:_[0-9]{2})?$/;
 const trustedBase='https://raw.githubusercontent.com/Nikke-db/Nikke-db.github.io/main/l2d/';
 let pending=false,catalogPromise=null;
 function getCatalog(){
  if(!catalogPromise)catalogPromise=fetch('./data/spine-characters.json',{cache:'no-cache'})
   .then(response=>{if(!response.ok)throw Error('无法读取网站资源目录');return response.json()})
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
  if(!base.startsWith(trustedBase+entry.id+'/')||
     !new RegExp('/'+entry.id+'_[0-9]{2}$').test(base))throw Error('模型来源校验失败');
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
 button.title='网站会检查骨骼文件的真实 Spine 版本；原生客户端目前只支持 4.1';
 button.addEventListener('click',async()=>{
  if(pending)return;
  const id=document.getElementById('characters')?.value||'';
  if(!idPattern.test(id)){alert('请先选择一个《胜利女神：妮姬》角色。');return}
  pending=true;button.disabled=true;
  const text=button.textContent;button.textContent='校验模型中…';
  try{
   const manifest=await getCatalog();
   const entry=manifest.characters?.find(item=>item.id===id);
   if(!entry){alert('角色不在网站目录中。');return}
   if(entry.gameId!=='nikke'){
    alert('当前原生桌面客户端尚未接入此游戏的运行时。网页播放器不受影响。');return;
   }
   // Do not reject models using "spineVersion" or "versionUnverified":
   // these catalog labels were demonstrated wrong for real 4.1 binaries.
   const actual=await getActualVersion(entry);
   if(!actual.startsWith('4.1.')){
    alert('检测到 '+entry.name+' 的真实骨骼版本为 Spine '+actual+
      '。当前 My_SpinePet 原生运行时只支持 4.1。'+
      '\n该模型可在网页播放；其他 Spine 版本需要相应原生运行时。');
    return;
   }
   window.location.href='animecharacter://open?id='+encodeURIComponent(id);
  }catch(error){
   alert('无法校验骨骼文件：'+(error?.message||'网络错误')+
      '。为避免加载不兼容版本，这次没有启动桌面客户端。');
  }finally{pending=false;button.disabled=false;button.textContent=text}
 });
 if(new URLSearchParams(location.search).has('desktop'))button.hidden=true;
})();
