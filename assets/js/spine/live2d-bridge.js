'use strict';
// Isolate Cubism from Spine. The iframe belongs to this same Pages origin,
// runs the source-pinned Cubism runtime and never navigates the outer page.
let frameBootstrapTimer=null;
function ensureAzurLaneFrame(){
 if(azurlaneFrame)return;
 clearPlayer();
 azurlaneFrame=document.createElement('iframe');
 azurlaneFrame.className='azurlane-live2d-frame';
 azurlaneFrame.title='Live2D · Cubism 模型画布';
 azurlaneFrame.src='./azurlane-stage.html?v=20261022-desktop-v2'+(new URLSearchParams(location.search).has('desktop')?'&desktop=1':'');
 azurlaneFrame.loading='eager';
 azurlaneFrame.setAttribute('allow','autoplay');
 $('player').replaceChildren(azurlaneFrame);
 clearTimeout(frameBootstrapTimer);
 const frame=azurlaneFrame;
 frameBootstrapTimer=setTimeout(()=>{if(azurlaneFrame===frame&&!azurlaneReady)status('Live2D 引擎加载超时，请点击重试加载。',true)},30000);
}
function presentAzurLanePreview(c){
 const playerNode=$('player');
 playerNode.querySelector('.azurlane-loading-cover')?.remove();
 const cover=document.createElement('div');
 cover.className='azurlane-loading-cover';
 cover.setAttribute('aria-hidden','true');
 if(c.preview&&(['upstream-ship-thumbnail','matching-live2d-animation-frame'].includes(c.previewSource))){
  const img=document.createElement('img');
  img.src=c.preview;
  img.alt='';
  img.decoding='async';
  cover.append(img);
 }
 const note=document.createElement('span');
 note.className='azurlane-loading-caption';
 note.textContent='正在载入 '+c.name+' 的动态模型…';
 cover.append(note);
 playerNode.append(cover);
}
function playAzurLane(c){
 if(azurlaneFrame&&azurlanePlayingId===c.id&&azurlanePending?.id===c.id)return;
 cancelCharacterDownload();
 ensureAzurLaneFrame();
 azurlanePending=c;azurlanePlayingId='';
 presentAzurLanePreview(c);
 $('title').textContent=c.name;
 $('stageContext').textContent=(c.gameId==='girlsfrontline'?'少女前线':c.gameId==='konosuba'?'为美好的世界献上祝福！':c.gameId==='touhoucannonball'?'东方炮弹':c.gameId==='girlscafegun'?'少女咖啡枪':c.gameId==='girldimension'?'少女次元':c.gameId==='sinsevendeadlysins'?'sin 七大罪':c.gameId==='tokyonecro'?'凍京NECRO':c.gameId==='maidslife'?'女仆生活S':'碧蓝航线')+' · Cubism Live2D';
 $('animationPicker').disabled=true;
 $('animationPicker').replaceChildren(new Option('正在加载角色动作…',''));
 setViewerToolsEnabled(false);
 viewZoom=1;viewOffsetX=0;viewOffsetY=0;
 $('zoomValue').textContent='100%';
 status('正在加载 '+c.name+' 的 Live2D 动态皮肤…');
 if(azurlaneReady){sendAzurLane('load',{id:c.id,skinCode:c.skinCode,modelUrl:c.modelUrl});if(typeof syncFrameVoice==='function')syncFrameVoice();}
}
window.addEventListener('message',event=>{
 if(event.origin!==location.origin||!azurlaneFrame||event.source!==azurlaneFrame.contentWindow)return;
 const data=event.data;
 if(data?.channel!==L2D_CHANNEL)return;
 if(data.kind==='ready'){
  clearTimeout(frameBootstrapTimer);azurlaneReady=true;
  if(typeof syncFrameVoice==='function')syncFrameVoice();
  if(azurlanePending)sendAzurLane('load',{id:azurlanePending.id,skinCode:azurlanePending.skinCode,modelUrl:azurlanePending.modelUrl});
  return;
 }
 if(data.kind==='error'&&(!data.id||data.id===azurlanePending?.id)){
  status('Live2D：'+data.error,true);return;
 }
 if(data.id!==azurlanePending?.id)return;
 if(data.kind==='playing'){
  $('player').querySelector('.azurlane-loading-cover')?.remove();
  azurlanePlayingId=data.id;
  updateGPUStatus(data.graphics||{backend:'WebGL 状态未知',renderer:'',software:false});
  setViewerToolsEnabled(true);
  const actions=Array.isArray(data.motions)?data.motions.filter(x=>typeof x==='string'):[];
  $('animationPicker').replaceChildren(...actions.map(x=>new Option(data.motionLabels?.[x]||x,x)));
  $('animationPicker').disabled=!actions.length;
  if(data.selectedMotion)$('animationPicker').value=data.selectedMotion;
  viewZoom=1;$('zoomValue').textContent='100%';
  status('正在播放：'+azurlanePending.name+' · Live2D'+(data.selectedMotion?' · '+(data.motionLabels?.[data.selectedMotion]||data.selectedMotion):'')+'（'+actions.length+' 组动作）'+(Number.isFinite(data.loadMs)&&data.loadMs>0?' · 加载 '+(data.loadMs/1000).toFixed(1)+' 秒':''));
 }
 if(data.kind==='performance'&&Number.isFinite(data.fps))updateGPUStatus(null,data.fps);
 if(data.kind==='zoom'&&Number.isFinite(data.zoom)){
  viewZoom=clampViewZoom(data.zoom);
  $('zoomValue').textContent=Math.round(viewZoom*100)+'%';
 }
 if(data.kind==='voice-error'&&typeof showVoiceMessage==='function')showVoiceMessage(data.error||'角色语音不可播放');
 if(data.kind==='voice-playing'&&typeof showVoiceMessage==='function')showVoiceMessage('互动语音播放中');
 if(data.kind==='motion'){
  const option=[...$('animationPicker').options].find(x=>x.value===data.name);
  status('正在播放：'+azurlanePending.name+' · Live2D · '+(option?.text||data.name));
 }
});


$('retryCharacter').addEventListener('click',()=>{
 const character=chosen();if(!character)return;
 if(azurlaneFrame){clearPlayer()}
 playCharacter(character);
});
