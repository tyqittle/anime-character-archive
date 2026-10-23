'use strict';
window.addEventListener('message',event=>{
 if(event.origin!==SAME_ORIGIN||event.source!==window.parent)return;
 const d=event.data;
 if(d?.channel!==CHANNEL)return;
 if(d.kind==='load')requestLoad(d.skinCode,d.id,d.modelUrl);
 else if(d.kind==='voice-config')setFrameVoice(d.voice);
 else if(d.kind==='motion')motion(d.motion);
 else if(d.kind==='zoom')setZoom(Number(d.zoom)||1);
 else if(d.kind==='reset'){zoom=desktopMode?.58:1;offsetX=desktopMode?(app?.screen?.width||window.innerWidth)*.24:0;offsetY=desktopMode?(app?.screen?.height||window.innerHeight)*.07:0;portraitLocalBounds=null;portraitGeometryBounds=null;fit();if(model)queueLive2DPortraitFit();notify('zoom',{zoom})}
});
window.addEventListener('resize',()=>{if(model)fit()});
const desktopMode=new URLSearchParams(location.search).has('desktop');
if(desktopMode){
 const canvas=document.getElementById('live2dCanvas');
 let previousHit=null;
 const report=hit=>{
  if(previousHit===hit)return;
  previousHit=hit;
  window.parent.postMessage({channel:'anime-archive-desktop-hover',hit},location.origin);
 };
 canvas.addEventListener('mousemove',event=>{
  if(!model||!readyId){report(false);return}
  const bounds=model.getBounds();
  report(Number.isFinite(bounds.x)&&event.clientX>=bounds.x&&event.clientX<=bounds.x+bounds.width
   &&event.clientY>=bounds.y&&event.clientY<=bounds.y+bounds.height);
 },true);
 canvas.addEventListener('mouseleave',()=>report(false));
 document.addEventListener('visibilitychange',()=>{if(document.hidden)report(false)});
}
let drag=false,last={x:0,y:0};
document.getElementById('live2dCanvas').addEventListener('wheel',e=>{if(!model)return;e.preventDefault();setZoom(zoom*Math.exp(-e.deltaY*.0015))},{passive:false});
document.getElementById('live2dCanvas').addEventListener('pointerdown',e=>{if(e.button===1){drag=true;last={x:e.clientX,y:e.clientY}}});
document.addEventListener('pointermove',e=>{if(drag&&model){const dx=e.clientX-last.x,dy=e.clientY-last.y;offsetX+=dx;offsetY+=dy;last={x:e.clientX,y:e.clientY};model.x+=dx;model.y+=dy}});
document.addEventListener('pointerup',()=>drag=false);
// Canvas gestures work for every Cubism model, including skins whose PIXI
// hit area does not dispatch pointertap. Do not play a voice at the end of a drag.
let voicePointer=null;
const voiceCanvas=document.getElementById('live2dCanvas');
voiceCanvas.addEventListener('pointerdown',e=>{
 if(e.button===0)voicePointer={id:e.pointerId,x:e.clientX,y:e.clientY};
});
voiceCanvas.addEventListener('pointerup',e=>{
 const start=voicePointer;voicePointer=null;
 if(!start||start.id!==e.pointerId||Math.hypot(e.clientX-start.x,e.clientY-start.y)>8)return;
 playFrameVoice();
});
voiceCanvas.addEventListener('pointercancel',()=>voicePointer=null);
function graphicsReport(){
 const canvas=document.getElementById('live2dCanvas'),box=canvas.getBoundingClientRect();
 const quality={backingWidth:canvas.width,backingHeight:canvas.height,
  displayWidth:Math.round(box.width),displayHeight:Math.round(box.height),
  pixelRatio:box.width?Number((canvas.width/box.width).toFixed(2)):1,
  deviceRatio:Number(window.devicePixelRatio)||1};
 const gl=app?.renderer?.gl;
 if(!gl)return {backend:'WebGL 状态未知',renderer:'',software:false,quality};
 try{
  const info=gl.getExtension('WEBGL_debug_renderer_info');
  const renderer=String(gl.getParameter(info?.UNMASKED_RENDERER_WEBGL||gl.RENDERER)||'').slice(0,180);
  return {backend:'WebGL',renderer,software:/swiftshader|llvmpipe|softpipe|software raster|microsoft basic render/i.test(renderer),quality};
 }catch(e){return {backend:'WebGL',renderer:'',software:false,quality}}
}
(async()=>{try{
 await window.archiveLive2DReady;
 if(!window.PIXI?.Application||!PIXI.live2d?.Live2DModel)throw Error('第三方 PixiJS/Cubism 播放库未能初始化，请检查网络或扩展拦截');
 // Real pixels, not a 1x bitmap stretched across a HiDPI panel.
// Cap at 2x to avoid overly expensive drawing buffers on ultra-high-DPI screens.
const renderResolution=Math.min(2,Math.max(1,Number(window.devicePixelRatio)||1));
app=new PIXI.Application({view:document.getElementById('live2dCanvas'),autoStart:true,
 resizeTo:window,backgroundAlpha:desktopMode?0:1,backgroundColor:desktopMode?0x000000:0x142238,antialias:false,autoDensity:true,
 resolution:renderResolution,powerPreference:'high-performance'});
 // Reduce WebGL fill-rate and avoid struggling to hit 60 fps on large models.
 if(app.ticker){app.ticker.maxFPS=targetFPS;app.ticker.stop()}
 if(PIXI.Ticker?.shared)PIXI.Ticker.shared.maxFPS=targetFPS;
 document.addEventListener('visibilitychange',()=>{
  if(!app?.ticker)return;
  if(document.hidden)app.ticker.stop();
  else if(model && readyId)app.ticker.start();
 });
 // One ticker owns simulation and drawing, so hidden tabs stop both and
 // frame times cannot accumulate on Live2DModel's independent shared ticker.
 if(app?.ticker)app.ticker.add(()=>{
  if(model&&readyId&&!document.hidden)model.update(Math.min(100,app.ticker.deltaMS));
 },null,PIXI.UPDATE_PRIORITY.HIGH);
 let lastPerf=0;
 if(app?.ticker)app.ticker.add(()=>{
  if(!model||document.hidden||!readyId)return;
  const now=performance.now();
  if(now-lastPerf>=1800){
   lastPerf=now;
   notify('performance',{fps:Math.round(app.ticker.FPS)||0});
  }
 });

 message('Live2D 播放器已准备，正在等待选择角色…');
 notify('ready');
}catch(e){initError=e.message;message('Live2D 初始化失败：'+initError);notify('error',{error:initError})}})();

