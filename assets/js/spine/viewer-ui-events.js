'use strict';
// UI event bindings only. Rendering and playback implementations remain in viewer-controls.js.
// Handle native wheel events on the persistent stage (not per-character
// canvases). Zoom directly without requiring a Ctrl or Meta modifier.
$('player').addEventListener('wheel',e=>{
 if(!player?.canvas||!Number.isFinite(e.deltaY)||e.deltaY===0)return;
 e.preventDefault();
 e.stopPropagation();
 const dy=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?$('player').clientHeight:1);
 player._archiveFitPending=0;
 const oldZoom=viewZoom;
 const nextZoom=clampViewZoom(oldZoom*Math.exp(-dy*0.0015));
 if(nextZoom===oldZoom)return;
 // Zoom about the pointer, rather than pulling the character offscreen.
 const bounds=$('player').getBoundingClientRect();
 const x=e.clientX-(bounds.left+bounds.width/2);
 const y=e.clientY-(bounds.top+bounds.height/2);
 const ratio=nextZoom/oldZoom;
 viewOffsetX=x-(x-viewOffsetX)*ratio;
 viewOffsetY=y-(y-viewOffsetY)*ratio;
 viewZoom=nextZoom;
 syncViewTransform();
},{passive:false,capture:true});
$('zoomIn').addEventListener('click',()=>adjustViewerZoom(1.2));
$('zoomOut').addEventListener('click',()=>adjustViewerZoom(1/1.2));
$('resetView').addEventListener('click',resetViewerTransform);
$('animationPicker').addEventListener('change',e=>{
 if(azurlaneFrame&&e.target.value){sendAzurLane('motion',{motion:e.target.value});return}
 if(!player||!e.target.value)return;
 try{player.setAnimation(e.target.value,true);player.play();status('正在播放：'+$('title').textContent+' · '+e.target.value)}
 catch(err){status('动作切换失败：'+err.message,true)}
});
$('fullscreenStage').addEventListener('click',async()=>{
 try{if(document.fullscreenElement)await document.exitFullscreen();else await $('stage').requestFullscreen()}
 catch(err){status('无法切换全屏：'+err.message,true)}
});
document.addEventListener('fullscreenchange',()=>{
 $('fullscreenStage').textContent=document.fullscreenElement?'⤢':'⛶';
 $('fullscreenStage').setAttribute('aria-label',document.fullscreenElement?'退出全屏':'全屏观看');
});
