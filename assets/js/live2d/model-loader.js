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
let frameInteractionPlan=null;
let frameDragInteraction=false;
let cancelFrameModelSetup=null;
function live2DInputRects(){
 const im=model?.internalModel,areas=Object.values(im?.hitAreas||{});
 if(!areas.length||!app||!model?.worldTransform)return null;
 const box=document.getElementById('live2dCanvas').getBoundingClientRect();
 try{return areas.map(area=>{
  const b=im.getDrawableBounds(area.index),points=[
   {x:b.x,y:b.y},{x:b.x+b.width,y:b.y},{x:b.x,y:b.y+b.height},{x:b.x+b.width,y:b.y+b.height}
  ].map(p=>model.worldTransform.apply(im.localTransform.apply(p)));
  const x=Math.min(...points.map(p=>p.x)),y=Math.min(...points.map(p=>p.y));
  return [box.left+x*box.width/app.screen.width,box.top+y*box.height/app.screen.height,
   (Math.max(...points.map(p=>p.x))-x)*box.width/app.screen.width,
   (Math.max(...points.map(p=>p.y))-y)*box.height/app.screen.height];
 }).filter(r=>r.every(Number.isFinite)&&r[2]>0&&r[3]>0)}catch(_){return null}
}
function triggerLive2DInteraction(event,{gesture='tap'}={}){
 if(!model||!readyId||!frameInteractionPlan||!app)return null;
 const box=document.getElementById('live2dCanvas').getBoundingClientRect();
 if(!box.width||!box.height)return null;
 const point={x:(event.clientX-box.left)*app.screen.width/box.width,y:(event.clientY-box.top)*app.screen.height/box.height};
 // getBounds updates the model transform, but its declared canvas often has
 // large invisible margins. Estimated zones must follow the visible portrait.
 const declared=model.getBounds();
 const local=portraitLocalBounds||portraitGeometryBounds;
 const visible=local?ArchivePortraitFraming.unionTransformedBounds([local],model.worldTransform):null;
 const hit=frameInteractionPlan.resolve({hits:model.hitTest(point.x,point.y),point,bounds:visible||declared,gesture});
 if(hit){model._archiveLastInteraction={area:hit.area,key:hit.entry.key,mode:hit.mode};motion(hit.entry.key);notify('interaction',model._archiveLastInteraction)}
 return hit;
}
function motion(name,{mode='once'}={}){
 if(!model||typeof name!=='string')return;
 return frameMotionController?.play(name,PIXI.live2d.MotionPriority.FORCE,{mode:['once','loop','source'].includes(mode)?mode:'once',restart:true});
}
function returnToFrameIdle(){return frameMotionController?.play(frameMotionController.initialKey,PIXI.live2d.MotionPriority.FORCE,{mode:'source',restart:true})}
async function load(name,id,modelUrl){
 if(!validLive2DIdentity(name,id)){notify('error',{error:'无效的 Live2D 模型编号'});return}
 const generation=++currentGeneration;
 cancelFrameModelSetup?.();cancelFrameModelSetup=null;
 currentId=id;readyId='';frameDragInteraction=false;loadStartedAt=performance.now();portraitLocalBounds=null;portraitGeometryBounds=null;
 frameMotionController?.dispose();frameMotionController=null;frameInteractionPlan=null;
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
     let settled=false;
     const clear=()=>{clearTimeout(timer);if(cancelFrameModelSetup===cancel)cancelFrameModelSetup=null};
     const fail=error=>{if(settled)return;settled=true;clear();reject(error instanceof Error?error:Error(String(error)))};
     const cancel=()=>fail(Object.assign(Error('模型加载已取消'),{name:'AbortError'}));
     const timer=setTimeout(()=>fail(Error('模型加载超时（25秒）')),25000);
     cancelFrameModelSetup=cancel;
     try{
      // fromSync reports setup failures through onError, not an "error" event.
      // Consume the actual rejection so invalid MOC/texture files fail promptly.
      next=PIXI.live2d.Live2DModel.fromSync(candidate,{
       motionPreload:'NONE',autoUpdate:false,onLoad:()=>{if(settled)return;settled=true;clear();resolve()},onError:fail
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
  // Some exported settings omit HitAreas while the MOC retains the actual
  // named touch meshes. Reuse their current deformed geometry, not canvas ratios.
  const im=model.internalModel,recovered=ArchivePortraitInteractions.embeddedHitAreas?.(im.getDrawableIDs?.()||[])||[];
  im.hitAreas=im.hitAreas||{};
  for(const area of recovered){
   if(im.hitAreas[area.name])continue;
   const bounds=im.getDrawableBounds?.(area.index);
   if(ArchivePortraitFraming.validBounds(bounds))im.hitAreas[area.name]=area;
  }
  frameInteractionPlan=ArchivePortraitInteractions.plan({
   entries:frameMotionController.entries,areas:Object.keys(model.internalModel?.hitAreas||{})
  });
  model._archiveInteractions={mode:frameInteractionPlan.mode,areas:frameInteractionPlan.sourceAreas,
   mapped:frameInteractionPlan.mappedAreas};
  notify('interaction-capability',{description:frameInteractionPlan.description,
   dragSupported:frameInteractionPlan.mappedAreas.some(area=>/drag/.test(ArchivePortraitInteractions.normalize(area))),
   actions:(frameInteractionPlan.actions||[]).map(({key,label,group,kind,gesture})=>({key,label:label||group||key,kind,gesture}))});
  const isActive=()=>generation===currentGeneration&&model===next;
  const p=(evt)=>{if(!isActive()||frameDragInteraction)return;const pt=evt?.data?.global;if(!pt)return;model.dragging=true;model.dragX=pt.x;model.dragY=pt.y};
  // Play audio within the SAME pointer gesture and iframe. postMessage to the
  // parent is asynchronous and loses transient user activation in some browsers.
  model.on('pointerdown',p);
  model.on('pointermove',evt=>{if(isActive()&&model.dragging&&evt?.data?.global){const pt=evt.data.global;offsetX+=pt.x-model.dragX;offsetY+=pt.y-model.dragY;model.x+=pt.x-model.dragX;model.y+=pt.y-model.dragY;model.dragX=pt.x;model.dragY=pt.y}});
  for(const ev of ['pointerup','pointerupoutside'])model.on(ev,()=>{if(isActive())model.dragging=false});
  // Application renders at PIXI.UPDATE_PRIORITY.LOW (-25); sample afterwards.
  queueLive2DPortraitFit();
  warn.hidden=true;
  if(!document.hidden&&app?.ticker)app.ticker.start();
  motionAnnounced=true;
  notify('playing',{motions:actions,motionLabels,selectedMotion:initial,zoom,loadMs:Math.round(performance.now()-loadStartedAt),fpsCap:targetFPS,graphics:graphicsReport()});
 }catch(e){try{next?.destroy()}catch(_){}if(generation!==currentGeneration)return;model=null;readyId='';message('模型加载失败：'+(e?.message||String(e)));notify('error',{error:'模型加载失败：'+(e?.message||String(e))})}
}
