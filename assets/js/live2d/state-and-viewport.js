'use strict';
// Same-origin child frame isolates PIXI / Cubism global APIs from the Spine engine.
const CHANNEL='anime-archive-azurlane-v1';
const SOURCE='https://cdn.jsdelivr.net/gh/Chaoray/AzurLane-Live2D-Viewer@88cb6e56a0ad472fe7e546509f096545d2bbc5b9';
const MILKY_SOURCE='https://cdn.jsdelivr.net/gh/MilkyLan/AzurLane-Live2d@1befbb04aba3ca8a7dd9e6c8907e71d09025f2c3';
// Allow only commit-pinned, audited source trees; never arbitrary cross-origin URLs.
const COMMUNITY_SOURCE='https://cdn.jsdelivr.net/gh/Eikanya/Live2d-model@7e446cbd95ec352cdb0f73c079e4d075d7d528ac/';
// Source adapters bind the fixed repository, model path, ID and setting stem.
// The renderer, gestures, motion policy and preview pipeline remain shared.
const EXPANSION_CUBISM_SOURCES=[
 {prefix:'tn2-',source:'./assets/model-settings/tokyonecro/',local:true,
  path:/^(tn2-(l2d\d{5}[a-z]?(?:-2048)?))\.model\.json\?v=[a-f0-9]{64}$/,identityGroup:2,stemGroup:1},
 {prefix:'gcs-47__l2d_202',id:'gcs-47__l2d_202',source:COMMUNITY_SOURCE,path:/^少女咖啡枪 girls cafe gun\/47__l2d_202\.u\/cosplay\.model3\.json$/,stem:'cosplay'},
 {prefix:'gcs-girl07-l2d8002-new',id:'gcs-girl07-l2d8002-new',source:COMMUNITY_SOURCE,path:/^少女咖啡枪 girls cafe gun\/girl07\/\(new\)l2d8002\.u\/l2d8002\.u\.model3\.json$/,stem:'l2d8002.u'},
 {prefix:'gcs-girl07-l2d21',id:'gcs-girl07-l2d21',source:COMMUNITY_SOURCE,path:/^少女咖啡枪 girls cafe gun\/girl07\/l2d21\.u\/l2d21\.model3\.json$/,stem:'l2d21'},
 {prefix:'gcs-girl120-l2d01',id:'gcs-girl120-l2d01',source:COMMUNITY_SOURCE,path:/^少女咖啡枪 girls cafe gun\/girl120\/l2d01\.u\.model3\.json$/,stem:'l2d01.u'},
 {prefix:'gcf-',source:COMMUNITY_SOURCE,path:/^少女咖啡枪 girls cafe gun\/([a-z0-9_]+)\.u\/\1\.u\.model3\.json$/,stemSuffix:'.u'},
 {prefix:'mm-',source:'https://cdn.jsdelivr.net/gh/SerenityS/memo_live2d@e4f1d58abe3610d4179c404ecf5de7865baeff62/',
  path:/^model\/(CHR_\d{6})\/\1\.model3\.json$/},
 {prefix:'is-',source:COMMUNITY_SOURCE,path:/^机动战队\/(leila|madierda|siluokayi|xinxiya)\/model\.model\.json$/,stem:'model'},
 {prefix:'vs-',source:COMMUNITY_SOURCE,path:/^VenusScramble\/(?:player|other|summon)units\/((?:player|other|summon)_unit_\d{5})\/live2d\/model\.json$/,stem:'model'},
 {prefix:'dc-',source:COMMUNITY_SOURCE,path:/^destiny_child_kr 天命之子\/(c\d+_\d+)\/model\.json$/,stem:'model'},
 {prefix:'ss-',source:COMMUNITY_SOURCE,path:/^Sacred Sword princesses\/(char2d_live2d_001)\/res\/sardyamodel\.model\.json$/,stem:'sardyamodel'}
];
function modelUrlFor(name,candidate,id){
 if(typeof candidate!=='string')return '';
 // Wave-3 normalized Cubism2 settings: only the same-origin, exact-ID file.
 // The catalog is source-checked, so never accept external or cross-skin URLs.
 if(/^(?:ggz|ao|gs1|gs2|wg)-[a-z0-9_]+$/.test(id)){
  const base='./assets/model-settings/newgames/';
  if(!candidate.startsWith(base))return '';
  const match=candidate.slice(base.length).match(/^([a-z0-9_-]+)\.model\.json\?v=([a-f0-9]{64})$/);
  if(!match||match[1]!==id||name!==id)return '';
  return new URL(candidate,location.href).href;
 }
 const adapter=EXPANSION_CUBISM_SOURCES.find(entry=>id.startsWith(entry.prefix));
 if(adapter){
  if(!candidate.startsWith(adapter.source))return '';
  try{
   const relative=decodeURIComponent(candidate.slice(adapter.source.length)),match=relative.match(adapter.path);
   const valid=match&&!relative.includes('..')&&id===(adapter.id||adapter.prefix+match[adapter.identityGroup||1].toLowerCase())&&name===(adapter.stem||match[adapter.stemGroup||1]+(adapter.stemSuffix||''));
   return valid?(adapter.local?new URL(candidate,location.href).href:candidate):'';
  }catch(error){return ''}
 }
 if(id.startsWith('al-')){
  const suffix='/live2d/'+name+'/'+name+'.model3.json';
  return [SOURCE+suffix,MILKY_SOURCE+suffix].includes(candidate)?candidate:'';
 }
 if(id.startsWith('tc-')){
  if(!candidate.startsWith(TOUHOU_SOURCE))return '';
  try{
   const relative=decodeURIComponent(candidate.slice(TOUHOU_SOURCE.length));
   const match=relative.match(/^([A-Za-z]+(?: \([A-Za-z ]+\))?)\/([A-Za-z0-9_.-]+)\.model3\.json$/);
   const slug=match?.[1].toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
   return match&&id==='tc-'+slug&&match[2]===name&&!relative.includes('..')?candidate:'';
  }catch(e){return ''}
 }
 if(id.startsWith('gc-')){
  if(!candidate.startsWith(COMMUNITY_SOURCE))return '';
  try{
   const relative=decodeURIComponent(candidate.slice(COMMUNITY_SOURCE.length));
   const m=relative.match(/^少女咖啡枪 girls cafe gun\/(girl\d{2,3})\/(l2d\d+\.u)\/\2\.model3\.json$/);
   return m&&id==='gc-'+m[1]+'-'+m[2].slice(0,-2)&&name===m[2]?candidate:'';
  }catch(e){return ''}
 }
 // Source-pinned new games use their actual model directory and skeleton stem.
 // Never permit a skin to load a different character's model by name or URL.
 if(id.startsWith('gd-')||id.startsWith('sds-')){
  if(!candidate.startsWith(COMMUNITY_SOURCE))return '';
  try{
   const path=decodeURIComponent(candidate.slice(COMMUNITY_SOURCE.length));
   if(path.includes('..'))return '';
   if(id.startsWith('gd-')){
    const m=path.match(/^少女次元\/(\d{3})\/([A-Za-z0-9_-]+)\.model3\.json$/);
    return m&&id==='gd-'+m[1]+'-'+m[2].toLowerCase()&&name===m[2]?candidate:'';
   }
   const m=path.match(/^sin 七大罪～魔王崇拜～\/([A-Za-z0-9_-]+)\/\1\.model3\.json$/);
   return m&&id==='sds-'+m[1].toLowerCase()&&name===m[1]?candidate:'';
  }catch(e){return ''}
 }
 // Commit-pinned adult-themed game models: URL, character and skin must match.
 if(id.startsWith('tn-')||id.startsWith('ml-')){
  if(!candidate.startsWith(COMMUNITY_SOURCE))return '';
  try{
   const relative=decodeURIComponent(candidate.slice(COMMUNITY_SOURCE.length));
   if(relative.includes('..'))return '';
   if(id.startsWith('tn-')){
    const m=relative.match(/^凍京Nerco\/l2d\/(l2d\d{5}[a-z]?)\/\1\.model3\.json$/);
    return m&&id==='tn-'+m[1]&&name===m[1]?candidate:'';
   }
   const m=relative.match(/^galgame live2d\/メイドさんのいる暮らしS\/(ele_[ab][0-4])\/model\.model3\.json$/);
   return m&&id==='ml-'+m[1]&&name==='model'?candidate:'';
  }catch(e){return ''}
 }
 // Whitelisted new Cubism3 sources: pinned repository, exact model, no adult-scene paths.
 if(id.startsWith('lc-')||id.startsWith('fh-')){
  if(!candidate.startsWith(COMMUNITY_SOURCE))return '';
  try{
   const relative=decodeURIComponent(candidate.slice(COMMUNITY_SOURCE.length));
   if(relative.includes('..'))return '';
   if(id.startsWith('lc-')){
    const m=relative.match(/^galgame live2d\/LOVE³-LOVE CUBE-\/live2d\/(akira|iori|nodoka)\/((?:akira|iori|nodoka)_st0[12]_w)\.model3\.json$/);
    return m&&m[2].startsWith(m[1]+'_')&&id==='lc-'+m[2]&&name===m[2]?candidate:'';
   }
   const m=relative.match(/^galgame live2d\/Fox Hime Zero\/([a-z][a-z0-9_]*)\/\1\.model3\.json$/);
   return m&&id==='fh-'+m[1]&&name===m[1]?candidate:'';
  }catch(e){return ''}
 }
 if(!/^(?:gf|ks)-[a-z0-9_-]+$/.test(id)||!candidate.startsWith(COMMUNITY_SOURCE))return '';
 try{
  const sub=decodeURIComponent(candidate.slice(COMMUNITY_SOURCE.length));
  const root=id.startsWith('gf-')?'少女前线 girls Frontline/live2dnew/':'为美好的世界献上祝福！Fantastic Days/';
  if(sub.startsWith(root)&&!sub.includes('..')&&sub.endsWith('/'+name+'.model3.json'))return candidate;
 }catch(e){}
 return '';
}
const TOUHOU_SOURCE='https://cdn.jsdelivr.net/gh/n0099/TouhouCannonBall-Live2d-Models@3c043b183be31cade537e299e47e158a2772184f/';
const SAME_ORIGIN=location.origin;
const warn=document.getElementById('warning');
let app=null,model=null,currentId='',currentGeneration=0,baseScale=1,zoom=1,offsetX=0,offsetY=0,initError='';
let queuedLoad=null,readyId='',loadStartedAt=0;
let portraitLocalBounds=null,portraitGeometryBounds=null;
// Avoid uneven frame pacing on standard 60 Hz displays. 45 FPS looks juddery
// even with a healthy WebGL renderer. Cap only genuinely constrained devices.
const lowPower=(Number(navigator.deviceMemory)>0&&navigator.deviceMemory<=2)
 ||(Number(navigator.hardwareConcurrency)>0&&navigator.hardwareConcurrency<=2)
 ||navigator.connection?.saveData===true;
