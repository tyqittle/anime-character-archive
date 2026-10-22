'use strict';
// A single display policy for both Spine and Cubism. WebGL is not proof of
// hardware acceleration: Chrome's chrome://gpu is authoritative.
let rendererStatus={backend:'等待动画',renderer:'',software:false};
let rendererFrameStats={at:0,count:0};
function rendererFromGL(gl){
 if(!gl || typeof gl.getParameter!=='function')return {backend:'WebGL 状态未知',renderer:'',software:false};
 try{
  const debug=gl.getExtension?.('WEBGL_debug_renderer_info');
  const renderer=String(gl.getParameter(debug?.UNMASKED_RENDERER_WEBGL || gl.RENDERER)||'').slice(0,180);
  return {backend:'WebGL',renderer,software:/swiftshader|llvmpipe|softpipe|software raster|microsoft basic render/i.test(renderer)};
 }catch(e){return {backend:'WebGL',renderer:'浏览器限制了显卡名称读取',software:false}}
}
function spineGraphicsStatus(p){
 let gl=p?.context?.gl||p?.context?.context||p?.sceneRenderer?.context?.gl;
 if(!gl&&p?.canvas){try{gl=p.canvas.getContext('webgl2')||p.canvas.getContext('webgl')}catch(e){}}
 return rendererFromGL(gl);
}
function updateGPUStatus(info, fps){
 if(info)rendererStatus=info;
 const el=$('gpuStatus'),details=$('gpuDetails');
 if(!el)return;
 const software=rendererStatus.software;
 const suffix=Number.isFinite(fps)?' · '+Math.max(0,Math.round(fps))+' FPS':'';
 el.textContent=(software?'软件渲染 · 请检查显卡加速':rendererStatus.backend)+suffix;
 el.classList.toggle('gpu-software',software);
 const note='是否真正调用 GPU，请以 Chrome 地址栏 chrome://gpu 中 WebGL / WebGL2 的 Hardware accelerated 为准。';
 if(details)details.textContent=(rendererStatus.renderer?rendererStatus.renderer+'。':'')+note;
 el.title=(rendererStatus.renderer||'未能从浏览器读取 GPU 名称')+' · '+note;
}
function recordSpineFrame(instance){
 if(instance!==player || document.hidden)return;
 const now=performance.now();
 if(!rendererFrameStats.at)rendererFrameStats.at=now;
 rendererFrameStats.count++;
 const elapsed=now-rendererFrameStats.at;
 if(elapsed>=1600){
  updateGPUStatus(null,rendererFrameStats.count*1000/elapsed);
  rendererFrameStats.at=now;rendererFrameStats.count=0;
 }
}
let pausedInBackground=null;
document.addEventListener('visibilitychange',()=>{
 if(document.hidden){
  if(player&&!player.paused){
   pausedInBackground=player;
   try{player.pause()}catch(e){pausedInBackground=null}
  }
 }else if(pausedInBackground){
  const candidate=pausedInBackground;pausedInBackground=null;
  if(player===candidate){try{candidate.play()}catch(e){}}
 }
});
updateGPUStatus({backend:'等待动画',renderer:'',software:false});
