'use strict';
// Iframe-local voice avoids browser restrictions on cross-frame gesture playback.
let frameVoiceSkin='',frameVoiceCharacter='',frameVoiceEnabled=false,frameVoiceVolume=.8,frameVoiceIndex=0;
const frameVoicePlayer=ArchiveVoice.create(state=>{
 if(state==='playing')notify('voice-playing');
 if(state==='error'||state==='blocked')notify('voice-error',{error:state==='blocked'?'浏览器阻止播放，请再次点击人物':'当前皮肤音频不可播放'});
});
function setFrameVoice(voice){
 const skin=typeof voice?.skinId==='string'&&/^\d{6}$/.test(voice.skinId)?voice.skinId:'';
 const character=typeof voice?.characterId==='string'?voice.characterId:'';
 if(skin!==frameVoiceSkin||character!==frameVoiceCharacter||!voice?.enabled)frameVoicePlayer.stop();
 if(skin!==frameVoiceSkin)frameVoiceIndex=0;
 frameVoiceSkin=skin;frameVoiceCharacter=character;
 frameVoiceEnabled=!!voice?.enabled;frameVoiceVolume=ArchiveVoice.volume(voice?.volume);
 frameVoicePlayer.setVolume(frameVoiceVolume);
}
function playFrameVoice(){
 if(!frameVoiceEnabled||!frameVoiceSkin||currentId!==readyId||currentId!==frameVoiceCharacter)return;
 const urls=ArchiveVoice.skinURLs(frameVoiceSkin),index=frameVoiceIndex++%urls.length;
 return frameVoicePlayer.play([...urls.slice(index),...urls.slice(0,index)],frameVoiceVolume);
}
let frameMotionController=null;
function motion(name){
 if(!model||typeof name!=='string')return;
 return frameMotionController?.play(name);
}
async function load(name,id,modelUrl){
 if(!validLive2DIdentity(name,id)){notify('error',{error:'无效的 Live2D 模型编号'});return}
 const generation=++currentGeneration;
 currentId=id;readyId='';loadStartedAt=performance.now();portraitLocalBounds=null;portraitGeometryBounds=null;
 frameMotionController?.dispose();frameMotionController=null;
 zoom=desktopMode?.58:1;offsetX=desktopMode?(app?.screen?.width||window.innerWidth)*.24:0;offsetY=desktopMode?(app?.screen?.height||window.innerHeight)*.07:0;
 if(model){try{app.stage.removeChild(model);model.destroy()}catch(e){}model=null}
 if(!app){notify('error',{error:initError||'Live2D 渲染库尚未加载'});return}
 message('正在加载 '+name+' 的 Cubism 模型与动作…');
 if(app?.ticker)app.ticker.stop();
 const verifiedUrl=modelUrlFor(name,modelUrl,id);
 const candidates=verifiedUrl?ArchiveAssets.variants(verifiedUrl):[];
 const url=candidates[0];
 if(!url){message('模型来源未被收录');notify('error',{error:'模型地址未通过来源校验'});return}
 let next;
 try{
  // Many skins define dozens of idle motions. Preloading all of them floods
  // the network and delays textures. Fetch motions only when actually selected.
  const failures=[];
  for(const candidate of candidates){
   if(generation!==currentGeneration)return;
   try{
    message('正在从 '+new URL(candidate).hostname+' 加载 '+name+'…');
    await new Promise((resolve,reject)=>{
     const fail=error=>{clearTimeout(timer);reject(error instanceof Error?error:Error(String(error)))};
     const timer=setTimeout(()=>fail(Error('模型加载超时（25秒）')),25000);
     try{
      // fromSync reports setup failures through onError, not an "error" event.
      // Consume the actual rejection so invalid MOC/texture files fail promptly.
      next=PIXI.live2d.Live2DModel.fromSync(candidate,{
       motionPreload:'NONE',autoUpdate:false,onLoad:()=>{clearTimeout(timer);resolve()},onError:fail
      });
      if(!next||!next.once)fail(Error('Live2D 模型加载器未初始化'));
     }catch(error){fail(error)}
    });
    break;
   }catch(error){
    try{next?.destroy()}catch(_){}
    next=null;failures.push(new URL(candidate).hostname+'：'+(error.message||String(error)));
   }
  }
  if(!next)throw Error(failures.join('；'));
  if(generation!==currentGeneration){next.destroy();return}
  model=next;readyId=id;app.stage.addChild(model);
  model.interactive=true;
  fit();
  const manager=model.internalModel?.motionManager;
  let motionAnnounced=false;
  frameMotionController=ArchiveCubismMotions.install({manager,priorities:PIXI.live2d.MotionPriority,
   isCurrent:()=>generation===currentGeneration&&model===next,
   onChange:name=>{if(motionAnnounced)notify('motion',{name})},
   onError:error=>notify('motion-error',{error})
  });
  const actions=frameMotionController.entries.map(entry=>entry.key);
  const motionLabels=Object.fromEntries(frameMotionController.entries.map(entry=>[entry.key,entry.label]));
  const initial=frameMotionController.initialKey;
  model._archiveMotionPolicy={idle:initial,idleKind:frameMotionController.idleKind,actions:actions.length};
  // Await only the selected standby clip, leaving all other actions lazy.
  // Model readiness and the first visible fit must refer to its standby pose.
  if(initial&&!await frameMotionController.start()&&generation===currentGeneration&&model===next)throw Error('初始动作未能加载：'+initial);
  if(generation!==currentGeneration||model!==next)return;
  model.on('hit',areas=>{if(Array.isArray(areas)&&areas.length){const a=areas[0];notify('interaction',{area:a});if(actions.includes(a))motion(a)}});
  const p=(evt)=>{if(!model)return;const pt=evt?.data?.global;if(!pt)return;model.dragging=true;model.dragX=pt.x;model.dragY=pt.y};
  // Play audio within the SAME pointer gesture and iframe. postMessage to the
  // parent is asynchronous and loses transient user activation in some browsers.
  model.on('pointerdown',p);
  model.on('pointermove',evt=>{if(model?.dragging&&evt?.data?.global){const pt=evt.data.global;offsetX+=pt.x-model.dragX;offsetY+=pt.y-model.dragY;model.x+=pt.x-model.dragX;model.y+=pt.y-model.dragY;model.dragX=pt.x;model.dragY=pt.y}});
  for(const ev of ['pointerup','pointerupoutside'])model.on(ev,()=>{if(model)model.dragging=false});
  // Application renders at PIXI.UPDATE_PRIORITY.LOW (-25); sample afterwards.
  queueLive2DPortraitFit();
  warn.hidden=true;
  if(!document.hidden&&app?.ticker)app.ticker.start();
  motionAnnounced=true;
  notify('playing',{motions:actions,motionLabels,selectedMotion:initial,zoom,loadMs:Math.round(performance.now()-loadStartedAt),fpsCap:targetFPS,graphics:graphicsReport()});
 }catch(e){try{next?.destroy()}catch(_){}if(generation!==currentGeneration)return;model=null;readyId='';message('模型加载失败：'+(e?.message||String(e)));notify('error',{error:'模型加载失败：'+(e?.message||String(e))})}
}

