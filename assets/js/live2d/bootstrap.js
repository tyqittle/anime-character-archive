'use strict';
window.addEventListener('message',event=>{
 if(event.origin!==SAME_ORIGIN||event.source!==window.parent)return;
 const d=event.data;
 if(d?.channel!==CHANNEL)return;
 if(d.kind==='load')requestLoad(d.skinCode,d.id,d.modelUrl);
 else if(d.kind==='motion')motion(d.motion);
 else if(d.kind==='zoom')setZoom(Number(d.zoom)||1);
 else if(d.kind==='reset'){zoom=1;offsetX=0;offsetY=0;fit();notify('zoom',{zoom})}
});
window.addEventListener('resize',()=>{if(model)fit()});
let drag=false,last={x:0,y:0};
document.getElementById('live2dCanvas').addEventListener('wheel',e=>{if(!model)return;e.preventDefault();setZoom(zoom*Math.exp(-e.deltaY*.0015))},{passive:false});
document.getElementById('live2dCanvas').addEventListener('pointerdown',e=>{if(e.button===1){drag=true;last={x:e.clientX,y:e.clientY}}});
document.addEventListener('pointermove',e=>{if(drag&&model){offsetX+=e.clientX-last.x;offsetY+=e.clientY-last.y;last={x:e.clientX,y:e.clientY};model.x+=e.movementX;model.y+=e.movementY}});
document.addEventListener('pointerup',()=>drag=false);
try{
 if(!window.PIXI?.Application||!PIXI.live2d?.Live2DModel)throw Error('第三方 PixiJS/Cubism 播放库未能初始化，请检查网络或扩展拦截');
 app=new PIXI.Application({view:document.getElementById('live2dCanvas'),autoStart:true,resizeTo:window,backgroundAlpha:0,antialias:false,resolution:1});
 // Reduce WebGL fill-rate and avoid struggling to hit 60 fps on large models.
 if(app.ticker){app.ticker.maxFPS=targetFPS;app.ticker.stop()}
 if(PIXI.Ticker?.shared)PIXI.Ticker.shared.maxFPS=targetFPS;
 document.addEventListener('visibilitychange',()=>{if(!app?.ticker)return;if(document.hidden)app.ticker.stop();else app.ticker.start()});

 message('Live2D 播放器已准备，正在等待选择角色…');
 notify('ready');
}catch(e){initError=e.message;message('Live2D 初始化失败：'+initError);notify('error',{error:initError})}
