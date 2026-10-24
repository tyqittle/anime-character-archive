'use strict';
function setViewerToolsEnabled(ready){
 if(!ready)setInteractionAvailability('请选择角色以查看点击交互');
 for(const id of ['zoomOut','zoomIn','resetView'])$(id).disabled=!ready;
 if(!ready){$('animationPicker').disabled=true;$('animationPicker').replaceChildren(new Option('选择角色后可切换动作',''))}
}
function setInteractionAvailability(description){
 const node=$('interactionAvailability');if(node)node.textContent=description;
 window.ArchiveDesktopBridge?.capabilities({interaction:description});
}
function initializeSpineInteractions(activePlayer,names){
 let hitBounds=null,areas=[];
 try{
  if(window.spine?.SkeletonBounds){hitBounds=new window.spine.SkeletonBounds();hitBounds.update(activePlayer.skeleton,true);
   areas=hitBounds.boundingBoxes.map(x=>x.name).filter(Boolean)}
 }catch(_){hitBounds=null}
 activePlayer._archiveHitBounds=hitBounds;
 activePlayer._archiveInteractions=ArchivePortraitInteractions.plan({
  entries:names.map(name=>({key:name,group:name,label:name})),areas
 });
 setInteractionAvailability(activePlayer._archiveInteractions.description);
}
function triggerSpineInteraction(activePlayer,event){
 if(activePlayer!==player||!activePlayer._archiveInteractions)return;
 const frame=activePlayer._archiveCameraFrame,box=activePlayer.canvas.getBoundingClientRect();
 if(!frame||!box.width||!box.height)return;
 const point={x:frame.x+((event.clientX-box.left)/box.width-.5)*frame.worldWidth,
  y:frame.y+(.5-(event.clientY-box.top)/box.height)*frame.worldHeight,yDown:false};
 let hits=[];
 try{activePlayer._archiveHitBounds?.update(activePlayer.skeleton,true);
  const hit=activePlayer._archiveHitBounds?.containsPoint(point.x,point.y);if(hit?.name)hits=[hit.name];
 }catch(_){}
 const result=activePlayer._archiveInteractions.resolve({hits,point,bounds:activePlayer._archiveViewBounds});
 if(!result)return;
 activePlayer.setAnimation(result.entry.key,false);activePlayer.play();
 activePlayer._archiveLastInteraction={area:result.area,key:result.entry.key,mode:result.mode};
 const picker=$('animationPicker');if(picker)picker.value=result.entry.key;
 const track=activePlayer.animationState?.getCurrent(0);
 if(track){
  const old=track.listener;
  track.listener={...old,complete:entry=>{
   old?.complete?.(entry);
   if(activePlayer!==player||activePlayer.animationState?.getCurrent(0)!==track)return;
   if(activePlayer._archiveIdleAnimation){activePlayer.setAnimation(activePlayer._archiveIdleAnimation,true);
    if(picker)picker.value=activePlayer._archiveIdleAnimation;}
  }};
 }
}
function syncViewTransform(){
 // Zoom and reset must update synchronously (including direct browser tests).
 const canvas=player?.canvas;
 if(canvas){
  canvas.style.transformOrigin='center center';
  // Native camera zoom renders original texture pixels directly; CSS scaling
  // magnifies the already rasterized bitmap and makes detailed portraits soft.
  canvas.style.transform=player?._archiveNativeView
   ?'translate(0px,0px) scale(1)'
   :'translate('+viewOffsetX+'px,'+viewOffsetY+'px) scale('+viewZoom+')';
 }
 $('zoomValue').textContent=Math.round(viewZoom*100)+'%';
}
function applySharpSpineCamera(activePlayer){
 if(activePlayer!==player||!activePlayer?._archiveNativeView)return;
 const camera=activePlayer.sceneRenderer?.camera,canvas=activePlayer.canvas;
 if(!camera||!canvas||!Number.isFinite(camera.zoom)||camera.zoom<=0)return;
 const bounds=activePlayer._archiveViewBounds;
 const frame=typeof ArchivePortraitFraming!=='undefined'
  ?ArchivePortraitFraming.cameraFrame({bounds,width:canvas.clientWidth,height:canvas.clientHeight,
   zoom:viewZoom,offsetX:viewOffsetX,offsetY:viewOffsetY}):null;
 if(frame){
  camera.zoom=frame.worldWidth/Math.max(1,camera.viewportWidth);
  camera.position.x=frame.x;camera.position.y=frame.y;
  activePlayer._archiveCameraFrame=frame;
 }else{
  const pixelRatio=canvas.width/Math.max(1,canvas.clientWidth);
  camera.zoom/=Math.max(.5,viewZoom);
  camera.position.x-=viewOffsetX*pixelRatio*camera.zoom;
  camera.position.y+=viewOffsetY*pixelRatio*camera.zoom;
 }

}
// Called inside the draw callback, while the WebGL backbuffer is available.
function fitRenderedSpinePortrait(p){
 if(p!==player||!p._archiveFitPending||!p._archiveCameraFrame)return;
 if(--p._archiveFitPending>0)return;
 try{
  const canvas=p.canvas,w=canvas.width,h=canvas.height;
  if(!(w>0&&h>0))return;
  const ratio=Math.min(1,384/Math.max(w,h));
  const sample=document.createElement('canvas');
  sample.width=Math.max(1,Math.round(w*ratio));sample.height=Math.max(1,Math.round(h*ratio));
  const ctx=sample.getContext('2d',{willReadFrequently:true});
  ctx.drawImage(canvas,0,0,sample.width,sample.height);
  const rgba=ctx.getImageData(0,0,sample.width,sample.height);
  const desktop=new URLSearchParams(location.search).has('desktop');
  const visible=ArchivePortraitFraming.visibleBounds({pixels:rgba.data,width:sample.width,height:sample.height,
   background:desktop?null:[20,34,56]});
  const bounds=ArchivePortraitFraming.pixelsToWorld(visible,sample.width,sample.height,p._archiveCameraFrame);
  if(ArchivePortraitFraming.validBounds(bounds)){
   p._archiveViewBounds=bounds;
   p._archiveFraming={source:'rendered-pixels',sampleWidth:sample.width,sampleHeight:sample.height,bounds};
  }
 }catch(error){console.warn('自动取景使用骨骼边界',error)}
}
function initializeSpinePortrait(p){
 const viewport=p.currentViewport;
 if(typeof ArchivePortraitFraming!=='undefined'&&ArchivePortraitFraming.validBounds(viewport)){
  p._archiveViewBounds={x:viewport.x,y:viewport.y,width:viewport.width,height:viewport.height};
  p._archiveFraming={source:'animation-bounds',bounds:p._archiveViewBounds};
 }
 // Animation changes retain the session camera and avoid the legacy player's
 // synchronous 100-pose bounds scan on every selection.
 if(typeof p.calculateAnimationViewport==='function'&&!p._archiveOriginalViewport){
  p._archiveOriginalViewport=p.calculateAnimationViewport;
  p.calculateAnimationViewport=function(...args){
   if(!this._archiveViewBounds)return this._archiveOriginalViewport(...args);
   // 3.8 returns a rectangle; 4.x fills the supplied output viewport.
   if(args[1]&&typeof args[1]==='object')Object.assign(args[1],this._archiveViewBounds);
   return {...this._archiveViewBounds};
  };
 }
 p._archiveFitPending=2;
}
function sendAzurLane(kind,extra={}){if(azurlaneFrame?.contentWindow&&azurlaneReady)azurlaneFrame.contentWindow.postMessage({channel:L2D_CHANNEL,kind,...extra},location.origin)}
function resetViewerTransform(){
 const desktop=new URLSearchParams(location.search).has('desktop');
 viewZoom=desktop?Math.max(.5,Math.min(.7,650/Math.max(650,$('player').clientHeight))):1;
 viewOffsetX=desktop?$('player').clientWidth*.24:0;
 viewOffsetY=desktop?$('player').clientHeight*.07:0;
 if(player){
  // Reacquire the current pose even when a different action moved outside
  // the previous camera. This is explicit reset work, never a per-frame scan.
  const Vector=window.spine?.Vector2;
  if(Vector&&player.skeleton?.getBounds){
   try{
    const offset=new Vector(),size=new Vector();
    player.skeleton.getBounds(offset,size);
    const bounds={x:offset.x,y:offset.y,width:size.x,height:size.y};
    if(ArchivePortraitFraming.validBounds(bounds))player._archiveViewBounds=bounds;
   }catch(error){console.warn('当前姿态取景失败，保留会话边界',error)}
  }
  player._archiveFitPending=2;
 }
 if(azurlaneFrame)sendAzurLane('reset');
 syncViewTransform();
}
function adjustViewerZoom(factor){if(!player?.canvas&&!azurlaneFrame)return;if(player)player._archiveFitPending=0;viewZoom=clampViewZoom(viewZoom*factor);if(azurlaneFrame)sendAzurLane('zoom',{zoom:viewZoom});syncViewTransform()}
function connectCanvasGestures(activePlayer){
 const canvas=activePlayer.canvas;if(!canvas)return;
 canvas.classList.add('portrait-canvas');canvas.style.touchAction='none';
 const pointers=new Map(),tapStarts=new Map();let pinchOrigin=0,pinchZoom=1;
 const distance=()=>{const [a,b]=[...pointers.values()];return Math.hypot(a.x-b.x,a.y-b.y)};
 canvas.addEventListener('pointerdown',e=>{
  if(e.pointerType==='mouse'&&e.button!==0||activePlayer!==player)return;
  activePlayer._archiveFitPending=0;
  pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  tapStarts.set(e.pointerId,{id:e.pointerId,x:e.clientX,y:e.clientY});
  if(pointers.size>1)for(const start of tapStarts.values())start.multiple=true;
  try{canvas.setPointerCapture(e.pointerId)}catch(_){}
  if(pointers.size===2){pinchOrigin=distance();pinchZoom=viewZoom}
 });
 canvas.addEventListener('pointermove',e=>{
  if(activePlayer!==player||!pointers.has(e.pointerId))return;
  const previous=pointers.get(e.pointerId);
  const start=tapStarts.get(e.pointerId);
  if(start&&Math.hypot(e.clientX-start.x,e.clientY-start.y)>8)start.moved=true;
  pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pointers.size===1){viewOffsetX+=e.clientX-previous.x;viewOffsetY+=e.clientY-previous.y}
  else if(pointers.size===2&&pinchOrigin>0)viewZoom=clampViewZoom(pinchZoom*distance()/pinchOrigin);
  syncViewTransform();
 });
 const finish=(e,canceled=false)=>{
  const start=tapStarts.get(e.pointerId);tapStarts.delete(e.pointerId);
  pointers.delete(e.pointerId);if(pointers.size<2)pinchOrigin=0;
  if(!canceled&&ArchivePortraitInteractions.isTap(start,e)){
   e._archivePortraitTap=true;triggerSpineInteraction(activePlayer,e);
  }
 };
 canvas.addEventListener('pointerup',e=>finish(e));
 canvas.addEventListener('pointercancel',e=>finish(e,true));
 canvas.addEventListener('dblclick',()=>{if(activePlayer===player)resetViewerTransform()});
 syncViewTransform();
}
// Handle native wheel events on the persistent stage (not per-character
// canvases). Zoom directly without requiring a Ctrl or Meta modifier.
$('player').addEventListener('wheel',e=>{
 if(!player?.canvas||!Number.isFinite(e.deltaY)||e.deltaY===0)return;
 e.preventDefault();
 e.stopPropagation();
 const dy=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?$('player').clientHeight:1);
 player._archiveFitPending=0;
 const oldZoom=viewZoom;
 const nextZoom=clampViewZoom(oldZoom*Math.exp(-dy*0.0015));
 if(nextZoom===oldZoom)return;
 // Zoom about the pointer, rather than pulling the character offscreen.
 const bounds=$('player').getBoundingClientRect();
 const x=e.clientX-(bounds.left+bounds.width/2);
 const y=e.clientY-(bounds.top+bounds.height/2);
 const ratio=nextZoom/oldZoom;
 viewOffsetX=x-(x-viewOffsetX)*ratio;
 viewOffsetY=y-(y-viewOffsetY)*ratio;
 viewZoom=nextZoom;
 syncViewTransform();
},{passive:false,capture:true});
$('zoomIn').addEventListener('click',()=>adjustViewerZoom(1.2));
$('zoomOut').addEventListener('click',()=>adjustViewerZoom(1/1.2));
$('resetView').addEventListener('click',resetViewerTransform);
$('animationPicker').addEventListener('change',e=>{
 if(azurlaneFrame&&e.target.value){sendAzurLane('motion',{motion:e.target.value});return}
 if(!player||!e.target.value)return;
 try{player.setAnimation(e.target.value,true);player.play();status('正在播放：'+$('title').textContent+' · '+e.target.value)}
 catch(err){status('动作切换失败：'+err.message,true)}
});
$('fullscreenStage').addEventListener('click',async()=>{
 try{if(document.fullscreenElement)await document.exitFullscreen();else await $('stage').requestFullscreen()}
 catch(err){status('无法切换全屏：'+err.message,true)}
});
document.addEventListener('fullscreenchange',()=>{
 $('fullscreenStage').textContent=document.fullscreenElement?'⤢':'⛶';
 $('fullscreenStage').setAttribute('aria-label',document.fullscreenElement?'退出全屏':'全屏观看');
});
