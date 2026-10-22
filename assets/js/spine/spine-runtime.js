'use strict';
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
 proto.load=function(atlasText,textureLoader){
  originalLoad.call(this,atlasText,textureLoader);
  for(const region of this.regions){
   const degrees=((Number(region.degrees)||0)%360+360)%360;
   if(degrees===270){
    region.rotate=true;
    region.u=region.x/region.page.width;
    region.v=region.y/region.page.height;
    region.u2=(region.x+region.height)/region.page.width;
    region.v2=(region.y+region.width)/region.page.height;
   }else if(degrees===180){
    region.rotate=false;
   }
  }
 };
 rt.RegionAttachment.prototype.setRegion=function(region){
  this.region=region;
  const uv=this.uvs,u=region.u,v=region.v,U=region.u2,V=region.v2;
  const degrees=((Number(region.degrees)||0)%360+360)%360;
  const corners=degrees===90 ? [U,V,u,V,u,v,U,v]
   :degrees===180 ? [U,v,U,V,u,V,u,v]
   :degrees===270 ? [u,v,U,v,U,V,u,V]
   :[u,V,u,v,U,v,U,V];
  for(let i=0;i<8;i++)uv[i]=corners[i];
 };
 proto.__fixedFullRotations=true;
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
function ensureRuntime(version){
 // Serialize script registration so rapid selection cannot corrupt globals.
 const request=runtimeQueue.then(async()=>{
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
     script.src=url;
     script.onload=()=>{
      clearTimeout(timeout);
      if(!window.spine?.SpinePlayer){reject(Error('脚本已加载但未注册 SpinePlayer'));return}
      try{if(legacy)patchSpine38AtlasRotations();resolve()}catch(e){reject(e)}
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
 try{player?.dispose?.()}catch(e){console.warn(e)}
 player=null;
 pausedInBackground=null;
 rendererFrameStats.at=0;rendererFrameStats.count=0;
 viewZoom=1;viewOffsetX=0;viewOffsetY=0;
 $('zoomValue').textContent='100%';
 setViewerToolsEnabled(false);
 if(azurlaneFrame){azurlaneFrame.remove();azurlaneFrame=null;azurlaneReady=false;azurlanePending=null;azurlanePlayingId=''}
 const ph=document.createElement('div');ph.id='placeholder';ph.textContent='正在准备动画画布…';
 $('player').replaceChildren(ph);
 return ph;
}
async function show(options,title,onError){
 const attempt=++currentAttempt;
 stopWatchdog();
 status('正在加载 '+title+' 的骨骼、图集与贴图…');$('title').textContent=title;
 try{
  await ensureRuntime($('version').value);
  if(attempt!==currentAttempt)return;
  clearPlayer();
  const skeletonPath=options.skeleton||options.binaryUrl||options.jsonUrl;
  const atlasPath=options.atlas||options.atlasUrl;
  const normalized={...options,atlasUrl:atlasPath};
  if(skeletonPath){if(/\.json(?:[?#]|$)/i.test(skeletonPath))normalized.jsonUrl=skeletonPath;else if($('version').value==='3.8')normalized.skelUrl=skeletonPath;else normalized.binaryUrl=skeletonPath;}
  const config={...normalized,showControls:false,controlBones:false,frame:(p)=>recordSpineFrame(p),update:(p)=>applySharpSpineCamera(p),premultipliedAlpha:options.premultipliedAlpha??true,alpha:false,backgroundColor:'#142238ff',
   success:(p)=>{
    if(attempt!==currentAttempt)return;
    stopWatchdog();player=p;
    // Spine 4.x invokes update() after resetting its camera but before drawing.
    // Legacy bundled Spine 3.8 lacks this hook; leave its compatible CSS zoom.
    p._archiveNativeView=$('version').value!=='3.8'
      &&!!p.sceneRenderer?.camera&&typeof p.sceneRenderer.camera.zoom==='number';
    rendererFrameStats.at=0;rendererFrameStats.count=0;
    updateGPUStatus(spineGraphicsStatus(p));
     setViewerToolsEnabled(true);
     resetViewerTransform();
     connectCanvasGestures(p);
    // Some exports put the complete character under a numbered skin ("00",
    // "01") while the initial "default" skin contains only stray attachments.
    // Such models render empty and trigger "Animation bounds are invalid".
    const sk=p.skeleton,skins=sk?.data?.skins||[];
    if(sk&&skins.length>1){
     const countAttachments=()=>sk.slots.filter(slot=>!!slot.attachment).length;
     const initial=countAttachments();
     if(initial<6){
      let bestSkin=sk.skin,bestCount=initial;
      for(const skin of skins){
       try{
        sk.setSkin(skin);sk.setSlotsToSetupPose();
        const count=countAttachments();
        if(count>bestCount){bestCount=count;bestSkin=skin}
       }catch(e){console.warn('Skin inspect failed: '+skin.name,e)}
      }
      if(bestSkin&&bestCount>initial){
       sk.setSkin(bestSkin);sk.setSlotsToSetupPose();sk.updateWorldTransform();
       p.config.skin=bestSkin.name;
      }
     }
    }
    const names=(p.skeleton?.data?.animations||[]).map(a=>a.name).filter(Boolean);
    $('animationPicker').replaceChildren(...names.map(name=>new Option(name,name)));
    $('animationPicker').disabled=!names.length;
    if(!names.length){status('骨骼已显示，但没有找到可播放的动作。',true);return}
    const preferred=names.find(n=>/^(idle|idle_0?1|stand|breath|loop|wait|default)$/i.test(n))
      ||names.find(n=>/idle|stand|breath|wait/i.test(n))
      ||names[0];
    try{
      p.setAnimation(preferred,true);
      $('animationPicker').value=preferred;
      p.play();
      if(document.hidden){pausedInBackground=p;p.pause()}
      status('正在播放：'+title+' · '+preferred+'（共 '+names.length+' 个动作，可用上方动作菜单切换）');
    }catch(e){status('骨骼已加载，但自动播放动作失败：'+e.message,true)}
   },
   error:(_p,reason)=>{if(attempt!==currentAttempt)return;stopWatchdog();
    if(onError)onError(String(reason||'资源加载失败'));else status('加载失败：'+String(reason||'请核查 Spine 版本及资源路径'),true)}
  };
  $('player').replaceChildren();
  watchdog=setTimeout(()=>{if(attempt!==currentAttempt)return;stopWatchdog();if(onError)onError('30 秒内未完成加载，可能是源站拒绝访问、图片下载缓慢或 WebGL 初始化失败');else status('加载超时（30 秒）。请检查浏览器网络控制台及源站访问。',true)},30000);
  player=new spine.SpinePlayer('player',config);
 }catch(e){stopWatchdog();if(attempt===currentAttempt)status('播放器初始化失败：'+(e.message||String(e)),true)}
}
