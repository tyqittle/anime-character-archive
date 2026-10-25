'use strict';
// Theater shell: all toolbar and inspector DOM changes live behind this interface.
(function(root){
 const el=id=>document.getElementById(id);
 let interactionActions=[];
 const actionKind=item=>item.gesture==='drag'?'拖动动作':({head:'头部互动',body:'身体互动',special:'特殊互动'}[item.kind]||'其他互动');
 function renderInteractionActions(){
  const area=el('interactionActionList');if(!area)return;
  const query=(el('interactionActionSearch')?.value||'').toLowerCase().trim();
  const visible=interactionActions.filter(item=>(item.label+' '+item.key+' '+actionKind(item)).toLowerCase().includes(query));
  const buttons=visible.map(item=>{
   const button=document.createElement('button');button.type='button';button.dataset.motion=item.key;
   button.textContent=actionKind(item)+' · '+(item.label||item.key);
   button.title='播放一次后回待机 · 源动作：'+item.key;
   return button;
  });
  area.replaceChildren(...buttons);
  const count=el('interactionActionCount');if(count)count.textContent=interactionActions.length+' 个';
  const panel=el('interactionActionPanel');if(panel)panel.hidden=!interactionActions.length;
 }
 function setInteractionActions(actions=[],{dragSupported=false}={}){
  interactionActions=actions.filter(item=>typeof item.key==='string').sort((a,b)=>actionKind(a).localeCompare(actionKind(b),'zh-CN')||(a.label||a.key).localeCompare(b.label||b.key,undefined,{numeric:true}));
  if(el('interactionActionSearch'))el('interactionActionSearch').value='';
  if(el('interactionMode'))el('interactionMode').value='pan';
  if(el('interactionModeControls'))el('interactionModeControls').hidden=!dragSupported;
  renderInteractionActions();
 }
 function setZoom(zoom){el('zoomValue').textContent=Math.round(zoom*100)+'%'}
 function setAnimations(actions,{selected='',placeholder='选择角色后可切换动作'}={}){
  const picker=el('animationPicker');
  const list=actions.map(item=>typeof item==='string'?{value:item,label:item}:item);
  picker.replaceChildren(...(list.length?list.map(item=>new Option(item.label||item.value,item.value)):[new Option(placeholder,'')]));
  picker.disabled=!list.length;
  if(selected&&list.some(item=>item.value===selected))picker.value=selected;
 }
 function setToolsEnabled(ready){
  for(const id of ['zoomOut','zoomIn','resetView'])el(id).disabled=!ready;
  if(el('returnIdle'))el('returnIdle').disabled=!ready;
  if(!ready)setAnimations([]);
  if(!ready)setInteractionActions([]);
 }
 function setStatus(message,error=false){
  const node=el('status');
  node.textContent=message;node.classList.toggle('error',error);
  const loading=!error&&/正在|已找到经版本检测的本地缓存|检测到.*Spine 版本|已读取骨骼/.test(message)&&!message.startsWith('正在播放：');
  el('loadNotice').hidden=!loading;
  if(loading)el('loadNoticeText').textContent=message.replace(/\s+/g,' ').slice(0,120);
 }
 function bind(commands){
  let pageImmersion=false,immersive=false;
  function syncImmersion(){
   const active=!!document.fullscreenElement||pageImmersion;
   document.body.classList.toggle('theater-immersive',pageImmersion);
   const button=el('fullscreenStage');
   button.textContent=active?'⤢':'⛶';
   button.setAttribute('aria-label',active?'退出全屏':'全屏观看');
   const quick=el('stageQuickFullscreen');
   if(quick){quick.textContent=active?'退出沉浸':'⛶ 沉浸模式';quick.setAttribute('aria-pressed',String(active));quick.setAttribute('aria-label',active?'退出沉浸模式':'全屏欣赏')}
   if(active!==immersive){
    immersive=active;
    document.dispatchEvent(new CustomEvent('archive:immersivechange',{detail:{active}}));
   }
  }
  el('player').addEventListener('wheel',commands.wheel,{passive:false,capture:true});
  el('zoomIn').addEventListener('click',commands.zoomIn);
  el('zoomOut').addEventListener('click',commands.zoomOut);
  el('resetView').addEventListener('click',commands.reset);
  el('animationPicker').addEventListener('change',event=>commands.animation(event.target.value,{mode:el('motionLoop')?.checked?'loop':'once'}));
  el('motionLoop')?.addEventListener('change',()=>{const picker=el('animationPicker');if(picker.value&&!picker.disabled)commands.animation(picker.value,{mode:el('motionLoop').checked?'loop':'once'})});
  el('returnIdle')?.addEventListener('click',()=>commands.idle?.());
  el('interactionMode')?.addEventListener('change',event=>commands.interactionMode?.(event.target.value));
  el('interactionActionSearch')?.addEventListener('input',renderInteractionActions);
  el('interactionActionList')?.addEventListener('click',event=>{
   const button=event.target.closest('[data-motion]');
   if(button)commands.animation(button.dataset.motion,{mode:'once'});
  });
  el('retryCharacter').addEventListener('click',commands.retry);
  el('fullscreenStage').addEventListener('click',async()=>{
   if(document.fullscreenElement){await document.exitFullscreen();syncImmersion();return}
   if(pageImmersion){pageImmersion=false;syncImmersion();return}
   // Catalog and settings must belong to the same fullscreen top layer.
   const shell=el('stage').closest?.('.wrap')||el('stage');
   try{await shell.requestFullscreen()}
   catch(_error){pageImmersion=true}
   syncImmersion();
  });
  document.addEventListener('fullscreenchange',syncImmersion);
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&pageImmersion){pageImmersion=false;syncImmersion()}});
 }
 root.ArchiveTheaterUI=Object.freeze({
  bind,setZoom,setAnimations,setToolsEnabled,setStatus,setInteractionActions,
  setHeading(title,context){el('title').textContent=title;if(context!==undefined)el('stageContext').textContent=context},
  setContext(context){el('stageContext').textContent=context},
  heading(){return el('title').textContent},
  setInteractionHint(message){const node=el('interactionAvailability');if(node)node.textContent=message},
  selectAnimation(name){const picker=el('animationPicker');if(picker)picker.value=name},
  animationLabel(name){return Array.from(el('animationPicker').options).find(item=>item.value===name)?.text||name}
 });
})(window);
