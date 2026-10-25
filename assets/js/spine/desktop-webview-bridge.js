'use strict';
(()=>{
 const query=new URLSearchParams(location.search);
 if(!query.has('desktop')||query.get('transport')!=='webview2')return;
 const child=window.parent!==window,session=query.get('session')||'';
 let lastSample=-Infinity,ready=false,viewRestored=false,failed=false,lastView='',lastSave=0;
 let sample=null,context=null,lastActions='',renderedFrames=0,lastFrameView=null;
 const emit=(kind,data={})=>{
  try{
  if(child){window.parent.postMessage({channel:'archive-desktop-surface',kind,...data},location.origin);return}
  window.chrome?.webview?.postMessage({channel:'archive-desktop-v1',session,kind,...data});
  }catch(error){console.warn('桌面宿主消息发送失败（不影响画布播放）',error)}
 };
 const current=()=>child?{id:typeof readyId==='string'?readyId:'',gameId:''}:
  (typeof chosen==='function'?chosen():null);
 const activeId=()=>current()?.id||'';
 const viewKey=()=>{const c=current();return 'archive-desktop-view:v1:'+c?.gameId+':'+c?.id};
 function saveView(view){
  if(child||!view||performance.now()-lastSave<400)return;
  const text=JSON.stringify(view);
  if(text===lastView)return;
  try{localStorage.setItem(viewKey(),text);lastView=text;lastSave=performance.now()}catch(_){}
 }
 function restoreView(){
  if(child||viewRestored)return;
  viewRestored=true;
  try{
   let v=JSON.parse(localStorage.getItem(viewKey())||'null');
   if(!v){
    const slot=Math.max(0,Math.min(99,Number(query.get('slot'))||0));
    if(!slot)return;
    v={...frameView()};
    v.offsetX-=(slot%3)*innerWidth*.26;
    v.offsetY-=Math.floor(slot/3)*innerHeight*.18;
   }
   if(![v.zoom,v.offsetX,v.offsetY].every(Number.isFinite))return;
   v.zoom=Math.min(3.5,Math.max(.5,v.zoom));
   v.offsetX=Math.min(50000,Math.max(-50000,v.offsetX));
   v.offsetY=Math.min(50000,Math.max(-50000,v.offsetY));
   if(typeof azurlaneFrame!=='undefined'&&azurlaneFrame)sendAzurLane('desktop-view',{view:v});
   else{viewZoom=v.zoom;viewOffsetX=v.offsetX;viewOffsetY=v.offsetY;player._archiveFitPending=0;syncViewTransform()}
  }catch(_){}
 }
 function announce(){
  if(child)return;
  const c=current();if(!c)return;
  if(!ready){ready=true;restoreView();emit('ready',{id:c.id,game:c.gameId,engine:c.engine||'spine',name:c.name})}
  const options=Array.from(document.getElementById('animationPicker')?.options||[])
   .filter(x=>x.value).map(x=>({id:x.value,label:x.text}));
  const key=JSON.stringify(options);
  if(lastActions!==key){lastActions=key;emit('actions',{id:c.id,actions:options})}
 }
 function frameView(){
  if(child)return {zoom,offsetX,offsetY};
  if(typeof azurlaneFrame!=='undefined'&&azurlaneFrame&&lastFrameView)return lastFrameView;
  return {zoom:viewZoom,offsetX:viewOffsetX,offsetY:viewOffsetY};
 }
 function afterRender(canvas,inputRects=null){
  if(failed||document.hidden||!canvas)return;
  const id=activeId();if(!id)return;
  if(child){if(typeof model==='undefined'||!model||!readyId)return}
  else if(typeof player==='undefined'||canvas!==player?.canvas||!player.skeleton||player._archiveFitPending>0)return;
  renderedFrames++;
  if(performance.now()-lastSample<100)return;
  lastSample=performance.now();
  try{
   const box=canvas.getBoundingClientRect();
   if(!box.width||!box.height||!canvas.width||!canvas.height)return;
   if(typeof inputRects==='function')inputRects=inputRects();
   if(!sample){sample=document.createElement('canvas');context=sample.getContext('2d',{willReadFrequently:true})}
   let size=320,rectangles=[];
   do{
    const ratio=size/Math.max(canvas.width,canvas.height);
    const w=Math.max(1,Math.round(canvas.width*ratio)),h=Math.max(1,Math.round(canvas.height*ratio));
    if(sample.width!==w||sample.height!==h){sample.width=w;sample.height=h}
    context.clearRect(0,0,w,h);context.drawImage(canvas,0,0,w,h);
    const pixels=context.getImageData(0,0,w,h);
    const allowed=Array.isArray(inputRects)?inputRects.map(([x,y,rw,rh])=>[
     (x-box.left)/box.width*w,(y-box.top)/box.height*h,rw/box.width*w,rh/box.height*h]):null;
    rectangles=ArchiveDesktopAlphaMask.runs(pixels.data,w,h,1,allowed);
    size=Math.floor(size/2);
   }while(rectangles.length>768&&size>=40);
   if(rectangles.length>768)throw Error('桌面输入轮廓超过区域预算');
   const sx=box.width/sample.width,sy=box.height/sample.height;
   const rects=rectangles.map(([x,y,w,h])=>[box.left+x*sx,box.top+y*sy,w*sx,h*sy]);
   if(child&&rects.length)ready=true;
   if(!child&&rects.length)announce();
   emit('mask',{id,rects,width:innerWidth,height:innerHeight,view:frameView()});
   if(!child)saveView(frameView());
  }catch(error){fail('桌面命中区域生成失败：'+error.message)}
 }
 function fail(error){
  if(failed)return;if(ready){emit('warning',{id:activeId(),error:String(error).slice(0,1000)});return}failed=true;emit('error',{id:child?activeId():query.get('id'),error:String(error).slice(0,1000)});
 }
 function catalogReady(){
  if(child)return;
  const c=current();
  if(!c||c.id!==query.get('id')||c.gameId!==query.get('game'))fail('请求的角色不在当前动画目录中');
 }
 if(!child){
  const style=document.createElement('style');
  style.textContent='html.desktop-mode body .theater-inspector,html.desktop-mode body .theater-panel-toggle{display:none!important}html.desktop-mode body .wrap{position:fixed!important;inset:0!important;display:block!important;padding:0!important;margin:0!important;width:100%!important;height:100%!important;max-width:none!important}html.desktop-mode body #stage,html.desktop-mode body #player{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;max-height:none!important;min-height:0!important;margin:0!important;padding:0!important;background:transparent!important}html.desktop-mode body #player iframe{width:100%!important;height:100%!important;border:0!important;background:transparent!important}';
  document.head.append(style);
  window.addEventListener('message',e=>{
   if(e.origin!==location.origin||e.source!==document.querySelector('#player iframe')?.contentWindow||
    e.data?.channel!=='archive-desktop-surface')return;
   const d=e.data;if(d.id!==activeId())return;
   if(d.kind==='error'){fail(d.error);return}
   if(d.kind!=='mask'||!Array.isArray(d.rects))return;
   const iframe=document.querySelector('#player iframe'),box=iframe.getBoundingClientRect();
   const sx=box.width/d.width,sy=box.height/d.height;
   if(!Number.isFinite(sx)||!Number.isFinite(sy))return;
   const rects=d.rects.map(([x,y,w,h])=>[box.left+x*sx,box.top+y*sy,w*sx,h*sy]);
   lastFrameView=d.view;
   if(rects.length)announce();
   emit('mask',{id:d.id,rects,width:innerWidth,height:innerHeight,view:d.view});
   saveView(d.view);
  });
  window.chrome?.webview?.addEventListener('message',e=>{
   const d=e.data;if(d?.session!==session||d.kind!=='command')return;
   if(d.command==='action'){
    const picker=document.getElementById('animationPicker');
    if(!Array.from(picker.options).some(o=>o.value===d.value))return;
    picker.value=d.value;picker.dispatchEvent(new Event('change',{bubbles:true}));
   }else if(['zoomIn','zoomOut','resetView','retryCharacter'].includes(d.command))document.getElementById(d.command)?.click();
   else if(d.command==='voice'){
    const box=document.getElementById('voiceEnabled');box.checked=!!d.enabled;box.dispatchEvent(new Event('change',{bubbles:true}));
   }
  });
 }
 window.ArchiveDesktopBridge=Object.freeze({afterRender,catalogReady,fail,
 capabilities:data=>{if(!child)emit('capabilities',{id:activeId(),...data})},
 inspect:()=>{
  const nested=!child&&document.querySelector('#player iframe')?.contentWindow?.ArchiveDesktopBridge?.inspect();
  return {id:activeId(),ready,failed,renderedFrames:nested?.renderedFrames??renderedFrames,view:nested?.view??frameView()};
 },loading:()=>{
  ready=false;viewRestored=false;failed=false;lastActions='';lastSample=-Infinity;lastFrameView=null;
  emit('mask',{id:activeId(),rects:[],width:innerWidth,height:innerHeight});
 }});
 window.addEventListener('pagehide',()=>emit('mask',{id:activeId(),rects:[],width:innerWidth,height:innerHeight}),{once:true});
})();