const targetFPS=lowPower?30:60;
// Keep only the final click in a burst. Never display an older asynchronous result.
function requestLoad(name,id,url){
 if(queuedLoad)clearTimeout(queuedLoad);
 if(typeof frameVoicePlayer!=='undefined')frameVoicePlayer.stop();
 ++currentGeneration;
 queuedLoad=setTimeout(()=>{queuedLoad=null;load(name,id,url)},110);
}

function notify(kind,detail={}){window.parent.postMessage({channel:CHANNEL,kind,id:currentId,...detail},SAME_ORIGIN)}
function message(s){warn.textContent=s;warn.hidden=false}
function verifyName(name){return typeof name==='string'&&name!=='.'&&name!=='..'&&/^[a-zA-Z0-9_.-]{1,100}$/.test(name)}
// The strict per-game modelUrlFor allowlist owns source identity. Do not copy its
// game-prefix inventory into a second check that rejects newly registered games.
function validLive2DIdentity(name,id){
 return verifyName(name)&&typeof id==='string'&&/^[a-z][a-z0-9]*-[a-z0-9_-]{1,100}$/.test(id)
  &&(!id.startsWith('al-')||id==='al-'+name.toLowerCase());
}
// The MOC canvas size is a coordinate system, not a clipping rectangle.
// Include visible meshes outside it before doing one rendered-pixel refinement.
function measureLive2DGeometry(active){
 const im=active?.internalModel,core=im?.coreModel;
 if(!im?.getDrawableIDs||!im?.getDrawableBounds)return null;
 try{
  const rects=[],ids=im.getDrawableIDs(),opacities=core?._model?.drawables?.opacities;
  for(let i=0;i<ids.length;i++){
   if(opacities&&opacities[i]<=.01)continue;
   if(core?.getDrawableDynamicFlagIsVisible&&!core.getDrawableDynamicFlagIsVisible(i))continue;
   const rect=im.getDrawableBounds(i);
   if(ArchivePortraitFraming.validBounds(rect))rects.push({...rect});
  }
  const bounds=ArchivePortraitFraming.unionTransformedBounds(rects,im.localTransform);
  if(bounds){portraitGeometryBounds=bounds;return bounds}
 }catch(error){console.warn('Live2D 几何取景失败，使用声明画布',error)}
 return null;
}
function fit(){
 if(!app||!model)return;
 // Live2D models have nonzero local-bound origins. Subtracting bounds.x/y
 // is essential: centering by model.width alone can cut off half the skin.
 const w=app.screen.width,h=app.screen.height;
 model.scale.set(1);
 let bounds=portraitLocalBounds||portraitGeometryBounds||measureLive2DGeometry(model)||model.getLocalBounds();
 if(!bounds||!Number.isFinite(bounds.width)||!Number.isFinite(bounds.height)||bounds.width<=0||bounds.height<=0)
  bounds={x:0,y:0,width:Math.max(1,model.width),height:Math.max(1,model.height)};
 baseScale=Math.min(w*.9/Math.max(1,bounds.width),h*.88/Math.max(1,bounds.height));
 const factor=baseScale*zoom;
 model.scale.set(factor);
 model.position.set(
  w/2-(bounds.x+bounds.width/2)*factor+offsetX,
  h/2-(bounds.y+bounds.height/2)*factor+offsetY
 );
}
function setZoom(value){zoom=Math.max(.35,Math.min(3.5,value));fit();notify('zoom',{zoom})}

