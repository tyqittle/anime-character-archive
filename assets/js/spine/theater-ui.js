'use strict';
// Theater shell: all toolbar and inspector DOM changes live behind this interface.
(function(root){
 const el=id=>document.getElementById(id);
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
  if(!ready)setAnimations([]);
 }
 function setStatus(message,error=false){
  const node=el('status');
  node.textContent=message;node.classList.toggle('error',error);
  const loading=!error&&/正在|已找到经版本检测的本地缓存|检测到.*Spine 版本|已读取骨骼/.test(message)&&!message.startsWith('正在播放：');
  el('loadNotice').hidden=!loading;
  if(loading)el('loadNoticeText').textContent=message.replace(/\s+/g,' ').slice(0,120);
 }
 function bind(commands){
  el('player').addEventListener('wheel',commands.wheel,{passive:false,capture:true});
  el('zoomIn').addEventListener('click',commands.zoomIn);
  el('zoomOut').addEventListener('click',commands.zoomOut);
  el('resetView').addEventListener('click',commands.reset);
  el('animationPicker').addEventListener('change',event=>commands.animation(event.target.value));
  el('retryCharacter').addEventListener('click',commands.retry);
  el('fullscreenStage').addEventListener('click',async()=>{
   try{if(document.fullscreenElement)await document.exitFullscreen();else await el('stage').requestFullscreen()}
   catch(error){commands.fullscreenError(error)}
  });
  document.addEventListener('fullscreenchange',()=>{
   const button=el('fullscreenStage'),active=!!document.fullscreenElement;
   button.textContent=active?'⤢':'⛶';
   button.setAttribute('aria-label',active?'退出全屏':'全屏观看');
  });
 }
 root.ArchiveTheaterUI=Object.freeze({
  bind,setZoom,setAnimations,setToolsEnabled,setStatus,
  setHeading(title,context){el('title').textContent=title;if(context!==undefined)el('stageContext').textContent=context},
  setContext(context){el('stageContext').textContent=context},
  heading(){return el('title').textContent},
  setInteractionHint(message){const node=el('interactionAvailability');if(node)node.textContent=message},
  selectAnimation(name){const picker=el('animationPicker');if(picker)picker.value=name},
  animationLabel(name){return Array.from(el('animationPicker').options).find(item=>item.value===name)?.text||name}
 });
})(window);
