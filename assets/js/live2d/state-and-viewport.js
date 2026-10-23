'use strict';
// Same-origin child frame isolates PIXI / Cubism global APIs from the Spine engine.
const CHANNEL='anime-archive-azurlane-v1';
const SOURCE='https://cdn.jsdelivr.net/gh/Chaoray/AzurLane-Live2D-Viewer@88cb6e56a0ad472fe7e546509f096545d2bbc5b9';
const MILKY_SOURCE='https://cdn.jsdelivr.net/gh/MilkyLan/AzurLane-Live2d@1befbb04aba3ca8a7dd9e6c8907e71d09025f2c3';
// Allow only commit-pinned, audited source trees; never arbitrary cross-origin URLs.
const COMMUNITY_SOURCE='https://cdn.jsdelivr.net/gh/Eikanya/Live2d-model@7e446cbd95ec352cdb0f73c079e4d075d7d528ac/';
function modelUrlFor(name,candidate,id){
 if(typeof candidate!=='string')return '';
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
   const m=relative.match(/^少女咖啡枪 girls cafe gun\/(girl\d{2})\/(l2d\d+\.u)\/\2\.model3\.json$/);
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
function fit(){
 if(!app||!model)return;
 // Live2D models have nonzero local-bound origins. Subtracting bounds.x/y
 // is essential: centering by model.width alone can cut off half the skin.
 const w=app.screen.width,h=app.screen.height;
 model.scale.set(1);
 let bounds=model.getLocalBounds();
 if(!bounds||!Number.isFinite(bounds.width)||!Number.isFinite(bounds.height)||bounds.width<=0||bounds.height<=0)
  bounds={x:0,y:0,width:Math.max(1,model.width),height:Math.max(1,model.height)};
 baseScale=Math.min(w*.88/Math.max(1,bounds.width),h*.84/Math.max(1,bounds.height),3);
 const factor=baseScale*zoom;
 model.scale.set(factor);
 model.position.set(
  w/2-(bounds.x+bounds.width/2)*factor+offsetX,
  h/2-(bounds.y+bounds.height/2)*factor+offsetY
 );
}
function setZoom(value){zoom=Math.max(.35,Math.min(3.5,value));fit();notify('zoom',{zoom})}