function fitRenderedLive2D(expected,generation){
 if(model!==expected||generation!==currentGeneration||!app||zoom!==(desktopMode?.58:1))return;
 try{
  const canvas=document.getElementById('live2dCanvas'),ratio=Math.min(1,384/Math.max(canvas.width,canvas.height));
  const sample=document.createElement('canvas');
  sample.width=Math.max(1,Math.round(canvas.width*ratio));sample.height=Math.max(1,Math.round(canvas.height*ratio));
  const ctx=sample.getContext('2d',{willReadFrequently:true});
  ctx.drawImage(canvas,0,0,sample.width,sample.height);
  const pixels=ctx.getImageData(0,0,sample.width,sample.height).data;
  const visible=ArchivePortraitFraming.visibleBounds({pixels,width:sample.width,height:sample.height,
   background:desktopMode?null:[20,34,56]});
  if(!visible)return;
  const sx=app.screen.width/sample.width,sy=app.screen.height/sample.height,factor=model.scale.x;
  portraitLocalBounds={x:(visible.x*sx-model.x)/factor,y:(visible.y*sy-model.y)/factor,
   width:visible.width*sx/factor,height:visible.height*sy/factor};
  if(!ArchivePortraitFraming.validBounds(portraitLocalBounds)){portraitLocalBounds=null;return}
  fit();
  model._archiveFraming={source:'rendered-pixels',bounds:portraitLocalBounds};
 }catch(error){console.warn('Live2D 自动取景使用模型边界',error)}
}

function queueLive2DPortraitFit(){
 const expected=model,generation=currentGeneration,requestedZoom=zoom,x=offsetX,y=offsetY;
 app.ticker.addOnce(()=>{
  if(model!==expected||generation!==currentGeneration||zoom!==requestedZoom||offsetX!==x||offsetY!==y)return;
  // The first draw applies the actual motion to the MOC meshes. Refit those
  // meshes, including portions outside the declared canvas, before sampling.
  portraitGeometryBounds=null;portraitLocalBounds=null;
  measureLive2DGeometry(expected);fit();
  app.renderer.render(app.stage);
  fitRenderedLive2D(expected,generation);
 },null,-100);
}

