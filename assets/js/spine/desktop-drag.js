'use strict';
(()=>{
 if(!new URLSearchParams(location.search).has('desktop'))return;
 const host=window.desktopHost;
 if(!host||typeof host.setInteractive!=='function')return;
 let interactive=null,pressed=false;
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
  // Use a bounded, model-relative region for interaction. WebGL readPixels
  // on the default framebuffer can stall the GPU or return discarded pixels.
  const h=Math.max(1,rect.height);
  const dx=typeof viewOffsetX==='number'?viewOffsetX:0;
  const dy=typeof viewOffsetY==='number'?viewOffsetY:0;
  const z=typeof viewZoom==='number'?viewZoom:1;
  const cx=rect.left+rect.width/2+dx,cy=rect.top+rect.height/2+dy;
  return Math.abs(x-cx)<Math.min(330,h*.45*z)
    &&Math.abs(y-cy)<Math.min(430,h*.60*z);
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
