'use strict';
(()=>{
 if(!new URLSearchParams(location.search).has('desktop'))return;
 const host=window.desktopHost;
 if(!host||typeof host.move!=='function')return;
 let drag=null;
 // Capture-phase handlers override the web viewer's internal image translation.
 // Small taps still reach the underlying Spine / Cubism click-and-voice handlers.
 document.addEventListener('pointerdown',event=>{
  if(event.button!==0||!event.isPrimary||!event.target.closest('#player canvas'))return;
  drag={id:event.pointerId,x:event.screenX,y:event.screenY,active:false};
 },true);
 document.addEventListener('pointermove',event=>{
  if(!drag||event.pointerId!==drag.id)return;
  const dx=event.screenX-drag.x,dy=event.screenY-drag.y;
  if(!drag.active&&Math.hypot(dx,dy)<5)return;
  drag.active=true;drag.x=event.screenX;drag.y=event.screenY;
  if(Math.abs(dx)<=150&&Math.abs(dy)<=150)host.move(dx,dy);
  event.stopImmediatePropagation();
  event.preventDefault();
 },true);
 for(const name of ['pointerup','pointercancel']){
  document.addEventListener(name,event=>{
   if(drag&&event.pointerId===drag.id){
    if(drag.active){event.stopImmediatePropagation();event.preventDefault()}
    drag=null;
   }
  },true);
 }
 // The Live2D iframe has its own pointer events. Forward only bounded pixel deltas.
 window.addEventListener('message',event=>{
  if(event.origin!==location.origin||event.data?.channel!=='anime-archive-desktop-drag')return;
  if(event.source!==document.querySelector('#player iframe')?.contentWindow)return;
  const dx=Number(event.data.dx),dy=Number(event.data.dy);
  if(Number.isFinite(dx)&&Number.isFinite(dy)&&Math.abs(dx)<=150&&Math.abs(dy)<=150)host.move(dx,dy);
 });
})();
