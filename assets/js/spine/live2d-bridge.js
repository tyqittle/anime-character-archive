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
 azurlaneFrame.src='./azurlane-stage.html?v=20261024-live2d-interactions-v10'+(new URLSearchParams(location.search).has('desktop')?'&desktop=1'+(new URLSearchParams(location.search).get('transport')==='webview2'?'&transport=webview2':''):'');
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
 window.ArchiveTheaterUI.setHeading(c.name);
 window.ArchiveTheaterUI.setContext((c.game||c.collectionName||(c.gameId==='girlsfrontline'?'少女前线':c.gameId==='konosuba'?'为美好的世界献上祝福！':c.gameId==='touhoucannonball'?'东方炮弹':c.gameId==='girlscafegun'?'少女咖啡枪':c.gameId==='girldimension'?'少女次元':c.gameId==='sinsevendeadlysins'?'sin 七大罪':c.gameId==='tokyonecro'?'凍京NECRO':c.gameId==='maidslife'?'女仆生活S':'碧蓝航线'))+' · Cubism Live2D');
 setViewerToolsEnabled(false);
 window.ArchiveTheaterUI.setAnimations([],{placeholder:'正在加载角色动作…'});
 viewZoom=1;viewOffsetX=0;viewOffsetY=0;
 window.ArchiveTheaterUI.setZoom(1);
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
 if(data.kind==='interaction-capability'){
  setInteractionAvailability(data.description||'模型暂无点击互动动作');return;
 }
 if(data.kind==='playing'){
  $('player').querySelector('.azurlane-loading-cover')?.remove();
  azurlanePlayingId=data.id;
  updateGPUStatus(data.graphics||{backend:'WebGL 状态未知',renderer:'',software:false});
  setViewerToolsEnabled(true);
  const actions=Array.isArray(data.motions)?data.motions.filter(x=>typeof x==='string'):[];
  window.ArchiveTheaterUI.setAnimations(actions.map(x=>({value:x,label:data.motionLabels?.[x]||x})),
   {selected:data.selectedMotion||'',placeholder:'模型没有预设动作'});
  viewZoom=clampViewZoom(Number.isFinite(data.zoom)?data.zoom:1);window.ArchiveTheaterUI.setZoom(viewZoom);
  status('正在播放：'+azurlanePending.name+' · Live2D'+(data.selectedMotion?' · '+(data.motionLabels?.[data.selectedMotion]||data.selectedMotion):'')+'（'+actions.length+' 组动作）'+(actions.length?'':' · 可缩放或拖动查看')+(Number.isFinite(data.loadMs)&&data.loadMs>0?' · 加载 '+(data.loadMs/1000).toFixed(1)+' 秒':''));
 }
 if(data.kind==='motion-error'){status('Live2D：'+data.error,true);return}
 if(data.kind==='performance'&&Number.isFinite(data.fps))updateGPUStatus(null,data.fps);
 if(data.kind==='zoom'&&Number.isFinite(data.zoom)){
  viewZoom=clampViewZoom(data.zoom);
  window.ArchiveTheaterUI.setZoom(viewZoom);
 }
 if(data.kind==='voice-error'&&typeof showVoiceMessage==='function')showVoiceMessage(data.error||'角色语音不可播放');
 if(data.kind==='voice-playing'&&typeof showVoiceMessage==='function')showVoiceMessage('互动语音播放中');
 if(data.kind==='motion'){
  const label=window.ArchiveTheaterUI.animationLabel(data.name);
  window.ArchiveTheaterUI.selectAnimation(data.name);
  status('正在播放：'+azurlanePending.name+' · Live2D · '+label);
 }
});

