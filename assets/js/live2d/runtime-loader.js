'use strict';
// The renderer libraries load in order. A failed CDN cannot block parsing the
// iframe forever; try the same commit on the other provider.
window.archiveLive2DReady=(async()=>{
 const root='https://cdn.jsdelivr.net/gh/Chaoray/AzurLane-Live2D-Viewer@88cb6e56a0ad472fe7e546509f096545d2bbc5b9/js/lib/';
 for(const file of ['live2dcubismcore.min.js','live2d.min.js','pixi.min.js','extra.min.js','index.min.js']){
  let loaded=false;const failures=[];
  for(const url of ArchiveAssets.variants(root+file)){
   try{
    await new Promise((resolve,reject)=>{
     const script=document.createElement('script');
     const finish=error=>{clearTimeout(timer);script.onload=script.onerror=null;if(error){script.remove();reject(error)}else resolve()};
     const timer=setTimeout(()=>finish(Error('8秒超时')),8000);
     script.onload=()=>finish();script.onerror=()=>finish(Error('请求失败'));
     script.src=url;document.head.append(script);
    });
    loaded=true;break;
   }catch(error){failures.push(error.message)}
  }
  if(!loaded)throw Error(file+'：'+failures.join('；'));
 }
})();
// bootstrap.js consumes the rejection and shows it in the theater.
window.archiveLive2DReady.catch(()=>{});
