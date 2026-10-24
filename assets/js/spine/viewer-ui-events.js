'use strict';
// UI adapter: translates DOM events into viewer commands; does not own playback state.
$('player').addEventListener('wheel',zoomViewerAtPointer,{passive:false,capture:true});
$('zoomIn').addEventListener('click',()=>adjustViewerZoom(1.2));
$('zoomOut').addEventListener('click',()=>adjustViewerZoom(1/1.2));
$('resetView').addEventListener('click',resetViewerTransform);
$('animationPicker').addEventListener('change',e=>chooseViewerAnimation(e.target.value));
$('fullscreenStage').addEventListener('click',async()=>{
 try{if(document.fullscreenElement)await document.exitFullscreen();else await $('stage').requestFullscreen()}
 catch(err){status('无法切换全屏：'+err.message,true)}
});
document.addEventListener('fullscreenchange',()=>{
 $('fullscreenStage').textContent=document.fullscreenElement?'⤢':'⛶';
 $('fullscreenStage').setAttribute('aria-label',document.fullscreenElement?'退出全屏':'全屏观看');
});
