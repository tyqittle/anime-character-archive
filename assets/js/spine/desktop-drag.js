'use strict';
(()=>{
 if(!new URLSearchParams(location.search).has('desktop'))return;
 const host=window.desktopHost;
 if(!host||typeof host.setInteractive!=='function')return;
 let interactive=null,pressed=false,lastInspection=0,cached=false;
 const notify=hit=>{
  const next=Boolean(hit||pressed);
  if(interactive===next)return;
  interactive=next;
  host.setInteractive(next);
 };
 const contains=(rect,x,y)=>x>=rect.left&&x<rect.right&&y>=rect.top&&y<rect.bottom;
 function spineHit(x,y){
  const canvas=document.querySelector('#player canvas');
  if(!canvas)return false;
  const rect=canvas.getBoundingClientRect();
  if(!contains(rect,x,y))return false;
  // A conservative viewport-space hit region prevents a full-screen transparent
  // window from blocking desktop icons. The WebGL pixel test narrows it further
  // where reading the presented framebuffer is supported.
  const h=Math.max(1,rect.height);
  const dx=typeof viewOffsetX==='number'?viewOffsetX:0;
  const dy=typeof viewOffsetY==='number'?viewOffsetY:0;
  const xx=rect.left+rect.width/2+dx,yy=rect.top+rect.height/2+dy;
  const near=Math.abs(x-xx)<Math.min(300,h*.28)&&Math.abs(y-yy)<Math.min(410,h*.37);
  if(!near)return false;
  const now=performance.now();
  if(now-lastInspection<65)return cached||near;
  lastInspection=now;
  try{
   const gl=canvas.getContext('webgl2')||canvas.getContext('webgl')||canvas.getContext('experimental-webgl');
   if(!gl)return near;
   const pixel=new Uint8Array(4);
   const px=Math.min(canvas.width-1,Math.max(0,Math.floor((x-rect.left)/rect.width*canvas.width)));
   const py=Math.min(canvas.height-1,Math.max(0,Math.floor((rect.bottom-y)/rect.height*canvas.height)));
   gl.readPixels(px,py,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);
   // A zero alpha can also mean the default framebuffer was discarded
   // after compositing. Keep the model's bounded fallback hit area.
   cached=pixel[3]>=24;
   return cached||near;
  }catch{return near}
 }
 // On Windows Electron forwards mousemove even while the whole overlay is
 // click-through (setIgnoreMouseEvents(true,{forward:true})).
 document.addEventListener('mousemove',event=>{
  const node=document.elementFromPoint(event.clientX,event.clientY);
  if(node?.closest('#player iframe'))return; // child reports Cubism hit separately
  notify(spineHit(event.clientX,event.clientY));
 },true);
 document.addEventListener('pointerdown',event=>{
  if(event.button===0&&interactive){pressed=true;notify(true)}
 },true);
 for(const kind of ['pointerup','pointercancel']){
  document.addEventListener(kind,()=>{pressed=false},true);
 }
 window.addEventListener('message',event=>{
  if(event.origin!==location.origin||event.data?.channel!=='anime-archive-desktop-hover')return;
  if(event.source!==document.querySelector('#player iframe')?.contentWindow)return;
  notify(event.data.hit===true);
 });
 window.addEventListener('blur',()=>{pressed=false;notify(false)});
 notify(false);
})();
