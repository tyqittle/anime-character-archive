'use strict';
// Same-origin child frame isolates PIXI / Cubism global APIs from the Spine engine.
const CHANNEL='anime-archive-azurlane-v1';
const SOURCE='https://cdn.jsdelivr.net/gh/Chaoray/AzurLane-Live2D-Viewer@88cb6e56a0ad472fe7e546509f096545d2bbc5b9';
const MILKY_SOURCE='https://cdn.jsdelivr.net/gh/MilkyLan/AzurLane-Live2d@1befbb04aba3ca8a7dd9e6c8907e71d09025f2c3';
// Model URLs are accepted only from the two pinned, known archive snapshots.
function modelUrlFor(name,candidate){
 const suffix='/live2d/'+name+'/'+name+'.model3.json';
 const allowed=[SOURCE+suffix,MILKY_SOURCE+suffix];
 return allowed.includes(candidate)?candidate:SOURCE+suffix;
}
const SAME_ORIGIN=location.origin;
const warn=document.getElementById('warning');
let app=null,model=null,currentId='',currentGeneration=0,baseScale=1,zoom=1,offsetX=0,offsetY=0,initError='';
let queuedLoad=null,readyId='',loadStartedAt=0;
const lowPower=(navigator.hardwareConcurrency||8)<=4||(navigator.deviceMemory||8)<=4;
const targetFPS=lowPower?30:45;
// Keep only the final click in a burst. Never display an older asynchronous result.
function requestLoad(name,id,url){
 if(queuedLoad)clearTimeout(queuedLoad);
 ++currentGeneration;
 queuedLoad=setTimeout(()=>{queuedLoad=null;load(name,id,url)},110);
}

function notify(kind,detail={}){window.parent.postMessage({channel:CHANNEL,kind,id:currentId,...detail},SAME_ORIGIN)}
function message(s){warn.textContent=s;warn.hidden=false}
function verifyName(name){return typeof name==='string'&&/^[a-zA-Z0-9_]{2,100}$/.test(name)}
function fit(){
 if(!app||!model)return;
 // Live2D models have nonzero local-bound origins. Subtracting bounds.x/y
 // is essential: centering by model.width alone can cut off half the skin.
 const w=app.renderer.width,h=app.renderer.height;
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
