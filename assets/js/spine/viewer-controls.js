'use strict';
function setViewerToolsEnabled(ready){
 for(const id of ['zoomOut','zoomIn','resetView'])$(id).disabled=!ready;
 if(!ready){$('animationPicker').disabled=true;$('animationPicker').replaceChildren(new Option('选择角色后可切换动作',''))}
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
 const pixelRatio=canvas.width/Math.max(1,canvas.clientWidth);
 const nextZoom=Math.max(.5,viewZoom);
 camera.zoom/=nextZoom;
 // Translate CSS-pixel dragging to Spine world coordinates. Camera y points up.
 camera.position.x-=viewOffsetX*pixelRatio*camera.zoom;
 camera.position.y+=viewOffsetY*pixelRatio*camera.zoom;
}
function sendAzurLane(kind,extra={}){if(azurlaneFrame?.contentWindow&&azurlaneReady)azurlaneFrame.contentWindow.postMessage({channel:L2D_CHANNEL,kind,...extra},location.origin)}
function resetViewerTransform(){viewZoom=1;viewOffsetX=0;viewOffsetY=0;if(azurlaneFrame)sendAzurLane('reset');syncViewTransform()}
function adjustViewerZoom(factor){if(!player?.canvas&&!azurlaneFrame)return;viewZoom=clampViewZoom(viewZoom*factor);if(azurlaneFrame)sendAzurLane('zoom',{zoom:viewZoom});syncViewTransform()}
function connectCanvasGestures(activePlayer){
 const canvas=activePlayer.canvas;if(!canvas)return;
 canvas.classList.add('portrait-canvas');canvas.style.touchAction='none';
 const pointers=new Map();let pinchOrigin=0,pinchZoom=1;
 const distance=()=>{const [a,b]=[...pointers.values()];return Math.hypot(a.x-b.x,a.y-b.y)};
 canvas.addEventListener('pointerdown',e=>{
  if(e.pointerType==='mouse'&&e.button!==0||activePlayer!==player)return;
  pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  try{canvas.setPointerCapture(e.pointerId)}catch(_){}
  if(pointers.size===2){pinchOrigin=distance();pinchZoom=viewZoom}
 });
 canvas.addEventListener('pointermove',e=>{
  if(activePlayer!==player||!pointers.has(e.pointerId))return;
  const previous=pointers.get(e.pointerId);
  pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pointers.size===1){viewOffsetX+=e.clientX-previous.x;viewOffsetY+=e.clientY-previous.y}
  else if(pointers.size===2&&pinchOrigin>0)viewZoom=clampViewZoom(pinchZoom*distance()/pinchOrigin);
  syncViewTransform();
 });
 const finish=e=>{pointers.delete(e.pointerId);if(pointers.size<2)pinchOrigin=0};
 canvas.addEventListener('pointerup',finish);
 canvas.addEventListener('pointercancel',finish);
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
 try{player.setAnimation(e.target.value,true);player.play();resetViewerTransform();status('正在播放：'+$('title').textContent+' · '+e.target.value)}
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
