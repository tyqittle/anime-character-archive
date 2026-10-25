'use strict';
// Shared by the theater and its same-origin Cubism frame. Call play() in the
// pointer/click handler: awaiting canplay first loses browser user activation.
(function(){
 const volume=value=>Number.isFinite(Number(value))?Math.max(0,Math.min(1,Number(value))):.8;
 function skinURLs(skin){return ['main1','login','touch','detail','home'].map(name=>
  'https://raw.githubusercontent.com/Fernando2603/AzurLane/main/audio/voiceline/'+encodeURIComponent(skin)+'/'+name+'.ogg')}
 function create(onState=()=>{}){
  let audio=null,generation=0,abortPending=null;
  const reportState=state=>{
   const failed=error=>console.warn('语音状态订阅者失败',error);
   try{const result=onState(state);if(result&&typeof result.then==='function')Promise.resolve(result).catch(failed)}catch(error){failed(error)}
  };
  function stop(){
   generation++;abortPending?.();abortPending=null;
   if(audio){audio.pause();audio.removeAttribute('src');audio.load();audio=null}
  }
  async function play(urls,level=.8){
   stop();const attempt=generation;
   for(const src of urls){
    if(attempt!==generation)return false;
    const clip=new Audio();audio=clip;clip.volume=volume(level);clip.preload='auto';clip.src=src;
    reportState('loading');
    try{
     const started=await new Promise((resolve,reject)=>{
      let done=false;
      const finish=(ok,error)=>{
       if(done)return;done=true;clearTimeout(timer);clip.onerror=null;
       if(abortPending===cancel)abortPending=null;
       if(error)reject(error);else resolve(ok);
      };
      const cancel=()=>finish(false);
      const timer=setTimeout(()=>finish(false,Error('加载超时')),7500);
      abortPending=cancel;
      clip.onerror=()=>finish(false,Error('文件不可播放'));
      // This invocation must stay synchronous with play(), before its first await.
      try{Promise.resolve(clip.play()).then(()=>finish(true),error=>finish(false,error))}
      catch(error){finish(false,error)}
     });
     if(!started||attempt!==generation)return false;
     clip.onended=()=>{if(attempt===generation)reportState('ended')};
     reportState('playing');return true;
    }catch(error){
     clip.pause();clip.removeAttribute('src');clip.load();
     if(attempt!==generation)return false;
     if(error?.name==='NotAllowedError'){reportState('blocked');return false}
    }
   }
   if(attempt===generation)reportState('error');
   return false;
  }
  return {play,stop,setVolume(value){if(audio)audio.volume=volume(value)}};
 }
 window.ArchiveVoice={create,skinURLs,volume};
})();
