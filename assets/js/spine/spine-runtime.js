'use strict';
function applyDeclaredSpineSkinLayers(p,entry){
 const layers=entry?.spineSkinLayers;if(layers===undefined)return false;
 if(!Array.isArray(layers)||!layers.length||new Set(layers).size!==layers.length)throw Error('模型皮肤层配置无效');
 const skins=layers.map(name=>{const skin=p.skeleton.data.findSkin(name);if(!skin)throw Error('源模型缺少皮肤层：'+name);return skin});
 const combined=new spine.Skin('__archive_source_layers');
 for(const skin of skins)combined.addSkin(skin);
 p.skeleton.setSkin(combined);p.skeleton.setSlotsToSetupPose();p.skeleton.updateWorldTransform();
 p._archiveSkinLayers=[...layers];return true;
}
function setVersion(v){
 // Runtime transitions do not navigate: preserve current UI, filters and scroll.
 if(!['3.8','4.0','4.1','4.2'].includes(v))throw Error('不支持的 Spine 版本：'+v);
 if($('version').value!==v)$('version').value=v;
 return true;
}
// Blue Archive's older Spine atlas exports use 180° and 270° rotation extensively.
 // The bundled Spine 3.8 player maps RegionAttachment UVs as if those entries
 // were unrotated; the result is visibly shattered collage-like characters.
 // Keep the upstream 3.8 runtime, fixing only its atlas rotation handling.
