'use strict';
// Download pinned libraries concurrently, then execute them in dependency order.
// Raw GitHub serves text/plain with nosniff: use a JavaScript Blob URL so the
// fallback also works in browsers enforcing strict script MIME checks.
window.archiveLive2DReady=(async()=>{
 const root='https://cdn.jsdelivr.net/gh/Chaoray/AzurLane-Live2D-Viewer@88cb6e56a0ad472fe7e546509f096545d2bbc5b9/js/lib/';
 const files=['live2dcubismcore.min.js','live2d.min.js','pixi.min.js','extra.min.js','index.min.js'];
 // Cubism 4.2 Core rejects newer MOC version 5 exports before rendering.
 const core='https://cdn.jsdelivr.net/gh/lezzthanthree/lezzthanthree.github.io@928753ac3cca486a6476d3d3f824ace0e7d1f281/js/live2dcubismcore.min.js';
 const downloads=await Promise.allSettled(files.map((file,index)=>ArchiveAssets.blob(index===0?core:root+file,8000)));
 for(let index=0;index<files.length;index++){
  const result=downloads[index];
  if(result.status!=='fulfilled')throw Error(files[index]+'：'+result.reason.message);
  const url=URL.createObjectURL(new Blob([result.value],{type:'application/javascript'}));
  try{
   await new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    const finish=error=>{clearTimeout(timer);script.onload=script.onerror=null;if(error){script.remove();reject(error)}else resolve()};
    const timer=setTimeout(()=>finish(Error(files[index]+' 执行超时')),8000);
    script.onload=()=>finish();script.onerror=()=>finish(Error(files[index]+' 执行失败'));
    script.src=url;document.head.append(script);
   });
  }finally{URL.revokeObjectURL(url)}
  if(index===0){
   const deadline=performance.now()+4000;
   while(true){
    try{if(Live2DCubismCore.Version.csmGetLatestMocVersion()>=5)break}catch(error){}
    if(performance.now()>deadline)throw Error('Cubism 5 内核未能初始化');
    await new Promise(resolve=>setTimeout(resolve,20));
   }
  }
 }
})();
// bootstrap.js consumes the rejection and shows it in the theater.
window.archiveLive2DReady.catch(()=>{});

