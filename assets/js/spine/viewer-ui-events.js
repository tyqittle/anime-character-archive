'use strict';
// Commands are implemented by playback code; this adapter does not own player state.
window.ArchiveTheaterUI.bind({
 wheel:zoomViewerAtPointer,
 zoomIn:()=>adjustViewerZoom(1.2),
 zoomOut:()=>adjustViewerZoom(1/1.2),
 reset:resetViewerTransform,
 animation:chooseViewerAnimation,
 fullscreenError:error=>status('无法切换全屏：'+error.message,true),
 retry:()=>{
  const current=chosen();
  if(!current)return;
  if(azurlaneFrame)clearPlayer();
  playCharacter(current);
 }
});