function patchSpine38AtlasRotations(){
 const rt=window.spine;
 if(!rt?.TextureAtlas?.prototype||!rt?.RegionAttachment?.prototype)throw Error('Spine 3.8 atlas classes missing');
 const proto=rt.TextureAtlas.prototype;
 if(proto.__fixedFullRotations)return;
 const originalLoad=proto.load;
 const originalSetRegion=rt.RegionAttachment.prototype.setRegion;
 // The bundled 3.8 atlas parser sizes 270-degree regions as unrotated
 // rectangles, while MeshAttachment.updateUVs already handles 270 degrees.
 // Normalize atlas bounds independently of game/selection; mixed atlases may
 // contain 0/90/180/270-degree regions within a single character.
 proto.load=function(atlasText,textureLoader){
  originalLoad.call(this,atlasText,textureLoader);
  for(const region of this.regions){
   const degrees=((Number(region.degrees)||0)%360+360)%360;
   if(degrees!==270)continue;
   const page=region.page;
   if(!(page?.width>0&&page?.height>0))throw Error('Invalid atlas page dimensions for '+region.name);
   region.rotate=true;
   region.u=region.x/page.width;
   region.v=region.y/page.height;
   region.u2=(region.x+region.height)/page.width;
   region.v2=(region.y+region.width)/page.height;
  }
 };
 // Preserve the vendor's verified 0/90 mapping. Only 180/270 require
 // the additional corner permutations absent from RegionAttachment.setRegion.
 rt.RegionAttachment.prototype.setRegion=function(region){
  const degrees=((Number(region?.degrees)||0)%360+360)%360;
  if(degrees!==180&&degrees!==270)return originalSetRegion.call(this,region);
  this.region=region;
  const uv=this.uvs,u=region.u,v=region.v,U=region.u2,V=region.v2;
  const corners=degrees===180?[U,v,U,V,u,V,u,v]:[u,v,U,v,U,V,u,V];
  for(let i=0;i<8;i++)uv[i]=corners[i];
 };
 proto.__fixedFullRotations=true;
}
// Spine 3.8's bundled SceneRenderer.resize() writes canvas.width = clientWidth
// on EVERY frame, discarding the device pixel ratio. This makes 2K+ illustration
// textures blurry even when the downloaded atlas is full resolution.
// Patch the shared renderer, not a specific game's skeleton or preview.
function patchSpine38HighDPI(){
 const webgl=window.spine?.webgl,proto=webgl?.SceneRenderer?.prototype;
 if(!proto||!webgl.ResizeMode)throw Error('Spine 3.8 WebGL renderer missing');
 if(proto.__archiveHighDPI)return;
 const originalBegin=proto.begin;
 proto.resize=function(mode){
  const canvas=this.canvas,gl=this.context?.gl;
  if(!canvas||!gl)return;
  const cssWidth=canvas.clientWidth,cssHeight=canvas.clientHeight;
  if(!(cssWidth>0&&cssHeight>0))return;
  if(!this._archiveRenderLimit){
   const reported=Number(gl.getParameter?.(gl.MAX_RENDERBUFFER_SIZE))||8192;
   this._archiveRenderLimit=Math.max(1,Math.min(8192,reported));
  }
  const requested=Math.min(2,Math.max(1,Number(window.devicePixelRatio)||1,Number(this._archiveRenderMinRatio)||1));
  // Cap the backing area to avoid allocating huge framebuffers on laptops;
  // never upscale above the device's actual pixel density.
  const ratio=Math.max(0.1,Math.min(requested,
   this._archiveRenderLimit/Math.max(cssWidth,cssHeight),
   Math.sqrt(12000000/(cssWidth*cssHeight))));
  const width=Math.max(1,Math.round(cssWidth*ratio));
  const height=Math.max(1,Math.round(cssHeight*ratio));
  if(canvas.width!==width||canvas.height!==height){
   canvas.width=width;
   canvas.height=height;
  }
  gl.viewport(0,0,canvas.width,canvas.height);
  if(mode===webgl.ResizeMode.Expand){
   this.camera.setViewport(canvas.width,canvas.height);
  }else if(mode===webgl.ResizeMode.Fit){
   const targetRatio=this.camera.viewportHeight/this.camera.viewportWidth;
   const sourceRatio=canvas.height/canvas.width;
   const scale=targetRatio<sourceRatio
    ?this.camera.viewportWidth/canvas.width
    :this.camera.viewportHeight/canvas.height;
   this.camera.viewportWidth=canvas.width*scale;
   this.camera.viewportHeight=canvas.height*scale;
  }
  this.camera.update();
 };
 // 3.8 does not expose SpinePlayer's newer update callback. Intercept the
 // native draw begin after it sets the automatic viewport so drag/wheel zoom
 // modifies the camera BEFORE drawing rather than CSS-scaling a bitmap.
 proto.begin=function(...args){
  if(typeof player!=='undefined'&&player?.sceneRenderer===this
    &&player._archiveNativeView&&typeof applySharpSpineCamera==='function'){
   applySharpSpineCamera(player);
  }
  return originalBegin.apply(this,args);
 };
 proto.__archiveHighDPI=true;
}
// The vendored 3.8 player has stopRendering(), but no dispose(). Its pause()
// also keeps drawing. Own the render loop and release each retired GPU session.
function patchSpine38Lifecycle(){
 const proto=window.spine?.SpinePlayer?.prototype;
 if(!proto||proto.__archiveLifecycle)return;
 const draw=proto.drawFrame;
 proto.drawFrame=function(...args){
  if(this._archiveDisposed)return;
  if(document.hidden){
   this.time?.update?.();
   if(args[0]!==false&&!this.stopRequestAnimationFrame)requestAnimationFrame(()=>this.drawFrame());
   return;
  }
  const result=draw.apply(this,args);
  if(!this._archiveDisposed){
   if(typeof fitRenderedSpinePortrait==='function')fitRenderedSpinePortrait(this);
   window.ArchiveDesktopBridge?.afterRender(this.canvas);
   if(typeof recordSpineFrame==='function')recordSpineFrame(this);
  }
  return result;
 };
 proto.dispose=function(){
  if(this._archiveDisposed)return;
  this._archiveDisposed=true;
  this.stopRendering();
  clearTimeout(this.cancelId);
  this.config.success=()=>{};this.config.error=()=>{};
  // A queued rAF now returns before touching disposed buffers.
  for(const resource of [this.assetManager,this.sceneRenderer]){
   try{resource?.dispose?.()}catch(error){console.warn('Spine 资源释放失败',error)}
  }
  const gl=this.context?.gl;
  try{gl?.getExtension?.('WEBGL_lose_context')?.loseContext()}catch(_){}
  this.dom?.remove?.();
 };
 proto.__archiveLifecycle=true;
}
// Keep incompatible Spine namespace objects isolated and cached by version.
function activateRuntimeStylesheet(href){
 if(!runtimeCss){
  runtimeCss=document.createElement('link');
  runtimeCss.id='spine-runtime-styles';
  runtimeCss.rel='stylesheet';
  document.head.append(runtimeCss);
 }
 if(runtimeCss.getAttribute('href')!==href)runtimeCss.href=href;
}
function ensureRuntime(version,isCurrent=()=>true){
 // Serialize script registration so rapid selection cannot corrupt globals.
 const request=runtimeQueue.then(async()=>{
  if(!isCurrent())return;
  if(loadedVersion===version&&window.spine?.SpinePlayer)return;
  if(player)clearPlayer();
  const cached=runtimeCache.get(version);
  if(cached){
   window.spine=cached.namespace;
   activateRuntimeStylesheet(cached.stylesheet);
   loadedVersion=version;
   return;
  }
  const oldNamespace=window.spine,oldVersion=loadedVersion;
  const legacy=version==='3.8',local='./vendor/spine38/';
  const bases=legacy?[local,'https://raw.githubusercontent.com/EsotericSoftware/spine-runtimes/3.8/spine-ts/build/']:[runtimeRoot+version+'.*/dist/'];
  const failures=[];
  for(const base of bases){
   const url=base+(legacy?'spine-player.js':'iife/spine-player.js');
   window.spine=undefined; // Never merge a 3.8 and a 4.x namespace.
   try{
    status('正在切换 Spine '+version+' 播放引擎，无需刷新页面…');
    await new Promise((resolve,reject)=>{
     const script=document.createElement('script');
     script.dataset.spineRuntime=version;
     const timeout=setTimeout(()=>{script.remove();reject(Error('超时（15秒）'))},15000);
     script.src=url+(base===local?'?v=20261022-utf8-v1':'');
     script.onload=()=>{
      clearTimeout(timeout);
      if(!window.spine?.SpinePlayer){reject(Error('脚本已加载但未注册 SpinePlayer'));return}
      try{if(legacy){patchSpine38AtlasRotations();patchSpine38HighDPI();patchSpine38Lifecycle()}resolve()}catch(e){reject(e)}
     };
     script.onerror=()=>{clearTimeout(timeout);script.remove();reject(Error('脚本请求失败（可能为404或网络拦截）'))};
     document.head.append(script);
    });
    const stylesheet=legacy?(base===local?local+'spine-player.css':'https://raw.githubusercontent.com/EsotericSoftware/spine-runtimes/3.8/spine-ts/player/css/spine-player.css'):base+'spine-player.css';
    runtimeCache.set(version,{namespace:window.spine,stylesheet});
    activateRuntimeStylesheet(stylesheet);
    loadedVersion=version;
    return;
   }catch(e){failures.push(url+'：'+e.message)}
  }
  window.spine=oldNamespace;loadedVersion=oldVersion;
  throw Error('Spine '+version+' 运行时全部加载失败。\n'+failures.join('\n'));
 });
 runtimeQueue=request.catch(()=>{});
 return request;
}
function clearPlayer(){
 try{if(typeof selectedVoiceChanged==='function')selectedVoiceChanged()}
 catch(error){console.warn('语音界面更新失败（继续清理播放器）',error)}
 try{player?.dispose?.()}catch(e){console.warn(e)}
 player=null;
 pausedInBackground=null;
 rendererFrameStats.at=0;rendererFrameStats.count=0;
 viewZoom=1;viewOffsetX=0;viewOffsetY=0;
 window.ArchiveTheaterUI.setZoom(1);
 setViewerToolsEnabled(false);
 if(azurlaneFrame){azurlaneFrame.remove();azurlaneFrame=null;azurlaneReady=false;azurlanePending=null;azurlanePlayingId=''}
 const ph=document.createElement('div');ph.id='placeholder';ph.textContent='正在准备动画画布…';
 $('player').replaceChildren(ph);
 return ph;
}
async function show(options,title,onError){
 const attempt=++currentAttempt;
 stopWatchdog();
 status('正在加载 '+title+' 的骨骼、图集与贴图…');window.ArchiveTheaterUI.setHeading(title);
 try{
  const version=$('version').value;
  await ensureRuntime(version,()=>attempt===currentAttempt);
  if(attempt!==currentAttempt)return;
  clearPlayer();
  const skeletonPath=options.skeleton||options.binaryUrl||options.jsonUrl;
  const atlasPath=options.atlas||options.atlasUrl;
  const normalized={...options,atlasUrl:atlasPath};
  if(skeletonPath){if(/\.json(?:[?#]|$)/i.test(skeletonPath))normalized.jsonUrl=skeletonPath;else if($('version').value==='3.8')normalized.skelUrl=skeletonPath;else normalized.binaryUrl=skeletonPath;}
  return await new Promise((resolve,reject)=>{
  const cancel=()=>{if(pendingRenderCancel===cancel)pendingRenderCancel=null;resolve(false)};
  pendingRenderCancel=cancel;
  const fail=reason=>{
   if(attempt!==currentAttempt){resolve(false);return}
   stopWatchdog();
   if(pendingRenderCancel===cancel)pendingRenderCancel=null;
   ++currentAttempt;
   clearPlayer();
   const error=Error(String(reason||'资源加载失败'));
   if(onError)onError(error.message);
   status('加载失败：'+error.message,true);
   reject(error);
  };
  const transparentDesktop=new URLSearchParams(location.search).has('desktop');
  const config={...normalized,showControls:false,controlBones:false,frame:(p)=>recordSpineFrame(p),draw:(p)=>{fitRenderedSpinePortrait(p);window.ArchiveDesktopBridge?.afterRender(p.canvas)},update:(p,delta)=>{p._archiveCompanionSession?.update(delta);applySharpSpineCamera(p)},premultipliedAlpha:options.premultipliedAlpha??true,
   alpha:transparentDesktop,backgroundColor:transparentDesktop?'#00000000':'#142238ff',
   fullScreenBackgroundColor:transparentDesktop?'#00000000':'#142238ff',
   preserveDrawingBuffer:transparentDesktop,showLoading:!transparentDesktop,
   success:(p)=>{
    if(attempt!==currentAttempt){try{p.dispose?.()}catch(e){}resolve(false);return}
    stopWatchdog();if(pendingRenderCancel===cancel)pendingRenderCancel=null;player=p;
    if(options.archiveCompanions?.length)try{ArchiveSpineCompanions.install(p,options.archiveCompanions,spine)}catch(error){fail('立绘组合失败：'+error.message);return}
    if(options.archiveEntry?.atlasCoordinateSpace){
     try{
      const atlas=p.assetManager.get(p.config.atlasUrl);
      p._archiveAtlasCoordinateDiagnostics=ArchiveSpineAtlasCoordinates.applyCoordinateSpace({
       atlas,atlasText:options.archiveAtlasText,skeleton:p.skeleton,runtime:window.spine,
       mode:options.archiveEntry.atlasCoordinateSpace
      });
     }catch(error){fail('图集坐标适配失败：'+error.message);return}
    }
    // Defer shader replacement until the current Spine draw callback exits;
    // never replace an active WebGL batcher's program halfway through a draw.
    if(typeof installSpineIllustrationQuality==='function'&&options.archiveEntry){
     queueMicrotask(()=>{
      if(player!==p)return;
      installSpineIllustrationQuality(p,options.archiveEntry);
      updateGPUStatus(spineGraphicsStatus(p));
     });
    }
    if(transparentDesktop){
     const gl=p.context?.gl||p.canvas?.getContext('webgl2')||p.canvas?.getContext('webgl');
     const attributes=gl?.getContextAttributes?.();
     // Report both player alpha config and the actual GPU surface attributes.
     // A false WebGL alpha bit cannot be corrected with CSS.
     window.__desktopRendererDiagnostics={engine:'Spine',requestedAlpha:true,
      actualAlpha:attributes?.alpha??null,clearColor:p.bg?.a??null,backgroundColor:p.config?.backgroundColor||null};
     if(p.canvas)p.canvas.style.setProperty('background','transparent','important');
     if(attributes&&attributes.alpha===false){
      console.error('Spine WebGL surface is opaque; transparency is unavailable on this renderer',window.__desktopRendererDiagnostics);
     }
    }
    // Spine 4.x uses its update callback; patched 3.8 applies the same
    // native-camera transform from SceneRenderer.begin().
    p._archiveNativeView=!!p.sceneRenderer?.camera
      &&typeof p.sceneRenderer.camera.zoom==='number';
    rendererFrameStats.at=0;rendererFrameStats.count=0;
    updateGPUStatus(spineGraphicsStatus(p));
     setViewerToolsEnabled(true);
     resetViewerTransform();
     connectCanvasGestures(p);
    // Some exports put the complete character under a numbered skin ("00",
    // "01") while the initial "default" skin contains only stray attachments.
    // Such models render empty and trigger "Animation bounds are invalid".
    const sk=p.skeleton,skins=sk?.data?.skins||[];
    p._archivePortraitFraming=options.archiveEntry?.portraitFraming;
    let declaredSkin=false;
    try{declaredSkin=applyDeclaredSpineSkinLayers(p,options.archiveEntry)}catch(error){fail(error.message);return}
    if(sk&&skins.length>1&&!declaredSkin){
     const countAttachments=()=>sk.slots.filter(slot=>!!slot.attachment&&slot.bone?.active!==false).length;
     const initial=countAttachments();
     const inactiveSkinBones=skins.some(skin=>skin.bones?.length)&&!sk.skin?.bones?.length;
     if(initial<6||inactiveSkinBones){
      let bestSkin=sk.skin,bestCount=initial;
      for(const skin of skins){
       try{
        sk.setSkin(skin);sk.setSlotsToSetupPose();
        const count=countAttachments();
        if(count>bestCount){bestCount=count;bestSkin=skin}
       }catch(e){console.warn('Skin inspect failed: '+skin.name,e)}
      }
      if(bestSkin){
       sk.setSkin(bestSkin);sk.setSlotsToSetupPose();sk.updateWorldTransform();
       p.config.skin=bestSkin.name;
      }
     }
    }
    resolve(true);
    const names=(p.skeleton?.data?.animations||[]).map(a=>a.name).filter(Boolean);
    initializeSpineInteractions(p,names);
    window.ArchiveTheaterUI.setAnimations(names);
    if(!names.length){status('骨骼已显示，但没有找到可播放的动作。',true);return}
    const preferred=names.find(n=>n===options.archiveEntry?.spineIdleAnimation)||names.find(n=>/^(idle|idle_0?1|stand|breath|loop|wait|default)$/i.test(n))
      ||names.find(n=>/idle|stand|breath|wait/i.test(n))
      ||names[0];
    try{
      p._archiveIdleAnimation=preferred;
      p.setAnimation(preferred,true);
      initializeSpinePortrait(p);
      window.ArchiveTheaterUI.selectAnimation(preferred);
      p.play();
      if(document.hidden){pausedInBackground=p;p.pause()}
      status('正在播放：'+title+' · '+preferred+'（共 '+names.length+' 个动作，可用上方动作菜单切换）');
    }catch(e){status('骨骼已加载，但自动播放动作失败：'+e.message,true)}
   },
   error:(_p,reason)=>fail(reason)
  };
  $('player').replaceChildren();
  watchdog=setTimeout(()=>fail('30 秒内未完成加载，可能是源站拒绝访问、图片下载缓慢或 WebGL 初始化失败'),30000);
  try{player=new spine.SpinePlayer('player',config)}catch(e){fail(e.message||String(e))}
  });
 }catch(e){if(attempt===currentAttempt){stopWatchdog();status('播放器初始化失败：'+(e.message||String(e)),true)}throw e}
}
